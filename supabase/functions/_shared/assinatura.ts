import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Grava o plano de um profissional em `assinaturas`.
 *
 * É o ÚNICO caminho de escrita nessa tabela em todo o sistema, e por isso vive
 * aqui, compartilhado pelas duas funções de notificação de loja — uma para a
 * Apple, outra para o Google. Duplicar esta lógica seria duplicar a chance de as
 * duas lojas produzirem estados diferentes para a mesma máquina 12.1.
 *
 * Usa `service_role`, que existe apenas nos secrets das Edge Functions.
 *
 * Implementa: 11.6 (plano e cortesia), máquina 12.1 e o épico 8.11.
 */

/** Os estados possíveis, conforme a máquina 12.1 e os CHECKs da tabela. */
export type EstadoDaAssinatura = {
  plano: 'free' | 'pro';
  status: 'ativo' | 'em_atraso' | 'cancelado' | 'expirado';
};

export function clienteAdministrativo() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

/**
 * Aplica o estado a partir do identificador de usuário carimbado na compra.
 *
 * Recebe:
 * - `usuarioId`: o `profissionais.usuario_id`, que o app carimbou na compra como
 *   `appAccountToken` (Apple) ou `obfuscatedAccountId` (Google). **Sem ele não há
 *   como ligar a compra à conta** — é o ponto mais frágil do fluxo sem
 *   RevenueCat;
 * - `estado`: o par plano/status derivado do tipo de notificação;
 * - `loja`: `app_store` ou `play_store`;
 * - `expiraEm`: quando o acesso termina, ou nulo;
 * - `identificadorNaLoja`: o que permite rastrear a assinatura do lado de lá.
 *
 * Devolve o que aconteceu, para o log da função dizer algo útil.
 */
export async function aplicarEstadoDaAssinatura(params: {
  usuarioId: string | null;
  estado: EstadoDaAssinatura;
  loja: 'app_store' | 'play_store';
  expiraEm: string | null;
  identificadorNaLoja: string | null;
  produto: string | null;
}): Promise<'aplicado' | 'sem_usuario' | 'sem_profissional' | 'erro'> {
  if (!params.usuarioId) return 'sem_usuario';

  const admin = clienteAdministrativo();

  const { data: profissional, error: erroBusca } = await admin
    .from('profissionais')
    .select('id')
    .eq('usuario_id', params.usuarioId)
    .maybeSingle();

  if (erroBusca) {
    console.error('assinatura: falha ao buscar o profissional', erroBusca);
    return 'erro';
  }
  if (!profissional) return 'sem_profissional';

  const { error } = await admin.from('assinaturas').upsert(
    {
      profissional_id: profissional.id,
      plano: params.estado.plano,
      status: params.estado.status,
      store: params.loja,
      rc_customer_id: params.usuarioId,
      rc_entitlement: params.produto,
      expira_em: params.expiraEm,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'profissional_id' },
  );

  if (error) {
    console.error('assinatura: falha no upsert', error);
    return 'erro';
  }

  return 'aplicado';
}
