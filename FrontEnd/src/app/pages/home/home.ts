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
  resultadoCsv: any = null;
  loadingCsv: boolean = false;

  constructor(private apiService: ApiService) { }

  // --- Funções de Texto ---
  analisarTexto() {
    if (!this.textoInput.trim()) return;

    this.loadingTexto = true;
    this.resultadoTexto = null;

    this.apiService.validateText(this.textoInput).subscribe({
      next: (res) => {
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

  // --- Funções de CSV ---
  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.arquivoSelecionado = file;
    }
  }

  enviarCsv() {
    if (!this.arquivoSelecionado) return;

    this.loadingCsv = true;
    this.resultadoCsv = null;

    this.apiService.validateCsv(this.arquivoSelecionado).subscribe({
      next: (res) => {
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
}