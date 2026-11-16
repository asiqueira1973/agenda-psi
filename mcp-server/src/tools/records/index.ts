import type { McpServer } from '@modelcontextprotocol/server';
import type { ToolContext } from '../context.js';
import { edicaoPaciente, remocaoHorario, trocaHorario } from './acoes-cadastro.js';
import { edicaoDespesa, edicaoPagamento, edicaoSessao, exclusaoDespesa, exclusaoPagamento, exclusaoSessao } from './acoes-financeiras.js';
import { registrarAcaoDeRegistro, registrarComunsDeRegistro, type DefDeRegistro } from './motor.js';

/** As nove ações do épico 6 (8.6), na ordem da tabela 13.3. */
export const ACOES_DE_REGISTRO = [
  trocaHorario, remocaoHorario, edicaoPaciente,
  edicaoSessao, exclusaoSessao, edicaoPagamento, exclusaoPagamento, edicaoDespesa, exclusaoDespesa,
] as unknown as Array<DefDeRegistro<never>>;

/** Registra as edições e exclusões conforme o cliente (13.4). */
export function registrarRegistros(server: McpServer, ctx: ToolContext): void {
  registrarComunsDeRegistro(server, ctx, ACOES_DE_REGISTRO);
  for (const def of ACOES_DE_REGISTRO) registrarAcaoDeRegistro(server, ctx, def);
}
