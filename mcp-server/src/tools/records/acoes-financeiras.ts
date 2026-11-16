import * as z from 'zod';
import { copyPagamentosDoApp, copySessoesDoApp, textosNovosEpico5 } from '../../rules/copy-app.js';
import { despesaDoApp, doAgente, doSpec, pacienteDoApp, pagamentoDoApp, sessaoDoApp, textosNovosEpico6 } from '../../rules/copy-registros.js';
import { dataValida } from '../../rules/dates.js';
import { modalidadeDaSessao, pagamentoDaSessao, tipoDoPagamento } from '../../rules/db-literals.js';
import { formatarData, formatarDinheiro } from '../../rules/format.js';
import { copyDespesaDoApp, erros, mensagensDoApp, textosNovosDespesa } from '../../rules/messages.js';
import { validarValorEmReais } from '../../rules/money.js';
import { normalizar } from '../../rules/text.js';
import type { ToolContext } from '../context.js';
import { type TipoDespesa } from '../expense/model.js';
import { lerTiposDespesa } from '../expense/options.js';
import { lerPacientesOpcoes } from '../shared/pacientes.js';
import { excluirPorId, linhaQueMudou, type DefDeRegistro, type Mudancas, type Valores } from './motor.js';
import type { Campo, ErroDeRegistro, RespostaDeRegistro } from './tipos.js';

/**
 * Edição e exclusão de sessão, pagamento e despesa (8.6), como `useEditarSessao`,
 * `useEditarDespesa`, a edição de pagamento e os `useExcluir*` do app (P4). A data da
 * sessão e a competência aparecem só para leitura. Observações nunca são lidas nem
 * gravadas (P5): o `update` não as inclui, e o valor atual fica como está.
 */

type Opcao = { valor: string; rotulo: string };
const rotuloDe = (opcoes: readonly Opcao[], v: string) => opcoes.find((o) => o.valor === v)?.rotulo ?? v;

/** Campo de escolha: `pedido` é o que a frase disse, se for uma opção válida. */
export function campoEscolha(nome: string, rotulo: string, opcoes: readonly Opcao[], atual: string, pedido?: string): Campo {
  const valor = pedido && opcoes.some((o) => o.valor === pedido) ? pedido : atual;
  return { nome, rotulo, tipo: 'escolha', opcoes: [...opcoes], atual, atualRotulo: rotuloDe(opcoes, atual), valor };
}

/**
 * Caixa de marcar, como na tela do app. O app não tem texto "Sim"/"Não", então o
 * formulário não mostra "Antes:" aqui; o `atualRotulo` em minúsculas é só para a prévia
 * do fallback, que o MODELO lê.
 */
export function campoMarcar(nome: string, rotulo: string, atual: boolean, pedido: unknown): Campo {
  return { nome, rotulo, tipo: 'marcar', atual: String(atual), atualRotulo: atual ? 'sim' : 'não', valor: String(typeof pedido === 'boolean' ? pedido : atual) };
}

export function campoLeitura(nome: string, rotulo: string, texto: string, rodape: string): Campo {
  return { nome, rotulo, tipo: 'leitura', valor: texto, atual: texto, atualRotulo: texto, rodape };
}

export const nadaMudou = (): { ok: false; erros: ErroDeRegistro[] } => ({ ok: false, erros: [{ campo: null, mensagem: erros.nadaMudou }] });
const achar = (campos: Campo[], nome: string) => campos.find((c) => c.nome === nome);

/** Nome do paciente pelo id (a lista é pequena e já passa pela RLS). */
async function nomesDosPacientes(ctx: ToolContext): Promise<Map<string, string>> {
  return new Map(((await lerPacientesOpcoes(ctx)) ?? []).map((p) => [p.id, p.nome]));
}

const campoPacienteDoModelo = z.string().optional().describe('Nome do paciente como a pessoa disse. O servidor procura no cadastro.');
const campoDataDoModelo = z.string().optional().describe('Data AAAA-MM-DD do registro existente, se a pessoa disser ("a sessão de terça", "o pagamento de ontem").');

