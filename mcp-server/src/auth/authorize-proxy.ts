import type { Config } from '../config.js';

/**
 * Desvio do authorize (épico 3, opção A, aprovada pelo Alexandre em 15/11/2026).
 *
 * O Claude sempre pede o escopo `openid`, mesmo com o PRM e o 401 pedindo só `email`.
 * Com `openid`, o `/oauth/token` do Supabase tenta emitir ID token e responde 500 "HS256
 * is not supported for ID token signing", porque o projeto assina em HS256 (decisão 25.4,
 * que veta migrar as chaves por causa do `agente`).
 *
 * A saída sem tocar no Supabase: o nosso domínio se anuncia como authorization server e
 * só o `authorize` passa por aqui, para tirar `openid` do escopo. Token, registro de
 * cliente (DCR) e JWKS apontam direto para o Supabase: não guardamos token nem segredo, o
 * PKCE passa intacto, e login e consentimento continuam sendo do Supabase (6.1 e 6.3). O
 * token emitido é o mesmo de antes, com `iss` do Supabase, e a verificação 6.4 não muda.
 */

/** Emissor anunciado ao cliente: a origem do servidor MCP (ex.: https://app.agendapsi.app.br). */
export function emissorAnunciado(config: Config): string {
  return new URL(config.publicUrl).origin;
}

/**
 * Metadata de authorization server (RFC 8414), servido também como
 * `openid-configuration`, porque alguns clientes procuram esse caminho primeiro. Copia os
 * endpoints do Supabase (`/auth/v1/...`), troca só o `authorize`, e não anuncia `openid`.
 */
export function metadataDeAutorizacao(config: Config) {
  const emissor = emissorAnunciado(config);
  const supabase = config.issuer; // https://<projeto>.supabase.co/auth/v1
  return {
    issuer: emissor,
    authorization_endpoint: `${emissor}/oauth/authorize`,
    token_endpoint: `${supabase}/oauth/token`,
    registration_endpoint: `${supabase}/oauth/clients/register`,
    jwks_uri: `${supabase}/.well-known/jwks.json`,
    scopes_supported: ['email', 'profile'],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
  };
}

/**
 * `GET /oauth/authorize`: redireciona (302) para o authorize do Supabase com a MESMA query,
 * só sem `openid` no `scope`. Sem escopo que sobre, usa `email` (o padrão do Supabase).
 * Não valida nada: quem valida cliente, `redirect_uri` e PKCE é o Supabase.
 */
export function redirecionarAuthorize(config: Config, request: Request): Response {
  const entrada = new URL(request.url).searchParams;
  const saida = new URLSearchParams(entrada);
  const escopos = (entrada.get('scope') ?? '').split(/\s+/).filter((s) => s && s !== 'openid');
  saida.set('scope', escopos.length ? escopos.join(' ') : 'email');
  return new Response(null, {
    status: 302,
    headers: { location: `${config.issuer}/oauth/authorize?${saida.toString()}`, 'cache-control': 'no-store' },
  });
}
