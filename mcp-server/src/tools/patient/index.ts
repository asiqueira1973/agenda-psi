import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import { randomUUID } from 'node:crypto';
import * as z from 'zod';
import { enviarEvento } from '../../analytics.js';
import { eventos } from '../../events.js';
import { logarChamada } from '../../log.js';
import { textosNovosEpico5 } from '../../rules/copy-app.js';
import { formatarDinheiro } from '../../rules/format.js';
import { validarValorEmReais } from '../../rules/money.js';
import { erros } from '../../rules/messages.js';
import { FORMULARIOS_HTML } from '../../ui/generated.js';
import type { ToolContext } from '../context.js';
import { fluxoComPrevia, registrarFallback, resposta, type Normalizado } from '../shared/previa.js';
import { registrarRecurso, uriVersionada } from '../shared/recurso.js';
import { horarioDoModelo, horarioDoModeloSchema, inserirHorario, lerAgenda } from '../schedule/index.js';
import { avisoDeConflito, resumoDoHorario, validarHorario, type HorarioDaAgenda } from '../schedule/model.js';
import {
  resumoDoPaciente,
  textoDoPacienteParaOModelo,
  tituloDoPaciente,
  validarPaciente,
  type FormularioDePaciente,
  type PacienteNormalizado,
} from './model.js';

/**
 * Ação "paciente" (8.5, 13.3): cadastro de UM paciente novo, com o preço e, se a frase
 * pedir, os horários fixos. Grava como `useCriarPaciente` do app (P4): `pacientes`, depois
 * `precos_paciente` (append-only, 11.17), depois cada horário como `useCriarAgendamento`.
 *
 * Depois que o paciente existe, NADA desfaz nem refaz o cadastro: se o preço ou um horário
 * falhar, a resposta diz o que faltou e o formulário tranca. Corrige o cartão do agente,
 * em que "tentar de novo" duplicaria o paciente (plans/epico-5.md).
 */

const HTML = FORMULARIOS_HTML.patient ?? '';
export const PACIENTE_RESOURCE_URI = uriVersionada('paciente', HTML);

/** Entrada do modelo: espelha `propor_paciente` do agente, tudo opcional, sem `anyOf`. */
export const entradaAbrir = z.object({
  nome: z.string().optional().describe('Nome completo como a pessoa disse.'),
  telefone: z.string().optional().describe('Só se a pessoa disser.'),
  email: z.string().optional().describe('Só se a pessoa disser.'),
  preco: z.number().optional().describe('Preço por sessão em reais, só se a pessoa disser.'),
  receber_sms: z.boolean().optional().describe('Só se a pessoa disser. Padrão: sim.'),
  horarios: z.array(horarioDoModeloSchema).optional().describe('Horários fixos na agenda semanal, só se a mesma frase pedir.'),
});

export type PreenchimentoDePaciente = { formulario_id: string; campos: FormularioDePaciente; avisos: string[] };

/** Pré-preenchimento (13.3): só o que a pessoa disse; SMS padrão sim (11.12); fim +50 min. */
export function preencherPaciente(
  args: z.infer<typeof entradaAbrir>, agenda: HorarioDaAgenda[], id: string = randomUUID(),
): PreenchimentoDePaciente {
  // Preço dito com centavos não entra: o campo fica vazio e a pessoa digita (11.1).
  const preco = args.preco !== undefined && validarValorEmReais(args.preco).valido ? String(args.preco) : '';
  const horarios = (args.horarios ?? []).map(horarioDoModelo);
  const avisos = horarios
    .map((h) => {
      const v = validarHorario(h, '');
      return v.ok ? avisoDeConflito(v.dados, agenda) : null;
    })
    .filter((x): x is string => !!x);
  return {
    formulario_id: id,
    campos: {
      nome: args.nome?.trim() ?? '',
      telefone: args.telefone?.trim() ?? '',
      email: args.email?.trim() ?? '',
      preco,
      receber_sms: args.receber_sms !== false,
      horarios,
    },
    avisos,
  };
}

/**
 * Resposta do salvar. `ok: true` sempre que o paciente foi criado; `avisos` lista o que
 * ficou de fora (preço, horários), e aí o formulário tranca em vez de oferecer de novo.
 */
