import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import type { McpServer } from '@modelcontextprotocol/server';
import { createHash } from 'node:crypto';

/**
 * Endereço de um formulário versionado pelo conteúdo (épico 3): `ui://agenda-psi/<nome>-<hash>.html`.
 * O Claude guarda em cache o HTML por endereço; com o hash, cada mudança da tela tem
 * endereço novo. Diverge da 13.1 (endereço fixo), com aprovação registrada.
 */
export function uriVersionada(nome: string, html: string): string {
  return `ui://agenda-psi/${nome}-${createHash('sha256').update(html).digest('hex').slice(0, 12)}.html`;
}

/**
 * Registra o HTML de um formulário como recurso MCP Apps (13.1). O HTML vem embutido no
 * build (4.2). Sem `_meta.ui.csp`: vale o CSP padrão do ext-apps (`connect-src 'none'`), e
 * o formulário fala com o servidor só por `callServerTool`.
 */
export function registrarRecurso(server: McpServer, titulo: string, uri: string, html: string): void {
  registerAppResource(server, titulo, uri, { mimeType: RESOURCE_MIME_TYPE, description: titulo }, async () => ({
    contents: [{ uri, mimeType: RESOURCE_MIME_TYPE, text: html }],
  }));
}
