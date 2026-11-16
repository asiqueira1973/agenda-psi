import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import { randomUUID } from 'node:crypto';
import * as z from 'zod';
import { enviarEvento } from '../../analytics.js';
import { eventos } from '../../events.js';
import { logarChamada } from '../../log.js';
import { mensagensEpico5DoApp, sucessoHorarioDoApp, textosNovosEpico5 } from '../../rules/copy-app.js';
import { erros } from '../../rules/messages.js';
import { FORMULARIOS_HTML } from '../../ui/generated.js';
import { executar, type ResultadoDeLeitura, type ToolContext } from '../context.js';
import { lerPacientesOpcoes, pacienteParaFormulario, type PacienteDaLinha, type PacienteOpcao } from '../shared/pacientes.js';
import { fluxoComPrevia, registrarFallback, resposta, type Normalizado } from '../shared/previa.js';
import { registrarRecurso, uriVersionada } from '../shared/recurso.js';
import {
  avisoDeConflito,
  diaDoNome,
  DIAS_DO_MODELO,
  horaFimPadrao,
  horaValida,
  resumoDoHorario,
  textoDosHorariosParaOModelo,
  validarHorario,
  type HorarioDaAgenda,
  type HorarioNormalizado,
  type LinhaDeHorario,
} from './model.js';

/**
 * Ação "horário" (8.5, 13.3): horários fixos na agenda semanal para pacientes JÁ
 * cadastrados. Grava como `useCriarAgendamento` do app (P4), `dia_semana` 1–7
 * (pegadinha 7). Sobreposição com outro horário é AVISO, não bloqueio (11.19).
 */

const HTML = FORMULARIOS_HTML.schedule ?? '';
export const HORARIO_RESOURCE_URI = uriVersionada('horario', HTML);

/** Horário como o modelo descreve, sem paciente (também usado pelo cadastro de paciente). */
export const horarioDoModeloSchema = z.object({
  dia: z.enum(DIAS_DO_MODELO).optional().describe('Dia da semana do horário fixo.'),
  hora_inicio: z.string().optional().describe('Hora HH:MM, 24h.'),
  hora_fim: z.string().optional().describe('Só se a pessoa disser. Padrão: 50 minutos depois.'),
});

/** Item como o modelo descreve (espelha `propor_horarios` do agente). */
const itemDoModelo = horarioDoModeloSchema.extend({
  paciente: z.string().optional().describe('Nome do paciente como a pessoa disse. O servidor procura no cadastro.'),
});
export const entradaAbrir = z.object({ itens: z.array(itemDoModelo).optional().describe('Um item por horário fixo.') });

/** Horário que o modelo descreveu, em texto do formulário (fim padrão +50 min, 11.7). */
export function horarioDoModelo(i: z.infer<typeof horarioDoModeloSchema>): Omit<LinhaDeHorario, 'paciente_id'> {
  const inicio = horaValida(i.hora_inicio ?? '') ?? '';
  const fim = horaValida(i.hora_fim ?? '') ?? (inicio ? horaFimPadrao(inicio) : '');
  const dia = diaDoNome(i.dia);
  // Dia não dito fica vazio: a pessoa escolhe no formulário; no fallback é erro (pegadinha 7).
  return { dia_semana: dia ? String(dia) : '', hora_inicio: inicio, hora_fim: fim };
}

/** Lê a agenda para o aviso de sobreposição (11.19). Só nome do paciente e horas; nada clínico. */
export async function lerAgenda({ db, sub }: Pick<ToolContext, 'db' | 'sub'>): Promise<HorarioDaAgenda[] | null> {
  const { data, error } = await db
    .from('view_agenda_semana_padrao')
    .select('id, paciente_nome, dia_semana, hora_inicio, hora_fim')
    .eq('usuario_id', sub);
  return error ? null : (data ?? []);
}

export type PreenchimentoDeHorarios = {
  formulario_id: string;
  linhas: Array<{ campos: LinhaDeHorario; paciente: PacienteDaLinha }>;
  avisos: string[];
};

