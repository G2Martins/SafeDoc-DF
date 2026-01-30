import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home';

export const routes: Routes = [
  // Rota padrão: carrega a Home
  { path: '', component: HomeComponent },
  
  // (Opcional) Redireciona qualquer rota desconhecida para a Home
  { path: '**', redirectTo: '' }
];