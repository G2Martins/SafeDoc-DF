import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException
from ..core.detector import analisar_texto, analisar_dataframe
from ..core.config import TEXT_COLUMN_CANDIDATES
from .schemas import TextoRequest, AnaliseResponse 

router = APIRouter()

@router.post("/validate/text", response_model=AnaliseResponse)
def validar_texto(payload: TextoRequest):
    # O detector retorna um dict completo, o Pydantic filtrará conforme o schema AnaliseResponse
    return analisar_texto(payload.texto)

@router.post("/validate/csv")
async def validar_csv(file: UploadFile = File(...)):
    # 1. Verifica se o nome do arquivo existe e se termina com .csv
    nome_arquivo = file.filename or ""
    
    if not nome_arquivo.lower().endswith('.csv'):
        raise HTTPException(
            status_code=400, 
            detail=f"Arquivo inválido ('{nome_arquivo}'). O formato deve ser CSV."
        )
    
    try:
        # 2. Rebobina o arquivo (boa prática caso tenha havido leitura prévia)
        await file.seek(0)
        df = pd.read_csv(file.file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao ler o CSV: {str(e)}")