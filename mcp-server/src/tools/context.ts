import type { CallToolResult } from '@modelcontextprotocol/server';
import { logarChamada } from '../log.js';
import type { DbClient } from '../supabase.js';

/**
 * O que toda ferramenta recebe: o cliente COMO o usuário e o `sub` do token (P1).
 * Montado uma vez por request em handler.ts; nenhuma ferramenta lê usuário de argumento.
 */
export type ToolContext = { db: DbClient; sub: string };

/** Resposta de leitura: objeto devolvido ao modelo, ou `{ erro }` como no agente. */
export type ResultadoDeLeitura = Record<string, unknown> | { erro: string };

/**
 * Executa a lógica de uma ferramenta e a converte para o formato MCP (seções 12 e 18).
 *
 * `{ erro }` vira `isError: true` com o texto curto, para o modelo se corrigir (como o
 * agente faz). Exceção inesperada vira uma mensagem genérica, sem stack. O log leva
 * só nome, duração, ok/erro e hash do `sub`.
 */
export async function executar(
  ferramenta: string,
  ctx: ToolContext,
  logica: () => Promise<ResultadoDeLeitura>,
): Promise<CallToolResult> {
  const inicio = performance.now();
  try {
    const resultado = await logica();
    if ('erro' in resultado && typeof resultado.erro === 'string') {
      logarChamada(ferramenta, inicio, false, ctx.sub);
      return { isError: true, content: [{ type: 'text', text: resultado.erro }] };
    }
    logarChamada(ferramenta, inicio, true, ctx.sub);
    return {
      content: [{ type: 'text', text: JSON.stringify(resultado) }],
      structuredContent: resultado,
    };
  } catch {
    logarChamada(ferramenta, inicio, false, ctx.sub);
    return { isError: true, content: [{ type: 'text', text: 'falha inesperada ao consultar' }] };
  }
}