/** Pré-preenchimento: paciente pela 11.14, dia pelo nome, fim padrão, e o aviso de sobreposição. */
export function preencherHorarios(
  args: z.infer<typeof entradaAbrir>, pacientes: PacienteOpcao[], agenda: HorarioDaAgenda[], id: string = randomUUID(),
): PreenchimentoDeHorarios {
  const itens = args.itens?.length ? args.itens : [{}];
  const avisos: string[] = [];
  const linhas = itens.map((i: z.infer<typeof itemDoModelo>) => {
    const p = pacienteParaFormulario(i.paciente, pacientes);
    if (p.aviso) avisos.push(p.aviso);
    const campos = { paciente_id: p.linha.paciente_id, ...horarioDoModelo(i) };
    const v = validarHorario(campos, '');
    const conflito = v.ok ? avisoDeConflito(v.dados, agenda) : null;
    if (conflito) avisos.push(conflito);
    return { paciente: p.linha, campos };
  });
  return { formulario_id: id, linhas, avisos };
}

export type RespostaDeHorarios =
  | { ok: true; ids: string[]; resumo: string; titulo: string }
  | { ok: false; erros: Array<{ campo: string | null; mensagem: string }>; gravadas: number[]; ids: string[]; resumo?: string };

export type HorarioComPaciente = HorarioNormalizado & { paciente_id: string };

/**
 * Grava um horário como `useCriarAgendamento`: `usuario_id` do token, `dia_semana` 1–7,
 * horas HH:MM, `observacoes: null`. Um `agenda_psi_novoagendamento` (tela `mcp_horario`
 * ou a do paciente). Devolve o id ou `null`. Usado também pelo cadastro de paciente.
 */
export async function inserirHorario(h: HorarioComPaciente, ctx: ToolContext, tela: `mcp_${string}`): Promise<string | null> {
  const r = await ctx.db
    .from('agenda_semana_padrao')
    .insert({ usuario_id: ctx.sub, paciente_id: h.paciente_id, dia_semana: h.dia_semana, hora_inicio: h.hora_inicio, hora_fim: h.hora_fim, observacoes: null })
    .select('id')
    .single();
  if (r.error || !r.data) return null;
  await enviarEvento(ctx.config, { nome: eventos.novoAgendamento, id: r.data.id, distinctId: ctx.email, tela, descricao: 'novo agendamento criado' });
  return r.data.id;
}

/** Grava em ordem; confere que o paciente é da pessoa; falha parcial diz o que faltou (8.5). */
export async function gravarHorarios(dados: HorarioComPaciente[], ctx: ToolContext): Promise<RespostaDeHorarios> {
  const pacientes = await lerPacientesOpcoes(ctx);
  if (!pacientes) return { ok: false, erros: [{ campo: null, mensagem: erros.inesperado }], gravadas: [], ids: [] };
  const nomeDe = new Map(pacientes.map((p) => [p.id, p.nome]));
  const fora = dados.map((d, i) => (nomeDe.has(d.paciente_id) ? null : i)).filter((i): i is number => i !== null);
  if (fora.length) return { ok: false, erros: fora.map((i) => ({ campo: `${i}.paciente_id`, mensagem: mensagensEpico5DoApp.pacienteNaoEscolhido })), gravadas: [], ids: [] };
  const ids: string[] = [];
  for (const [i, d] of dados.entries()) {
    const id = await inserirHorario(d, ctx, 'mcp_horario');
    if (!id) {
      const faltam = dados.slice(i).map((x) => resumoDoHorario(nomeDe.get(x.paciente_id) ?? '', x));
      const resumo = dados.slice(0, i).map((x) => resumoDoHorario(nomeDe.get(x.paciente_id) ?? '', x)).join('; ');
      return { ok: false, erros: [{ campo: null, mensagem: i === 0 ? erros.inesperado : textosNovosEpico5.naoGravadas(faltam) }], gravadas: dados.slice(0, i).map((_, k) => k), ids, resumo };
    }
    ids.push(id);
  }
  return {
    ok: true,
    ids,
    resumo: dados.map((d) => resumoDoHorario(nomeDe.get(d.paciente_id) ?? '', d)).join('; '),
    titulo: dados.length === 1 ? sucessoHorarioDoApp : textosNovosEpico5.horariosCriados,
  };
}

