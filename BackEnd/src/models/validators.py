# BackEnd/src/models/validators.py
import re
from typing import List, Tuple, Optional

# --- Auxiliares ---
def apenas_digitos(s: str) -> str:
    return re.sub(r"\D+", "", s or "")

# --- CPF e CNPJ ---
def validar_cpf(cpf: str) -> bool:
    cpf = apenas_digitos(cpf)
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False
    
    def dv(nums: str) -> str:
        soma = 0
        peso = len(nums) + 1
        for ch in nums:
            soma += int(ch) * peso
            peso -= 1
        resto = soma % 11
        return "0" if resto < 2 else str(11 - resto)

    d1 = dv(cpf[:9])
    d2 = dv(cpf[:9] + d1)
    return cpf[-2:] == (d1 + d2)

def validar_cnpj(cnpj: str) -> bool:
    cnpj = apenas_digitos(cnpj)
    if len(cnpj) != 14 or cnpj == cnpj[0] * 14:
        return False

    def dv(nums: str, pesos: List[int]) -> str:
        soma = sum(int(n) * p for n, p in zip(nums, pesos))
        resto = soma % 11
        return "0" if resto < 2 else str(11 - resto)

    p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    d1 = dv(cnpj[:12], p1)
    d2 = dv(cnpj[:12] + d1, p2)
    return cnpj[-2:] == (d1 + d2)

# --- Telefone ---
_DDDS_VALIDOS = set(range(11, 100))
_SEQUENCIAS_PROIBIDAS = {
    "0000000000", "1111111111", "1234567890", "0123456789"
    # Adicione as outras sequências proibidas aqui se necessário
}

def _tem_padrao_sequencial(d: str) -> bool:
    return d in _SEQUENCIAS_PROIBIDAS

def _extrair_ddd_e_numero(digits: str) -> Tuple[Optional[int], str]:
    if len(digits) in (12, 13) and digits.startswith("55"):
        digits = digits[2:]
    if len(digits) in (10, 11):
        return int(digits[:2]), digits[2:]
    return None, digits

def validar_telefone_br(match_str: str) -> Tuple[bool, str, str]:
    digits = apenas_digitos(match_str)
    if not digits: return False, "", "telefone_sem_digitos"
    if len(digits) not in (10, 11, 12, 13): return False, digits, "telefone_tamanho_invalido"

    ddd, num = _extrair_ddd_e_numero(digits)
    if ddd is None: return False, digits, "telefone_sem_ddd"
    if ddd not in _DDDS_VALIDOS: return False, digits, "telefone_ddd_invalido"
    if _tem_padrao_sequencial(digits): return False, digits, "telefone_sequencia_obvia"
    if len(num) == 9 and not num.startswith("9"): return False, digits, "telefone_celular_sem_9"
    if len(num) not in (8, 9): return False, digits, "telefone_numero_invalido"

    return True, digits, "ok"