import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { nonAdminGuard } from './guards/non-admin.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/layout/layout.component').then((m) => m.LayoutComponent),
    children: [
      {
        path: '',
        canActivate: [nonAdminGuard],
        loadComponent: () => import('./pages/landing/landing.component').then((m) => m.LandingComponent),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'nexajuegos',
        canActivate: [nonAdminGuard],
        loadComponent: () => import('./pages/nexajuegos/nexajuegos.component').then((m) => m.NexaJuegosComponent),
      },
      {
        path: 'nexateg',
        canActivate: [nonAdminGuard],
        loadComponent: () => import('./pages/nexateg/nexateg.component').then((m) => m.NexaTegComponent),
      },
      {
        path: 'nexateg/game',
        canActivate: [authGuard, nonAdminGuard],
        loadComponent: () => import('./pages/nexatag-game/nexatag-game.component').then((m) => m.NexaTagGameComponent),
      },
    ],
  },
  {
    path: 'auth',
    loadComponent: () => import('./pages/auth/auth.component').then((m) => m.AuthComponent),
  },
  {
    path: 'personas',
    canActivate: [authGuard, nonAdminGuard],
    loadComponent: () => import('./pages/personas/personas.component').then((m) => m.PersonasComponent),
  },
  {
    path: 'personas/nueva',
    canActivate: [authGuard, nonAdminGuard],
    loadComponent: () => import('./pages/persona-form/persona-form.component').then((m) => m.PersonaFormComponent),
  },
  {
    path: 'personas/:id/editar',
    canActivate: [authGuard, nonAdminGuard],
    loadComponent: () => import('./pages/persona-form/persona-form.component').then((m) => m.PersonaFormComponent),
  },
];
