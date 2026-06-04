import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data, error } = await supabase.rpc('revoke_inactive_sessions');

  if (error) {
    console.error('cleanup-inactive-sessions error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const revoked = data ?? 0;
  console.log(`cleanup-inactive-sessions: ${revoked} sesiones revocadas`);
  return new Response(JSON.stringify({ revoked }), { status: 200 });
});
