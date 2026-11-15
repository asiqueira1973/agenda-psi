import { getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/server';
import type { Config } from '../config.js';

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
    authorization_servers: [config.issuer],
    bearer_methods_supported: ['header'],
    resource_name: 'Agenda Psi',
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
