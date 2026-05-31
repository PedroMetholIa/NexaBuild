import { Injectable, inject } from '@angular/core';
import { Supabase } from './supabase';

@Injectable({ providedIn: 'root' })
export class UserActivityService {
  private client = inject(Supabase).client;

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

  getAll() {
    return this.client
      .from('user_activity')
      .select('*, usuario(nombre, apellido)')
      .order('last_seen', { ascending: false });
  }
}