// ---------------------------------------------------------------------------
// Sessão
// ---------------------------------------------------------------------------

export type Sessao = { id: string; paciente_id: string; paciente_nome: string; data: string; pagamento: string; modalidade: string; duracao_minutos: number | null; cobrada: boolean };

const COLUNAS_DA_SESSAO = 'id, paciente_id, ocorreu_em_dia, pagamento, modalidade, duracao_minutos, devesercobrada';
type LinhaDaSessao = { id: string; paciente_id: string; ocorreu_em_dia: string; pagamento: string | null; modalidade: string | null; duracao_minutos: number | null; devesercobrada: boolean | null };
const sessaoDaLinha = (l: LinhaDaSessao, nomes: Map<string, string>): Sessao => ({
  id: l.id, paciente_id: l.paciente_id, paciente_nome: nomes.get(l.paciente_id) ?? '', data: l.ocorreu_em_dia,
  pagamento: l.pagamento ?? 'pagamento mensal', modalidade: l.modalidade ?? 'presencial', duracao_minutos: l.duracao_minutos, cobrada: l.devesercobrada !== false,
});

async function lerSessoes(ctx: ToolContext, pacienteId: string | null): Promise<Sessao[] | null> {
  if (!pacienteId) return [];
  const [r, nomes] = await Promise.all([
    ctx.db.from('sessoes').select(COLUNAS_DA_SESSAO).eq('usuario_id', ctx.sub).eq('paciente_id', pacienteId).order('ocorreu_em_dia', { ascending: false }).limit(40),
    nomesDosPacientes(ctx),
  ]);
  return r.error ? null : ((r.data ?? []) as LinhaDaSessao[]).map((l) => sessaoDaLinha(l, nomes));
}

async function lerSessao(ctx: ToolContext, id: string): Promise<Sessao | null> {
  const [r, nomes] = await Promise.all([ctx.db.from('sessoes').select(COLUNAS_DA_SESSAO).eq('id', id).eq('usuario_id', ctx.sub).maybeSingle(), nomesDosPacientes(ctx)]);
  return r.error || !r.data ? null : sessaoDaLinha(r.data as LinhaDaSessao, nomes);
}

const rotuloDaSessao = (s: Sessao) => `${formatarData(s.data)}, ${rotuloDe(pagamentoDaSessao, s.pagamento)}, ${rotuloDe(modalidadeDaSessao, s.modalidade)}`;
const casaPelaData = <R extends { data: string }>(args: Record<string, unknown>, todos: R[]) => {
  const data = dataValida(args.data);
  return data ? todos.filter((r) => r.data === data) : null;
};

/** "mensal" do modelo vira o literal `pagamento mensal` (pegadinha 6). */
const pagamentoDoModelo = (v: unknown) => (v === 'mensal' ? 'pagamento mensal' : typeof v === 'string' ? v : undefined);

const entradaSessao = z.object({
  paciente: campoPacienteDoModelo,
  data: campoDataDoModelo,
  pagamento: z.enum(['pagou', 'nao pagou', 'mensal']).optional(),
  modalidade: z.enum(['presencial', 'remota']).optional(),
  duracao_minutos: z.number().int().optional(),
  cobrada: z.boolean().optional().describe('Se a sessão será cobrada.'),
});

