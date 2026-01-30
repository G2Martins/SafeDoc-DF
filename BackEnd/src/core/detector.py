from __future__ import annotations

import re
import unicodedata
import pandas as pd
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple, Callable

# Importações da estrutura do projeto
from ..models.validators import (
    validar_cpf,
    validar_cnpj,
    validar_telefone_br,  # pode retornar bool ou tuple; vamos adaptar
    apenas_digitos,
)
from .config import DEFAULT_POLITICA, PoliticaRisco

# =========================
# Tipos
# =========================

ValidatorFn = Callable[["re.Match[str]", str, str], Tuple[bool, Optional[str], Optional[str]]]
# assinatura: (match, raw_text, search_text_norm) -> (ok, norm, motivo)


@dataclass(frozen=True)
class Regra:
    nome: str
    padrao: re.Pattern
    tipo: str  # 'hard' ou 'soft'
    peso: int
    prioridade: int  # menor = mais prioritário no overlap
    validator: Optional[ValidatorFn] = None
    # parâmetros extras p/ soft (evitar FP e cobrir matrículas/inscrições)
    peso_min_sem_contexto: int = 1        # se 0, ignora sem contexto
    boost_contexto: int = 2               # quanto soma quando tem contexto
    min_len: int = 0                      # tamanho mínimo do match (raw)
    exige_contexto: bool = False          # se True, sem contexto ignora


@dataclass
class MatchInfo:
    regra: str
    prioridade: int
    start: int
    end: int
    raw: str
    norm: Optional[str]
    ok: bool
    motivo: Optional[str]
    peso_aplicado: int


# =========================
# Normalização
# =========================

def _comp(p: str) -> re.Pattern:
    return re.compile(p, flags=re.IGNORECASE | re.UNICODE)


def normalizar_raw(texto: Any) -> str:
    if texto is None:
        return ""
    s = str(texto).replace("\u00a0", " ")
    return re.sub(r"\s+", " ", s).strip()


def normalizar_busca(texto: Any) -> str:
    s = normalizar_raw(texto)
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"\s+", " ", s).strip().casefold()
    return s


# =========================
# Contexto (keywords)
# =========================

PALAVRAS_CHAVE_RISCO = [
    # identificadores
    "cpf", "cnpj", "rg", "identidade", "pis", "pasep", "nis", "nit", "cns", "sus", "cnh",
    "passaporte", "titulo de eleitor", "título de eleitor", "ctps", "oab",
    # contato
    "telefone", "celular", "contato", "whatsapp", "wpp", "zap", "email", "e-mail",
    # endereço
    "endereco", "endereço", "rua", "avenida", "av", "travessa", "bairro", "cep", "logradouro",
    "numero", "número", "complemento", "quadra", "lote", "setor",
    # dados pessoais
    "nascimento", "data de nascimento", "nasc", "dn", "filiação", "filiacao", "mae", "mãe", "pai",
    # governo / processos / cadastros
    "processo", "sei", "cnj", "protocolo", "autos", "matricula", "matrícula", "siape",
    "inscricao", "inscrição", "inscricao imobiliaria", "inscrição imobiliária",
    "inscricao municipal", "inscrição municipal", "inscricao estadual", "inscrição estadual",
    "numero interno", "número interno", "autuacao", "autuação", "auto de infracao", "auto de infração",
    "nota fiscal", "nf", "empenho", "cda", "nire", "registro", "ri", "registro de imoveis", "registro de imóveis",
    # educação/servidor
    "paciente", "aluno", "servidor",
    # sua observação
    "ppg",
]

# termos que costumam causar falsos positivos para TELEFONE / CEP / etc.
PALAVRAS_NEGATIVAS_TELEFONE = [
    "nire", "protocolo", "processo", "sei", "cnj", "matricula", "matrícula",
    "cda", "empenho", "nota fiscal", "nf", "id", "inscricao", "inscrição",
]

PALAVRAS_ENDERECO = [
    "endereco", "endereço", "rua", "avenida", "av", "travessa",
    "bairro", "cep", "logradouro", "quadra", "lote", "setor", "residencia", "residência",
]

# gatilhos para nome (evita FP em “parte representada”, títulos, etc.)
GATILHOS_NOME = [
    "nome:", "nome do requerente:", "requerente:", "interessado:", "interessada:",
    "servidor:", "servidora:", "paciente:", "aluno:", "aluna:", "responsavel:", "responsável:",
    "representante:", "advogado:", "advogada:",
]

