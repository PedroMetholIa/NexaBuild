import { Injectable, inject, signal } from '@angular/core';
import { Supabase } from './supabase';
import { Producto } from '../models/producto';

@Injectable({ providedIn: 'root' })
export class ProductoService {
  private client = inject(Supabase).client;

  // Signal compartida entre componentes — persiste entre navegaciones
  readonly productos = signal<Producto[]>([]);

  async cargar() {
    const { data } = await this.client.from('producto').select('*').order('id_producto');
    this.productos.set((data as Producto[]) ?? []);
  }

  getAll() {
    return this.client.from('producto').select('*').order('id_producto');
  }

  create(producto: Omit<Producto, 'created_at'>) {
    return this.client.from('producto').insert(producto);
  }

  update(idProducto: string, data: Partial<Omit<Producto, 'id_producto' | 'created_at'>>) {
    return this.client.from('producto').update(data).eq('id_producto', idProducto);
  }

  delete(idProducto: string) {
    return this.client.from('producto').delete().eq('id_producto', idProducto);
  }
}
