import { Injectable, inject } from '@angular/core';
import { Supabase } from './supabase';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private client = inject(Supabase).client;

  getAll() {
    return this.client.from('usuario').select('*').order('nombre');
  }

  create(id: string, email: string, nombre: string, apellido: string) {
    return this.client.from('usuario').insert({ id, email, nombre, apellido });
  }

  getByUserId(userId: string) {
    return this.client.from('usuario').select('*').eq('id', userId).maybeSingle();
  }

  update(id: string, data: { nombre?: string; apellido?: string; administrador?: boolean }) {
    return this.client.from('usuario').update(data).eq('id', id);
  }

  delete(id: string) {
    return this.client.from('usuario').delete().eq('id', id);
  }
}
