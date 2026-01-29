from pydantic import BaseModel
from typing import Dict


class TextoRequest(BaseModel):
    texto: str


class AnaliseResponse(BaseModel):
    sensivel: bool
    ocorrencias: Dict[str, int]
