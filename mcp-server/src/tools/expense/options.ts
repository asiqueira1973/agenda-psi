import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import { executar, type ResultadoDeLeitura, type ToolContext } from '../context.js';
import { DESPESA_RESOURCE_URI, type TipoDespesa } from './schema.js';

/**
 * Lê o catálogo de tipos de despesa: `id` e `nome`, ordenados por nome (8.2 e 13.3).
 * A policy da tabela já filtra os ativos. Catálogo global, cerca de 13 linhas.
 * Devolve a lista, ou `null` se o banco falhar.
 */
export async function lerTiposDespesa({ db }: Pick<ToolContext, 'db'>): Promise<TipoDespesa[] | null> {
  const { data, error } = await db
    .from('tipos_despesa')
    .select('id, nome')
    .order('nome', { ascending: true });
  return error ? null : (data ?? []);
}

/** Opções do campo "Tipo da despesa": `{ tipos }` ou `{ erro }`. */
export async function listarTiposDespesa(ctx: Pick<ToolContext, 'db'>): Promise<ResultadoDeLeitura> {
  const tipos = await lerTiposDespesa(ctx);
  return tipos ? { tipos } : { erro: 'falha ao ler os tipos de despesa' };
}

/**
 * Registra `listar_tipos_despesa` com visibilidade só para o app (13.1): o modelo não
 * a vê; quem chama é o formulário, por `callServerTool`.
 */
export function registrarListarTiposDespesa(server: McpServer, ctx: ToolContext): void {
  registerAppTool(
    server,
    'listar_tipos_despesa',
    {
      description: 'Lista os tipos de despesa (id e nome), ordenados por nome. Usada pelo formulário de despesa.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: DESPESA_RESOURCE_URI, visibility: ['app'] } },
    },
    () => executar('listar_tipos_despesa', ctx, () => listarTiposDespesa(ctx)),
  );
}
