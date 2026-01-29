# BackEnd/src/utils/metrics.py
from typing import Dict

def calcular_precisao(vp: int, fp: int) -> float:
    """Calcula Precisão: VP / (VP + FP)"""
    if (vp + fp) == 0:
        return 0.0
    return vp / (vp + fp)

def calcular_recall(vp: int, fn: int) -> float:
    """Calcula Sensibilidade/Recall: VP / (VP + FN)"""
    if (vp + fn) == 0:
        return 0.0
    return vp / (vp + fn)

def calcular_p1_score(precisao: float, recall: float) -> float:
    """Calcula Score P1 (Harmonic Mean): 2 * (Prec * Rec) / (Prec + Rec)"""
    if (precisao + recall) == 0:
        return 0.0
    return 2 * (precisao * recall) / (precisao + recall)

def gerar_relatorio_metricas(df_resultado) -> Dict[str, float]:
    """
    Gera um dicionário com as métricas dado um DataFrame que contenha 
    colunas 'y_true' (real) e 'y_pred' (predito).
    """
    vp = len(df_resultado[(df_resultado['y_true'] == 1) & (df_resultado['y_pred'] == 1)])
    fp = len(df_resultado[(df_resultado['y_true'] == 0) & (df_resultado['y_pred'] == 1)])
    fn = len(df_resultado[(df_resultado['y_true'] == 1) & (df_resultado['y_pred'] == 0)])
    vn = len(df_resultado[(df_resultado['y_true'] == 0) & (df_resultado['y_pred'] == 0)])

    precisao = calcular_precisao(vp, fp)
    recall = calcular_recall(vp, fn)
    p1 = calcular_p1_score(precisao, recall)

    return {
        "VP": vp, "FP": fp, "FN": fn, "VN": vn,
        "Precisao": precisao,
        "Recall": recall,
        "P1_Score": p1
    }