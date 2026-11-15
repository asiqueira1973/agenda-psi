import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import { randomUUID } from 'node:crypto';
import * as z from 'zod';
import { logarChamada } from '../../log.js';
import { textosNovosEpico5 } from '../../rules/copy-app.js';
import { erros, textosParaOModelo } from '../../rules/messages.js';
import { FORMULARIOS_HTML } from '../../ui/generated.js';
import type { ToolContext } from '../context.js';
import { lerPacientesOpcoes, pacienteParaFormulario, type PacienteDaLinha } from '../shared/pacientes.js';
import { fluxoComPrevia, resposta, type Normalizado } from '../shared/previa.js';
import { registrarRecurso, uriVersionada } from '../shared/recurso.js';
import { textoDoRegistroParaOModelo } from './texto.js';
import type { Campo, Candidato, ErroDeRegistro, PreenchimentoDeRegistro, RespostaDeRegistro } from './tipos.js';

/**
 * Motor das edições e exclusões (épico 6, 8.6 e 13.3). Cada ação é uma `DefDeRegistro`:
 * como ler os candidatos, filtrar pela frase, montar os campos, validar e gravar. O motor
 * registra `abrir_formulario_<acao>` (modelo), `salvar_<acao>` (app) e `registrar_<acao>`
 * (fallback com prévia, 13.4), mais um `listar_registros` (app) para todas.
 *
 * Regras comuns, como `escolherAlvo` do agente do app: um registro casou com a frase,
 * vem escolhido; vários, até 6 para escolher; nenhum, os 6 mais recentes. Nunca escolhe
 * sozinho entre dois. O `salvar_*` relê o registro pelo id com a RLS da pessoa: o que
 * o formulário manda é só o que mudar, nunca o estado atual.
 */

const HTML = FORMULARIOS_HTML.record ?? '';
export const REGISTRO_RESOURCE_URI = uriVersionada('registro', HTML);
/** Quantos candidatos o formulário mostra quando a frase não basta (agente: RECENTES). */
export const RECENTES = 6;

type Args = Record<string, unknown>;
export type Valores = Record<string, string>;

/** O que `validar` devolve: as colunas a gravar e o antes/depois para a prévia. */
export type Mudancas = { colunas: Record<string, unknown>; linhas: Array<{ campo: string; antes: string; depois: string }> };

export type DefDeRegistro<R> = {
  acao: string;
  modo: 'edicao' | 'exclusao';
  /** "alteração de sessão": entra em "Abri o formulário de …". */
  qual: string;
  titulo: string;
  descricaoAbrir: string;
  descricaoFallback: string;
  /** Espelha o `propor_*` do agente do app, tudo opcional, sem observações (P5). */
  entrada: z.ZodObject<z.ZodRawShape>;
  porPaciente: boolean;
  /** Os registros candidatos, mais recentes primeiro, SEM observações (P5). */
  ler(ctx: ToolContext, pacienteId: string | null): Promise<R[] | null>;
  /** Um registro pelo id, com a RLS da pessoa; `null` se não existe ou não é dela. */
  lerUm(ctx: ToolContext, id: string): Promise<R | null>;
  /** Os que casam com o que a frase disse; `null` se a frase não disse nada que filtre. */
  casam(args: Args, todos: R[]): R[] | null;
  id(r: R): string;
  rotulo(r: R): string;
  /** Dados extras para montar os campos (tipos de despesa, agenda), lidos uma vez. */
  extra?(ctx: ToolContext): Promise<unknown>;
  campos(r: R, args: Args, extra: unknown): Campo[];
  aviso?(r: R, campos: Campo[], extra: unknown): string | undefined;
  /** Só na edição: valida e diz o que muda. Nada mudou é erro (`erros.nadaMudou`). */
  validar?(r: R, valores: Valores, extra: unknown): { ok: true; mudancas: Mudancas } | { ok: false; erros: ErroDeRegistro[] };
  gravar(r: R, mudancas: Mudancas | null, ctx: ToolContext, continuar: Valores): Promise<RespostaDeRegistro>;
  vazio: string;
  textos: PreenchimentoDeRegistro['textos'];
};

/** Monta o candidato: campos preenchidos e o aviso (ex.: horário que coincide). */
function candidato<R>(def: DefDeRegistro<R>, r: R, args: Args, extra: unknown): Candidato {
  const campos = def.campos(r, args, extra);
  const aviso = def.aviso?.(r, campos, extra);
  return { id: def.id(r), rotulo: def.rotulo(r), campos, ...(aviso ? { aviso } : {}) };
}

