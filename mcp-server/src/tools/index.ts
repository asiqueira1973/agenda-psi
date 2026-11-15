import type { McpServer } from '@modelcontextprotocol/server';
import type { ToolContext } from './context.js';
import { registrarListarTiposDespesa } from './expense/options.js';
import { registrarConsultarDespesas } from './read/consultar-despesas.js';

/**
 * Registra todas as ferramentas no `McpServer` do request (13.1). Cada módulo de
 * ação registra as suas; aqui só se lista. Nenhuma recebe `usuario_id` (P1): o
 * usuário vem do `ctx`, montado a partir do token.
 */
export function registrarFerramentas(server: McpServer, ctx: ToolContext): void {
  registrarConsultarDespesas(server, ctx);
  registrarListarTiposDespesa(server, ctx);
}
