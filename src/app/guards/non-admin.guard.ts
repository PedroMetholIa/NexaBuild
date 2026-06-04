import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Supabase } from '../services/supabase';

export const nonAdminGuard: CanActivateFn = async () => {
  const supabase = inject(Supabase).client;
  const router = inject(Router);

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return true;

  const { data: usuario } = await supabase
    .from('usuario')
    .select('administrador')
    .eq('id', sessionData.session.user.id)
    .single();

  if (usuario?.administrador) {
    router.navigate(['/admin']);
    return false;
  }

  return true;
};
