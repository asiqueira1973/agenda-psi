import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import type { McpServer } from '@modelcontextprotocol/server';
import { DESPESA_HTML } from '../../ui/generated.js';
import { DESPESA_RESOURCE_URI } from './resource-uri.js';

/**
 * Registra o HTML do formulário de despesa como recurso MCP Apps (13.1). O HTML é um
 * arquivo único gerado pelo Vite e embutido como string no build (4.2), então o
 * servidor não lê disco. Sem `_meta.ui.csp`: vale o CSP padrão do ext-apps
 * (`connect-src 'none'`), e o formulário fala com o servidor só por `callServerTool`.
 */
export function registrarRecursoDespesa(server: McpServer): void {
  registerAppResource(
    server,
    'Formulário de despesa',
    DESPESA_RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE, description: 'Formulário para conferir e salvar uma despesa.' },
    async () => ({ contents: [{ uri: DESPESA_RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: DESPESA_HTML }] }),
  );
}
