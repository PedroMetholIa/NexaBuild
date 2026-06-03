import { Injectable, inject } from '@angular/core';
import { Supabase } from './supabase';
import { Suscripcion } from '../models/suscripcion';

@Injectable({ providedIn: 'root' })
export class SuscripcionService {
  private client = inject(Supabase).client;

  getAll() {
    return this.client
      .from('suscripcion')
      .select('*, usuario(nombre, apellido, email), producto(descripcion)')
      .order('created_at', { ascending: false });
  }

  create(data: Omit<Suscripcion, 'id' | 'created_at' | 'usuario' | 'producto'>) {
    return this.client.from('suscripcion').insert(data);
  }

  update(id: string, data: Omit<Suscripcion, 'id' | 'created_at' | 'usuario' | 'producto'>) {
    return this.client.from('suscripcion').update(data).eq('id', id);
  }

  getByUsuario(userId: string) {
    return this.client.from('suscripcion').select('id_producto').eq('id_usuario', userId);
  }

  getByProducto(idProducto: string) {
    return this.client
      .from('suscripcion')
      .select('*, usuario(nombre, apellido, email)')
      .eq('id_producto', idProducto)
      .order('fecha_ing_sus', { ascending: false });
  }

  delete(id: string) {
    return this.client.from('suscripcion').delete().eq('id', id);
  }
}
