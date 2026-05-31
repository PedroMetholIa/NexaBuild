import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'auth',
    loadComponent: () => import('./pages/auth/auth.component').then((m) => m.AuthComponent),
  },
  {
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'personas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/personas/personas.component').then((m) => m.PersonasComponent),
  },
  {
    path: 'personas/nueva',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/persona-form/persona-form.component').then((m) => m.PersonaFormComponent),
  },
  {
    path: 'personas/:id/editar',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/persona-form/persona-form.component').then((m) => m.PersonaFormComponent),
  },
];