# palavras que indicam entidade/órgão (evita marcar como "nome completo")
KW_ORGAO_ENTIDADE = [
    "secretaria", "ministerio", "ministério", "governo", "prefeitura", "camara", "câmara",
    "tribunal", "universidade", "instituto", "fundacao", "fundação", "departamento",
    "coordenacao", "coordenação", "diretoria", "superintendencia", "superintendência",
]

# “stop-phrases” que estavam virando “nome_completo”
STOP_PHRASES_NOME = [
    "parte representada",
    "parte requerente",
    "parte interessada",
    "nome do requerente",
    "nome da parte",
    "nome do interessado",
    "nome do servidor",
    "dados do requerente",
    "dados do interessado",
]

# keywords positivas específicas por tipo de ID (para reduzir confusão CPF->matrícula etc.)
KW_MATRICULA = ["matricula", "matrícula", "registro", "ri", "registro de imoveis", "registro de imóveis", "inscricao imobiliaria", "inscrição imobiliária"]
KW_INSCRICAO = ["inscricao", "inscrição", "inscricao municipal", "inscrição municipal", "inscricao estadual", "inscrição estadual", "ppg"]
KW_SIAPE = ["siape", "servidor", "matricula siape", "matrícula siape"]
KW_NIS_PIS = ["nis", "pis", "pasep", "nit"]
KW_CNH = ["cnh", "carteira nacional de habilitacao", "carteira nacional de habilitação"]
KW_TITULO = ["titulo de eleitor", "título de eleitor"]


def _fragmento(texto_norm: str, start: int, end: int, window: int = 80) -> str:
    s = max(0, start - window)
    e = min(len(texto_norm), end + window)
    return texto_norm[s:e]


def _tem_kw(texto_norm: str, start: int, end: int, kws: List[str], window: int = 80) -> bool:
    frag = _fragmento(texto_norm, start, end, window=window)
    return any(kw in frag for kw in kws)


def _tem_gatilho_nome(texto_norm: str, start: int, window: int = 120) -> bool:
    s = max(0, start - window)
    frag = texto_norm[s:start]
    return any(g in frag for g in GATILHOS_NOME)


def _tem_stopphrase_nome(texto_norm: str, start: int, end: int, window: int = 80) -> bool:
    frag = _fragmento(texto_norm, start, end, window=window)
    return any(sp in frag for sp in STOP_PHRASES_NOME)


# =========================
# Validadores (robustos)
# =========================

def _validator_cpf(m: "re.Match[str]", raw_text: str, search_text: str) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    CPF:
    - valida DV quando possível
    - fallback: se DV falhar, mas houver contexto "cpf" perto, aceita como suspeito (para aumentar recall)
    """
    v = m.group(0)
    dig = apenas_digitos(v)

    if len(dig) != 11:
        return (False, None, "cpf_tamanho_invalido")

    if validar_cpf(v):
        return (True, dig, None)

    # fallback contextual (bases reais têm ruído)
    if _tem_kw(search_text, m.start(), m.end(), ["cpf"], window=80):
        return (True, dig, "cpf_suspeito_dv")

    return (False, None, "cpf_invalido")


def _validator_cnpj(m: "re.Match[str]", raw_text: str, search_text: str) -> Tuple[bool, Optional[str], Optional[str]]:
    v = m.group(0)
    dig = apenas_digitos(v)

    if len(dig) != 14:
        return (False, None, "cnpj_tamanho_invalido")

    if validar_cnpj(v):
        return (True, dig, None)

    if _tem_kw(search_text, m.start(), m.end(), ["cnpj"], window=80):
        return (True, dig, "cnpj_suspeito_dv")

    return (False, None, "cnpj_invalido")


def _validator_telefone_strito(m: "re.Match[str]", raw_text: str, search_text: str) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Telefone BR com redução agressiva de falso positivo:
    - exige DDD presente (10 ou 11 dígitos com DDD)
    - rejeita se contexto negativo (nire/protocolo/processo/etc.)
    - valida com validar_telefone_br quando possível
    """
    raw = m.group(0)
    dig = apenas_digitos(raw)

    if _tem_kw(search_text, m.start(), m.end(), PALAVRAS_NEGATIVAS_TELEFONE, window=60):
        return (False, None, "telefone_contexto_negativo")

    if dig.startswith("55") and len(dig) in (12, 13):
        dig = dig[2:]

    if len(dig) not in (10, 11):
        return (False, None, "telefone_tamanho_invalido")

    ddd = dig[:2]
    if not (ddd.isdigit() and 11 <= int(ddd) <= 99):
        return (False, None, "telefone_ddd_invalido")

    if len(dig) == 11 and dig[2] != "9":
        return (False, None, "telefone_celular_sem_9")

    try:
        v = validar_telefone_br(raw)
        if isinstance(v, tuple) and len(v) >= 1:
            ok = bool(v[0])
            norm = v[1] if len(v) > 1 else dig
            motivo = v[2] if len(v) > 2 else (None if ok else "telefone_invalido")
            return (ok, norm if ok else None, motivo)
        else:
            ok = bool(v)
            return (ok, dig if ok else None, None if ok else "telefone_invalido")
    except Exception:
        return (True, dig, "telefone_validacao_fallback")


