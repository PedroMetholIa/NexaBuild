import { Injectable, inject } from '@angular/core';
import { Supabase } from './supabase';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private client = inject(Supabase).client;

  create(id: string, email: string, nombre: string, apellido: string) {
    return this.client.from('usuario').insert({ id, email, nombre, apellido });
  }
}