export const edicaoSessao: DefDeRegistro<Sessao> = {
  acao: 'edicao_sessao',
  modo: 'edicao',
  qual: 'alteração de sessão',
  titulo: doAgente.edicaoSessao,
  descricaoAbrir: 'Abre o formulário para ALTERAR uma sessão já registrada: se pagou, modalidade, duração, se será cobrada. A DATA não se altera (para isso, apaga e registra de novo). Use para "a Helena pagou a sessão de terça" ou "a sessão do Caio de ontem foi remota". Preencha só o que muda. Não grava nada: a pessoa confere o antes e depois e clica em Salvar.',
  descricaoFallback: 'Altera uma sessão já registrada em duas chamadas, para clientes sem formulário. A primeira devolve a prévia (antes e depois), as pendências (paciente ou registro a escolher) e um token_previa; nada é gravado. Nunca envie confirmar=true sem mostrar a prévia à pessoa e ela concordar.',
  entrada: entradaSessao,
  porPaciente: true,
  ler: lerSessoes,
  lerUm: lerSessao,
  casam: casaPelaData,
  id: (s) => s.id,
  rotulo: rotuloDaSessao,
  campos: (s, a) => [
    campoLeitura('data', copySessoesDoApp.data, formatarData(s.data), sessaoDoApp.rodapeData),
    campoEscolha('pagamento', copySessoesDoApp.grupoPagamento, pagamentoDaSessao, s.pagamento, pagamentoDoModelo(a.pagamento)),
    campoEscolha('modalidade', copySessoesDoApp.grupoModalidade, modalidadeDaSessao, s.modalidade, a.modalidade as string | undefined),
    { nome: 'duracao_minutos', rotulo: copySessoesDoApp.duracao, tipo: 'numero', atual: s.duracao_minutos === null ? '' : String(s.duracao_minutos),
      atualRotulo: s.duracao_minutos === null ? '—' : `${s.duracao_minutos} min`, valor: typeof a.duracao_minutos === 'number' ? String(a.duracao_minutos) : s.duracao_minutos === null ? '' : String(s.duracao_minutos) },
    campoMarcar('devesercobrada', copySessoesDoApp.seraCobrada, s.cobrada, a.cobrada),
  ],
  validar: (s, v) => {
    const campos = edicaoSessao.campos(s, {}, null);
    const e: ErroDeRegistro[] = [];
    const pagamento = v.pagamento ?? s.pagamento;
    const modalidade = v.modalidade ?? s.modalidade;
    if (!pagamentoDaSessao.some((o) => o.valor === pagamento) || !modalidadeDaSessao.some((o) => o.valor === modalidade)) e.push({ campo: null, mensagem: erros.inesperado });
    // Vazia vira nula, como `useEditarSessao` do app; fora de 1–600 é erro (11.8).
    const texto = (v.duracao_minutos ?? (s.duracao_minutos === null ? '' : String(s.duracao_minutos))).trim();
    const duracao = texto === '' ? null : /^\d+$/.test(texto) && Number(texto) >= 1 && Number(texto) <= 600 ? Number(texto) : NaN;
    if (Number.isNaN(duracao)) e.push({ campo: 'duracao_minutos', mensagem: textosNovosEpico5.duracaoInvalida });
    const cobrada = (v.devesercobrada ?? String(s.cobrada)) === 'true';
    if (e.length) return { ok: false, erros: e };
    const linhas: Mudancas['linhas'] = [];
    if (pagamento !== s.pagamento) linhas.push(...linhaQueMudou(achar(campos, 'pagamento'), rotuloDe(pagamentoDaSessao, pagamento)));
    if (modalidade !== s.modalidade) linhas.push(...linhaQueMudou(achar(campos, 'modalidade'), rotuloDe(modalidadeDaSessao, modalidade)));
    if (duracao !== s.duracao_minutos) linhas.push(...linhaQueMudou(achar(campos, 'duracao_minutos'), duracao === null ? '—' : `${duracao} min`));
    if (cobrada !== s.cobrada) linhas.push(...linhaQueMudou(achar(campos, 'devesercobrada'), cobrada ? 'sim' : 'não'));
    if (!linhas.length) return nadaMudou();
    return { ok: true, mudancas: { colunas: { pagamento, modalidade, duracao_minutos: duracao, devesercobrada: cobrada }, linhas } };
  },
  gravar: async (s, m, ctx) => {
    const r = await ctx.db.from('sessoes').update(m!.colunas as never).eq('id', s.id).eq('usuario_id', ctx.sub).select('id');
    if (r.error) return { ok: false, erros: [{ campo: null, mensagem: erros.inesperado }] };
    if (!(r.data ?? []).length) return { ok: false, erros: [{ campo: null, mensagem: erros.semPermissao }] };
    return { ok: true, ids: [s.id], titulo: sessaoDoApp.sucessoAtualizada, resumo: `${s.paciente_nome}, ${formatarData(s.data)}: ${m!.linhas.map((l) => `${l.campo} ${l.depois}`).join(', ')}` };
  },
  vazio: pacienteDoApp.semSessoes,
  textos: { salvar: copySessoesDoApp.salvar, salvando: copySessoesDoApp.salvando, aviso: null },
};