/** `escolherAlvo` do agente: um casou, vem escolhido; senão até 6 para a pessoa escolher. */
export function escolher<R>(def: DefDeRegistro<R>, args: Args, todos: R[]): { lista: R[]; escolhido: R | null } {
  const casam = def.casam(args, todos) ?? [];
  if (casam.length === 1) return { lista: casam, escolhido: casam[0] ?? null };
  if (casam.length > 1) return { lista: casam.slice(0, RECENTES), escolhido: null };
  return { lista: todos.slice(0, RECENTES), escolhido: null };
}

/** Lê e escolhe os candidatos de um paciente (ou de todos, se a ação não é por paciente). */
async function candidatosDe<R>(def: DefDeRegistro<R>, ctx: ToolContext, args: Args, pacienteId: string | null) {
  const [todos, extra] = await Promise.all([def.ler(ctx, pacienteId), def.extra?.(ctx)]);
  if (!todos) return null;
  const { lista, escolhido } = escolher(def, args, todos);
  return { candidatos: lista.map((r) => candidato(def, r, args, extra)), escolhido: escolhido ? def.id(escolhido) : null };
}

/** Pré-preenchimento do `abrir_formulario_<acao>`. */
export async function preencherRegistro<R>(def: DefDeRegistro<R>, args: Args, ctx: ToolContext, id: string = randomUUID()): Promise<PreenchimentoDeRegistro> {
  const avisos: string[] = [];
  let paciente: PacienteDaLinha | null = null;
  let pacienteId: string | null = null;
  if (def.porPaciente) {
    const p = pacienteParaFormulario(args.paciente as string | undefined, (await lerPacientesOpcoes(ctx)) ?? []);
    paciente = p.linha;
    pacienteId = p.linha.paciente_id || null;
    if (p.aviso) avisos.push(p.aviso);
  }
  // Por paciente e sem paciente resolvido: a pessoa escolhe e o formulário pede os candidatos.
  const c = !def.porPaciente || pacienteId ? await candidatosDe(def, ctx, args, pacienteId) : { candidatos: [], escolhido: null };
  return {
    formulario_id: id,
    acao: def.acao,
    qual: def.qual,
    modo: def.modo,
    ferramentaSalvar: `salvar_${def.acao}`,
    titulo: def.titulo,
    avisos,
    paciente,
    pedido: JSON.stringify(args),
    candidatos: c?.candidatos ?? [],
    escolhido: c?.escolhido ?? null,
    vazio: def.vazio,
    textos: def.textos,
  };
}

/** `salvar_<acao>`: relê pelo id (RLS), valida e grava. */
export async function salvarRegistro<R>(def: DefDeRegistro<R>, id: string, valores: Valores, continuar: Valores, ctx: ToolContext): Promise<RespostaDeRegistro> {
  try {
    const r = await def.lerUm(ctx, id);
    if (!r) return { ok: false, erros: [{ campo: null, mensagem: erros.semPermissao }] };
    let mudancas: Mudancas | null = null;
    if (def.validar) {
      const v = def.validar(r, valores, await def.extra?.(ctx));
      if (!v.ok) return { ok: false, erros: v.erros };
      mudancas = v.mudancas;
    }
    return await def.gravar(r, mudancas, ctx, continuar);
  } catch {
    return { ok: false, erros: [{ campo: null, mensagem: erros.inesperado }] };
  }
}

/** Os valores dos campos de um candidato, como o formulário mandaria. */
const valoresDe = (c: Candidato): Valores => Object.fromEntries(c.campos.filter((x) => x.tipo !== 'leitura').map((x) => [x.nome, x.valor]));

