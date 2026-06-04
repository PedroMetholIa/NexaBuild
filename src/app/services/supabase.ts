import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

// Toda llamada HTTP del cliente (incluyendo refresh de JWT) tiene timeout propio.
// Si el refresh de JWT tarda demasiado, devolvemos una respuesta sintética
// invalid_grant para que el cliente dispare SIGNED_OUT en lugar de reintentar
// indefinidamente y bloquear todas las llamadas API posteriores.
const fetchConTimeout = (url: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
  const urlStr = url.toString();
  const isAuthRefresh = urlStr.includes('/auth/v1/token');
  const timeout = isAuthRefresh ? 10_000 : 20_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal })
    .catch(err => {
      if (err.name === 'AbortError' && isAuthRefresh) {
        return new Response(
          JSON.stringify({ error: 'invalid_grant', error_description: 'Timeout' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw err;
    })
    .finally(() => clearTimeout(timer));
};

@Injectable({
  providedIn: 'root',
})
export class Supabase {
  readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseKey,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      global: {
        fetch: fetchConTimeout,
      },
    }
  );
}
