import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import { randomUUID } from 'node:crypto';
import * as z from 'zod';
import { logarChamada } from '../../log.js';
import { copyFeedbackDoApp, textosNovosEpico5 } from '../../rules/copy-app.js';
import { erros } from '../../rules/messages.js';
import { FORMULARIOS_HTML } from '../../ui/generated.js';
import type { ToolContext } from '../context.js';
import { fluxoComPrevia, registrarFallback, type Normalizado } from '../shared/previa.js';
import { registrarRecurso, uriVersionada } from '../shared/recurso.js';
import { CATEGORIAS, textoDoFeedback, textoDoFeedbackParaOModelo, validarFeedback, type FeedbackNormalizado } from './model.js';

/**
 * Ação "feedback" (8.5, 11.21): grava em `feedback` como `useEnviarFeedback` do app (P4)
 * e avisa o administrador pela Edge Function `notifica-admin`, com o JWT da PRÓPRIA
 * pessoa e só o id (pegadinha 3: nada de `usuario_id` no corpo). Sem evento de analytics,
 * como o app.
 */

const HTML = FORMULARIOS_HTML.feedback ?? '';
export const FEEDBACK_RESOURCE_URI = uriVersionada('feedback', HTML);
const ESPERA_DO_AVISO_MS = 1500;

/** Entrada do modelo: espelha `propor_feedback` do agente, tudo opcional. */
export const entradaAbrir = z.object({
  categoria: z.enum(CATEGORIAS).optional().describe('problema para erro, bug ou algo que não funciona; sugestao para melhoria ou ideia; elogio para quando a pessoa diz que gostou.'),
  mensagem: z.string().optional().describe('O feedback com as palavras da pessoa, fiel ao que ela disse, em uma a três frases. Sem nome de paciente nem valores, a menos que sejam necessários para entender o problema.'),
});

export type PreenchimentoDeFeedback = { formulario_id: string; campos: { categoria: string; mensagem: string } };

export function preencherFeedback(args: z.infer<typeof entradaAbrir>, id: string = randomUUID()): PreenchimentoDeFeedback {
  return { formulario_id: id, campos: { categoria: args.categoria ?? 'problema', mensagem: args.mensagem?.trim() ?? '' } };
}

export type RespostaDeFeedback =
  | { ok: true; ids: string[]; resumo: string; titulo: string }
  | { ok: false; erros: Array<{ campo: string | null; mensagem: string }>; ids: string[] };

/**
 * Grava e avisa. O aviso é secundário, como no app: se falhar, o feedback já está gravado
 * e a pessoa não precisa saber. Esperamos no máximo 1,5 s porque a função serverless pode
 * ser encerrada assim que a resposta sai.
 */
export async function gravarFeedback(f: FeedbackNormalizado, ctx: ToolContext): Promise<RespostaDeFeedback> {
  const r = await ctx.db
    .from('feedback')
    .insert({ mensagem: textoDoFeedback(f), email: ctx.email, app_name: 'agenda_psi' })
    .select('id')
    .single();
  if (r.error || !r.data) return { ok: false, erros: [{ campo: null, mensagem: erros.inesperado }], ids: [] };
  const id = String(r.data.id);
  const aviso = ctx.db.functions.invoke('notifica-admin', { body: { tipo: 'feedback', referencia: id } }).catch(() => undefined);
  await Promise.race([aviso, new Promise((ok) => setTimeout(ok, ESPERA_DO_AVISO_MS))]);
  return { ok: true, ids: [id], resumo: textoDoFeedback(f), titulo: copyFeedbackDoApp.sucesso };
}

export const entradaSalvar = z.object({
  feedback: z.object({ categoria: z.string().optional(), mensagem: z.string().optional() }).describe('O feedback conferido no formulário.'),
});

