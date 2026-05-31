export interface UserActivity {
  id?: string;
  user_id: string;
  email: string;
  last_login: string;
  last_seen: string;
  is_online: boolean;
  usuario?: { nombre: string; apellido: string };
}
