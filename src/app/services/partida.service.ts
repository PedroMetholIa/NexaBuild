import { Injectable, inject } from '@angular/core';
import { Supabase } from './supabase';
import { Partida } from '../models/partida';

@Injectable({ providedIn: 'root' })
export class PartidaService {
  private client = inject(Supabase).client;

  getAll() {
    return this.client
      .from('partida')
      .select('*, usuario!partida_HostPartida_fkey(nombre, apellido)')
      .order('idPartida', { ascending: false });
  }

  create(data: Omit<Partida, 'idPartida'>) {
    return this.client.from('partida').insert(data).select().single();
  }

  toggleActiva(idPartida: number, activa: boolean) {
    return this.client
      .from('partida')
      .update({ PartidaActiva: activa })
      .eq('idPartida', idPartida);
  }

  delete(idPartida: number) {
    return this.client
      .from('partida')
      .delete()
      .eq('idPartida', idPartida);
  }
}
