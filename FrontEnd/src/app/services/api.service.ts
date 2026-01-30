// src/app/services/api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // Ajuste a porta se necessário (padrão FastAPI é 8000)
  private baseUrl = 'http://localhost:8000'; 

  constructor(private http: HttpClient) { }

  // POST /validate/text
  validateText(texto: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/validate/text`, { texto });
  }

  // POST /validate/csv
  validateCsv(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.baseUrl}/validate/csv`, formData);
  }
}