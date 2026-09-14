import { identificarUsuario } from '../_shared/auth.ts';
import { corsHeaders, json } from '../_shared/cors.ts';

/**
 * Edge Function `notifica-admin` — substitui o webhook `MeAvisa`.
 *
 * Contrato (spec 13.4):
 *   POST /functions/v1/notifica-admin
 *   Authorization: Bearer <JWT do usuário>
 *   Body: { "tipo": "feedback", "referencia": "<id do registro em feedback>" }
 *
 *   200 → { "ok": true }
 *   401 → { "error": "nao_autenticado" }
 *
 * O que conserta (defeito 11.9.17): hoje o app chama o webhook `MeAvisa` direto,
 * sem autenticação, mandando o e-mail do usuário e o texto digitado. Qualquer
 * pessoa com a URL gera notificação falsa ou coleta o que passa por ali.
 *
 * Aqui o corpo leva só o TIPO e o ID do registro. O conteúdo é buscado no banco
 * com o JWT do usuário — o que também garante que ninguém peça notificação de
 * um feedback que não é seu, porque a RLS não deixa ler.
 *
 * `tipo` tem um valor só porque, com o corte do módulo de Locais (spec 3), o
 * único chamador que sobrou é o feedback. O campo continua existindo para o dia
 * em que 28.8 voltar.
 *
 * SEGREDOS NECESSÁRIOS: `N8N_MEAVISA_URL` e `N8N_WEBHOOK_SECRET`.
 */

/** Rate limit da regra 20.5: 5 por usuário por hora. */
const LIMITE_POR_HORA = 5;

const chamadasPorUsuario = new Map<string, number[]>();

function excedeuOLimite(usuarioId: string): boolean {
  const agora = Date.now();
  const umaHoraAtras = agora - 60 * 60 * 1000;
  const recentes = (chamadasPorUsuario.get(usuarioId) ?? []).filter((t) => t > umaHoraAtras);
  recentes.push(agora);
  chamadasPorUsuario.set(usuarioId, recentes);
  return recentes.length > LIMITE_POR_HORA;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const identidade = await identificarUsuario(req);
  if (!identidade) return json({ error: 'nao_autenticado' }, 401);

  if (excedeuOLimite(identidade.usuarioId)) {
    return json({ error: 'limite_excedido' }, 429);
  }

  let corpo: { tipo?: string; referencia?: string };
  try {
    corpo = await req.json();
  } catch {
    return json({ error: 'corpo_invalido' }, 400);
  }

  if (corpo.tipo !== 'feedback' || !corpo.referencia) {
    return json({ error: 'corpo_invalido' }, 400);
  }

  // O conteúdo vem do banco, não do corpo. Quem não pode ler o registro pela
  // RLS também não consegue pedir notificação sobre ele.
  const { data, error } = await identidade.cliente
    .from('feedback')
    .select('id, mensagem, email, created_at')
    .eq('id', corpo.referencia)
    .maybeSingle();

  if (error || !data) return json({ error: 'nao_encontrado' }, 404);

  const url = Deno.env.get('N8N_MEAVISA_URL');
  const segredo = Deno.env.get('N8N_WEBHOOK_SECRET');
  if (!url || !segredo) {
    console.error('notifica-admin: N8N_MEAVISA_URL ou N8N_WEBHOOK_SECRET ausente');
    // Falhar aqui não pode derrubar o feedback, que JÁ foi gravado. O usuário
    // fez a parte dele; o aviso ao administrador é problema nosso.
    return json({ ok: false }, 200);
  }

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': segredo },
      body: JSON.stringify({
        tipo: 'feedback',
        usuario_id: identidade.usuarioId,
        feedback: data,
      }),
    });
    return json({ ok: true });
  } catch (erro) {
    console.error('notifica-admin: falha ao chamar o n8n', erro);
    return json({ ok: false }, 200);
  }
});
