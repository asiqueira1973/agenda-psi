import { Buffer } from 'node:buffer';
import {
  SignedDataVerifier,
  Environment,
} from 'npm:@apple/app-store-server-library@3';
import { certificadosRaizDaApple } from '../_shared/apple-root-ca.ts';
import { aplicarEstadoDaAssinatura, type EstadoDaAssinatura } from '../_shared/assinatura.ts';
import { json } from '../_shared/cors.ts';

/**
 * Edge Function `apple-notificacoes` — App Store Server Notifications V2.
 *
 * Substitui metade do que o `rc-webhook` fazia. Sem RevenueCat (decisão de
 * 14/09/2026), cada loja avisa do seu jeito, e este é o jeito da Apple.
 *
 * Contrato:
 *   POST /functions/v1/apple-notificacoes
 *   verify_jwt = false  — quem chama é a Apple, não um usuário
 *   Body: { "signedPayload": "<JWS>" }
 *
 *   200 → { ok: true }   (também para evento ignorado — senão a Apple reenvia)
 *   401 → assinatura inválida
 *
 * **A autenticação aqui é criptográfica, não um segredo compartilhado.** A URL
 * desta função é cadastrada no App Store Connect e, a partir daí, é pública. O
 * que separa uma notificação real de uma forjada é a cadeia de certificados do
 * JWS, validada até uma raiz da Apple — e é por isso que a validação é feita
 * pela biblioteca oficial, e não à mão.
 *
 * O `appAccountToken` é o `profissionais.usuario_id`, carimbado pelo app na hora
 * da compra. É o que liga o dinheiro à conta.
 *
 * SEGREDOS/CONFIGURAÇÃO: `APPLE_BUNDLE_ID` e, opcionalmente, `APPLE_APP_ID`.
 *
 * ⚠️ NÃO TESTADA CONTRA A APPLE. Só dá para exercitar depois que o produto de
 * assinatura existir no App Store Connect e o sandbox começar a mandar
 * notificação. Até lá, é código revisado, não código verificado.
 */

/**
 * Traduz o tipo e o subtipo da notificação para o par plano/status da máquina
 * 12.1.
 *
 * A regra de fundo é a 11.6: cancelado mantém acesso até `expira_em`, em atraso
 * mantém durante o período de graça, e expirado volta a free.
 */
function estadoDoEvento(tipo: string, subtipo: string | undefined): EstadoDaAssinatura | null {
  switch (tipo) {
    case 'SUBSCRIBED':
    case 'DID_RENEW':
    case 'OFFER_REDEEMED':
      return { plano: 'pro', status: 'ativo' };

    case 'DID_CHANGE_RENEWAL_STATUS':
      // AUTO_RENEW_DISABLED é o cancelamento: o acesso segue até expira_em.
      return subtipo === 'AUTO_RENEW_DISABLED'
        ? { plano: 'pro', status: 'cancelado' }
        : { plano: 'pro', status: 'ativo' };

    case 'DID_FAIL_TO_RENEW':
      // Com GRACE_PERIOD o acesso continua; sem ele, acabou.
      return subtipo === 'GRACE_PERIOD'
        ? { plano: 'pro', status: 'em_atraso' }
        : { plano: 'free', status: 'expirado' };

    case 'EXPIRED':
    case 'GRACE_PERIOD_EXPIRED':
    case 'REVOKE':
      return { plano: 'free', status: 'expirado' };

    case 'REFUND':
      return { plano: 'free', status: 'expirado' };

    case 'DID_CHANGE_RENEWAL_PREF':
      // Trocou de produto e segue assinante.
      return { plano: 'pro', status: 'ativo' };

    default:
      // CONSUMPTION_REQUEST, RENEWAL_EXTENDED, TEST e o que vier depois.
      return null;
  }
}

Deno.serve(async (req) => {
  let corpo: { signedPayload?: string };
  try {
    corpo = await req.json();
  } catch {
    return json({ error: 'corpo_invalido' }, 400);
  }

  if (!corpo.signedPayload) return json({ error: 'sem_payload' }, 400);

  const bundleId = Deno.env.get('APPLE_BUNDLE_ID') ?? 'com.dablab.agendapsi';
  const appId = Deno.env.get('APPLE_APP_ID');

  // O ambiente vem do próprio payload; a Apple manda sandbox e produção para a
  // mesma URL. Verificar com o ambiente errado faz a validação falhar.
  const ambiente = corpo.signedPayload.includes('Sandbox')
    ? Environment.SANDBOX
    : Environment.PRODUCTION;

  let verificador: SignedDataVerifier;
  try {
    verificador = new SignedDataVerifier(
      certificadosRaizDaApple().map((c) => Buffer.from(c)),
      true, // valida a revogação online (OCSP)
      ambiente,
      bundleId,
      appId ? Number(appId) : undefined,
    );
  } catch (erro) {
    console.error('apple: falha ao montar o verificador', erro);
    return json({ error: 'erro_interno' }, 500);
  }

  let notificacao;
  try {
    notificacao = await verificador.verifyAndDecodeNotification(corpo.signedPayload);
  } catch (erro) {
    // Assinatura inválida: alguém mandou algo que não veio da Apple.
    console.error('apple: assinatura inválida', erro);
    return json({ error: 'nao_autorizado' }, 401);
  }

  const tipo = String(notificacao.notificationType ?? '');
  const subtipo = notificacao.subtype ? String(notificacao.subtype) : undefined;
  const estado = estadoDoEvento(tipo, subtipo);

  // 200 em evento que não interessa, senão a Apple reenvia por horas.
  if (!estado) return json({ ok: true, ignorado: tipo });

  const assinado = notificacao.data?.signedTransactionInfo;
  if (!assinado) return json({ ok: true, ignorado: 'sem_transacao' });

  let transacao;
  try {
    transacao = await verificador.verifyAndDecodeTransaction(assinado);
  } catch (erro) {
    console.error('apple: transação com assinatura inválida', erro);
    return json({ error: 'nao_autorizado' }, 401);
  }

  const resultado = await aplicarEstadoDaAssinatura({
    // O carimbo que o app pôs na compra. Sem ele, não há a quem dar o Pro.
    usuarioId: transacao.appAccountToken ?? null,
    estado,
    loja: 'app_store',
    expiraEm: transacao.expiresDate ? new Date(transacao.expiresDate).toISOString() : null,
    identificadorNaLoja: transacao.originalTransactionId ?? null,
    produto: transacao.productId ?? null,
  });

  if (resultado === 'sem_usuario') {
    // Compra sem carimbo. 200 evita reenvio infinito; o log guarda o caso, que
    // precisa de investigação manual — provavelmente compra feita por uma
    // versão do app anterior ao carimbo.
    console.warn('apple: notificação sem appAccountToken', {
      tipo,
      transacao: transacao.originalTransactionId,
    });
    return json({ ok: true, ignorado: 'sem_app_account_token' });
  }

  if (resultado === 'erro') return json({ error: 'erro_interno' }, 500);

  return json({ ok: true, resultado });
});
