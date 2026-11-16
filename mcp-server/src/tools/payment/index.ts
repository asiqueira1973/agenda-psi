import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import { randomUUID } from 'node:crypto';
import * as z from 'zod';
import { enviarEvento } from '../../analytics.js';
import { eventos } from '../../events.js';
import { logarChamada } from '../../log.js';
import { copyPagamentosDoApp, mensagensEpico5DoApp, textosNovosEpico5 } from '../../rules/copy-app.js';
import { hojeEmSaoPaulo } from '../../rules/dates.js';
import { STATUS_PAGO } from '../../rules/db-literals.js';
import { formatarData, formatarDinheiro } from '../../rules/format.js';
import { erros } from '../../rules/messages.js';
import { validarValorEmReais } from '../../rules/money.js';
import { FORMULARIOS_HTML } from '../../ui/generated.js';
import type { ToolContext } from '../context.js';
import { lerPacientesOpcoes, pacienteParaFormulario, type PacienteDaLinha, type PacienteOpcao } from '../shared/pacientes.js';
import { fluxoComPrevia, registrarFallback, resposta, type Normalizado } from '../shared/previa.js';
import { registrarRecurso, uriVersionada } from '../shared/recurso.js';
import { tituloDoSucesso } from '../sessions/model.js';
import {
  resumoDoPagamento,
  rotuloDoTipo,
  textoDosPagamentosParaOModelo,
  validarPagamentos,
  type LinhaDePagamento,
  type PagamentoNormalizado,
} from './model.js';

/**
 * Ação "pagamento" (8.5, 13.3): um ou vários pagamentos recebidos numa vez.
 * - `abrir_formulario_pagamento` (modelo): pré-preenche; o valor é o dito, senão o preço
 *   de referência (`preco_vigente` da view, nunca calculado), senão vazio (11.11);
 * - `salvar_pagamentos` (app): revalida (P3) e grava como `useCriarPagamento` (P4);
 * - `registrar_pagamentos` (modelo, sem UI): prévia + `token_previa` (13.4).
 * Não cria sessão.
 */

const HTML = FORMULARIOS_HTML.payment ?? '';
export const PAGAMENTO_RESOURCE_URI = uriVersionada('pagamento', HTML);

const itemDoModelo = z.object({
  paciente: z.string().optional().describe('Nome do paciente como a pessoa disse. O servidor procura no cadastro.'),
  valor: z.number().optional().describe('Valor em reais, só se a pessoa disser. Omita se não disser.'),
  data: z.string().optional().describe('Data AAAA-MM-DD. Resolva "hoje", "ontem", "segunda passada" a partir da data de hoje.'),
  tipo: z.enum(['mensal', 'por sessao']).optional().describe('Só se a pessoa disser. Padrão: mensal. Quando a pessoa pedir o pagamento de sessões já registradas ("Quero registrar o pagamento destas sessões: ..."), use por sessao e a data de cada sessão.'),
});
export const entradaAbrir = z.object({ itens: z.array(itemDoModelo).optional().describe('Uma entrada por pagamento recebido.') });

/** "por sessao" do modelo vira o literal do banco `por sessão`, com acento (11.4, pegadinha 6). */
const literalDoTipo = (v: string | undefined) => (v === 'por sessao' ? 'por sessão' : 'mensal');

/** Valor sugerido (11.11, `valorDoPagamento` do agente), mas exigindo inteiro como o app (11.1). */
function valorSugerido(dito: number | undefined, p: PacienteDaLinha, pacientes: PacienteOpcao[]): Pick<LinhaDePagamento, 'valor_pagamento' | 'valor_origem'> {
  if (dito !== undefined && validarValorEmReais(dito).valido) return { valor_pagamento: String(dito), valor_origem: 'frase' };
  const ref = pacientes.find((x) => x.id === p.paciente_id)?.preco_referencia;
  if (p.paciente_id && ref) return { valor_pagamento: String(ref), valor_origem: 'referencia' };
  return { valor_pagamento: '', valor_origem: 'nenhum' };
}

export type PreenchimentoDePagamentos = {
  formulario_id: string;
  linhas: Array<{ campos: LinhaDePagamento; paciente: PacienteDaLinha }>;
  avisos: string[];
};

/** Pré-preenchimento (8.5): paciente pela 11.14, valor pela 11.11, data hoje em SP, tipo mensal. */
export function preencherPagamentos(
  args: z.infer<typeof entradaAbrir>, pacientes: PacienteOpcao[], hoje: string = hojeEmSaoPaulo(), id: string = randomUUID(),
): PreenchimentoDePagamentos {
  const itens = args.itens?.length ? args.itens : [{}];
  const avisos: string[] = [];
  const linhas = itens.map((i: z.infer<typeof itemDoModelo>) => {
    const p = pacienteParaFormulario(i.paciente, pacientes);
    if (p.aviso) avisos.push(p.aviso);
    return { paciente: p.linha, campos: { paciente_id: p.linha.paciente_id, ...valorSugerido(i.valor, p.linha, pacientes), data_competencia: i.data ?? hoje, tipo: literalDoTipo(i.tipo) } };
  });
  return { formulario_id: id, linhas, avisos };
}