export type RespostaDePaciente =
  | { ok: true; ids: string[]; resumo: string; titulo: string; avisos: string[] }
  | { ok: false; erros: Array<{ campo: string | null; mensagem: string }>; ids: string[] };

/** Grava paciente → preço → horários, em ordem, como o app. */
export async function gravarPaciente(d: PacienteNormalizado, ctx: ToolContext): Promise<RespostaDePaciente> {
  const p = await ctx.db
    .from('pacientes')
    .insert({
      usuario_id: ctx.sub,
      nome_completo: d.nome_completo,
      telefone: d.telefone,
      email: d.email,
      observacoes: null, // P5: o conector não grava texto clínico
      receber_sms: d.receber_sms,
      status: 'ativo',
    })
    .select('id')
    .single();
  if (p.error || !p.data) return { ok: false, erros: [{ campo: null, mensagem: erros.inesperado }], ids: [] };
  const pacienteId = p.data.id;

  // Daqui em diante o paciente EXISTE: erro ou exceção vira aviso, nunca "tente de novo",
  // porque um segundo envio duplicaria o paciente.
  const avisos: string[] = [];
  const preco = await ctx.db
    .from('precos_paciente')
    .insert({ usuario_id: ctx.sub, paciente_id: pacienteId, preco: d.preco })
    .then((r) => !r.error, () => false);
  if (preco) {
    // Como o app: o evento sai só com paciente E preço gravados, sem id nem nome (pegadinha 5);
    // `id` vazio vira uuid novo.
    await enviarEvento(ctx.config, { nome: eventos.novoPaciente, id: '', distinctId: ctx.email, tela: 'mcp_paciente', descricao: 'novo paciente criado' });
  } else avisos.push(textosNovosEpico5.pacienteSemPreco);

  const gravados = [];
  const faltaram: string[] = [];
  for (const h of d.horarios) {
    const id = await inserirHorario({ ...h, paciente_id: pacienteId }, ctx, 'mcp_paciente').catch(() => null);
    if (id) gravados.push(h);
    else faltaram.push(resumoDoHorario('', h));
  }
  if (faltaram.length) avisos.push(textosNovosEpico5.horariosNaoGravados(faltaram));

  // O resumo diz só o que de fato ficou gravado.
  const resumo = !preco
    ? [d.nome_completo, ...gravados.map((h) => resumoDoHorario('', h))].join('; ')
    : resumoDoPaciente({ ...d, horarios: gravados });
  return { ok: true, ids: [pacienteId], resumo, titulo: tituloDoPaciente(d.nome_completo), avisos };
}

export const entradaSalvar = z.object({
  paciente: z.object({
    nome: z.string().optional(),
    telefone: z.string().optional(),
    email: z.string().optional(),
    preco: z.string().optional(),
    receber_sms: z.boolean().optional(),
    horarios: z.array(z.object({
      dia_semana: z.string().optional(),
      hora_inicio: z.string().optional(),
      hora_fim: z.string().optional(),
    })).optional(),
  }).describe('O cadastro conferido no formulário.'),
});

/** `salvar_paciente` (só app): revalida (P3) e grava. */
export async function salvarPaciente(args: z.infer<typeof entradaSalvar>, ctx: ToolContext): Promise<RespostaDePaciente> {
  const v = validarPaciente(args.paciente as Partial<FormularioDePaciente>);
  if (!v.ok) return { ok: false, erros: v.erros, ids: [] };
  try {
    return await gravarPaciente(v.dados, ctx);
  } catch {
    return { ok: false, erros: [{ campo: null, mensagem: erros.inesperado }], ids: [] };
  }
}

const DESCRICAO_ABRIR =
  'Abre o formulário de cadastro de UM paciente novo, com o preço e, se a mesma frase pedir, os horários fixos na agenda semanal, já preenchido com o que a pessoa disse. Não grava nada: a pessoa confere e clica em Cadastrar paciente. Telefone e preço são obrigatórios no app: se a pessoa não disser, omita e o formulário pede. Para paciente já cadastrado, horário novo é abrir_formulario_horario.';

