import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import type * as z from 'zod';
import { logarChamada } from '../../log.js';
import { conferirTokenDePrevia, emitirTokenDePrevia } from '../../preview-token.js';
import { erros, textosParaOModelo } from '../../rules/messages.js';
import type { ToolContext } from '../context.js';

/** Um erro ligado a um campo (12); `campo: null` é a mensagem geral. */
export type ErroGenerico = { campo: string | null; mensagem: string };

/** Resposta de qualquer `salvar_*` (13.3 e 12). */
export type RespostaGenerica =
  | { ok: true; ids: string[]; resumo: string }
  | { ok: false; erros: ErroGenerico[] };

/** O que a normalização de uma ação devolve ao fluxo da prévia (13.4). */
export type Normalizado<D> =
  | { ok: true; dados: D; previa: Record<string, unknown> }
  | { ok: false; pendencias: unknown[]; erros: ErroGenerico[] };

/** Resultado MCP com texto e estrutura; `isError` quando nada foi gravado por algo a corrigir. */
export function resposta(estrutura: Record<string, unknown>, texto: string, isError = false): CallToolResult {
  return { content: [{ type: 'text', text: texto }], structuredContent: estrutura, ...(isError ? { isError } : {}) };
}

/**
 * Fluxo de prévia e confirmação de QUALQUER `registrar_*` (13.4), extraído da despesa.
 *
 * Chamada 1 (sem `confirmar`): devolve `previa`, `pendencias` e, sem pendência nem erro,
 * o `token_previa` (HMAC de sub + ação + dados normalizados + exp). Chamada 2: recusa
 * pendência aberta, recalcula o HMAC sobre os dados de agora e só grava se bater e não
 * tiver vencido. Dados diferentes dão a mensagem literal da 13.4. A barreira de P2 não
 * depende do modelo.
 */
export async function fluxoComPrevia<D>(
  ctx: ToolContext,
  acao: string,
  n: Normalizado<D>,
  e: { confirmar?: boolean | undefined; token_previa?: string | undefined },
  gravar: (dados: D) => Promise<RespostaGenerica>,
  textoDoSucesso: (r: { ids: string[]; resumo: string }) => string,
): Promise<CallToolResult> {
  if (!n.ok) {
    if (e.confirmar && n.pendencias.length) return resposta({ ok: false, pendencias: n.pendencias }, erros.pendenciasAbertas, true);
    return resposta({ ok: false, pendencias: n.pendencias, erros: n.erros }, textosParaOModelo.nadaGravadoComPendencias, true);
  }
  if (!e.confirmar) {
    const token = emitirTokenDePrevia(ctx.config.previewSecret, ctx.sub, acao, n.dados);
    return resposta({ ok: true, previa: n.previa, pendencias: [], token_previa: token }, textosParaOModelo.previaPronta);
  }
  const conferencia = conferirTokenDePrevia(ctx.config.previewSecret, ctx.sub, acao, n.dados, e.token_previa);
  if (conferencia === 'divergente') return resposta({ ok: false }, erros.dadosMudaram, true);
  if (conferencia !== 'ok') return resposta({ ok: false }, erros.tokenInvalido, true);

  const r = await gravar(n.dados).catch((): RespostaGenerica => ({ ok: false, erros: [{ campo: null, mensagem: erros.inesperado }] }));
  if (!r.ok) return resposta(r, r.erros.map((x) => x.mensagem).join('; '), true);
  return resposta(r, textoDoSucesso(r));
}

/**
 * Registra um `registrar_*` (visível ao modelo) SÓ quando o cliente não mostra MCP Apps,
 * ou não diz se mostra (13.4; ver tools/index.ts). Loga sem PII (18).
 */
export function registrarFallback<S extends z.ZodObject>(
  server: McpServer,
  ctx: ToolContext,
  nome: string,
  descricao: string,
  entrada: S,
  executar: (args: z.infer<S>, ctx: ToolContext) => Promise<CallToolResult>,
): void {
  if (ctx.ui === 'sim') return;
  // O SDK não infere o tipo de um schema genérico; a validação em tempo de execução é a do zod.
  const schema = entrada as unknown as z.ZodObject<z.ZodRawShape>;
  server.registerTool(nome, { description: descricao, inputSchema: schema, _meta: { ui: { visibility: ['model'] } } }, async (args: unknown) => {
    const inicio = performance.now();
    const r = await executar(args as z.infer<S>, ctx);
    logarChamada(nome, inicio, !r.isError, ctx.sub);
    return r;
  });
}
