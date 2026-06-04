import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Supabase } from './supabase';
import { Partida } from '../models/partida';

@Injectable({ providedIn: 'root' })
export class PartidaService {
  private client = inject(Supabase).client;

  getAll() {
    return this.client
      .from('partida')
      .select('idPartida, idProducto, NombrePartida, ClavePartida, PartidaActiva, LimiteJugadores, JugadoresRegistrados, HostPartida, usuario!partida_HostPartida_fkey(nombre, apellido)')
      .order('idPartida', { ascending: false });
  }

  create(data: Omit<Partida, 'idPartida' | 'JugadoresRegistrados' | 'usuario'>) {
    return this.client.from('partida').insert(data).select().single();
  }

  addJugador(idPartida: number, idUsuario: string) {
    return this.client
      .from('partida_jugador')
      .insert({ id_partida: idPartida, id_usuario: idUsuario });
  }

  comenzarPartida(idPartida: number) {
    return this.client.rpc('comenzar_partida', { p_id_partida: idPartida });
  }

  subscribeToUpdates(onUpdate: (partida: Partial<Partida>) => void): RealtimeChannel {
    return this.client
      .channel('partidas_realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'partida' },
        (payload) => onUpdate(payload.new as Partial<Partida>)
      )
      .subscribe();
  }

  delete(idPartida: number) {
    return this.client
      .from('partida')
      .delete()
      .eq('idPartida', idPartida);
  }
}
