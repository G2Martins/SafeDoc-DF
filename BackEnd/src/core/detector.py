from __future__ import annotations
import re
import unicodedata
import pandas as pd
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple, Callable

# Importações da nova estrutura do projeto
from ..models.validators import (
    validar_cpf, 
    validar_cnpj, 
    validar_telefone_br, 
    apenas_digitos
)
from .config import DEFAULT_POLITICA, PoliticaRisco

# --- Tipos e Constantes ---

ValidatorFn = Callable[["re.Match[str]"], Tuple[bool, str, str]]

@dataclass(frozen=True)
class Regra:
    nome: str
    padrao: re.Pattern
    tipo: str  # 'hard' (identificadores fortes) ou 'soft' (contextuais)
    peso: int
    validator: Optional[ValidatorFn] = None

@dataclass
class MatchInfo:
    regra: str
    start: int
    end: int
    raw: str
    norm: Optional[str]
    ok: bool
    motivo: Optional[str]
    peso_aplicado: int

# Palavras que, se próximas a um dado 'soft', aumentam o risco
PALAVRAS_CHAVE = [
    "cpf", "cnpj", "rg", "telefone", "celular", "contato", 
    "whatsapp", "email", "e-mail", "endereço", "rua", "cep", 
    "bairro", "nascimento", "data", "placa", "veículo", 
    "processo", "matricula", "servidor", "paciente", "aluno"
]

# --- Funções Auxiliares de Normalização ---

def _comp(p: str) -> re.Pattern:
    """Compila regex ignorando case."""
    return re.compile(p, flags=re.IGNORECASE)

def normalizar_raw(texto: Any) -> str:
    """Converte entrada para string limpa, preservando acentos/case original."""
    if texto is None:
        return ""
    s = str(texto).replace("\u00a0", " ")  # Remove non-breaking spaces
    return re.sub(r"\s+", " ", s).strip()

def normalizar_busca(texto: Any) -> str:
    """Normaliza para busca: sem acentos, lowercase."""
    s = normalizar_raw(texto)
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", s).strip().casefold()

# --- Definição das Regras ---

REGRAS: List[Regra] = [
    # CPF: Valida dígito verificador
    Regra(
        nome="cpf", 
        padrao=_comp(r"\b(?:\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11})\b"), 
        tipo="hard", 
        peso=DEFAULT_POLITICA.score_sensivel_estrito, 
        validator=lambda m: (validar_cpf(m.group(0)), apenas_digitos(m.group(0)), "cpf_invalido")
    ),
    # CNPJ: Valida dígito verificador
    Regra(
        nome="cnpj", 
        padrao=_comp(r"\b(?:\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}|\d{14})\b"), 
        tipo="hard", 
        peso=DEFAULT_POLITICA.score_sensivel_estrito,
        validator=lambda m: (validar_cnpj(m.group(0)), apenas_digitos(m.group(0)), "cnpj_invalido")
    ),
    # E-mail: Regex padrão
    Regra(
        nome="email", 
        padrao=_comp(r"\b[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\b"), 
        tipo="hard", 
        peso=5
    ),
    # Processo SEI/CNJ (Padrões comuns de órgãos públicos)
    Regra(
        nome="processo_cnj", 
        padrao=_comp(r"\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b"), 
        tipo="hard", 
        peso=5
    ),
    Regra(
        nome="processo_sei", 
        padrao=_comp(r"\b\d{5}\.\d{6}/\d{4}-\d{2}\b"), 
        tipo="hard", 
        peso=4
    ),
    # Telefone: Valida DDD e formato
    Regra(
        nome="telefone", 
        padrao=_comp(r"\b(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9?\d{4})[\s-]?\d{4}\b"), 
        tipo="hard", 
        peso=4,
        validator=lambda m: validar_telefone_br(m.group(0))
    ),
    # CEP
    Regra(
        nome="cep", 
        padrao=_comp(r"\b\d{5}-?\d{3}\b"), 
        tipo="soft", 
        peso=3
    ),
    # Placa de Veículo (Mercosul ou antiga)
    Regra(
        nome="placa_veiculo", 
        padrao=_comp(r"\b[A-Z]{3}\d[A-Z0-9]\d{2}\b"), 
        tipo="soft", 
        peso=2
    ),
    # Data (Pode gerar muitos falsos positivos, por isso peso baixo e tipo soft)
    Regra(
        nome="data", 
        padrao=_comp(r"\b(0?[1-9]|[12]\d|3[01])[\/\-](0?[1-9]|1[0-2])[\/\-](19|20)\d{2}\b"), 
        tipo="soft", 
        peso=1
    ),
]

# --- Lógica Core de Detecção ---

