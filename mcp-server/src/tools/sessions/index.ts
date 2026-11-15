import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import { randomUUID } from 'node:crypto';
import * as z from 'zod';
import { enviarEvento } from '../../analytics.js';
import { eventos } from '../../events.js';
import { logarChamada } from '../../log.js';
import { textosNovosEpico5 } from '../../rules/copy-app.js';
import { hojeEmSaoPaulo } from '../../rules/dates.js';
import { formatarData } from '../../rules/format.js';
import { erros } from '../../rules/messages.js';
import { FORMULARIOS_HTML } from '../../ui/generated.js';
import type { ToolContext } from '../context.js';
import { lerPacientesOpcoes, pacienteParaFormulario, type PacienteDaLinha, type PacienteOpcao } from '../shared/pacientes.js';
import { fluxoComPrevia, registrarFallback, resposta, type Normalizado } from '../shared/previa.js';
import { registrarRecurso, uriVersionada } from '../shared/recurso.js';
import {
  PADRAO_SESSAO,
  resumoDaSessao,
  rotuloDoPagamento,
  textoDasSessoesParaOModelo,
  tituloDoSucesso,
  validarSessoes,
  type ErroDeLinha,
  type LinhaDeSessao,
  type SessaoNormalizada,
} from './model.js';
import { copySessoesDoApp, mensagensEpico5DoApp } from '../../rules/copy-app.js';

/**
 * Ação "sessões" (8.5, 13.3): uma ou várias sessões realizadas numa vez.
 * - `abrir_formulario_sessoes` (modelo): pré-preenche a partir da frase;
 * - `salvar_sessoes` (app): revalida (P3) e grava em ordem, como `useCriarSessao` (P4);
 * - `registrar_sessoes` (modelo, sem UI): prévia + `token_previa` (13.4).
 * Sessão marcada "Pagou" NÃO cria pagamento (11.18): o formulário oferece o botão.
 */

const HTML = FORMULARIOS_HTML.sessions ?? '';
export const SESSOES_RESOURCE_URI = uriVersionada('sessoes', HTML);

/** Item como o modelo descreve (espelha `propor_sessoes` do agente; tudo opcional, sem anyOf). */
const itemDoModelo = z.object({
  paciente: z.string().optional().describe('Nome do paciente como a pessoa disse. O servidor procura no cadastro.'),
  data: z.string().optional().describe('Data AAAA-MM-DD. Resolva "hoje", "ontem", "segunda passada" a partir da data de hoje.'),
  pagamento: z.enum(['pagou', 'nao pagou', 'mensal']).optional().describe('Só se a pessoa disser. Omita se não disser: vale o padrão do app (mensal).'),
  modalidade: z.enum(['presencial', 'remota']).optional().describe('Só se a pessoa disser.'),
  duracao_minutos: z.number().int().optional().describe('Só se a pessoa disser. Padrão 50.'),
});
export const entradaAbrir = z.object({ itens: z.array(itemDoModelo).optional().describe('Uma entrada por sessão atendida.') });

/** "mensal" do modelo vira o literal do banco `pagamento mensal` (11.4, `pagamentoDaSessao` do agente). */
const literalDoPagamento = (v: string | undefined) => (v === 'pagou' || v === 'nao pagou' ? v : PADRAO_SESSAO.pagamento);

/** Pré-preenchimento do formulário: as linhas, os candidatos de cada paciente e os avisos. */
export type PreenchimentoDeSessoes = {
  formulario_id: string;
  linhas: Array<{ campos: LinhaDeSessao; paciente: PacienteDaLinha }>;
  avisos: string[];
};

/**
 * Monta o pré-preenchimento (8.5): paciente resolvido pela 11.14 (ambíguo fica vazio, com
 * candidatos e o aviso do app), data padrão hoje em SP, pagamento/modalidade/duração com
 * os padrões da tela do app. Sem itens, uma linha vazia. Não grava nada.
 */
