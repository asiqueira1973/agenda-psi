import { requireBearerAuth, type McpHttpHandler } from '@modelcontextprotocol/server';
import { ESCOPO_PEDIDO, protectedResourceMetadata, protectedResourceMetadataUrl } from './auth/metadata.js';
import { metadataDeAutorizacao, redirecionarAuthorize } from './auth/authorize-proxy.js';
import { criarVerificador, type ClaimsReader } from './auth/verify-token.js';
import { suporteAUi } from './client-capabilities.js';
import type { Config } from './config.js';
import { criarHandlerMcp } from './handler.js';
import { criarClienteAnonimo } from './supabase.js';

/** Caminho do documento RFC 9728; o sufixo `/mcp` é a forma que o SDK anuncia (6.2). */
const PRM_PATH = '/.well-known/oauth-protected-resource';

/** O PRM é público e lido por clientes no navegador (Inspector), então libera CORS. */
const CORS_PUBLICO = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

/**
 * Acrescenta `scope="email"` ao desafio do 401. O cliente MCP escolhe o escopo primeiro
 * pelo `WWW-Authenticate` e só depois pelo PRM; assim ele não pede `openid` (épico 3).
 */
function comEscopo(r: Response): Response {
  const desafio = r.headers.get('www-authenticate');
  if (!desafio || /\bscope="/.test(desafio)) return r;
  const headers = new Headers(r.headers);
  headers.set('www-authenticate', `${desafio}, scope="${ESCOPO_PEDIDO}"`);
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers });
}

/** Dependências trocáveis no teste: o leitor de claims e o handler MCP. */
export type Dependencias = { leitorDeClaims?: ClaimsReader; mcp?: McpHttpHandler };

/**
 * A aplicação inteira como um `fetch` web-standard (4.2 e 4.3), para rodar igual na
 * Vercel, no servidor local e nos testes.
 *
 * Rotas:
 * - `GET /.well-known/oauth-protected-resource[/mcp]` → metadata da 6.2;
 * - `GET /.well-known/oauth-authorization-server` (e `openid-configuration`) e
 *   `GET /oauth/authorize` → desvio do authorize, sem openid (authorize-proxy.ts);
 * - `/mcp` → exige Bearer: sem token ou com token inválido, 401 com
 *   `WWW-Authenticate: Bearer … resource_metadata="…"` (6.2, passo 1); com token
 *   válido, o handler MCP recebe o `authInfo`;
 * - qualquer outra → 404.
 */
export function criarApp(config: Config, deps: Dependencias = {}) {
  const verifier = criarVerificador(config, deps.leitorDeClaims ?? criarClienteAnonimo(config).auth);
  const exigirToken = requireBearerAuth({ verifier, resourceMetadataUrl: protectedResourceMetadataUrl(config) });
  const mcp = deps.mcp ?? criarHandlerMcp(config);
  const prm = protectedResourceMetadata(config);

  return {
    async fetch(request: Request): Promise<Response> {
      const { pathname } = new URL(request.url);

      if (pathname === PRM_PATH || pathname === `${PRM_PATH}/mcp`) {
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_PUBLICO });
        if (request.method !== 'GET') return new Response(null, { status: 405, headers: CORS_PUBLICO });
        return Response.json(prm, { headers: CORS_PUBLICO });
      }

      // Desvio do authorize (authorize-proxy.ts): metadata de AS no nosso domínio e o
      // authorize sem openid. Token, DCR e JWKS seguem direto no Supabase.
      if (pathname === '/.well-known/oauth-authorization-server' || pathname === '/.well-known/openid-configuration') {
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_PUBLICO });
        return Response.json(metadataDeAutorizacao(config), { headers: CORS_PUBLICO });
      }
      if (pathname === '/oauth/authorize' && request.method === 'GET') {
        return redirecionarAuthorize(config, request);
      }

      if (pathname === '/mcp') {
        const auth = await exigirToken(request);
        if (auth instanceof Response) {
          // Diagnóstico sem PII (18): só o motivo, que é ASCII e vem do verificador, e o
          // método. Nunca o token. Sem isto, uma falha do OAuth no Claude não deixa rastro.
          const motivo = /error_description="([^"]*)"/.exec(auth.headers.get('www-authenticate') ?? '')?.[1] ?? 'sem motivo';
          console.log(JSON.stringify({ evento: 'token_recusado', motivo, metodo: request.method }));
          return comEscopo(auth);
        }
        // O corpo é lido uma vez aqui: dele sai o suporte a UI do cliente (13.4), e o
        // mesmo objeto vai ao SDK como `parsedBody`, sem segunda leitura.
        const corpo = request.method === 'POST' ? await request.clone().json().catch(() => undefined) : undefined;
        const authInfo = { ...auth, extra: { ...auth.extra, ui: suporteAUi(corpo) } };
        return mcp.fetch(request, corpo === undefined ? { authInfo } : { authInfo, parsedBody: corpo });
      }

      return new Response('Not found', { status: 404 });
    },
  };
}
