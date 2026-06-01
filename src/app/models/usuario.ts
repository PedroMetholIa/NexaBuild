export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  administrador: boolean;
  created_at?: string;
}
