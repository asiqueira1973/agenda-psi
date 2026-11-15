import { requireBearerAuth, type McpHttpHandler } from '@modelcontextprotocol/server';
import { protectedResourceMetadata, protectedResourceMetadataUrl } from './auth/metadata.js';
import { criarVerificador, type ClaimsReader } from './auth/verify-token.js';
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

/** Dependências trocáveis no teste: o leitor de claims e o handler MCP. */
export type Dependencias = { leitorDeClaims?: ClaimsReader; mcp?: McpHttpHandler };

/**
 * A aplicação inteira como um `fetch` web-standard (4.2 e 4.3), para rodar igual na
 * Vercel, no servidor local e nos testes.
 *
 * Rotas:
 * - `GET /.well-known/oauth-protected-resource[/mcp]` → metadata da 6.2;
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

      if (pathname === '/mcp') {
        const auth = await exigirToken(request);
        if (auth instanceof Response) return auth;
        return mcp.fetch(request, { authInfo: auth });
      }

      return new Response('Not found', { status: 404 });
    },
  };
}