/** Exclusão comum: apaga por id e devolve o sucesso do app. */
function gravarExclusao<R extends { id: string }>(tabela: Parameters<typeof excluirPorId>[1], titulo: string, resumo: (r: R) => string) {
  return async (r: R, _m: Mudancas | null, ctx: ToolContext, _c: Valores): Promise<RespostaDeRegistro> => {
    const erro = await excluirPorId(ctx, tabela, r.id);
    return erro ? { ok: false, erros: [erro] } : { ok: true, ids: [r.id], titulo, resumo: resumo(r) };
  };
}

export const exclusaoSessao: DefDeRegistro<Sessao> = {
  ...edicaoSessao,
  acao: 'exclusao_sessao',
  modo: 'exclusao',
  qual: 'exclusão de sessão',
  titulo: doAgente.exclusaoSessao,
  descricaoAbrir: 'Abre o formulário para APAGAR uma sessão registrada por engano. Nada é apagado sem a pessoa confirmar duas vezes no formulário.',
  descricaoFallback: 'Apaga uma sessão registrada por engano em duas chamadas, para clientes sem formulário. A primeira devolve a prévia, as pendências e um token_previa; nada é apagado. Nunca envie confirmar=true sem mostrar a prévia à pessoa e ela concordar.',
  entrada: z.object({ paciente: campoPacienteDoModelo, data: campoDataDoModelo }),
  campos: () => [],
  validar: undefined,
  gravar: gravarExclusao('sessoes', sessaoDoApp.sucessoExcluida, (s: Sessao) => `${s.paciente_nome}, ${rotuloDaSessao(s)}`),
  textos: { salvar: sessaoDoApp.excluir, salvando: copySessoesDoApp.salvando, aviso: doAgente.avisoDeExclusao, excluir: sessaoDoApp.excluir, confirmar: sessaoDoApp.confirmarExclusao, definitivo: doSpec.excluirDefinitivamente },
};

// ---------------------------------------------------------------------------
// Pagamento
// ---------------------------------------------------------------------------

export type Pagamento = { id: string; paciente_id: string; paciente_nome: string; data: string; valor: number; tipo: string };
const COLUNAS_DO_PAGAMENTO = 'id, paciente_id, data_competencia, valor_pagamento, tipo';
type LinhaDoPagamento = { id: string; paciente_id: string; data_competencia: string | null; valor_pagamento: number | null; tipo: string | null };
const pagamentoDaLinha = (l: LinhaDoPagamento, nomes: Map<string, string>): Pagamento => ({
  id: l.id, paciente_id: l.paciente_id, paciente_nome: nomes.get(l.paciente_id) ?? '', data: l.data_competencia ?? '', valor: Number(l.valor_pagamento), tipo: l.tipo ?? 'mensal',
});

async function lerPagamentos(ctx: ToolContext, pacienteId: string | null): Promise<Pagamento[] | null> {
  if (!pacienteId) return [];
  const [r, nomes] = await Promise.all([
    ctx.db.from('pagamentos').select(COLUNAS_DO_PAGAMENTO).eq('usuario_id', ctx.sub).eq('paciente_id', pacienteId).order('data_competencia', { ascending: false }).limit(40),
    nomesDosPacientes(ctx),
  ]);
  return r.error ? null : ((r.data ?? []) as LinhaDoPagamento[]).map((l) => pagamentoDaLinha(l, nomes));
}

async function lerPagamento(ctx: ToolContext, id: string): Promise<Pagamento | null> {
  const [r, nomes] = await Promise.all([ctx.db.from('pagamentos').select(COLUNAS_DO_PAGAMENTO).eq('id', id).eq('usuario_id', ctx.sub).maybeSingle(), nomesDosPacientes(ctx)]);
  return r.error || !r.data ? null : pagamentoDaLinha(r.data as LinhaDoPagamento, nomes);
}

