import { identificarUsuario } from '../_shared/auth.ts';
import { corsHeaders, json } from '../_shared/cors.ts';

/**
 * Edge Function `agente-psi` — substitui o webhook n8n aberto.
 *
 * Contrato (spec 13.1):
 *   POST /functions/v1/agente-psi
 *   Authorization: Bearer <JWT do usuário>
 *   Body: { "chat": "Registre uma despesa de 30 reais hoje" }
 *
 *   200 → { "output": "..." }
 *   401 → { "error": "nao_autenticado" }
 *   400 → { "error": "chat_vazio" }
 *   429 → { "error": "limite_excedido" }
 *   502 → { "error": "agente_indisponivel" }
 *
 * O que esta função existe para consertar (defeito 11.9.17 e risco 23.1): hoje o
 * app chama `https://dablab.app.n8n.cloud/webhook/AgentePsi` SEM autenticação,
 * passando o `usuario_id` no corpo. Quem tiver a URL — extraível do bundle —
 * lê e escreve dado de qualquer psicólogo trocando um uuid.
 *
 * Aqui o corpo tem UM campo, `chat`. O `usuario_id` é derivado do token e
 * repassado ao n8n junto com um segredo compartilhado em header, que o fluxo do
 * lado de lá precisa conferir. O fluxo de IA não é reescrito — é protegido
 * (trade-off declarado em D3).
 *
 * Guardrail de 20.5: o isolamento entre usuários não depende de o modelo se
 * comportar. Mesmo que ele seja induzido a qualquer coisa, não alcança dado de
 * outro psicólogo, porque o `usuario_id` não passa por ele.
 *
 * SEGREDOS NECESSÁRIOS (spec 18): `N8N_AGENTE_URL` e `N8N_WEBHOOK_SECRET`.
 */

/** Rate limit da regra 20.5: 20 comandos por usuário por hora. */
const LIMITE_POR_HORA = 20;

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

  let corpo: { chat?: string };
  try {
    corpo = await req.json();
  } catch {
    return json({ error: 'chat_vazio' }, 400);
  }

  const texto = (corpo.chat ?? '').trim();
  if (texto.length === 0) return json({ error: 'chat_vazio' }, 400);

  const url = Deno.env.get('N8N_AGENTE_URL');
  const segredo = Deno.env.get('N8N_WEBHOOK_SECRET');
  if (!url || !segredo) {
    console.error('agente-psi: N8N_AGENTE_URL ou N8N_WEBHOOK_SECRET ausente nos secrets');
    return json({ error: 'agente_indisponivel' }, 502);
  }

  try {
    const resposta = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': segredo,
      },
      // O usuario_id vem do TOKEN. Nunca do corpo da requisição do app.
      body: JSON.stringify({ usuario_id: identidade.usuarioId, chat: texto }),
    });

    if (!resposta.ok) {
      console.error('agente-psi: n8n respondeu', resposta.status);
      return json({ error: 'agente_indisponivel' }, 502);
    }

    const dados = await resposta.json();
    const saida = typeof dados?.output === 'string' ? dados.output : null;

    // Resposta fora do formato esperado não vira texto cru na tela (spec 20.5).
    if (!saida) return json({ error: 'agente_indisponivel' }, 502);

    return json({ output: saida });
  } catch (erro) {
    console.error('agente-psi: falha ao chamar o n8n', erro);
    return json({ error: 'agente_indisponivel' }, 502);
  }
});
