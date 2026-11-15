import type { CallToolResult } from '@modelcontextprotocol/server';
import type { SuporteAUi } from '../client-capabilities.js';
import type { Config } from '../config.js';
import { logarChamada } from '../log.js';
import type { DbClient } from '../supabase.js';

/**
 * O que toda ferramenta recebe, montado uma vez por request em handler.ts:
 * - `db`: o cliente COMO o usuário; `sub` e `email`: do token, nunca de argumento (P1);
 * - `config`: segredo da prévia e analytics;
 * - `ui`: se o cliente mostra MCP Apps, que decide o fallback (13.4).
 */
export type ToolContext = {
  db: DbClient;
  sub: string;
  email: string | null;
  config: Pick<Config, 'previewSecret' | 'analytics'>;
  ui: SuporteAUi;
};

/** Resposta de leitura: objeto devolvido ao modelo, ou `{ erro }` como no agente. */
export type ResultadoDeLeitura = Record<string, unknown> | { erro: string };

/** Campos clínicos que nunca saem do servidor na v1 (P5, seção 20). */
const CAMPOS_CLINICOS = new Set(['observacoes']);

/**
 * Segunda tranca de P5: remove os campos clínicos em qualquer nível da resposta. A primeira
 * é o `select` de cada leitura, que não os pede; esta garante que nada vaza se uma consulta
 * mudar ou se o banco mandar o campo por engano (teste em test/tools/p5.test.ts).
 */
export function semCamposClinicos<T>(valor: T): T {
  if (Array.isArray(valor)) return valor.map(semCamposClinicos) as T;
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>)
        .filter(([k]) => !CAMPOS_CLINICOS.has(k))
        .map(([k, v]) => [k, semCamposClinicos(v)]),
    ) as T;
  }
  return valor;
}

/**
 * Executa a lógica de uma ferramenta e a converte para o formato MCP (seções 12 e 18).
 *
 * `{ erro }` vira `isError: true` com o texto curto, para o modelo se corrigir (como o
 * agente faz). Exceção inesperada vira uma mensagem genérica, sem stack. O log leva
 * só nome, duração, ok/erro e hash do `sub`.
 */
export async function executar(
  ferramenta: string,
  ctx: Pick<ToolContext, 'sub'>,
  logica: () => Promise<ResultadoDeLeitura>,
): Promise<CallToolResult> {
  const inicio = performance.now();
  try {
    const resultado = semCamposClinicos(await logica());
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
