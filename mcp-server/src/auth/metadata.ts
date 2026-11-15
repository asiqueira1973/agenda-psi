import { getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/server';
import type { Config } from '../config.js';
import { emissorAnunciado } from './authorize-proxy.js';

/**
 * O único escopo que o servidor pede ao cliente OAuth (épico 3). Sem `openid`: com ele,
 * o Supabase precisa emitir ID token, e o `/oauth/token` responde 500 "HS256 is not
 * supported…", porque o projeto assina em HS256 (decisão 25.4). Escopo não controla
 * acesso a dado (6.4); quem controla é a RLS. `email` é o padrão do próprio Supabase.
 */
export const ESCOPO_PEDIDO = 'email';

/**
 * Documento de Protected Resource Metadata, RFC 9728 (seção 6.2).
 *
 * - `resource`: igual, byte a byte, à URL que a pessoa digita no conector;
 * - `authorization_servers`: UM item, o Auth do Supabase, porque o Claude usa só o primeiro.
 *
 * Montado à mão (divergência 3 do plano do épico 1): o helper do SDK exige o metadata
 * completo do authorization server, e aqui basta apontar para o do Supabase.
 */
export function protectedResourceMetadata(config: Config) {
  return {
    resource: config.publicUrl,
    // O nosso domínio, e não o Supabase direto: só o authorize passa por aqui, para tirar
    // `openid` (authorize-proxy.ts, épico 3). O Claude usa só o primeiro item (6.2).
    authorization_servers: [emissorAnunciado(config)],
    bearer_methods_supported: ['header'],
    resource_name: 'Agenda Psi',
    scopes_supported: [ESCOPO_PEDIDO],
  };
}

/**
 * URL do documento acima, anunciada no `WWW-Authenticate` do 401 (6.2, passo 1).
 * Para `https://host/mcp` o SDK devolve `https://host/.well-known/oauth-protected-resource/mcp`,
 * como manda a RFC 9728 para recursos com caminho.
 */
export function protectedResourceMetadataUrl(config: Config): string {
  return getOAuthProtectedResourceMetadataUrl(new URL(config.publicUrl));
}