def _validator_cep_contextual(m: "re.Match[str]", raw_text: str, search_text: str) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    CEP: só aceita com contexto de endereço.
    """
    raw = m.group(0)
    dig = apenas_digitos(raw)
    if len(dig) != 8:
        return (False, None, "cep_tamanho_invalido")

    if not _tem_kw(search_text, m.start(), m.end(), PALAVRAS_ENDERECO, window=90):
        return (False, None, "cep_sem_contexto_endereco")

    return (True, dig, None)


def _validator_email_tld_suspeito(m: "re.Match[str]", raw_text: str, search_text: str) -> Tuple[bool, Optional[str], Optional[str]]:
    raw = m.group(0)
    lower = raw.casefold()

    parts = lower.rsplit(".", 1)
    if len(parts) == 2:
        tld = parts[1]
        if not re.fullmatch(r"[a-z]{2,24}", tld):
            return (True, lower, "email_tld_suspeito")

        if lower.endswith((".com.br", ".gov.br", ".org.br", ".net.br", ".edu.br")):
            return (True, lower, None)

        comuns = {"com", "org", "net", "edu", "gov", "br"}
        if tld not in comuns:
            return (True, lower, "email_tld_incomum")

    return (True, lower, None)


def _validator_data_contextual(m: "re.Match[str]", raw_text: str, search_text: str) -> Tuple[bool, Optional[str], Optional[str]]:
    return (True, m.group(0), None)


def _validator_id_contextual_factory(kws_obrigatorias: List[str], motivo_sem_ctx: str) -> ValidatorFn:
    """
    Cria validador para IDs que só devem ser aceitos quando houver palavras-chave *do próprio tipo* no entorno.
    Isso reduz o problema de:
      - CPF ser capturado como matrícula
      - número de processo virar RG
      - “inscrição” pegar qualquer número longo
    """
    def _v(m: "re.Match[str]", raw_text: str, search_text: str) -> Tuple[bool, Optional[str], Optional[str]]:
        raw = m.group(0).strip()
        norm = re.sub(r"[^\w]+", "", raw, flags=re.UNICODE).replace("_", "")

        if len(norm) < 4:
            return (False, None, "id_curto")

        if re.fullmatch(r"(19|20)\d{2}", norm):
            return (False, None, "ano_isolado")

        # exige keywords específicas do tipo
        if not _tem_kw(search_text, m.start(), m.end(), kws_obrigatorias, window=140):
            return (False, None, motivo_sem_ctx)

        return (True, norm, None)

    return _v


def _validator_nome_contextual(m: "re.Match[str]", raw_text: str, search_text: str) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Nome completo:
    - só aceita se tiver gatilho explícito antes
    - rejeita stop-phrases (ex.: “parte representada”)
    - rejeita se houver contexto de órgão/entidade no entorno
    """
    raw = m.group(0).strip()

    if not _tem_gatilho_nome(search_text, m.start(), window=140):
        return (False, None, "nome_sem_gatilho")

    if _tem_stopphrase_nome(search_text, m.start(), m.end(), window=90):
        return (False, None, "nome_stopphrase")

    if _tem_kw(search_text, m.start(), m.end(), KW_ORGAO_ENTIDADE, window=90):
        return (False, None, "nome_contexto_orgao")

    # exige pelo menos 2 palavras “de verdade”
    if len(raw.split()) < 2:
        return (False, None, "nome_curto")

    return (True, raw, None)


# =========================
# Regras (prioridades e padrões)
# =========================
# Prioridade (menor = ganha no overlap):
# 1 CPF/CNPJ/EMAIL
# 2 TELEFONE
# 3 PROCESSOS
# 4 OUTROS (CEP/PLACA/DATA/RG/IDS/NOME...)

