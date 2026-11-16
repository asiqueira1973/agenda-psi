import type { McpServer } from '@modelcontextprotocol/server';
import { DESPESA_HTML } from '../../ui/generated.js';
import { registrarRecurso } from '../shared/recurso.js';
import { DESPESA_RESOURCE_URI } from './resource-uri.js';

/** Registra o HTML do formulário de despesa como recurso MCP Apps (13.1, shared/recurso.ts). */
export function registrarRecursoDespesa(server: McpServer): void {
  registrarRecurso(server, 'Formulário de despesa', DESPESA_RESOURCE_URI, DESPESA_HTML);
}
