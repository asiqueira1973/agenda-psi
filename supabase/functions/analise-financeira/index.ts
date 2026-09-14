import { identificarUsuario } from '../_shared/auth.ts';
import { corsHeaders, json } from '../_shared/cors.ts';

/**
 * Edge Function `analise-financeira` — substitui o segundo webhook n8n aberto.
 *
 * Contrato (spec 13.2):
 *   POST /functions/v1/analise-financeira
 *   Authorization: Bearer <JWT do usuário>
 *   Body: {}
 *
 *   200 → { resumo, riscos, oportunidades, acoes_prioritarias }
 *   401 → { "error": "nao_autenticado" }
 *   429 → { "error": "limite_excedido" }
 *   502 → { "error": "analise_indisponivel" }
 *
 * O que conserta (defeito 11.9.17 e risco 23.1): hoje o app lê
 * `v_dashboard_payload_json` e MANDA o payload financeiro inteiro para uma URL
 * pública sem autenticação. Os números de faturamento, despesa e lucro do
 * usuário trafegam para fora sem nenhuma credencial no caminho.
 *
 * Aqui o corpo da requisição do app é VAZIO. É a função que lê a view — com o
 * JWT do usuário, de modo que a própria view se auto-filtra por `auth.uid()` —
 * e só então chama o n8n, com o segredo compartilhado.
 *
 * SEGREDOS NECESSÁRIOS: `N8N_ANALISE_URL` e `N8N_WEBHOOK_SECRET`.
 */

/** Rate limit da regra 20.5: 10 análises por usuário por dia. */
const LIMITE_POR_DIA = 10;

const chamadasPorUsuario = new Map<string, number[]>();

function excedeuOLimite(usuarioId: string): boolean {
  const agora = Date.now();
  const umDiaAtras = agora - 24 * 60 * 60 * 1000;
  const recentes = (chamadasPorUsuario.get(usuarioId) ?? []).filter((t) => t > umDiaAtras);
  recentes.push(agora);
  chamadasPorUsuario.set(usuarioId, recentes);
  return recentes.length > LIMITE_POR_DIA;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const identidade = await identificarUsuario(req);
  if (!identidade) return json({ error: 'nao_autenticado' }, 401);

  if (excedeuOLimite(identidade.usuarioId)) {
    return json({ error: 'limite_excedido' }, 429);
  }

  // A view se auto-filtra por auth.uid(): o cliente age como o usuário, então
  // não há como esta função ler o painel de outra pessoa nem por engano.
  const { data, error } = await identidade.cliente
    .from('v_dashboard_payload_json')
    .select('*')
    .maybeSingle();

  if (error || !data) {
    console.error('analise-financeira: falha ao ler o payload', error);
    return json({ error: 'analise_indisponivel' }, 502);
  }

  const url = Deno.env.get('N8N_ANALISE_URL');
  const segredo = Deno.env.get('N8N_WEBHOOK_SECRET');
  if (!url || !segredo) {
    console.error('analise-financeira: N8N_ANALISE_URL ou N8N_WEBHOOK_SECRET ausente');
    return json({ error: 'analise_indisponivel' }, 502);
  }

  try {
    const resposta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': segredo },
      body: JSON.stringify({ usuario_id: identidade.usuarioId, payload: data }),
    });

    if (!resposta.ok) {
      console.error('analise-financeira: n8n respondeu', resposta.status);
      return json({ error: 'analise_indisponivel' }, 502);
    }

    const dados = await resposta.json();
    return json({
      resumo: String(dados?.resumo ?? ''),
      riscos: String(dados?.riscos ?? ''),
      oportunidades: String(dados?.oportunidades ?? ''),
      acoes_prioritarias: String(dados?.acoes_prioritarias ?? ''),
    });
  } catch (erro) {
    console.error('analise-financeira: falha ao chamar o n8n', erro);
    return json({ error: 'analise_indisponivel' }, 502);
  }
});