export function preencherSessoes(
  args: z.infer<typeof entradaAbrir>, pacientes: PacienteOpcao[], hoje: string = hojeEmSaoPaulo(), id: string = randomUUID(),
): PreenchimentoDeSessoes {
  const itens = args.itens?.length ? args.itens : [{}];
  const avisos: string[] = [];
  const linhas = itens.map((i: z.infer<typeof itemDoModelo>) => {
    const p = pacienteParaFormulario(i.paciente, pacientes);
    if (p.aviso) avisos.push(p.aviso);
    return {
      paciente: p.linha,
      campos: {
        paciente_id: p.linha.paciente_id,
        ocorreu_em_dia: i.data ?? hoje,
        pagamento: literalDoPagamento(i.pagamento),
        modalidade: i.modalidade ?? PADRAO_SESSAO.modalidade,
        duracao_minutos: i.duracao_minutos ? String(i.duracao_minutos) : PADRAO_SESSAO.duracao_minutos,
        devesercobrada: PADRAO_SESSAO.devesercobrada,
      },
    };
  });
  return { formulario_id: id, linhas, avisos };
}

/** Resposta do salvar de várias linhas: o geral, mais quais linhas foram gravadas (8.5). */
export type RespostaDeSessoes =
  | { ok: true; ids: string[]; resumo: string; titulo: string; pagas: string[] }
  | { ok: false; erros: ErroDeLinha[]; gravadas: number[]; ids: string[]; resumo?: string; pagas?: string[] };

/**
 * Grava as sessões em ordem, como o app (`useCriarSessao`): `usuario_id` do token, sem
 * `status` e sem `ocorreu_em` (padrões do banco), `observacoes: null` (P5). Confere antes
 * que cada paciente é da pessoa (está nas opções que a RLS devolve). Se uma falhar, as
 * anteriores ficam, e a resposta diz quais (8.5). Um `agenda_psi_novasessao` por sessão.
 */
/** Sessões marcadas "Pagou", no formato da oferta: "Beatriz Nogueira (14/11/2026)". */
function pagasDe(dados: SessaoNormalizada[], nomeDe: Map<string, string>): string[] {
  return dados.filter((d) => d.pagamento === 'pagou').map((d) => `${nomeDe.get(d.paciente_id) ?? ''} (${formatarData(d.ocorreu_em_dia)})`);
}

export async function gravarSessoes(dados: SessaoNormalizada[], ctx: ToolContext): Promise<RespostaDeSessoes> {
  const pacientes = await lerPacientesOpcoes(ctx);
  if (!pacientes) return { ok: false, erros: [{ campo: null, mensagem: erros.inesperado }], gravadas: [], ids: [] };
  const nomeDe = new Map(pacientes.map((p) => [p.id, p.nome]));
  const desconhecidos = dados.map((d, i) => (nomeDe.has(d.paciente_id) ? null : i)).filter((i): i is number => i !== null);
  if (desconhecidos.length) {
    return { ok: false, erros: desconhecidos.map((i) => ({ campo: `${i}.paciente_id`, mensagem: mensagensEpico5DoApp.pacienteNaoEscolhido })), gravadas: [], ids: [] };
  }

  const ids: string[] = [];
  for (const [i, d] of dados.entries()) {
    const r = await ctx.db
      .from('sessoes')
      .insert({
        usuario_id: ctx.sub,
        paciente_id: d.paciente_id,
        ocorreu_em_dia: d.ocorreu_em_dia,
        modalidade: d.modalidade,
        duracao_minutos: d.duracao_minutos,
        pagamento: d.pagamento,
        devesercobrada: d.devesercobrada,
        observacoes: null,
      })
      .select('id')
      .single();
    if (r.error || !r.data) {
      const faltam = dados.slice(i).map((x) => resumoDaSessao(nomeDe.get(x.paciente_id) ?? '', x));
      const feitas = dados.slice(0, i);
      return {
        ok: false,
        erros: [{ campo: null, mensagem: i === 0 ? erros.inesperado : textosNovosEpico5.naoGravadas(faltam) }],
        gravadas: feitas.map((_, k) => k),
        ids,
        // O que JÁ foi gravado, para o sucesso final e a oferta de pagamento somarem (8.5).
        resumo: feitas.map((x) => resumoDaSessao(nomeDe.get(x.paciente_id) ?? '', x)).join('; '),
        pagas: pagasDe(feitas, nomeDe),
      };
    }
    ids.push(r.data.id);
    await enviarEvento(ctx.config, { nome: eventos.novaSessao, id: r.data.id, distinctId: ctx.email, tela: 'mcp_sessoes', descricao: 'nova sessao criada' });
  }
  const resumos = dados.map((d) => resumoDaSessao(nomeDe.get(d.paciente_id) ?? '', d));
  return {
    ok: true,
    ids,
    resumo: resumos.join('; '),
    titulo: tituloDoSucesso(dados.length, copySessoesDoApp.sucessoCriada, textosNovosEpico5.sessoesRegistradas),
    // As marcadas "Pagou", para o botão "Registrar também o pagamento" (11.18).
    pagas: pagasDe(dados, nomeDe),
  };
}

