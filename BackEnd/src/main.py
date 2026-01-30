# BackEnd/src/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware # <--- 1. Importar
from src.api.routes import router

app = FastAPI(
    title="SafeDoc-DF API",
    description="API de detecção de dados pessoais",
    version="1.0.0"
)

# 2. Configurar o CORS
origins = [
    "http://localhost:4200",  # Angular
    "http://127.0.0.1:4200",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Permite POST, GET, etc.
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/health")
def health():
    return {"status": "ok", "service": "SafeDoc-DF"}