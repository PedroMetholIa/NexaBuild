-- Función que revoca sesiones de auth y marca offline a usuarios inactivos.
-- SECURITY DEFINER permite acceder a auth.sessions desde fuera del schema auth.
CREATE OR REPLACE FUNCTION public.revoke_inactive_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count integer;
BEGIN
  -- Eliminar sesiones de auth para usuarios inactivos
  WITH inactive AS (
    SELECT user_id::uuid AS uid
    FROM public.user_activity
    WHERE is_online = true
      AND last_seen < NOW() - INTERVAL '1 hour'
  )
  DELETE FROM auth.sessions
  WHERE user_id IN (SELECT uid FROM inactive);

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  -- Marcar offline en user_activity
  UPDATE public.user_activity
  SET is_online = false
  WHERE is_online = true
    AND last_seen < NOW() - INTERVAL '1 hour';

  RETURN affected_count;
END;
$$;
