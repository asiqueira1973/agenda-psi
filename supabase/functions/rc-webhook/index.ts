import { createClient } from 'jsr:@supabase/supabase-js@2';
import { json } from '../_shared/cors.ts';

/**
 * Edge Function `rc-webhook` — o único lugar do sistema que grava em
 * `assinaturas`.
 *
 * Contrato (spec 13.3):
 *   POST /functions/v1/rc-webhook
 *   Authorization: Bearer <segredo configurado no painel do RevenueCat>
 *   verify_jwt = false
 *
 *   200 → { "ok": true }
 *   401 → assinatura inválida
 *
 * Por que `verify_jwt = false`: quem chama é o RevenueCat, não um usuário. A
 * autenticação é o segredo combinado no painel deles, conferido abaixo.
 *
 * Esta função é a razão de `assinaturas` não ter policy de escrita nenhuma
 * (migration 0002). O app NUNCA grava plano — nem a partir da resposta local do
 * StoreKit, que é justamente o caminho por onde um cliente comprometido
 * concederia Pro a si mesmo. A máquina 12.1 lista isso como transição proibida.
 *
 * Idempotente: reprocessar o mesmo evento leva ao mesmo estado. O RevenueCat
 * reenvia em caso de falha, e reenvio não pode duplicar nem regredir nada.
 *
 * SEGREDOS NECESSÁRIOS: `RC_WEBHOOK_SECRET` e `SUPABASE_SERVICE_ROLE_KEY`.
 */

/** Eventos tratados, conforme 13.3. Os demais são aceitos e ignorados. */
type TipoDeEvento =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'UNCANCELLATION'
  | 'PRODUCT_CHANGE'
  | 'CANCELLATION'
  | 'EXPIRATION'
  | 'BILLING_ISSUE'
  | 'SUBSCRIPTION_PAUSED';

type EventoRevenueCat = {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  entitlement_ids?: string[];
  store?: string;
  expiration_at_ms?: number;
  id?: string;
};

/**
 * Traduz o evento do RevenueCat para o par (plano, status) da máquina 12.1.
 *
 * A regra de fundo é a 11.6: cancelado mantém acesso até `expira_em`, em atraso
 * mantém durante o período de graça, e expirado volta a free.
 */
function estadoDoEvento(tipo: TipoDeEvento): { plano: string; status: string } {
  switch (tipo) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE':
      return { plano: 'pro', status: 'ativo' };
    case 'CANCELLATION':
      // Cancelou na loja, mas o acesso continua até expira_em (regra 11.6).
      return { plano: 'pro', status: 'cancelado' };
    case 'BILLING_ISSUE':
      // Período de graça: o acesso é mantido enquanto a loja tenta cobrar.
      return { plano: 'pro', status: 'em_atraso' };
    case 'SUBSCRIPTION_PAUSED':
    case 'EXPIRATION':
      return { plano: 'free', status: 'expirado' };
  }
}

/** Mapeia a loja do RevenueCat para o literal do CHECK da tabela (spec 7.3). */
function lojaDoEvento(store: string | undefined): string | null {
  const normalizada = (store ?? '').toUpperCase();
  if (normalizada === 'APP_STORE' || normalizada === 'MAC_APP_STORE') return 'app_store';
  if (normalizada === 'PLAY_STORE') return 'play_store';
  return null;
}

Deno.serve(async (req) => {
  const segredo = Deno.env.get('RC_WEBHOOK_SECRET');
  if (!segredo) {
    console.error('rc-webhook: RC_WEBHOOK_SECRET ausente nos secrets');
    return json({ error: 'nao_configurado' }, 500);
  }

  const autorizacao = req.headers.get('Authorization');
  if (autorizacao !== `Bearer ${segredo}`) {
    return json({ error: 'nao_autorizado' }, 401);
  }

  let corpo: { event?: EventoRevenueCat };
  try {
    corpo = await req.json();
  } catch {
    return json({ error: 'corpo_invalido' }, 400);
  }

  const evento = corpo.event;
  const tipo = evento?.type as TipoDeEvento | undefined;
  if (!tipo || !estadoDoEventoConhecido(tipo)) {
    // Evento que não interessa: 200 para o RevenueCat não ficar reenviando.
    return json({ ok: true, ignorado: tipo ?? 'sem_tipo' });
  }

  // O appUserID é o `profissionais.usuario_id`, definido no Purchases.logIn
  // logo após o login (spec 8.11). Sem isso a compra não liga na conta.
  const usuarioId = evento?.app_user_id ?? evento?.original_app_user_id;
  if (!usuarioId) return json({ error: 'sem_app_user_id' }, 400);

  // service_role: é a única função que precisa dela, e ela só existe aqui.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: profissional, error: erroBusca } = await admin
    .from('profissionais')
    .select('id')
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (erroBusca) {
    console.error('rc-webhook: falha ao buscar o profissional', erroBusca);
    return json({ error: 'erro_interno' }, 500);
  }

  if (!profissional) {
    // Compra de alguém sem ficha. Responder 200 evita reenvio infinito; o log
    // guarda o caso para investigação.
    console.warn('rc-webhook: nenhum profissional para o app_user_id', usuarioId);
    return json({ ok: true, ignorado: 'sem_profissional' });
  }

  const { plano, status } = estadoDoEvento(tipo);

  const { error: erroUpsert } = await admin.from('assinaturas').upsert(
    {
      profissional_id: profissional.id,
      plano,
      status,
      store: lojaDoEvento(evento?.store),
      rc_customer_id: usuarioId,
      rc_entitlement: evento?.entitlement_ids?.[0] ?? null,
      expira_em: evento?.expiration_at_ms
        ? new Date(evento.expiration_at_ms).toISOString()
        : null,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'profissional_id' },
  );

  if (erroUpsert) {
    console.error('rc-webhook: falha no upsert de assinaturas', erroUpsert);
    return json({ error: 'erro_interno' }, 500);
  }

  return json({ ok: true });
});

function estadoDoEventoConhecido(tipo: string): tipo is TipoDeEvento {
  return [
    'INITIAL_PURCHASE',
    'RENEWAL',
    'UNCANCELLATION',
    'PRODUCT_CHANGE',
    'CANCELLATION',
    'EXPIRATION',
    'BILLING_ISSUE',
    'SUBSCRIPTION_PAUSED',
  ].includes(tipo);
}