/** `registrar_<acao>` (13.4): pendência de paciente e de registro; prévia com antes e depois. */
export async function registrarRegistro<R>(def: DefDeRegistro<R>, e: Args, ctx: ToolContext): Promise<CallToolResult> {
  const pendencias: Array<{ aviso: string; opcoes: Array<{ id: string; nome: string }> }> = [];
  let pacienteId: string | null = null;
  if (def.porPaciente) {
    const pacientes = await lerPacientesOpcoes(ctx);
    if (!pacientes) return resposta({ ok: false }, erros.inesperado, true);
    const dito = typeof e.paciente_id === 'string' ? e.paciente_id.trim() : '';
    const p = dito ? null : pacienteParaFormulario(e.paciente as string | undefined, pacientes);
    pacienteId = dito || p?.linha.paciente_id || null;
    if (!pacienteId) {
      pendencias.push({ aviso: p?.aviso ?? 'Diga o paciente', opcoes: p?.linha.candidatos.length ? p.linha.candidatos : pacientes.map((x) => ({ id: x.id, nome: x.nome })) });
      return resposta({ ok: false, pendencias }, textosParaOModelo.nadaGravadoComPendencias, true);
    }
  }
  const [todos, extra] = await Promise.all([def.ler(ctx, pacienteId), def.extra?.(ctx)]);
  if (!todos) return resposta({ ok: false }, erros.inesperado, true);
  if (!todos.length) return resposta({ ok: false }, def.vazio, true);
  const pedido = typeof e.registro_id === 'string' ? todos.find((r) => def.id(r) === e.registro_id) : undefined;
  const { lista, escolhido } = pedido ? { lista: [pedido], escolhido: pedido } : escolher(def, e, todos);
  if (!escolhido) {
    pendencias.push({ aviso: 'Escolha o registro (registro_id)', opcoes: lista.map((r) => ({ id: def.id(r), nome: def.rotulo(r) })) });
    return resposta({ ok: false, pendencias }, 'Nada foi gravado. Mostre os registros à pessoa, pergunte qual é e chame de novo com registro_id, sem confirmar.', true);
  }
  const c = candidato(def, escolhido, e, extra);
  let n: Normalizado<{ id: string; valores: Valores }>;
  if (def.validar) {
    const v = def.validar(escolhido, valoresDe(c), extra);
    n = v.ok
      ? { ok: true, dados: { id: c.id, valores: valoresDe(c) }, previa: { registro: c.rotulo, muda: v.mudancas.linhas, ...(c.aviso ? { aviso: c.aviso } : {}) } }
      : { ok: false, pendencias: [], erros: v.erros };
  } else {
    n = { ok: true, dados: { id: c.id, valores: {} }, previa: { registro: c.rotulo, apaga: true, aviso: def.textos.aviso } };
  }
  return fluxoComPrevia(ctx, `registrar_${def.acao}`, n, e as { confirmar?: boolean; token_previa?: string }, async (d) => {
    const r = await salvarRegistro(def, d.id, d.valores, {}, ctx);
    return r.ok ? { ok: true, ids: r.ids, resumo: `${r.titulo} ${r.resumo}` } : { ok: false, erros: r.erros };
  }, (r) => textoDoRegistroParaOModelo(r.resumo, r.ids));
}


const entradaSalvar = z.object({
  id: z.string().describe('Id do registro escolhido no formulário.'),
  valores: z.record(z.string(), z.string()).optional().describe('Campos do formulário, em texto.'),
  continuar: z.record(z.string(), z.string()).optional().describe('O que a resposta anterior pediu para mandar de volta.'),
});

const camposDoFallback = {
  paciente_id: z.string().optional().describe('Id do paciente, quando a pessoa já escolheu entre as pendências.'),
  registro_id: z.string().optional().describe('Id do registro, quando a pessoa já escolheu entre as pendências.'),
  confirmar: z.boolean().optional().describe('true só na segunda chamada, depois de a pessoa concordar com a prévia.'),
  token_previa: z.string().optional().describe('O token_previa devolvido pela primeira chamada.'),
};