export async function salvarFeedback(args: z.infer<typeof entradaSalvar>, ctx: ToolContext): Promise<RespostaDeFeedback> {
  const v = validarFeedback(args.feedback);
  if (!v.ok) return { ok: false, erros: v.erros, ids: [] };
  try {
    return await gravarFeedback(v.dados, ctx);
  } catch {
    return { ok: false, erros: [{ campo: null, mensagem: erros.inesperado }], ids: [] };
  }
}

const DESCRICAO_ABRIR =
  'Abre o formulário de feedback para a equipe do Agenda Psi (um problema, erro ou bug no app, uma sugestão de melhoria, ou um elogio), já preenchido com as palavras da pessoa. Não envia nada: a pessoa confere o texto e clica em Enviar. Use quando a pessoa reclamar de algo que não funciona, relatar um erro, sugerir uma melhoria ou elogiar o app.';

const DESCRICAO_FALLBACK =
  'Envia um feedback para a equipe do Agenda Psi em duas chamadas, para clientes sem formulário. Na primeira (sem confirmar), devolve a prévia do texto e um token_previa; nada é enviado. Mostre o texto à pessoa. Nunca envie confirmar=true sem ela concordar.';

const entradaFallback = entradaAbrir.extend({
  confirmar: z.boolean().optional().describe('true só na segunda chamada, depois de a pessoa concordar com a prévia.'),
  token_previa: z.string().optional().describe('O token_previa devolvido pela primeira chamada.'),
});

/** `registrar_feedback` (13.4). */
export async function registrarFeedback(e: z.infer<typeof entradaFallback>, ctx: ToolContext): Promise<CallToolResult> {
  const v = validarFeedback({ categoria: e.categoria ?? 'problema', mensagem: e.mensagem ?? '' });
  const n: Normalizado<FeedbackNormalizado> = v.ok
    ? { ok: true, dados: v.dados, previa: { texto: textoDoFeedback(v.dados) } }
    : { ok: false, pendencias: [], erros: v.erros };
  return fluxoComPrevia(ctx, 'registrar_feedback', n, e, async (d) => {
    const r = await gravarFeedback(d, ctx);
    return r.ok ? { ok: true, ids: r.ids, resumo: r.resumo } : { ok: false, erros: r.erros };
  }, (r) => textoDoFeedbackParaOModelo(r.ids[0] ?? ''));
}

/** Registra a ação "feedback" conforme o cliente (13.4). */
export function registrarAcaoFeedback(server: McpServer, ctx: ToolContext): void {
  if (ctx.ui !== 'nao') {
    registrarRecurso(server, 'Formulário de feedback', FEEDBACK_RESOURCE_URI, HTML);
    registerAppTool(server, 'abrir_formulario_feedback', {
      title: copyFeedbackDoApp.titulo,
      description: DESCRICAO_ABRIR,
      inputSchema: entradaAbrir,
      _meta: { ui: { resourceUri: FEEDBACK_RESOURCE_URI, visibility: ['model'] } },
    }, async (args) => {
      const inicio = performance.now();
      const p = preencherFeedback(args);
      logarChamada('abrir_formulario_feedback', inicio, true, ctx.sub);
      return { content: [{ type: 'text', text: textosNovosEpico5.formularioAberto('feedback') }], structuredContent: p };
    });
    registerAppTool(server, 'salvar_feedback', {
      description: 'Envia o feedback conferido pela pessoa no formulário. Chamada só pelo formulário de feedback.',
      inputSchema: entradaSalvar,
      _meta: { ui: { resourceUri: FEEDBACK_RESOURCE_URI, visibility: ['app'] } },
    }, async (args) => {
      const inicio = performance.now();
      const r = await salvarFeedback(args, ctx);
      logarChamada('salvar_feedback', inicio, r.ok, ctx.sub);
      const texto = r.ok ? textoDoFeedbackParaOModelo(r.ids[0] ?? '') : r.erros.map((x) => x.mensagem).join('; ');
      return { content: [{ type: 'text', text: texto }], structuredContent: r };
    });
  }
  registrarFallback(server, ctx, 'registrar_feedback', DESCRICAO_FALLBACK, entradaFallback, registrarFeedback);
}