/** Valida todas as linhas (paciente + horário). */
export function validarHorarios(linhas: Partial<LinhaDeHorario>[]):
  { ok: true; dados: HorarioComPaciente[] } | { ok: false; erros: Array<{ campo: string | null; mensagem: string }> } {
  const erros: Array<{ campo: string | null; mensagem: string }> = [];
  const dados: HorarioComPaciente[] = [];
  linhas.forEach((l, i) => {
    const paciente = (l.paciente_id ?? '').trim();
    if (!paciente) erros.push({ campo: `${i}.paciente_id`, mensagem: mensagensEpico5DoApp.pacienteNaoEscolhido });
    const v = validarHorario(l, `${i}.`);
    if (!v.ok) erros.push(...v.erros);
    else if (paciente) dados.push({ ...v.dados, paciente_id: paciente });
  });
  if (!linhas.length) erros.push({ campo: '0.paciente_id', mensagem: mensagensEpico5DoApp.pacienteNaoEscolhido });
  return erros.length ? { ok: false, erros } : { ok: true, dados };
}

export const entradaSalvar = z.object({
  horarios: z.array(z.object({
    paciente_id: z.string().optional(),
    dia_semana: z.string().optional(),
    hora_inicio: z.string().optional(),
    hora_fim: z.string().optional(),
  })).describe('Os horários conferidos no formulário.'),
});

/** `salvar_horarios` (só app): revalida (P3) e grava. Sobreposição não bloqueia (11.19). */
export async function salvarHorarios(args: z.infer<typeof entradaSalvar>, ctx: ToolContext): Promise<RespostaDeHorarios> {
  const v = validarHorarios(args.horarios);
  if (!v.ok) return { ok: false, erros: v.erros, gravadas: [], ids: [] };
  try {
    return await gravarHorarios(v.dados, ctx);
  } catch {
    return { ok: false, erros: [{ campo: null, mensagem: erros.inesperado }], gravadas: [], ids: [] };
  }
}

const DESCRICAO_ABRIR =
  'Abre o formulário para adicionar UM OU MAIS horários fixos na agenda semanal de pacientes JÁ cadastrados, já preenchido com o que a pessoa disse. Use para "põe a Laura toda quarta às 10h". Paciente novo usa abrir_formulario_paciente. Não grava nada: a pessoa confere e clica em Salvar. Horário que coincide com outro aparece como aviso.';

const DESCRICAO_FALLBACK =
  'Adiciona UM OU MAIS horários fixos em duas chamadas, para clientes sem formulário. Na primeira (sem confirmar), devolve a prévia, os avisos de horário que coincide com outro, as pendências e um token_previa; nada é gravado. Mostre a prévia e os avisos à pessoa. Nunca envie confirmar=true sem ela concordar.';

const entradaFallback = z.object({
  itens: z.array(itemDoModelo.extend({ paciente_id: z.string().optional().describe('Id do paciente, quando a pessoa já escolheu entre as pendências.') })).describe('Um item por horário.'),
  confirmar: z.boolean().optional().describe('true só na segunda chamada, depois de a pessoa concordar com a prévia.'),
  token_previa: z.string().optional().describe('O token_previa devolvido pela primeira chamada.'),
});