export const entradaSalvar = z.object({
  sessoes: z.array(z.object({
    paciente_id: z.string().optional(),
    ocorreu_em_dia: z.string().optional(),
    pagamento: z.string().optional(),
    modalidade: z.string().optional(),
    duracao_minutos: z.string().optional(),
    devesercobrada: z.boolean().optional(),
  })).describe('As sessões conferidas no formulário.'),
});

/** `salvar_sessoes` (só app): revalida tudo (P3) e grava. Validação falha sem tocar no banco. */
export async function salvarSessoes(args: z.infer<typeof entradaSalvar>, ctx: ToolContext): Promise<RespostaDeSessoes> {
  const v = validarSessoes(args.sessoes);
  if (!v.ok) return { ok: false, erros: v.erros, gravadas: [], ids: [] };
  try {
    return await gravarSessoes(v.dados, ctx);
  } catch {
    return { ok: false, erros: [{ campo: null, mensagem: erros.inesperado }], gravadas: [], ids: [] };
  }
}

const DESCRICAO_ABRIR =
  'Abre o formulário para registrar UMA OU MAIS sessões realizadas (atendimentos que aconteceram), já preenchido com o que a pessoa disse. Use para "atendi a Beatriz hoje", "segunda passada atendi Caio e Helena". Não grava nada: a pessoa confere e clica em Salvar. Se ela fechar sem salvar, nada foi registrado. Uma sessão marcada como paga NÃO cria pagamento.';

const DESCRICAO_FALLBACK =
  'Registra UMA OU MAIS sessões realizadas em duas chamadas, para clientes sem formulário. Na primeira (sem confirmar), devolve a prévia, as pendências e um token_previa; nada é gravado. Mostre a prévia à pessoa. Se houver pendência (paciente ambíguo ou não encontrado), pergunte e chame de novo com paciente_id. Nunca envie confirmar=true sem mostrar a prévia à pessoa e ela concordar. Uma sessão paga NÃO cria pagamento.';

const entradaFallback = z.object({
  itens: z.array(itemDoModelo.extend({ paciente_id: z.string().optional().describe('Id do paciente, quando a pessoa já escolheu entre as pendências.') })).describe('Uma entrada por sessão.'),
  confirmar: z.boolean().optional().describe('true só na segunda chamada, depois de a pessoa concordar com a prévia.'),
  token_previa: z.string().optional().describe('O token_previa devolvido pela primeira chamada.'),
});

