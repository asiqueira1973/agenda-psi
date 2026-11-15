import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import { executar, type ResultadoDeLeitura, type ToolContext } from '../context.js';

/**
 * Opções do campo "Tipo da despesa" do formulário (8.2 e 13.3): `id` e `nome` de
 * `tipos_despesa`, ordenados por nome. A policy da tabela já filtra os ativos.
 * Catálogo global, cerca de 13 linhas. Devolve `{ tipos }` ou `{ erro }`.
 */
export async function listarTiposDespesa({ db }: ToolContext): Promise<ResultadoDeLeitura> {
  const { data, error } = await db
    .from('tipos_despesa')
    .select('id, nome')
    .order('nome', { ascending: true });
  if (error) return { erro: 'falha ao ler os tipos de despesa' };
  return { tipos: data ?? [] };
}

/**
 * Registra `listar_tipos_despesa` com visibilidade só para o app (13.1): o modelo não
 * a vê; quem chama é o formulário, por `callServerTool`.
 */
export function registrarListarTiposDespesa(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'listar_tipos_despesa',
    {
      description: 'Lista os tipos de despesa (id e nome), ordenados por nome. Usada pelo formulário de despesa.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
      _meta: { ui: { visibility: ['app'] } },
    },
    () => executar('listar_tipos_despesa', ctx, () => listarTiposDespesa(ctx)),
  );
}