export type RespostaDePagamentos =
  | { ok: true; ids: string[]; resumo: string; titulo: string }
  | { ok: false; erros: Array<{ campo: string | null; mensagem: string }>; gravadas: number[]; ids: string[]; resumo?: string };

/**
 * Grava em ordem, como `useCriarPagamento`: `usuario_id` do token, `pago_em` agora,
 * `status = 'pago'` (11.10), `observacoes: null`. Confere que cada paciente é da pessoa.
 * Falha parcial: as gravadas ficam e a resposta diz o que faltou (8.5). Um
 * `agenda_psi_novopagamento` por pagamento (tela `mcp_pagamento`).
 */
export async function gravarPagamentos(dados: PagamentoNormalizado[], ctx: ToolContext): Promise<RespostaDePagamentos> {
  const pacientes = await lerPacientesOpcoes(ctx);
  if (!pacientes) return { ok: false, erros: [{ campo: null, mensagem: erros.inesperado }], gravadas: [], ids: [] };
  const nomeDe = new Map(pacientes.map((p) => [p.id, p.nome]));
  const fora = dados.map((d, i) => (nomeDe.has(d.paciente_id) ? null : i)).filter((i): i is number => i !== null);
  if (fora.length) return { ok: false, erros: fora.map((i) => ({ campo: `${i}.paciente_id`, mensagem: mensagensEpico5DoApp.pacienteNaoEscolhido })), gravadas: [], ids: [] };

  const ids: string[] = [];
  for (const [i, d] of dados.entries()) {
    const r = await ctx.db
      .from('pagamentos')
      .insert({
        usuario_id: ctx.sub,
        paciente_id: d.paciente_id,
        valor_pagamento: d.valor_pagamento,
        data_competencia: d.data_competencia,
        pago_em: new Date().toISOString(),
        status: STATUS_PAGO,
        tipo: d.tipo,
        observacoes: null,
      })
      .select('id')
      .single();
    if (r.error || !r.data) {
      const faltam = dados.slice(i).map((x) => resumoDoPagamento(nomeDe.get(x.paciente_id) ?? '', x));
      const resumo = dados.slice(0, i).map((x) => resumoDoPagamento(nomeDe.get(x.paciente_id) ?? '', x)).join('; ');
      return { ok: false, erros: [{ campo: null, mensagem: i === 0 ? erros.inesperado : textosNovosEpico5.naoGravadas(faltam) }], gravadas: dados.slice(0, i).map((_, k) => k), ids, resumo };
    }
    ids.push(r.data.id);
    await enviarEvento(ctx.config, { nome: eventos.novoPagamento, id: r.data.id, distinctId: ctx.email, tela: 'mcp_pagamento', descricao: 'novo pagamento criado' });
  }
  return {
    ok: true,
    ids,
    resumo: dados.map((d) => resumoDoPagamento(nomeDe.get(d.paciente_id) ?? '', d)).join('; '),
    titulo: tituloDoSucesso(dados.length, copyPagamentosDoApp.sucessoCriado, textosNovosEpico5.pagamentosRegistrados),
  };
}

export const entradaSalvar = z.object({
  pagamentos: z.array(z.object({
    paciente_id: z.string().optional(),
    valor_pagamento: z.string().optional(),
    data_competencia: z.string().optional(),
    tipo: z.string().optional(),
  })).describe('Os pagamentos conferidos no formulário.'),
});

/** `salvar_pagamentos` (só app): revalida tudo (P3); validação falha sem tocar no banco. */
export async function salvarPagamentos(args: z.infer<typeof entradaSalvar>, ctx: ToolContext): Promise<RespostaDePagamentos> {
  const v = validarPagamentos(args.pagamentos);
  if (!v.ok) return { ok: false, erros: v.erros, gravadas: [], ids: [] };
  try {
    return await gravarPagamentos(v.dados, ctx);
  } catch {
    return { ok: false, erros: [{ campo: null, mensagem: erros.inesperado }], gravadas: [], ids: [] };
  }
}

const DESCRICAO_ABRIR =
  'Abre o formulário para registrar UM OU MAIS pagamentos recebidos (dinheiro que entrou), já preenchido com o que a pessoa disse. Use para "a Beatriz pagou 280", "recebi do Caio e da Helena hoje". Sem valor dito, o formulário sugere o preço de referência do paciente. Não grava nada e não cria sessão: a pessoa confere e clica em Salvar.';

const DESCRICAO_FALLBACK =
  'Registra UM OU MAIS pagamentos recebidos em duas chamadas, para clientes sem formulário. Na primeira (sem confirmar), devolve a prévia, as pendências e um token_previa; nada é gravado. Sem valor dito, usa o preço de referência do paciente; diga isso à pessoa. Se houver pendência, pergunte e chame de novo com paciente_id. Nunca envie confirmar=true sem mostrar a prévia à pessoa e ela concordar.';

