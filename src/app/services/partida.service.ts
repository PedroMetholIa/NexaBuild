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

  crearCompleta(nombre: string | null, clave: string, limite: number) {
    return this.client.rpc('crear_partida_completa', {
      p_nombre: nombre,
      p_clave: clave,
      p_limite: limite,
    });
  }

  unirseConRpc(idPartida: number) {
    return this.client.rpc('unirse_a_partida', { p_id_partida: idPartida });
  }

  eliminarConRpc(idPartida: number) {
    return this.client.rpc('eliminar_partida', { p_id_partida: idPartida });
  }

  subscribeToJugadorGame(userId: string, onStart: (idPartida: number) => void): RealtimeChannel {
    return this.client
      .channel(`jugador_game_${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'partida_jugador', filter: `id_usuario=eq.${userId}` },
        (payload) => {
          if (payload.new['enpartida'] === true) onStart(payload.new['id_partida'] as number);
        }
      )
      .subscribe();
  }

  subscribeToPartidaChanges(
    onInsert: () => void,
    onUpdate: (partida: Partial<Partida>) => void,
    onDelete: (idPartida: number) => void,
  ): RealtimeChannel {
    return this.client
      .channel('partidas_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'partida' },
        () => onInsert()
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'partida' },
        (payload) => onUpdate(payload.new as Partial<Partida>)
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'partida' },
        (payload) => onDelete(payload.old['idPartida'] as number)
      )
      .subscribe();
  }

  deleteJugadores(idPartida: number) {
    return this.client
      .from('partida_jugador')
      .delete()
      .eq('id_partida', idPartida);
  }

  delete(idPartida: number) {
    return this.client
      .from('partida')
      .delete()
      .eq('idPartida', idPartida);
  }
}
