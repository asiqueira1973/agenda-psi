import type { McpServer } from '@modelcontextprotocol/server';
import type { ToolContext } from './context.js';
import { registrarFallbackDespesa } from './expense/fallback.js';
import { registrarAbrirFormularioDespesa } from './expense/open-form.js';
import { registrarListarTiposDespesa } from './expense/options.js';
import { registrarRecursoDespesa } from './expense/resource.js';
import { registrarSalvarDespesa } from './expense/save.js';
import { registrarLeituras } from './read/index.js';

/**
 * Registra as ferramentas e os recursos no `McpServer` do request (13.1). Nenhuma recebe
 * `usuario_id` (P1): o usuário vem do `ctx`, montado a partir do token.
 *
 * Formulário × fallback (13.4), pelo que o cliente anunciou neste request:
 * - `sim` (tem MCP Apps): só o formulário;
 * - `nao`: só o fallback com prévia;
 * - `desconhecido` (cliente de 2025, que não repete as capacidades): os dois, para a
 *   pessoa nunca ficar sem caminho. Registrado em plans/epico-2.md.
 */
export function registrarFerramentas(server: McpServer, ctx: ToolContext): void {
  // As 9 leituras do agente (épico 4), para qualquer cliente, com ou sem UI.
  registrarLeituras(server, ctx);

  if (ctx.ui !== 'nao') {
    registrarRecursoDespesa(server);
    registrarAbrirFormularioDespesa(server, ctx);
    registrarListarTiposDespesa(server, ctx);
    registrarSalvarDespesa(server, ctx);
  }
  registrarFallbackDespesa(server, ctx);
}