/** `registrar_sessoes` (13.4): resolve pacientes (pendência quando não é um só), valida e passa ao fluxo comum. */
export async function registrarSessoes(e: z.infer<typeof entradaFallback>, ctx: ToolContext): Promise<CallToolResult> {
  const pacientes = await lerPacientesOpcoes(ctx);
  if (!pacientes) return resposta({ ok: false }, erros.inesperado, true);
  const hoje = hojeEmSaoPaulo();
  const pendencias: Array<{ item: number; aviso: string; opcoes: Array<{ id: string; nome: string }> }> = [];
  const linhas = e.itens.map((i, k) => {
    let paciente_id = i.paciente_id?.trim() ?? '';
    if (!paciente_id) {
      const p = pacienteParaFormulario(i.paciente, pacientes);
      paciente_id = p.linha.paciente_id;
      if (p.aviso) pendencias.push({ item: k, aviso: p.aviso, opcoes: p.linha.candidatos.length ? p.linha.candidatos : pacientes.map((x) => ({ id: x.id, nome: x.nome })) });
    }
    return { paciente_id, ocorreu_em_dia: i.data ?? hoje, pagamento: literalDoPagamento(i.pagamento), modalidade: i.modalidade ?? PADRAO_SESSAO.modalidade, duracao_minutos: i.duracao_minutos ? String(i.duracao_minutos) : '', devesercobrada: true };
  });
  const v = validarSessoes(linhas);
  const nomeDe = new Map(pacientes.map((p) => [p.id, p.nome]));
  let n: Normalizado<SessaoNormalizada[]>;
  if (pendencias.length || !v.ok) {
    const errosRestantes = v.ok ? [] : v.erros.filter((x) => !pendencias.some((p) => x.campo === `${p.item}.paciente_id`));
    n = { ok: false, pendencias, erros: errosRestantes };
  } else {
    n = {
      ok: true,
      dados: v.dados,
      previa: { sessoes: v.dados.map((d) => ({ paciente: nomeDe.get(d.paciente_id) ?? '', data: formatarData(d.ocorreu_em_dia), pagamento: rotuloDoPagamento(d.pagamento), modalidade: d.modalidade, duracao_minutos: d.duracao_minutos })) },
    };
  }
  return fluxoComPrevia(ctx, 'registrar_sessoes', n, e, async (d) => {
    const r = await gravarSessoes(d, ctx);
    return r.ok ? r : { ok: false, erros: r.erros };
  }, (r) => textoDasSessoesParaOModelo(r.resumo, r.ids));
}

/** Registra a ação "sessões" conforme o cliente (13.4, ver tools/index.ts). */
export function registrarAcaoSessoes(server: McpServer, ctx: ToolContext): void {
  if (ctx.ui !== 'nao') {
    registrarRecurso(server, 'Formulário de sessões', SESSOES_RESOURCE_URI, HTML);
    registerAppTool(server, 'abrir_formulario_sessoes', {
      title: copySessoesDoApp.nova,
      description: DESCRICAO_ABRIR,
      inputSchema: entradaAbrir,
      _meta: { ui: { resourceUri: SESSOES_RESOURCE_URI, visibility: ['model'] } },
    }, async (args) => {
      const inicio = performance.now();
      const pacientes = (await lerPacientesOpcoes(ctx)) ?? [];
      const p = preencherSessoes(args, pacientes);
      logarChamada('abrir_formulario_sessoes', inicio, true, ctx.sub);
      const avisos = p.avisos.length ? ` Avisos: ${p.avisos.join('; ')}.` : '';
      return { content: [{ type: 'text', text: `${textosNovosEpico5.formularioAberto('sessão')}${avisos}` }], structuredContent: p };
    });
    registerAppTool(server, 'salvar_sessoes', {
      description: 'Grava as sessões conferidas pela pessoa no formulário. Chamada só pelo formulário de sessões.',
      inputSchema: entradaSalvar,
      _meta: { ui: { resourceUri: SESSOES_RESOURCE_URI, visibility: ['app'] } },
    }, async (args) => {
      const inicio = performance.now();
      const r = await salvarSessoes(args, ctx);
      logarChamada('salvar_sessoes', inicio, r.ok, ctx.sub);
      const texto = r.ok ? textoDasSessoesParaOModelo(r.resumo, r.ids) : r.erros.map((x) => x.mensagem).join('; ');
      return { content: [{ type: 'text', text: texto }], structuredContent: r };
    });
  }
  registrarFallback(server, ctx, 'registrar_sessoes', DESCRICAO_FALLBACK, entradaFallback, registrarSessoes);
}
