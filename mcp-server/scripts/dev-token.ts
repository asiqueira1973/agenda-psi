import { createClient } from '@supabase/supabase-js';

/**
 * Imprime um access token da CONTA DE TESTE (8.1.3), para chamar o servidor local pelo
 * Inspector ou pelo curl. Só para desenvolvimento: esse token não tem `client_id` e só
 * é aceito com `MCP_DEV_ALLOW_SESSION_TOKEN=1`, que nunca existe no deploy.
 *
 * Lê `TEST_EMAIL`, `TEST_PASSWORD`, `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` do
 * `.env.local`. Imprime só o token, nada mais, para caber num `$(...)`.
 */
const faltando = ['TEST_EMAIL', 'TEST_PASSWORD', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'].filter((n) => !process.env[n]);
if (faltando.length > 0) {
  console.error(`Faltam no .env.local: ${faltando.join(', ')}`);
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await supabase.auth.signInWithPassword({
  email: process.env.TEST_EMAIL!,
  password: process.env.TEST_PASSWORD!,
});
if (error || !data.session) {
  console.error('Não foi possível entrar com a conta de teste.');
  process.exit(1);
}
console.log(data.session.access_token);
