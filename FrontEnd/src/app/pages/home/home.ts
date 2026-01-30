import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navbar } from '../../components/navbar/navbar';
import { Footer } from '../../components/footer/footer';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Navbar,
    Footer
  ],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class HomeComponent {
  // Variáveis para Texto
  textoInput: string = '';
  resultadoTexto: any = null;
  loadingTexto: boolean = false;

  // Variáveis para CSV
  arquivoSelecionado: File | null = null;
  resultadoCsv: any = null; // esperado: { total: number, resultados: [...] }
  loadingCsv: boolean = false;

  constructor(private apiService: ApiService) { }

  // =========================
  // Download helpers (NOVO)
  // =========================
  private downloadBlob(content: BlobPart, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    window.URL.revokeObjectURL(url);
  }

  private timestampName(prefix: string, ext: string) {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return `${prefix}_${stamp}.${ext}`;
  }

  // --- Funções de Texto ---
  analisarTexto() {
    if (!this.textoInput.trim()) return;

    this.loadingTexto = true;
    this.resultadoTexto = null;

    this.apiService.validateText(this.textoInput).subscribe({
      next: (res: any) => {
        // res esperado: {status, score, matches, texto_anonimizado}
        this.resultadoTexto = res;
        this.loadingTexto = false;
      },
      error: (err) => {
        console.error(err);
        this.loadingTexto = false;
        alert('Erro ao conectar com a API.');
      }
    });
  }

  baixarTextoAnonimizado() {
    if (!this.resultadoTexto?.texto_anonimizado) return;

    const nome = this.timestampName('safedoc_texto_anonimizado', 'txt');
    this.downloadBlob(this.resultadoTexto.texto_anonimizado, nome, 'text/plain;charset=utf-8');
  }

  baixarJsonResultadoTexto() {
    if (!this.resultadoTexto) return;

    const nome = this.timestampName('safedoc_resultado_texto', 'json');
    const json = JSON.stringify(this.resultadoTexto, null, 2);
    this.downloadBlob(json, nome, 'application/json;charset=utf-8');
  }

  // --- Funções de CSV ---
  onFileSelected(event: any) {
    const file: File = event.target.files?.[0];
    if (file) {
      this.arquivoSelecionado = file;
    }
  }

  enviarCsv() {
    if (!this.arquivoSelecionado) return;

    this.loadingCsv = true;
    this.resultadoCsv = null;

    this.apiService.validateCsv(this.arquivoSelecionado).subscribe({
      next: (res: any) => {
        // res esperado: { total: number, resultados: Array<...> }
        this.resultadoCsv = res;
        this.loadingCsv = false;
      },
      error: (err) => {
        console.error(err);
        this.loadingCsv = false;
        alert('Erro ao processar o arquivo CSV.');
      }
    });
  }

  baixarJsonResultadoCsv() {
    if (!this.resultadoCsv) return;

    const nome = this.timestampName('safedoc_resultado_lote', 'json');
    const json = JSON.stringify(this.resultadoCsv, null, 2);
    this.downloadBlob(json, nome, 'application/json;charset=utf-8');
  }

  baixarCsvResultados() {
    const rows = this.resultadoCsv?.resultados;
    if (!Array.isArray(rows) || rows.length === 0) return;

    const headers = [
      'index',
      'status',
      'score',
      'texto_anonimizado',
      'matches'
    ];

    const escape = (val: any) => {
      if (val === null || val === undefined) return '""';
      const s = typeof val === 'string' ? val : JSON.stringify(val);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const csv = [
      headers.join(','),
      ...rows.map((r: any) => headers.map((h) => escape(r[h])).join(','))
    ].join('\n');

    const nome = this.timestampName('safedoc_resultado_lote', 'csv');
    this.downloadBlob(csv, nome, 'text/csv;charset=utf-8');
  }

  baixarUltimoResultado() {
    // prioridade: lote (CSV) se existir, senão texto
    if (this.resultadoCsv?.resultados?.length) {
      this.baixarCsvResultados();
      return;
    }
    if (this.resultadoTexto) {
      this.baixarTextoAnonimizado();
      return;
    }
  }
}