REGRAS: List[Regra] = [
    # --- HARD ---
    Regra(
        nome="cpf",
        padrao=_comp(r"\b(?:\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11})\b"),
        tipo="hard",
        peso=DEFAULT_POLITICA.score_sensivel_estrito,
        prioridade=1,
        validator=_validator_cpf,
        min_len=11,
    ),
    Regra(
        nome="cnpj",
        padrao=_comp(r"\b(?:\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}|\d{14})\b"),
        tipo="hard",
        peso=DEFAULT_POLITICA.score_sensivel_estrito,
        prioridade=1,
        validator=_validator_cnpj,
        min_len=14,
    ),
    Regra(
        nome="email",
        padrao=_comp(r"\b[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+\b"),
        tipo="hard",
        peso=5,
        prioridade=1,
        validator=_validator_email_tld_suspeito,
        min_len=6,
    ),

    # --- PROCESSOS ---
    Regra(
        nome="processo_cnj",
        padrao=_comp(r"\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b"),
        tipo="hard",
        peso=5,
        prioridade=3,
    ),
    Regra(
        nome="processo_sei",
        padrao=_comp(r"\b\d{5}\.\d{6}/\d{4}-\d{2}\b"),
        tipo="hard",
        peso=4,
        prioridade=3,
    ),
    Regra(
        nome="processo_sei_generico",
        padrao=_comp(r"\b\d{4,6}-\d{6,8}/\d{4}-\d{2}\b"),
        tipo="hard",
        peso=4,
        prioridade=3,
    ),

    # --- TELEFONE ---
    Regra(
        nome="telefone",
        padrao=_comp(r"\b(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9?\d{4})[\s-]?\d{4}\b"),
        tipo="hard",
        peso=4,
        prioridade=2,
        validator=_validator_telefone_strito,
        min_len=8,
    ),

    # --- ENDEREÇO / SOFT ---
    Regra(
        nome="cep",
        padrao=_comp(r"\b\d{5}-?\d{3}\b(?!/\d{4}-\d{2})"),
        tipo="soft",
        peso=3,
        prioridade=4,
        validator=_validator_cep_contextual,
        min_len=8,
        exige_contexto=True,
        peso_min_sem_contexto=0,
        boost_contexto=0,
    ),
    Regra(
        nome="placa_veiculo",
        padrao=_comp(r"\b[A-Z]{3}\d[A-Z0-9]\d{2}\b"),
        tipo="soft",
        peso=2,
        prioridade=4,
        min_len=7,
        peso_min_sem_contexto=1,
        boost_contexto=1,
    ),
    Regra(
        nome="data",
        padrao=_comp(r"\b(0?[1-9]|[12]\d|3[01])[\/\-](0?[1-9]|1[0-2])[\/\-](19|20)\d{2}\b"),
        tipo="soft",
        peso=1,
        prioridade=4,
        validator=_validator_data_contextual,
        min_len=8,
        peso_min_sem_contexto=1,
        boost_contexto=2,
    ),
    Regra(
        nome="rg",
        # mantido soft, MAS exige contexto forte agora (keywords do próprio RG)
        padrao=_comp(r"\b(?:\d{1,2}\.?\d{3}\.?\d{3}-?\d|[1-9]\d{6,8}-?\d)\b"),
        tipo="soft",
        peso=2,
        prioridade=4,
        validator=_validator_id_contextual_factory(["rg", "identidade", "ssP", "orgao expedidor", "órgão expedidor"], "rg_sem_contexto"),
        min_len=7,
        exige_contexto=True,
        peso_min_sem_contexto=0,
        boost_contexto=0,
    ),

    # =========================
    # Matrículas / Inscrições / IDs (agora com contexto ESPECÍFICO)
    # =========================

    Regra(
        nome="matricula",
        padrao=_comp(r"\b\d{1,3}(?:\.\d{3}){1,3}-?\d{1,2}[A-Z]?\b|\b\d{6,10}[A-Z]?\b"),
        tipo="soft",
        peso=3,
        prioridade=4,
        validator=_validator_id_contextual_factory(KW_MATRICULA, "matricula_sem_contexto"),
        min_len=6,
        exige_contexto=True,
        peso_min_sem_contexto=0,
        boost_contexto=0,
    ),
    Regra(
        nome="inscricao",
        padrao=_comp(r"\b\d{4,10}-\d\b|\b\d{6,12}\b"),
        tipo="soft",
        peso=3,
        prioridade=4,
        validator=_validator_id_contextual_factory(KW_INSCRICAO, "inscricao_sem_contexto"),
        min_len=6,
        exige_contexto=True,
        peso_min_sem_contexto=0,
        boost_contexto=0,
    ),
    Regra(
        nome="siape",
        padrao=_comp(r"\b\d{7,8}\b"),
        tipo="soft",
        peso=3,
        prioridade=4,
        validator=_validator_id_contextual_factory(KW_SIAPE, "siape_sem_contexto"),
        min_len=7,
        exige_contexto=True,
        peso_min_sem_contexto=0,
        boost_contexto=0,
    ),
    Regra(
        nome="nis_pis_pasep",
        padrao=_comp(r"\b\d{11}\b"),
        tipo="soft",
        peso=3,
        prioridade=4,
        validator=_validator_id_contextual_factory(KW_NIS_PIS, "nis_pis_sem_contexto"),
        min_len=11,
        exige_contexto=True,
        peso_min_sem_contexto=0,
        boost_contexto=0,
    ),
    Regra(
        nome="cnh_numero",
        padrao=_comp(r"\b\d{9,11}\b"),
        tipo="soft",
        peso=2,
        prioridade=4,
        validator=_validator_id_contextual_factory(KW_CNH, "cnh_sem_contexto"),
        min_len=9,
        exige_contexto=True,
        peso_min_sem_contexto=0,
        boost_contexto=0,
    ),
    Regra(
        nome="titulo_eleitor_numero",
        padrao=_comp(r"\b\d{12}\b"),
        tipo="soft",
        peso=2,
        prioridade=4,
        validator=_validator_id_contextual_factory(KW_TITULO, "titulo_sem_contexto"),
        min_len=12,
        exige_contexto=True,
        peso_min_sem_contexto=0,
        boost_contexto=0,
    ),
    Regra(
        nome="nire",
        padrao=_comp(r"\bNIRE\s*[:\-]?\s*\d{8,12}(?:-\d)?\b"),
        tipo="soft",
        peso=2,
        prioridade=4,
        validator=_validator_id_contextual_factory(["nire"], "nire_sem_contexto"),
        min_len=8,
        exige_contexto=True,
        peso_min_sem_contexto=0,
        boost_contexto=0,
    ),
    Regra(
        nome="id_documental_rotulado",
        padrao=_comp(
            r"\b(?:CDA|PROTOCOLO|N[ÚU]MERO\s+INTERNO|AUTUA[ÇC][AÃ]O|NOTA\s+FISCAL|EMPENHO|DOCUMENTO/EMPENHO)\s*[:#º°\-]?\s*[A-Z]?\d{3,20}\b"
        ),
        tipo="soft",
        peso=2,
        prioridade=4,
        validator=_validator_id_contextual_factory(
            ["cda", "protocolo", "número interno", "numero interno", "autuacao", "autuação", "nota fiscal", "empenho", "documento/empenho"],
            "id_doc_sem_contexto"
        ),
        min_len=6,
        exige_contexto=True,
        peso_min_sem_contexto=0,
        boost_contexto=0,
    ),

    # =========================
    # Nome completo (somente com gatilho)
    # =========================
    Regra(
        nome="nome_completo",
        padrao=_comp(
            r"\b(?:[A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ][a-záàâãéèêíìîóòôõúùûç]{2,}"
            r"(?:\s+(?:de|da|do|dos|das|e))?){1,}"
            r"\s+[A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ][a-záàâãéèêíìîóòôõúùûç]{2,}"
            r"(?:\s+[A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ][a-záàâãéèêíìîóòôõúùûç]{2,}){0,3}\b"
        ),
        tipo="soft",
        peso=3,
        prioridade=4,
        validator=_validator_nome_contextual,
        min_len=8,
        exige_contexto=True,
        peso_min_sem_contexto=0,
        boost_contexto=0,
    ),
]