const rotuloDoPagamento = (p: Pagamento) => `${formatarData(p.data)}, ${formatarDinheiro(p.valor)}, ${rotuloDe(tipoDoPagamento, p.tipo)}`;
/** Filtra pela data e pelo valor ditos (agente: `valor_atual` na edição, `valor` na exclusão). */
const casaPagamento = (chaveDoValor: string) => (a: Record<string, unknown>, todos: Pagamento[]) => {
  const data = dataValida(a.data);
  const v = validarValorEmReais(a[chaveDoValor]);
  const valor = v.valido ? v.valor : null;
  return data || valor !== null ? todos.filter((p) => (!data || p.data === data) && (valor === null || p.valor === valor)) : null;
};
const tipoDoModelo = (v: unknown) => (v === 'por sessao' ? 'por sessão' : typeof v === 'string' ? v : undefined);

export const edicaoPagamento: DefDeRegistro<Pagamento> = {
  acao: 'edicao_pagamento',
  modo: 'edicao',
  qual: 'alteração de pagamento',
  titulo: doAgente.edicaoPagamento,
  descricaoAbrir: 'Abre o formulário para ALTERAR um pagamento já registrado: valor e tipo (mensal ou por sessão). A competência não se altera. Use para "o pagamento da Beatriz de ontem era 300, não 280". Não grava nada: a pessoa confere o antes e depois e clica em Salvar.',
  descricaoFallback: 'Altera um pagamento já registrado em duas chamadas, para clientes sem formulário. A primeira devolve a prévia (antes e depois), as pendências e um token_previa; nada é gravado. Nunca envie confirmar=true sem mostrar a prévia à pessoa e ela concordar.',
  entrada: z.object({
    paciente: campoPacienteDoModelo,
    data: campoDataDoModelo,
    valor_atual: z.number().optional().describe('Valor que está registrado, se a pessoa disser: ajuda a achar o pagamento certo.'),
    valor: z.number().optional().describe('Valor novo.'),
    tipo: z.enum(['mensal', 'por sessao']).optional(),
  }),
  porPaciente: true,
  ler: lerPagamentos,
  lerUm: lerPagamento,
  casam: casaPagamento('valor_atual'),
  id: (p) => p.id,
  rotulo: rotuloDoPagamento,
  campos: (p, a) => {
    const valorDito = validarValorEmReais(a.valor);
    return [
      campoLeitura('data_competencia', copyPagamentosDoApp.competencia, formatarData(p.data), pagamentoDoApp.rodapeCompetencia),
      { nome: 'valor_pagamento', rotulo: copyPagamentosDoApp.valor, tipo: 'numero', prefixo: 'R$', atual: String(p.valor), atualRotulo: formatarDinheiro(p.valor), valor: valorDito.valido ? String(valorDito.valor) : String(p.valor) },
      campoEscolha('tipo', copyPagamentosDoApp.grupoTipo, tipoDoPagamento, p.tipo, tipoDoModelo(a.tipo)),
    ];
  },
  validar: (p, v) => {
    const campos = edicaoPagamento.campos(p, {}, null);
    const valor = validarValorEmReais(v.valor_pagamento ?? String(p.valor));
    const tipo = v.tipo ?? p.tipo;
    if (!valor.valido) return { ok: false, erros: [{ campo: 'valor_pagamento', mensagem: valor.mensagem }] };
    if (!tipoDoPagamento.some((o) => o.valor === tipo)) return { ok: false, erros: [{ campo: 'tipo', mensagem: erros.inesperado }] };
    const linhas: Mudancas['linhas'] = [];
    if (valor.valor !== p.valor) linhas.push(...linhaQueMudou(achar(campos, 'valor_pagamento'), formatarDinheiro(valor.valor)));
    if (tipo !== p.tipo) linhas.push(...linhaQueMudou(achar(campos, 'tipo'), rotuloDe(tipoDoPagamento, tipo)));
    if (!linhas.length) return nadaMudou();
    return { ok: true, mudancas: { colunas: { valor_pagamento: valor.valor, tipo }, linhas } };
  },
  gravar: async (p, m, ctx) => {
    const r = await ctx.db.from('pagamentos').update(m!.colunas as never).eq('id', p.id).eq('usuario_id', ctx.sub).select('id');
    if (r.error) return { ok: false, erros: [{ campo: null, mensagem: erros.inesperado }] };
    if (!(r.data ?? []).length) return { ok: false, erros: [{ campo: null, mensagem: erros.semPermissao }] };
    return { ok: true, ids: [p.id], titulo: pagamentoDoApp.sucessoAtualizado, resumo: `${p.paciente_nome}, ${formatarData(p.data)}: ${m!.linhas.map((l) => `${l.campo} ${l.depois}`).join(', ')}` };
  },
  vazio: pacienteDoApp.semPagamentos,
  textos: { salvar: copyPagamentosDoApp.salvar, salvando: copyPagamentosDoApp.salvando, aviso: null },
};

