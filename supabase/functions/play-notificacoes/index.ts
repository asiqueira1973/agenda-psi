import { SignJWT, importPKCS8 } from 'npm:jose@6';
import { aplicarEstadoDaAssinatura, type EstadoDaAssinatura } from '../_shared/assinatura.ts';
import { json } from '../_shared/cors.ts';

/**
 * Edge Function `play-notificacoes` — Real-time Developer Notifications do
 * Google Play.
 *
 * Substitui a outra metade do que o `rc-webhook` fazia.
 *
 * Contrato:
 *   POST /functions/v1/play-notificacoes?token=<PLAY_PUSH_TOKEN>
 *   verify_jwt = false  — quem chama é o Pub/Sub do Google
 *   Body: envelope de push do Pub/Sub, com a notificação em base64
 *
 *   200 → { ok: true }   (sempre que der para seguir; 200 encerra a reentrega)
 *   401 → token do push inválido
 *
 * **O Google funciona ao contrário da Apple.** A notificação NÃO traz o estado
 * da assinatura — ela diz apenas "o token de compra X mudou". Para saber o que
 * mudou é preciso perguntar à API do Play, autenticado com uma conta de
 * serviço. Isso é mais trabalho, mas tem uma vantagem: a resposta vem da fonte,
 * e não de um corpo de requisição que alguém poderia forjar.
 *
 * Por isso a autenticação aqui é um segredo na URL do push, e não validação de
 * assinatura: mesmo que alguém descubra a URL e mande um token de compra
 * qualquer, quem responde o que é verdade é o Google.
 *
 * O `obfuscatedExternalAccountId` é o `profissionais.usuario_id`, carimbado pelo
 * app na hora da compra. É o que liga o dinheiro à conta.
 *
 * SEGREDOS: `PLAY_PUSH_TOKEN`, `PLAY_SERVICE_ACCOUNT_EMAIL`,
 * `PLAY_SERVICE_ACCOUNT_PRIVATE_KEY` e `PLAY_PACKAGE_NAME`.
 *
 * ⚠️ NÃO TESTADA CONTRA O GOOGLE. Só dá para exercitar depois que a assinatura
 * existir no Play Console e o Pub/Sub estiver ligado. Até lá, é código revisado,
 * não código verificado.
 */

/** Troca a conta de serviço por um token de acesso do Google. */
async function tokenDeAcesso(): Promise<string | null> {
  const email = Deno.env.get('PLAY_SERVICE_ACCOUNT_EMAIL');
  const chaveBruta = Deno.env.get('PLAY_SERVICE_ACCOUNT_PRIVATE_KEY');
  if (!email || !chaveBruta) {
    console.error('play: conta de serviço ausente nos secrets');
    return null;
  }

  // O JSON da conta de serviço guarda a chave com \n literais; sem esta troca a
  // importação falha com um erro que não diz o motivo.
  const pem = chaveBruta.replace(/\\n/g, '\n');

  try {
    const chave = await importPKCS8(pem, 'RS256');
    const agora = Math.floor(Date.now() / 1000);

    const assercao = await new SignJWT({
      scope: 'https://www.googleapis.com/auth/androidpublisher',
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(email)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt(agora)
      .setExpirationTime(agora + 3600)
      .sign(chave);

    const resposta = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: assercao,
      }),
    });

    if (!resposta.ok) {
      console.error('play: troca de token falhou', resposta.status);
      return null;
    }

    const dados = await resposta.json();
    return typeof dados?.access_token === 'string' ? dados.access_token : null;
  } catch (erro) {
    console.error('play: falha ao assinar a asserção', erro);
    return null;
  }
}

/**
 * Traduz o estado que o Google reporta para o par plano/status da máquina 12.1.
 *
 * Usar o `subscriptionState` da API, e não o tipo da notificação, é decisão
 * consciente: o tipo diz o que aconteceu, o estado diz como as coisas estão. Se
 * duas notificações chegarem fora de ordem — e chegam —, o estado continua
 * certo e o tipo, não.
 */
