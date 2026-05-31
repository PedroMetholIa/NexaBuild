import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Supabase } from '../services/supabase';

export const authGuard: CanActivateFn = async () => {
  const supabase = inject(Supabase);
  const router = inject(Router);
  const { data } = await supabase.client.auth.getSession();
  if (!data.session) {
    router.navigate(['/auth']);
    return false;
  }
  return true;
};