# =========================
# Overlap / seleção por prioridade
# =========================

def _resolver_overlaps(matches: List[MatchInfo]) -> List[MatchInfo]:
    """
    Resolve overlaps com regras:
    1) prioridade (menor ganha)
    2) maior peso aplicado
    3) maior comprimento
    4) se empatar, mantém o primeiro (estável)
    """
    if not matches:
        return []

    matches_sorted = sorted(
        matches,
        key=lambda x: (x.start, x.prioridade, -x.peso_aplicado, -(x.end - x.start)),
    )

    resultado: List[MatchInfo] = []
    current = matches_sorted[0]

    for nxt in matches_sorted[1:]:
        if nxt.start >= current.end:
            resultado.append(current)
            current = nxt
            continue

        cur_key = (current.prioridade, -current.peso_aplicado, -(current.end - current.start))
        nxt_key = (nxt.prioridade, -nxt.peso_aplicado, -(nxt.end - nxt.start))

        if nxt_key < cur_key:
            current = nxt

    resultado.append(current)
    return resultado


# =========================
# Utilitários
# =========================

def _extrair_contexto(texto: str, start: int, end: int, window: int = 60) -> str:
    s = max(0, start - window)
    e = min(len(texto), end + window)
    return texto[s:e]


def _decidir_acao(score_total: int, politica: PoliticaRisco) -> str:
    if score_total >= politica.score_bloquear:
        return "BLOQUEAR"
    if score_total >= politica.score_revisar:
        return "REVISAR"
    return "PUBLICAR"


