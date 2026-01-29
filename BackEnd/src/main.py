from fastapi import FastAPI
from src.api.routes import router

app = FastAPI(
    title="SafeDoc-DF API",
    description="API de detecção de dados pessoais para o Desafio Participa DF",
    version="1.0.0"
)

app.include_router(router)

@app.get("/health")
def health():
    return {"status": "ok", "service": "SafeDoc-DF"}