export const exclusaoPagamento: DefDeRegistro<Pagamento> = {
  ...edicaoPagamento,
  acao: 'exclusao_pagamento',
  modo: 'exclusao',
  qual: 'exclusão de pagamento',
  titulo: doAgente.exclusaoPagamento,
  descricaoAbrir: 'Abre o formulário para APAGAR um pagamento registrado por engano ou em duplicidade. Nada é apagado sem a pessoa confirmar duas vezes no formulário.',
  descricaoFallback: 'Apaga um pagamento registrado por engano em duas chamadas, para clientes sem formulário. A primeira devolve a prévia, as pendências e um token_previa; nada é apagado. Nunca envie confirmar=true sem mostrar a prévia à pessoa e ela concordar.',
  entrada: z.object({ paciente: campoPacienteDoModelo, data: campoDataDoModelo, valor: z.number().optional().describe('Valor do pagamento a apagar, se a pessoa disser.') }),
  casam: casaPagamento('valor'),
  campos: () => [],
  validar: undefined,
  gravar: gravarExclusao('pagamentos', pagamentoDoApp.sucessoExcluido, (p: Pagamento) => `${p.paciente_nome}, ${rotuloDoPagamento(p)}`),
  textos: { salvar: pagamentoDoApp.excluir, salvando: copyPagamentosDoApp.salvando, aviso: doAgente.avisoDeExclusao, excluir: pagamentoDoApp.excluir, confirmar: pagamentoDoApp.confirmarExclusao, definitivo: doSpec.excluirDefinitivamente },
};

// ---------------------------------------------------------------------------
// Despesa
// ---------------------------------------------------------------------------

export type Despesa = { id: string; tipo_despesa_id: string; tipo_nome: string; data: string; valor: number; descricao: string };
const COLUNAS_DA_DESPESA = 'id, data_competencia, valor_despesa, descricao, tipo_despesa_id, tipos_despesa(nome)';
type LinhaDaDespesa = { id: string; data_competencia: string | null; valor_despesa: number | null; descricao: string | null; tipo_despesa_id: string; tipos_despesa: { nome?: string } | null };
const despesaDaLinha = (l: LinhaDaDespesa): Despesa => ({
  id: l.id, tipo_despesa_id: l.tipo_despesa_id, tipo_nome: l.tipos_despesa?.nome ?? '', data: l.data_competencia ?? '', valor: Number(l.valor_despesa), descricao: l.descricao ?? '',
});

async function lerDespesas(ctx: ToolContext): Promise<Despesa[] | null> {
  const r = await ctx.db.from('despesas').select(COLUNAS_DA_DESPESA).eq('usuario_id', ctx.sub).order('data_competencia', { ascending: false }).limit(60);
  return r.error ? null : ((r.data ?? []) as unknown as LinhaDaDespesa[]).map(despesaDaLinha);
}