# =========================
# Core
# =========================

def analisar_texto(texto: Any, politica: PoliticaRisco = DEFAULT_POLITICA) -> Dict[str, Any]:
    raw_text = normalizar_raw(texto)
    search_text = normalizar_busca(raw_text)

    if not raw_text:
        return {
            "status": "PUBLICAR",
            "score": 0,
            "total_matches": 0,
            "matches": [],
            "texto_anonimizado": "",
        }

    encontrados: List[MatchInfo] = []

    # 1) varredura
    for regra in REGRAS:
        for m in regra.padrao.finditer(raw_text):
            raw = m.group(0)

            if regra.min_len and len(raw) < regra.min_len:
                continue

            ok = True
            norm_val: Optional[str] = raw
            motivo: Optional[str] = "padrao_direto"

            if regra.validator:
                ok, norm_val, motivo = regra.validator(m, raw_text, search_text)

            if not ok:
                continue

            peso_final = regra.peso

            # soft: exige contexto? (ou aplica min/boost)
            if regra.tipo == "soft":
                has_ctx = _tem_kw(search_text, m.start(), m.end(), PALAVRAS_CHAVE_RISCO, window=110)

                if regra.exige_contexto and not has_ctx:
                    continue

                if has_ctx:
                    peso_final = max(peso_final, regra.peso_min_sem_contexto) + regra.boost_contexto
                    if motivo is None or motivo == "padrao_direto":
                        motivo = "soft_com_contexto"
                else:
                    if regra.peso_min_sem_contexto <= 0:
                        continue
                    peso_final = regra.peso_min_sem_contexto
                    if motivo is None or motivo == "padrao_direto":
                        motivo = "soft_sem_contexto"

            encontrados.append(
                MatchInfo(
                    regra=regra.nome,
                    prioridade=regra.prioridade,
                    start=m.start(),
                    end=m.end(),
                    raw=raw,
                    norm=norm_val,
                    ok=True,
                    motivo=motivo,
                    peso_aplicado=peso_final,
                )
            )

    # 2) resolve overlaps
    limpos = _resolver_overlaps(encontrados)

    # 3) score + anonimização
    score_total = sum(x.peso_aplicado for x in limpos)
    texto_anon = list(raw_text)

    detalhes: List[Dict[str, Any]] = []
    for x in limpos:
        for i in range(x.start, x.end):
            texto_anon[i] = "*"

        detalhes.append(
            {
                "tipo": x.regra,
                "valor_detectado": x.raw,
                "valor_normalizado": x.norm,
                "motivo": x.motivo,
                "contexto": _extrair_contexto(raw_text, x.start, x.end),
                "score": x.peso_aplicado,
            }
        )

    return {
        "status": _decidir_acao(score_total, politica),
        "score": score_total,
        "total_matches": len(limpos),
        "matches": detalhes,
        "texto_anonimizado": "".join(texto_anon),
    }


def analisar_dataframe(df: pd.DataFrame, col_texto: str, politica: PoliticaRisco = DEFAULT_POLITICA) -> List[Dict[str, Any]]:
    resultados: List[Dict[str, Any]] = []
    df = df.copy()
    df[col_texto] = df[col_texto].fillna("")

    for idx, row in df.iterrows():
        texto = row[col_texto]
        analise = analisar_texto(texto, politica=politica)
        resultados.append(
            {
                "index": idx,
                "texto_original_preview": (str(texto)[:80] + "...") if len(str(texto)) > 80 else str(texto),
                **analise,
            }
        )
    return resultados
