import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Supabase } from '../services/supabase';

export const adminGuard: CanActivateFn = async () => {
  const supabase = inject(Supabase);
  const router = inject(Router);

  const { data: sessionData } = await supabase.client.auth.getSession();
  if (!sessionData.session) {
    router.navigate(['/auth']);
    return false;
  }

  const { data: usuario } = await supabase.client
    .from('usuario')
    .select('administrador')
    .eq('id', sessionData.session.user.id)
    .single();

  if (!usuario?.administrador) {
    router.navigate(['/personas']);
    return false;
  }

  return true;
};