async function lerDespesa(ctx: ToolContext, id: string): Promise<Despesa | null> {
  const r = await ctx.db.from('despesas').select(COLUNAS_DA_DESPESA).eq('id', id).eq('usuario_id', ctx.sub).maybeSingle();
  return r.error || !r.data ? null : despesaDaLinha(r.data as unknown as LinhaDaDespesa);
}

const rotuloDaDespesa = (d: Despesa) => `${d.tipo_nome}, ${formatarData(d.data)}, ${formatarDinheiro(d.valor)}${d.descricao ? `, ${d.descricao}` : ''}`;
/** Como `proporDespesa` do agente: tipo (ou descrição), data e valor ditos. */
const casaDespesa = (chaveDoTipo: string, chaveDoValor: string) => (a: Record<string, unknown>, todas: Despesa[]) => {
  const tipo = normalizar(String(a[chaveDoTipo] ?? ''));
  const data = dataValida(a.data);
  const v = validarValorEmReais(a[chaveDoValor]);
  const valor = v.valido ? v.valor : null;
  if (!tipo && !data && valor === null) return null;
  return todas.filter((d) => (!tipo || normalizar(d.tipo_nome).includes(tipo) || normalizar(d.descricao).includes(tipo)) && (!data || d.data === data) && (valor === null || d.valor === valor));
};

export const edicaoDespesa: DefDeRegistro<Despesa> = {
  acao: 'edicao_despesa',
  modo: 'edicao',
  qual: 'alteração de despesa',
  titulo: doAgente.edicaoDespesa,
  descricaoAbrir: 'Abre o formulário para ALTERAR uma despesa já registrada: tipo, valor e descrição. A competência não se altera. Use para "o aluguel deste mês era 1.500, não 1.450". Não grava nada: a pessoa confere o antes e depois e clica em Salvar.',
  descricaoFallback: 'Altera uma despesa já registrada em duas chamadas, para clientes sem formulário. A primeira devolve a prévia (antes e depois), as pendências e um token_previa; nada é gravado. Nunca envie confirmar=true sem mostrar a prévia à pessoa e ela concordar.',
  entrada: z.object({
    tipo_atual: z.string().optional().describe('Tipo da despesa registrada, por exemplo "aluguel".'),
    data: campoDataDoModelo,
    valor_atual: z.number().optional().describe('Valor que está registrado, se a pessoa disser.'),
    valor: z.number().optional().describe('Valor novo.'),
    descricao: z.string().optional().describe('Descrição nova.'),
  }),
  porPaciente: false,
  ler: (ctx) => lerDespesas(ctx),
  lerUm: lerDespesa,
  casam: casaDespesa('tipo_atual', 'valor_atual'),
  id: (d) => d.id,
  rotulo: rotuloDaDespesa,
  extra: (ctx) => lerTiposDespesa(ctx),
  campos: (d, a, extra) => {
    const tipos = ((extra as TipoDespesa[] | null) ?? []).map((t) => ({ valor: t.id, rotulo: t.nome }));
    const valorDito = validarValorEmReais(a.valor);
    return [
      campoLeitura('data_competencia', despesaDoApp.competencia, formatarData(d.data), despesaDoApp.rodapeCompetencia),
      { ...campoEscolha('tipo_despesa_id', copyDespesaDoApp.tipoFolha, tipos.length ? tipos : [{ valor: d.tipo_despesa_id, rotulo: d.tipo_nome }], d.tipo_despesa_id), atualRotulo: d.tipo_nome },
      { nome: 'valor_despesa', rotulo: copyDespesaDoApp.valor, tipo: 'numero', prefixo: 'R$', atual: String(d.valor), atualRotulo: formatarDinheiro(d.valor), valor: valorDito.valido ? String(valorDito.valor) : String(d.valor) },
      { nome: 'descricao', rotulo: copyDespesaDoApp.descricao, tipo: 'texto', atual: d.descricao, atualRotulo: d.descricao || '—', valor: typeof a.descricao === 'string' ? a.descricao.trim() : d.descricao },
    ];
  },
  validar: (d, v, extra) => {
    const campos = edicaoDespesa.campos(d, {}, extra);
    const tipos = (extra as TipoDespesa[] | null) ?? [];
    const tipo = v.tipo_despesa_id ?? d.tipo_despesa_id;
    const valor = validarValorEmReais(v.valor_despesa ?? String(d.valor));
    const descricao = (v.descricao ?? d.descricao).trim();
    const e: ErroDeRegistro[] = [];
    if (tipo !== d.tipo_despesa_id && !tipos.some((t) => t.id === tipo)) e.push({ campo: 'tipo_despesa_id', mensagem: mensagensDoApp.tipoDeDespesaNaoEscolhido });
    if (!valor.valido) e.push({ campo: 'valor_despesa', mensagem: valor.mensagem });
    if (descricao.length > 200) e.push({ campo: 'descricao', mensagem: textosNovosDespesa.descricaoLonga });
    if (e.length || !valor.valido) return { ok: false, erros: e };
    const linhas: Mudancas['linhas'] = [];
    if (tipo !== d.tipo_despesa_id) linhas.push(...linhaQueMudou(achar(campos, 'tipo_despesa_id'), tipos.find((t) => t.id === tipo)?.nome ?? tipo));
    if (valor.valor !== d.valor) linhas.push(...linhaQueMudou(achar(campos, 'valor_despesa'), formatarDinheiro(valor.valor)));
    if (descricao !== d.descricao) linhas.push(...linhaQueMudou(achar(campos, 'descricao'), descricao || '—'));
    if (!linhas.length) return nadaMudou();
    return { ok: true, mudancas: { colunas: { tipo_despesa_id: tipo, valor_despesa: valor.valor, descricao: descricao || null }, linhas } };
  },
  gravar: async (d, m, ctx) => {
    const r = await ctx.db.from('despesas').update(m!.colunas as never).eq('id', d.id).eq('usuario_id', ctx.sub).select('id');
    if (r.error) return { ok: false, erros: [{ campo: null, mensagem: erros.inesperado }] };
    if (!(r.data ?? []).length) return { ok: false, erros: [{ campo: null, mensagem: erros.semPermissao }] };
    return { ok: true, ids: [d.id], titulo: despesaDoApp.sucessoAtualizada, resumo: `${d.tipo_nome}, ${formatarData(d.data)}: ${m!.linhas.map((l) => `${l.campo} ${l.depois}`).join(', ')}` };
  },
  vazio: textosNovosEpico6.semDespesas,
  textos: { salvar: copyDespesaDoApp.salvar, salvando: copyDespesaDoApp.salvando, aviso: null },
};