function estadoDoGoogle(subscriptionState: string): EstadoDaAssinatura {
  switch (subscriptionState) {
    case 'SUBSCRIPTION_STATE_ACTIVE':
      return { plano: 'pro', status: 'ativo' };
    case 'SUBSCRIPTION_STATE_CANCELED':
      // Cancelou, mas o acesso segue até o fim do período pago (regra 11.6).
      return { plano: 'pro', status: 'cancelado' };
    case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD':
      return { plano: 'pro', status: 'em_atraso' };
    case 'SUBSCRIPTION_STATE_ON_HOLD':
      // Em espera é DEPOIS da graça: o Google já cortou o acesso.
      return { plano: 'free', status: 'expirado' };
    case 'SUBSCRIPTION_STATE_PAUSED':
    case 'SUBSCRIPTION_STATE_EXPIRED':
      return { plano: 'free', status: 'expirado' };
    default:
      // PENDING e o que vier depois: ainda não pagou, não libera.
      return { plano: 'free', status: 'expirado' };
  }
}

Deno.serve(async (req) => {
  const segredo = Deno.env.get('PLAY_PUSH_TOKEN');
  if (!segredo) {
    console.error('play: PLAY_PUSH_TOKEN ausente nos secrets');
    return json({ error: 'nao_configurado' }, 500);
  }

  const url = new URL(req.url);
  if (url.searchParams.get('token') !== segredo) {
    return json({ error: 'nao_autorizado' }, 401);
  }

  let envelope: { message?: { data?: string } };
  try {
    envelope = await req.json();
  } catch {
    return json({ error: 'corpo_invalido' }, 400);
  }

  if (!envelope.message?.data) return json({ ok: true, ignorado: 'sem_dados' });

  let aviso: {
    packageName?: string;
    subscriptionNotification?: { purchaseToken?: string; subscriptionId?: string };
    testNotification?: unknown;
  };
  try {
    aviso = JSON.parse(atob(envelope.message.data));
  } catch {
    return json({ error: 'corpo_invalido' }, 400);
  }

  // O Play manda uma notificação de teste ao configurar o Pub/Sub. 200 nela.
  if (aviso.testNotification) return json({ ok: true, ignorado: 'teste' });

  const token = aviso.subscriptionNotification?.purchaseToken;
  if (!token) return json({ ok: true, ignorado: 'sem_token_de_compra' });

  const pacote = aviso.packageName ?? Deno.env.get('PLAY_PACKAGE_NAME') ?? 'com.dablab.agendapsi';

  const acesso = await tokenDeAcesso();
  if (!acesso) return json({ error: 'erro_interno' }, 500);

  // Aqui está a diferença para a Apple: a verdade vem de uma chamada NOSSA à
  // API do Google, sobre TLS, e não do corpo que chegou.
  const consulta = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pacote}/purchases/subscriptionsv2/tokens/${token}`,
    { headers: { Authorization: `Bearer ${acesso}` } },
  );

  if (!consulta.ok) {
    console.error('play: consulta da assinatura falhou', consulta.status);
    return json({ error: 'erro_interno' }, 500);
  }

  const assinatura = await consulta.json();

  const estado = estadoDoGoogle(String(assinatura?.subscriptionState ?? ''));
  const usuarioId =
    assinatura?.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null;
  const primeiroItem = assinatura?.lineItems?.[0];

  const resultado = await aplicarEstadoDaAssinatura({
    usuarioId,
    estado,
    loja: 'play_store',
    expiraEm: primeiroItem?.expiryTime ?? null,
    identificadorNaLoja: assinatura?.latestOrderId ?? null,
    produto: primeiroItem?.productId ?? aviso.subscriptionNotification?.subscriptionId ?? null,
  });

  if (resultado === 'sem_usuario') {
    console.warn('play: assinatura sem obfuscatedExternalAccountId', {
      pedido: assinatura?.latestOrderId,
    });
    return json({ ok: true, ignorado: 'sem_carimbo_de_conta' });
  }

  if (resultado === 'erro') return json({ error: 'erro_interno' }, 500);

  return json({ ok: true, resultado });
});