const entradaFallback = z.object({
  itens: z.array(itemDoModelo.extend({ paciente_id: z.string().optional().describe('Id do paciente, quando a pessoa já escolheu entre as pendências.') })).describe('Uma entrada por pagamento.'),
  confirmar: z.boolean().optional().describe('true só na segunda chamada, depois de a pessoa concordar com a prévia.'),
  token_previa: z.string().optional().describe('O token_previa devolvido pela primeira chamada.'),
});

/** `registrar_pagamentos` (13.4). */
export async function registrarPagamentos(e: z.infer<typeof entradaFallback>, ctx: ToolContext): Promise<CallToolResult> {
  const pacientes = await lerPacientesOpcoes(ctx);
  if (!pacientes) return resposta({ ok: false }, erros.inesperado, true);
  const hoje = hojeEmSaoPaulo();
  const pendencias: Array<{ item: number; aviso: string; opcoes: Array<{ id: string; nome: string }> }> = [];
  const linhas = e.itens.map((i, k) => {
    const escolhido = i.paciente_id?.trim();
    const p = escolhido ? { linha: { paciente_id: escolhido, termo: '', candidatos: [] }, aviso: null } : pacienteParaFormulario(i.paciente, pacientes);
    if (p.aviso) pendencias.push({ item: k, aviso: p.aviso, opcoes: p.linha.candidatos.length ? p.linha.candidatos : pacientes.map((x) => ({ id: x.id, nome: x.nome })) });
    return { paciente_id: p.linha.paciente_id, ...valorSugerido(i.valor, p.linha, pacientes), data_competencia: i.data ?? hoje, tipo: literalDoTipo(i.tipo) };
  });
  const v = validarPagamentos(linhas);
  const nomeDe = new Map(pacientes.map((p) => [p.id, p.nome]));
  const n: Normalizado<PagamentoNormalizado[]> = pendencias.length || !v.ok
    ? { ok: false, pendencias, erros: v.ok ? [] : v.erros.filter((x) => !pendencias.some((p) => x.campo === `${p.item}.paciente_id`)) }
    : { ok: true, dados: v.dados, previa: { pagamentos: v.dados.map((d, k) => ({ paciente: nomeDe.get(d.paciente_id) ?? '', valor: formatarDinheiro(d.valor_pagamento), valor_sugerido_pelo_cadastro: linhas[k]?.valor_origem === 'referencia', data: formatarData(d.data_competencia), tipo: rotuloDoTipo(d.tipo) })) } };
  return fluxoComPrevia(ctx, 'registrar_pagamentos', n, e, async (d) => {
    const r = await gravarPagamentos(d, ctx);
    return r.ok ? r : { ok: false, erros: r.erros };
  }, (r) => textoDosPagamentosParaOModelo(r.resumo, r.ids));
}

/** Registra a ação "pagamento" conforme o cliente (13.4). */
export function registrarAcaoPagamento(server: McpServer, ctx: ToolContext): void {
  if (ctx.ui !== 'nao') {
    registrarRecurso(server, 'Formulário de pagamento', PAGAMENTO_RESOURCE_URI, HTML);
    registerAppTool(server, 'abrir_formulario_pagamento', {
      title: copyPagamentosDoApp.novo,
      description: DESCRICAO_ABRIR,
      inputSchema: entradaAbrir,
      _meta: { ui: { resourceUri: PAGAMENTO_RESOURCE_URI, visibility: ['model'] } },
    }, async (args) => {
      const inicio = performance.now();
      const p = preencherPagamentos(args, (await lerPacientesOpcoes(ctx)) ?? []);
      logarChamada('abrir_formulario_pagamento', inicio, true, ctx.sub);
      const avisos = p.avisos.length ? ` Avisos: ${p.avisos.join('; ')}.` : '';
      return { content: [{ type: 'text', text: `${textosNovosEpico5.formularioAberto('pagamento')}${avisos}` }], structuredContent: p };
    });
    registerAppTool(server, 'salvar_pagamentos', {
      description: 'Grava os pagamentos conferidos pela pessoa no formulário. Chamada só pelo formulário de pagamento.',
      inputSchema: entradaSalvar,
      _meta: { ui: { resourceUri: PAGAMENTO_RESOURCE_URI, visibility: ['app'] } },
    }, async (args) => {
      const inicio = performance.now();
      const r = await salvarPagamentos(args, ctx);
      logarChamada('salvar_pagamentos', inicio, r.ok, ctx.sub);
      const texto = r.ok ? textoDosPagamentosParaOModelo(r.resumo, r.ids) : r.erros.map((x) => x.mensagem).join('; ');
      return { content: [{ type: 'text', text: texto }], structuredContent: r };
    });
  }
  registrarFallback(server, ctx, 'registrar_pagamentos', DESCRICAO_FALLBACK, entradaFallback, registrarPagamentos);
}
