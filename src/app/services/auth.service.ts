import { Injectable } from '@angular/core';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { Supabase } from './supabase';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private supabase: Supabase) {}

  private get client() {
    return this.supabase.client;
  }

  signUp(email: string, password: string, metadata?: { nombre: string; apellido: string }) {
    return this.client.auth.signUp({
      email,
      password,
      options: metadata ? { data: metadata } : undefined,
    });
  }

  signIn(email: string, password: string) {
    return this.client.auth.signInWithPassword({ email, password });
  }

  signOut() {
    return this.client.auth.signOut();
  }

  getSession() {
    return this.client.auth.getSession();
  }

  updateUserMetadata(data: Record<string, string>) {
    return this.client.auth.updateUser({ data });
  }

  refreshSession() {
    return this.client.auth.refreshSession();
  }

  onAuthChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return this.client.auth.onAuthStateChange(callback);
  }
}