/** Registra as ferramentas de uma ação conforme o cliente (13.4). */
export function registrarAcaoDeRegistro<R>(server: McpServer, ctx: ToolContext, def: DefDeRegistro<R>): void {
  if (ctx.ui !== 'nao') {
    registerAppTool(server, `abrir_formulario_${def.acao}`, {
      title: def.titulo,
      description: def.descricaoAbrir,
      inputSchema: def.entrada,
      _meta: { ui: { resourceUri: REGISTRO_RESOURCE_URI, visibility: ['model'] } },
    }, async (args: unknown) => {
      const inicio = performance.now();
      const p = await preencherRegistro(def, args as Args, ctx);
      logarChamada(`abrir_formulario_${def.acao}`, inicio, true, ctx.sub);
      const vazio = p.candidatos.length || (def.porPaciente && !p.paciente?.paciente_id) ? '' : ` ${def.vazio}`;
      const avisos = p.avisos.length ? ` Avisos: ${p.avisos.join('; ')}.` : '';
      return { content: [{ type: 'text', text: `${textosNovosEpico5.formularioAberto(def.qual)}${avisos}${vazio}` }], structuredContent: p };
    });
    registerAppTool(server, `salvar_${def.acao}`, {
      description: `Grava a ${def.qual} conferida pela pessoa no formulário. Chamada só pelo formulário.`,
      inputSchema: entradaSalvar,
      _meta: { ui: { resourceUri: REGISTRO_RESOURCE_URI, visibility: ['app'] } },
    }, async (args) => {
      const inicio = performance.now();
      const r = await salvarRegistro(def, args.id, args.valores ?? {}, args.continuar ?? {}, ctx);
      logarChamada(`salvar_${def.acao}`, inicio, r.ok, ctx.sub);
      const texto = r.ok ? textoDoRegistroParaOModelo(`${r.titulo} ${r.resumo}`, r.ids) : r.erros.map((x) => x.mensagem).join('; ');
      return { content: [{ type: 'text', text: texto }], structuredContent: r };
    });
  }
  if (ctx.ui === 'sim') return;
  const entrada = def.entrada.extend(camposDoFallback);
  server.registerTool(`registrar_${def.acao}`, { description: def.descricaoFallback, inputSchema: entrada, _meta: { ui: { visibility: ['model'] } } }, async (args: unknown) => {
    const inicio = performance.now();
    const r = await registrarRegistro(def, args as Args, ctx);
    logarChamada(`registrar_${def.acao}`, inicio, !r.isError, ctx.sub);
    return r;
  });
}

/**
 * Recurso do formulário e `listar_registros` (app): quando a pessoa escolhe o paciente
 * no formulário, devolve os candidatos dele para a mesma ação e o mesmo pedido.
 */
export function registrarComunsDeRegistro(server: McpServer, ctx: ToolContext, defs: Array<DefDeRegistro<never>>): void {
  if (ctx.ui === 'nao') return;
  registrarRecurso(server, 'Formulário de edição e exclusão', REGISTRO_RESOURCE_URI, HTML);
  server.registerTool('listar_registros', {
    description: 'Os registros candidatos de um paciente para uma edição ou exclusão. Usada pelo formulário.',
    inputSchema: z.object({ acao: z.string(), paciente_id: z.string(), pedido: z.string().optional() }),
    annotations: { readOnlyHint: true },
    _meta: { ui: { visibility: ['app'] } },
  }, async ({ acao, paciente_id, pedido }) => {
    const def = defs.find((d) => d.acao === acao);
    let args: Args = {};
    try {
      args = pedido ? (JSON.parse(pedido) as Args) : {};
    } catch {
      args = {};
    }
    const c = def ? await candidatosDe(def, ctx, args, paciente_id) : null;
    if (!c) return { content: [{ type: 'text', text: 'falha ao ler os registros' }], isError: true };
    return { content: [{ type: 'text', text: `${c.candidatos.length} registros.` }], structuredContent: c };
  });
}

/**
 * Exclusão por id, como os `useExcluir*` do app, com a contagem de linhas: a policy de
 * DELETE da conta demo não dá erro, só não apaga. Zero linhas e `demo_uid() = sub` é
 * a conta demo (12); zero linhas sem ser a demo, registro não encontrado.
 */
export async function excluirPorId(ctx: ToolContext, tabela: 'sessoes' | 'pagamentos' | 'despesas' | 'agenda_semana_padrao', id: string): Promise<ErroDeRegistro | null> {
  const r = await ctx.db.from(tabela).delete().eq('id', id).select('id');
  if (r.error) return { campo: null, mensagem: erros.inesperado };
  if ((r.data ?? []).length > 0) return null;
  const demo = await ctx.db.rpc('demo_uid').then((x) => x.data, () => null);
  return { campo: null, mensagem: demo && demo === ctx.sub ? erros.contaDemoNaoExclui : erros.semPermissao };
}

/** Linha do antes/depois quando o campo mudou. */
export function linhaQueMudou(c: Campo | undefined, depoisRotulo: string): Mudancas['linhas'] {
  return c ? [{ campo: c.rotulo, antes: c.atualRotulo, depois: depoisRotulo }] : [];
}
