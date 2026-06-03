export interface Suscripcion {
  id: string;
  id_usuario: string;
  id_producto: string;
  fecha_ing_sus: string;
  fecha_fin_sus: string | null;
  url: string | null;
  user_admin: string | null;
  user_key: string | null;
  created_at?: string;
  usuario?: { nombre: string; apellido: string; email: string };
  producto?: { descripcion: string };
}
