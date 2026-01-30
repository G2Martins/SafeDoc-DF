
import pandas as pd
from fastapi import APIRouter, UploadFile, File
from ..core.detector import analisar_texto
from ..core.config import TEXT_COLUMN_CANDIDATES
from .schemas import TextoRequest


router = APIRouter()


@router.post("/validate/text")
def validar_texto(payload: TextoRequest): 
    return analisar_texto(payload.texto)


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
