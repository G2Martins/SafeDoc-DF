from dataclasses import dataclass

TEXT_COLUMN_CANDIDATES = [
    "descricao", "texto", "detalhe", "mensagem", "conteudo"
]

DEFAULT_ENCODING = "utf-8"
MAX_TEXT_LENGTH = 20_000

@dataclass(frozen=True)
class PoliticaRisco:
    # Scores de sensibilidade
    score_sensivel_estrito: int = 6
    score_sensivel_balanceado: int = 6
    score_sensivel_sensivel: int = 3

    # Scores para ação
    score_bloquear: int = 8
    score_revisar: int = 3

    # Regras de bloqueio
    bloquear_se_cpf_cnpj_ok: bool = True
    bloquear_se_email: bool = True
    bloquear_se_processo: bool = False
    bloquear_se_telefone_ok: bool = True

    # Regras de revisão
    revisar_se_telefone_suspeito: bool = True
    revisar_se_hard_suspeito_com_contexto: bool = True

DEFAULT_POLITICA = PoliticaRisco()