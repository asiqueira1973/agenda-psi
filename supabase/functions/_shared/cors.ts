/**
 * Cabeçalhos de CORS das Edge Functions.
 *
 * O app nativo não precisa de CORS, mas o preflight aparece em teste pelo
 * navegador e no painel do Supabase. Sem isto, depurar a função vira adivinhação.
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Resposta JSON com status e CORS. */
export function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
