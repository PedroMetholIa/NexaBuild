import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Supabase } from './supabase';

@Injectable({ providedIn: 'root' })
export class UserActivityService {
  private client = inject(Supabase).client;

  delete(userId: string) {
    return this.client.from('user_activity').delete().eq('user_id', userId);
  }

  updateStatus(userId: string, isOnline: boolean) {
    return this.client
      .from('user_activity')
      .update({ is_online: isOnline, last_seen: new Date().toISOString() })
      .eq('user_id', userId);
  }

  upsertLogin(userId: string, email: string) {
    const now = new Date().toISOString();
    return this.client.from('user_activity').upsert(
      { user_id: userId, email, last_login: now, last_seen: now, is_online: true },
      { onConflict: 'user_id' }
    );
  }

  setOffline(userId: string) {
    return this.client
      .from('user_activity')
      .update({ is_online: false, last_seen: new Date().toISOString() })
      .eq('user_id', userId);
  }

  updateLastSeen(userId: string) {
    return this.client
      .from('user_activity')
      .update({ last_seen: new Date().toISOString() })
      .eq('user_id', userId);
  }

  getAll() {
    return this.client
      .from('user_activity')
      .select('*, usuario(nombre, apellido)')
      .order('last_seen', { ascending: false });
  }

  // Escucha cambios de DB (requiere Realtime activo en Supabase) Y broadcasts del admin.
  subscribeToStatus(userId: string, onOffline: () => void): RealtimeChannel {
    return this.client
      .channel(`session_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_activity',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new['is_online'] === false) onOffline();
        }
      )
      .on('broadcast', { event: 'force_logout' }, () => onOffline())
      .subscribe();
  }

  // Envía señal de logout por broadcast (no requiere permisos de DB).
  broadcastForceLogout(userId: string): Promise<void> {
    return new Promise((resolve) => {
      const channel = this.client.channel(`session_${userId}`);
      const fallback = setTimeout(async () => {
        await this.client.removeChannel(channel);
        resolve();
      }, 5000);

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(fallback);
          await channel.send({ type: 'broadcast', event: 'force_logout', payload: {} });
          await this.client.removeChannel(channel);
          resolve();
        }
      });
    });
  }
}