export const exclusaoDespesa: DefDeRegistro<Despesa> = {
  ...edicaoDespesa,
  acao: 'exclusao_despesa',
  modo: 'exclusao',
  qual: 'exclusão de despesa',
  titulo: doAgente.exclusaoDespesa,
  descricaoAbrir: 'Abre o formulário para APAGAR uma despesa registrada por engano. Nada é apagado sem a pessoa confirmar duas vezes no formulário.',
  descricaoFallback: 'Apaga uma despesa registrada por engano em duas chamadas, para clientes sem formulário. A primeira devolve a prévia, as pendências e um token_previa; nada é apagado. Nunca envie confirmar=true sem mostrar a prévia à pessoa e ela concordar.',
  entrada: z.object({ tipo: z.string().optional().describe('Tipo da despesa, por exemplo "aluguel".'), data: campoDataDoModelo, valor: z.number().optional() }),
  casam: casaDespesa('tipo', 'valor'),
  extra: undefined,
  campos: () => [],
  validar: undefined,
  gravar: gravarExclusao('despesas', despesaDoApp.sucessoExcluida, rotuloDaDespesa),
  textos: { salvar: despesaDoApp.excluir, salvando: copyDespesaDoApp.salvando, aviso: doAgente.avisoDeExclusao, excluir: despesaDoApp.excluir, confirmar: despesaDoApp.confirmarExclusao, definitivo: doSpec.excluirDefinitivamente },
};
