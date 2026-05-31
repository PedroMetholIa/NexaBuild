import { Injectable } from '@angular/core';
import { Supabase } from './supabase';
import { Persona } from '../models/persona';

@Injectable({
  providedIn: 'root',
})
export class PersonaService {
  private readonly TABLE = 'persona';

  constructor(private supabase: Supabase) {}

  private get client() {
    return this.supabase.client;
  }

  async getAll(): Promise<Persona[]> {
    const { data, error } = await this.client.from(this.TABLE).select('*');
    if (error) throw error;
    return data ?? [];
  }

  async getById(identificador: number): Promise<Persona | null> {
    const { data, error } = await this.client
      .from(this.TABLE)
      .select('*')
      .eq('identificador', identificador)
      .single();
    if (error) throw error;
    return data;
  }

  async create(persona: Omit<Persona, 'identificador'>): Promise<Persona> {
    const { data, error } = await this.client
      .from(this.TABLE)
      .insert(persona)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async update(
    identificador: number,
    changes: Partial<Omit<Persona, 'identificador'>>,
  ): Promise<Persona> {
    const { data, error } = await this.client
      .from(this.TABLE)
      .update(changes)
      .eq('identificador', identificador)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async delete(identificador: number): Promise<void> {
    const { error } = await this.client
      .from(this.TABLE)
      .delete()
      .eq('identificador', identificador);
    if (error) throw error;
  }
}