def _verificar_overlap(matches: List[MatchInfo]) -> List[MatchInfo]:
    """
    Remove matches que estão contidos dentro de outros matches maiores.
    Ex: Evita detectar um CPF dentro de um número de telefone mal formatado.
    Prioriza o match mais longo ou com maior peso.
    """
    if not matches:
        return []

    # Ordena por posição inicial e depois pelo tamanho (decrescente)
    matches_sorted = sorted(matches, key=lambda x: (x.start, -(x.end - x.start)))
    
    final_matches = []
    if not matches_sorted:
        return []
        
    current = matches_sorted[0]
    
    for next_match in matches_sorted[1:]:
        # Se o próximo começa depois que o atual termina, não há overlap
        if next_match.start >= current.end:
            final_matches.append(current)
            current = next_match
        else:
            # Há overlap. Escolhemos o que tem maior peso ou maior comprimento
            if next_match.peso_aplicado > current.peso_aplicado:
                current = next_match
            # Se pesos iguais, mantém o mais longo (current já é o mais longo pela ordenação)
            
    final_matches.append(current)
    return final_matches

def _extrair_contexto(texto_completo: str, start: int, end: int, window: int = 50) -> str:
    """Extrai texto ao redor do match para ajudar na decisão humana."""
    s = max(0, start - window)
    e = min(len(texto_completo), end + window)
    return texto_completo[s:e]

def _calcular_risco_contextual(texto_norm: str, start: int, end: int, window: int = 100) -> bool:
    """Verifica se há palavras-chave de risco próximas ao match."""
    s = max(0, start - window)
    e = min(len(texto_norm), end + window)
    fragmento = texto_norm[s:e]
    
    for kw in PALAVRAS_CHAVE:
        if kw in fragmento:
            return True
    return False

def _decidir_acao(score_total: int, politica: PoliticaRisco) -> str:
    """Decide a ação final baseada no score acumulado e na política."""
    if score_total >= politica.score_bloquear:
        return "BLOQUEAR"
    elif score_total >= politica.score_revisar:
        return "REVISAR"
    else:
        return "PUBLICAR"

def analisar_texto(texto: Any, politica: PoliticaRisco = DEFAULT_POLITICA) -> Dict[str, Any]:
    """
    Função principal que analisa um único texto e retorna os achados.
    """
    raw_text = normalizar_raw(texto)
    # Normalização para busca de palavras-chave (contexto)
    search_text = normalizar_busca(raw_text) 
    
    if not raw_text:
        return {
            "status": "PUBLICAR",
            "score": 0,
            "matches": [],
            "texto_anonimizado": ""
        }

    matches_encontrados: List[MatchInfo] = []

    # 1. Varredura de Regras
    for regra in REGRAS:
        for m in regra.padrao.finditer(raw_text):
            valido = True
            norm_val = m.group(0)
            motivo = None

            # Executa validador específico se houver
            if regra.validator:
                valido, norm_val, motivo = regra.validator(m)
            
            # Se a validação matemática falhar (ex: CPF com dígito errado), ignoramos o match
            if not valido:
                continue

            # Cálculo de Peso com Contexto para regras 'soft'
            peso_final = regra.peso
            has_contexto = False
            
            if regra.tipo == 'soft':
                # Regras soft precisam de contexto para ter peso relevante
                if _calcular_risco_contextual(search_text, m.start(), m.end()):
                    peso_final += 2 # Boost por contexto
                    has_contexto = True
                else:
                    peso_final = 1 # Peso mínimo se isolado
            
            matches_encontrados.append(MatchInfo(
                regra=regra.nome,
                start=m.start(),
                end=m.end(),
                raw=m.group(0),
                norm=norm_val,
                ok=valido,
                motivo=motivo if not valido else ("contexto_encontrado" if has_contexto else "padrao_direto"),
                peso_aplicado=peso_final
            ))

    # 2. Resolução de Conflitos (Overlap)
    matches_limpos = _verificar_overlap(matches_encontrados)

    # 3. Consolidação e Cálculo de Score
    score_total = sum(m.peso_aplicado for m in matches_limpos)
    detalhes_matches = []
    
    # Criar texto anonimizado (máscara simples)
    texto_anonimizado = list(raw_text)
    
    for m in matches_limpos:
        # Mascarar no texto
        for i in range(m.start, m.end):
            texto_anonimizado[i] = '*'
            
        detalhes_matches.append({
            "tipo": m.regra,
            "valor_detectado": m.raw,
            "contexto": _extrair_contexto(raw_text, m.start, m.end),
            "score": m.peso_aplicado
        })

    return {
        "status": _decidir_acao(score_total, politica),
        "score": score_total,
        "total_matches": len(matches_limpos),
        "matches": detalhes_matches,
        "texto_anonimizado": "".join(texto_anonimizado)
    }

def analisar_dataframe(df: pd.DataFrame, col_texto: str) -> List[Dict[str, Any]]:
    """
    Processa um DataFrame pandas inteiro.
    Retorna uma lista de dicionários com os resultados.
    """
    resultados = []
    
    # Garante que não haja NaNs na coluna
    df[col_texto] = df[col_texto].fillna("")
    
    for idx, row in df.iterrows():
        texto = row[col_texto]
        analise = analisar_texto(texto)
        
        # Adiciona ID da linha se houver, para rastreabilidade
        res = {
            "index": idx,
            "texto_original_preview": str(texto)[:50] + "...",
            **analise
        }
        resultados.append(res)
        
    return resultados