/** `registrar_horarios` (13.4): pendências de paciente, avisos de sobreposição na prévia. */
export async function registrarHorarios(e: z.infer<typeof entradaFallback>, ctx: ToolContext): Promise<CallToolResult> {
  const [pacientes, agenda] = await Promise.all([lerPacientesOpcoes(ctx), lerAgenda(ctx)]);
  if (!pacientes || !agenda) return resposta({ ok: false }, erros.inesperado, true);
  const pendencias: Array<{ item: number; aviso: string; opcoes: Array<{ id: string; nome: string }> }> = [];
  const linhas = e.itens.map((i, k) => {
    const escolhido = i.paciente_id?.trim();
    const p = escolhido ? { linha: { paciente_id: escolhido, termo: '', candidatos: [] }, aviso: null } : pacienteParaFormulario(i.paciente, pacientes);
    if (p.aviso) pendencias.push({ item: k, aviso: p.aviso, opcoes: p.linha.candidatos.length ? p.linha.candidatos : pacientes.map((x) => ({ id: x.id, nome: x.nome })) });
    return { paciente_id: p.linha.paciente_id, ...horarioDoModelo(i) };
  });
  const v = validarHorarios(linhas);
  const nomeDe = new Map(pacientes.map((p) => [p.id, p.nome]));
  const n: Normalizado<HorarioComPaciente[]> = pendencias.length || !v.ok
    ? { ok: false, pendencias, erros: v.ok ? [] : v.erros.filter((x) => !pendencias.some((p) => x.campo === `${p.item}.paciente_id`)) }
    : {
        ok: true,
        dados: v.dados,
        previa: {
          horarios: v.dados.map((d) => resumoDoHorario(nomeDe.get(d.paciente_id) ?? '', d)),
          avisos: v.dados.map((d) => avisoDeConflito(d, agenda)).filter((x): x is string => !!x),
        },
      };
  return fluxoComPrevia(ctx, 'registrar_horarios', n, e, async (d) => {
    const r = await gravarHorarios(d, ctx);
    return r.ok ? r : { ok: false, erros: r.erros };
  }, (r) => textoDosHorariosParaOModelo(r.resumo, r.ids));
}

/** `listar_agenda` (só app): a agenda existente, para o aviso de sobreposição no formulário. */
async function listarAgenda(ctx: ToolContext): Promise<ResultadoDeLeitura> {
  const agenda = await lerAgenda(ctx);
  return agenda ? { agenda } : { erro: 'falha ao ler a agenda' };
}

/** Registra a ação "horário" conforme o cliente (13.4). */
export function registrarAcaoHorario(server: McpServer, ctx: ToolContext): void {
  if (ctx.ui !== 'nao') {
    registrarRecurso(server, 'Formulário de horário', HORARIO_RESOURCE_URI, HTML);
    registerAppTool(server, 'abrir_formulario_horario', {
      title: 'Novo agendamento',
      description: DESCRICAO_ABRIR,
      inputSchema: entradaAbrir,
      _meta: { ui: { resourceUri: HORARIO_RESOURCE_URI, visibility: ['model'] } },
    }, async (args) => {
      const inicio = performance.now();
      const [pacientes, agenda] = await Promise.all([lerPacientesOpcoes(ctx), lerAgenda(ctx)]);
      const p = preencherHorarios(args, pacientes ?? [], agenda ?? []);
      logarChamada('abrir_formulario_horario', inicio, true, ctx.sub);
      const avisos = p.avisos.length ? ` Avisos: ${p.avisos.join('; ')}.` : '';
      return { content: [{ type: 'text', text: `${textosNovosEpico5.formularioAberto('horário')}${avisos}` }], structuredContent: p };
    });
    server.registerTool('listar_agenda', {
      description: 'A agenda semanal (paciente, dia e horas), para o aviso de horário que coincide. Usada pelos formulários.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
      _meta: { ui: { visibility: ['app'] } },
    }, () => executar('listar_agenda', ctx, () => listarAgenda(ctx)));
    registerAppTool(server, 'salvar_horarios', {
      description: 'Grava os horários conferidos pela pessoa no formulário. Chamada só pelo formulário de horário.',
      inputSchema: entradaSalvar,
      _meta: { ui: { resourceUri: HORARIO_RESOURCE_URI, visibility: ['app'] } },
    }, async (args) => {
      const inicio = performance.now();
      const r = await salvarHorarios(args, ctx);
      logarChamada('salvar_horarios', inicio, r.ok, ctx.sub);
      const texto = r.ok ? textoDosHorariosParaOModelo(r.resumo, r.ids) : r.erros.map((x) => x.mensagem).join('; ');
      return { content: [{ type: 'text', text: texto }], structuredContent: r };
    });
  }
  registrarFallback(server, ctx, 'registrar_horarios', DESCRICAO_FALLBACK, entradaFallback, registrarHorarios);
}
