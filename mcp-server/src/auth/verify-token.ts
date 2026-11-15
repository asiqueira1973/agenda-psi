import { OAuthError, type AuthInfo, type OAuthTokenVerifier } from '@modelcontextprotocol/server';
import type { Config } from '../config.js';

/** O pedaço do `supabase.auth` que a verificação usa; permite simular no teste. */
export type ClaimsReader = {
  getClaims(jwt: string): Promise<
    { data: { claims: Record<string, unknown> }; error: null } | { data: null; error: unknown }
  >;
};

/** Dados do token que as ferramentas usam, guardados em `AuthInfo.extra`. */
export type IdentidadeDoToken = {
  /** `sub` do JWT: o `usuario_id` de todas as tabelas (P1, pegadinha 3). */
  sub: string;
};

/**
 * Recusa com 401 `invalid_token`; os helpers de bearer do SDK montam o desafio.
 * O motivo vai no `error_description` do cabeçalho `WWW-Authenticate`, que só carrega
 * ASCII com segurança (acento virava espaço), e é lido pelo cliente OAuth, não pela
 * pessoa. Por isso fica em inglês, sem acento, e fora das mensagens da seção 15.
 */
function recusar(motivo: string): never {
  throw new OAuthError('invalid_token', motivo);
}

/**
 * Verificador de access token do servidor MCP (seção 6.4).
 *
 * A assinatura é conferida PELO SUPABASE AUTH, com `getClaims`: o projeto usa o
 * segredo HS256 legado (decisão 25.4), e esse segredo não entra no MCP. Depois:
 * - `iss` igual a `<SUPABASE_URL>/auth/v1`;
 * - `exp` presente e no futuro (vira `expiresAt`);
 * - `role` = `authenticated`;
 * - `client_id` OBRIGATÓRIO, para o token de sessão do app não servir no MCP. Só é
 *   dispensado com `MCP_DEV_ALLOW_SESSION_TOKEN=1`, que existe apenas localmente (8.1.3);
 * - `aud` não é exigido (o Supabase emite `authenticated`), risco registrado na seção 23.
 *
 * Recebe a configuração, o leitor de claims e o relógio (para teste). Devolve um
 * verificador que entrega `AuthInfo` com `extra.sub`, ou lança `OAuthError`.
 */
export function criarVerificador(
  config: Config,
  leitor: ClaimsReader,
  agoraEmSegundos: () => number = () => Math.floor(Date.now() / 1000),
): OAuthTokenVerifier {
  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      let resposta: Awaited<ReturnType<ClaimsReader['getClaims']>>;
      try {
        resposta = await leitor.getClaims(token);
      } catch {
        recusar('Invalid token');
      }
      if (resposta.error || !resposta.data) recusar('Invalid token');
      const c = resposta.data.claims;

      if (c.iss !== config.issuer) recusar('Unexpected token issuer');
      if (typeof c.exp !== 'number' || c.exp <= agoraEmSegundos()) recusar('Token expired');
      if (c.role !== 'authenticated') recusar('Token role is not authenticated');
      if (typeof c.sub !== 'string' || c.sub.length === 0) recusar('Token has no subject');

      const clientId = typeof c.client_id === 'string' && c.client_id.length > 0 ? c.client_id : null;
      if (!clientId && !config.devAllowSessionToken) {
        recusar('App session tokens are not accepted; connect through OAuth');
      }

      const scopes = typeof c.scope === 'string' ? c.scope.split(' ').filter(Boolean) : [];
      const extra: IdentidadeDoToken = { sub: c.sub };
      return { token, clientId: clientId ?? 'sessao-local', scopes, expiresAt: c.exp, extra };
    },
  };
}

/**
 * Lê o `sub` que o verificador guardou. Toda ferramenta pega o usuário daqui, nunca
 * de um argumento (P1). Lança se faltar, o que só acontece se o roteador for mal montado.
 */
export function subDoAuthInfo(authInfo: AuthInfo | undefined): string {
  const sub = (authInfo?.extra as Partial<IdentidadeDoToken> | undefined)?.sub;
  if (!sub) throw new Error('Request sem usuário autenticado.');
  return sub;
}
