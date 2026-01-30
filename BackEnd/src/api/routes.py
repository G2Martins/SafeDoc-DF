# src/participa_df/api/routes.py
import pandas as pd
from fastapi import APIRouter, UploadFile, File
from ..services.detector import analisar_texto
from ..settings import TEXT_COLUMN_CANDIDATES


router = APIRouter()


@router.post("/validate/text")
def validar_texto(payload: dict):
    return analisar_texto(payload.get("texto", ""))


@router.post("/validate/csv")
async def validar_csv(file: UploadFile = File(...)):
    df = pd.read_csv(file.file)

    coluna = next(
        (c for c in df.columns if c.lower() in TEXT_COLUMN_CANDIDATES),
        None
    )

    if not coluna:
        return {"erro": "Nenhuma coluna de texto encontrada"}

    resultados = df[coluna].apply(lambda x: analisar_texto(str(x))).tolist()
    return {"total": len(resultados), "resultados": resultados}