const DESCRICAO_FALLBACK =
  'Cadastra UM paciente novo (com preço e, se pedido, horários fixos) em duas chamadas, para clientes sem formulário. Na primeira (sem confirmar), devolve a prévia, os erros a corrigir e um token_previa; nada é gravado. Mostre a prévia à pessoa e peça o que faltar (telefone e preço são obrigatórios). Nunca envie confirmar=true sem ela concordar. Cada confirmação cadastra um paciente novo: se o preço ou algum horário ficarem de fora, a resposta diz o que faltou, e repetir a chamada cadastraria o paciente de novo.';

const entradaFallback = entradaAbrir.extend({
  confirmar: z.boolean().optional().describe('true só na segunda chamada, depois de a pessoa concordar com a prévia.'),
  token_previa: z.string().optional().describe('O token_previa devolvido pela primeira chamada.'),
});

/** `registrar_paciente` (13.4): prévia com os avisos de horário que coincide. */
export async function registrarPaciente(e: z.infer<typeof entradaFallback>, ctx: ToolContext): Promise<CallToolResult> {
  const agenda = await lerAgenda(ctx);
  if (!agenda) return resposta({ ok: false }, erros.inesperado, true);
  const { campos } = preencherPaciente(e, agenda, '');
  // No fallback o preço vem do modelo como número: com centavos é erro, não campo vazio.
  const v = validarPaciente({ ...campos, preco: e.preco === undefined ? '' : String(e.preco) });
  const n: Normalizado<PacienteNormalizado> = !v.ok
    ? { ok: false, pendencias: [], erros: v.erros }
    : {
        ok: true,
        dados: v.dados,
        previa: {
          nome: v.dados.nome_completo,
          telefone: v.dados.telefone,
          email: v.dados.email,
          preco: formatarDinheiro(v.dados.preco),
          receber_sms: v.dados.receber_sms,
          horarios: v.dados.horarios.map((h) => resumoDoHorario('', h)),
          avisos: v.dados.horarios.map((h) => avisoDeConflito(h, agenda)).filter((x): x is string => !!x),
        },
      };
  let avisos: string[] = [];
  return fluxoComPrevia(ctx, 'registrar_paciente', n, e, async (d) => {
    const r = await gravarPaciente(d, ctx);
    if (!r.ok) return { ok: false, erros: r.erros };
    avisos = r.avisos;
    return { ok: true, ids: r.ids, resumo: r.resumo };
  }, (r) => textoDoPacienteParaOModelo(r.resumo, r.ids[0] ?? '', avisos));
}

/** Registra a ação "paciente" conforme o cliente (13.4). */
export function registrarAcaoPaciente(server: McpServer, ctx: ToolContext): void {
  if (ctx.ui !== 'nao') {
    registrarRecurso(server, 'Formulário de paciente', PACIENTE_RESOURCE_URI, HTML);
    registerAppTool(server, 'abrir_formulario_paciente', {
      title: 'Novo paciente',
      description: DESCRICAO_ABRIR,
      inputSchema: entradaAbrir,
      _meta: { ui: { resourceUri: PACIENTE_RESOURCE_URI, visibility: ['model'] } },
    }, async (args) => {
      const inicio = performance.now();
      const p = preencherPaciente(args, (await lerAgenda(ctx)) ?? []);
      logarChamada('abrir_formulario_paciente', inicio, true, ctx.sub);
      const avisos = p.avisos.length ? ` Avisos: ${p.avisos.join('; ')}.` : '';
      return { content: [{ type: 'text', text: `${textosNovosEpico5.formularioAberto('paciente')}${avisos}` }], structuredContent: p };
    });
    registerAppTool(server, 'salvar_paciente', {
      description: 'Grava o cadastro conferido pela pessoa no formulário. Chamada só pelo formulário de paciente.',
      inputSchema: entradaSalvar,
      _meta: { ui: { resourceUri: PACIENTE_RESOURCE_URI, visibility: ['app'] } },
    }, async (args) => {
      const inicio = performance.now();
      const r = await salvarPaciente(args, ctx);
      logarChamada('salvar_paciente', inicio, r.ok, ctx.sub);
      const texto = r.ok ? textoDoPacienteParaOModelo(r.resumo, r.ids[0] ?? '', r.avisos) : r.erros.map((x) => x.mensagem).join('; ');
      return { content: [{ type: 'text', text: texto }], structuredContent: r };
    });
  }
  registrarFallback(server, ctx, 'registrar_paciente', DESCRICAO_FALLBACK, entradaFallback, registrarPaciente);
}
