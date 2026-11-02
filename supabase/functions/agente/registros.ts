import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { normalizar } from './ferramentas.ts';
import {
  dataValida,
  type OpcaoDePaciente,
  type PacienteResolvido,
  resolverPaciente,
  type ResultadoDeProposta,
  valorValido,
} from './propostas.ts';

/**
 * Propostas de ALTERAR e APAGAR registros que já existem — sessão, pagamento e
 * despesa. Fase 2 de docs/agente-plano.md, pedida em
 * 02/11/2026 ("CRUD completo para pacientes, agenda, pagamentos, sessões e
 * despesas").
 *
 * Mesmas regras das telas de detalhe, porque o app grava pelos mesmos hooks:
 * - a DATA da sessão e a COMPETÊNCIA do pagamento e da despesa não se alteram
 *   (spec 10, telas 15, 17 e 20); para mudar, apaga-se e registra-se de novo;
 * - nada é escolhido sozinho: se mais de um registro casa com a frase, o
 *   cartão mostra todos e a pessoa escolhe;
 *
 * APAGAR PACIENTE fica de fora, por decisão de 02/11/2026: é exclusão
 * definitiva em cascata (sessões, pagamentos, preços, horários), e a ficha do
 * paciente já tem a confirmação nominal que ela exige.
 *
 * Nenhuma ferramenta daqui grava ou apaga. Só montam o rascunho.
 */

export type RegistroDeSessao = {
  id: string;
  paciente_id: string;
  paciente_nome: string;
  data: string;
  pagamento: 'pagou' | 'nao pagou' | 'pagamento mensal';
  modalidade: 'presencial' | 'remota';
  duracao_minutos: number | null;
  cobrada: boolean;
  observacoes: string | null;
};

export type RegistroDePagamento = {
  id: string;
  paciente_id: string;
  paciente_nome: string;
  data: string;
  valor: number;
  tipo: 'mensal' | 'por sessão';
  observacoes: string | null;
};

export type RegistroDeDespesa = {
  id: string;
  tipo_despesa_id: string;
  tipo_nome: string;
  data: string;
  valor: number;
  descricao: string | null;
  observacoes: string | null;
};

/** O registro que a frase quis dizer. Ambíguo: o cartão lista e a pessoa escolhe. */
export type Alvo<T> = { situacao: 'ok'; registro: T } | { situacao: 'ambiguo'; opcoes: T[] };

export type RascunhoDeRegistro =
  | {
    tipo: 'edicao_sessao';
    alvo: Alvo<RegistroDeSessao>;
    mudancas: Partial<Pick<RegistroDeSessao, 'pagamento' | 'modalidade' | 'duracao_minutos' | 'cobrada' | 'observacoes'>>;
  }
  | { tipo: 'exclusao_sessao'; alvo: Alvo<RegistroDeSessao> }
  | {
    tipo: 'edicao_pagamento';
    alvo: Alvo<RegistroDePagamento>;
    mudancas: Partial<Pick<RegistroDePagamento, 'valor' | 'tipo' | 'observacoes'>>;
  }
  | { tipo: 'exclusao_pagamento'; alvo: Alvo<RegistroDePagamento> }
  | {
    tipo: 'edicao_despesa';
    alvo: Alvo<RegistroDeDespesa>;
    mudancas: Partial<Pick<RegistroDeDespesa, 'tipo_despesa_id' | 'tipo_nome' | 'valor' | 'descricao' | 'observacoes'>>;
  }
  | { tipo: 'exclusao_despesa'; alvo: Alvo<RegistroDeDespesa> };

/** Quantos registros recentes entram na lista quando a frase não basta. */
const RECENTES = 6;

const campoPaciente = { type: 'string', description: 'Nome do paciente como a pessoa disse.' };
const campoData = {
  type: 'string',
  description: 'Data AAAA-MM-DD do registro existente, se a pessoa disser ("a sessão de terça", "o pagamento de ontem").',
};

export const definicoesDeRegistros = [
  {
    name: 'propor_edicao_de_sessao',
    description:
      'Rascunho para ALTERAR uma sessão já registrada: se pagou, modalidade, duração, se será cobrada, observações. A DATA não se altera (para isso, apaga e registra de novo). Use para "a Helena pagou a sessão de terça" ou "a sessão do Caio de ontem foi remota". Preencha só o que muda.',
    input_schema: {
      type: 'object',
      properties: {
        paciente: campoPaciente,
        data: campoData,
        pagamento: { type: 'string', enum: ['pagou', 'nao pagou', 'mensal'] },
        modalidade: { type: 'string', enum: ['presencial', 'remota'] },
        duracao_minutos: { type: 'integer' },
        cobrada: { type: 'boolean', description: 'Se a sessão será cobrada.' },
        observacoes: { type: 'string', description: 'Observações novas, substituindo as atuais.' },
      },
      required: ['paciente'],
    },
  },
  {
    name: 'propor_exclusao_de_sessao',
    description: 'Rascunho para APAGAR uma sessão registrada por engano. Nada é apagado sem a confirmação no cartão.',
    input_schema: {
      type: 'object',
      properties: { paciente: campoPaciente, data: campoData },
      required: ['paciente'],
    },
  },
  {
    name: 'propor_edicao_de_pagamento',
    description:
      'Rascunho para ALTERAR um pagamento já registrado: valor, tipo (mensal ou por sessão), observações. A data de competência não se altera. Use para "o pagamento da Beatriz de ontem era 300, não 280".',
    input_schema: {
      type: 'object',
      properties: {
        paciente: campoPaciente,
        data: campoData,
        valor_atual: { type: 'number', description: 'Valor que está registrado, se a pessoa disser — ajuda a achar o pagamento certo.' },
        valor: { type: 'number', description: 'Valor novo.' },
        tipo: { type: 'string', enum: ['mensal', 'por sessao'] },
        observacoes: { type: 'string' },
      },
      required: ['paciente'],
    },
  },
  {
    name: 'propor_exclusao_de_pagamento',
    description: 'Rascunho para APAGAR um pagamento registrado por engano ou em duplicidade. Nada é apagado sem a confirmação no cartão.',
    input_schema: {
      type: 'object',
      properties: {
        paciente: campoPaciente,
        data: campoData,
        valor: { type: 'number', description: 'Valor do pagamento a apagar, se a pessoa disser.' },
      },
      required: ['paciente'],
    },
  },
  {
    name: 'propor_edicao_de_despesa',
    description:
      'Rascunho para ALTERAR uma despesa já registrada: tipo, valor, descrição, observações. A data de competência não se altera. Use para "o aluguel deste mês era 1.500, não 1.450".',
    input_schema: {
      type: 'object',
      properties: {
        tipo_atual: { type: 'string', description: 'Tipo da despesa registrada, por exemplo "aluguel".' },
        data: campoData,
        valor_atual: { type: 'number', description: 'Valor que está registrado, se a pessoa disser.' },
        valor: { type: 'number', description: 'Valor novo.' },
        descricao: { type: 'string' },
        observacoes: { type: 'string' },
      },
    },
  },
  {
    name: 'propor_exclusao_de_despesa',
    description: 'Rascunho para APAGAR uma despesa registrada por engano. Nada é apagado sem a confirmação no cartão.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', description: 'Tipo da despesa, por exemplo "aluguel".' },
        data: campoData,
        valor: { type: 'number' },
      },
    },
  },
] as const;

export const nomesDeRegistros: readonly string[] = definicoesDeRegistros.map((d) => d.name);

// ---------------------------------------------------------------------------
// Peças puras
// ---------------------------------------------------------------------------

/**
 * Escolhe o alvo entre os candidatos já filtrados pelo que a frase disse.
 * Um: `ok`. Vários: `ambiguo`. Nenhum que case: `ambiguo` com os recentes, para
 * a pessoa achar na lista. Nenhum registro de todo: `null`.
 */
export function escolherAlvo<T>(casam: T[], recentes: T[]): Alvo<T> | null {
  if (casam.length === 1) return { situacao: 'ok', registro: casam[0] };
  if (casam.length > 1) return { situacao: 'ambiguo', opcoes: casam.slice(0, RECENTES) };
  if (recentes.length === 0) return null;
  return { situacao: 'ambiguo', opcoes: recentes.slice(0, RECENTES) };
}

/** "mensal" vira o literal do banco `pagamento mensal` (pegadinha 6). */
function pagamentoDaSessao(v: unknown): RegistroDeSessao['pagamento'] | undefined {
  if (v === 'pagou' || v === 'nao pagou') return v;
  if (v === 'mensal' || v === 'pagamento mensal') return 'pagamento mensal';
  return undefined;
}

/** Monta as mudanças pedidas para uma sessão, só com o que veio. */
export function mudancasDeSessao(e: Record<string, unknown>) {
  const m: Extract<RascunhoDeRegistro, { tipo: 'edicao_sessao' }>['mudancas'] = {};
  const pagamento = pagamentoDaSessao(e.pagamento);
  if (pagamento) m.pagamento = pagamento;
  if (e.modalidade === 'presencial' || e.modalidade === 'remota') m.modalidade = e.modalidade;
  const d = Number(e.duracao_minutos);
  if (Number.isInteger(d) && d > 0 && d <= 600) m.duracao_minutos = d;
  if (typeof e.cobrada === 'boolean') m.cobrada = e.cobrada;
  if (typeof e.observacoes === 'string') m.observacoes = e.observacoes.trim() || null;
  return m;
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

type Entrada = Record<string, unknown>;

function pacienteObrigatorio(
  e: Entrada,
  pacientes: Array<OpcaoDePaciente & { ativo: boolean }>,
): Extract<PacienteResolvido, { situacao: 'ok' }> | { erro: string } {
  const p = resolverPaciente(String(e.paciente ?? ''), pacientes);
  if (p.situacao === 'nao_encontrado') return { erro: `"${p.termo}" não está no cadastro` };
  if (p.situacao === 'ambiguo') {
    return { erro: `"${p.termo}" é ambíguo, pergunte qual: ${p.opcoes.map((o) => o.nome).join(', ')}` };
  }
  return p;
}

/** Executa uma proposta de alterar ou apagar. Recebe o mesmo que as outras. */
export async function executarRegistro(
  nome: string,
  e: Entrada,
  pacientes: Array<OpcaoDePaciente & { ativo: boolean }>,
  cliente: SupabaseClient,
  usuarioId: string,
): Promise<ResultadoDeProposta> {
  if (nome === 'propor_edicao_de_despesa' || nome === 'propor_exclusao_de_despesa') {
    return await proporDespesa(nome, e, cliente, usuarioId);
  }

  const p = pacienteObrigatorio(e, pacientes);
  if ('erro' in p) return p;

  const data = dataValida(e.data);

  if (nome === 'propor_edicao_de_sessao' || nome === 'propor_exclusao_de_sessao') {
    const { data: linhas, error } = await cliente
      .from('sessoes')
      .select('id, ocorreu_em_dia, pagamento, modalidade, duracao_minutos, devesercobrada, observacoes')
      .eq('usuario_id', usuarioId)
      .eq('paciente_id', p.id)
      .order('ocorreu_em_dia', { ascending: false })
      .limit(40);
    if (error) return { erro: 'falha ao ler as sessões' };
    const todas: RegistroDeSessao[] = (linhas ?? []).map((l) => ({
      id: l.id,
      paciente_id: p.id,
      paciente_nome: p.nome,
      data: l.ocorreu_em_dia,
      pagamento: pagamentoDaSessao(l.pagamento) ?? 'pagamento mensal',
      modalidade: l.modalidade === 'remota' ? 'remota' : 'presencial',
      duracao_minutos: l.duracao_minutos,
      cobrada: l.devesercobrada !== false,
      observacoes: l.observacoes,
    }));
    const alvo = escolherAlvo(data ? todas.filter((s) => s.data === data) : [], todas);
    if (!alvo) return { erro: `${p.nome} não tem sessão registrada` };
    if (nome === 'propor_exclusao_de_sessao') {
      return { rascunho: { tipo: 'exclusao_sessao', alvo }, resumo: resumoDoAlvo(alvo, (s) => s.data) };
    }
    const mudancas = mudancasDeSessao(e);
    if (Object.keys(mudancas).length === 0) return { erro: 'nada a mudar: diga o que muda na sessão' };
    return {
      rascunho: { tipo: 'edicao_sessao', alvo, mudancas },
      resumo: { ...resumoDoAlvo(alvo, (s) => s.data), muda: mudancas },
    };
  }

  if (nome === 'propor_edicao_de_pagamento' || nome === 'propor_exclusao_de_pagamento') {
    const { data: linhas, error } = await cliente
      .from('pagamentos')
      .select('id, data_competencia, valor_pagamento, tipo, observacoes')
      .eq('usuario_id', usuarioId)
      .eq('paciente_id', p.id)
      .order('data_competencia', { ascending: false })
      .limit(40);
    if (error) return { erro: 'falha ao ler os pagamentos' };
    const todos: RegistroDePagamento[] = (linhas ?? []).map((l) => ({
      id: l.id,
      paciente_id: p.id,
      paciente_nome: p.nome,
      data: l.data_competencia ?? '',
      valor: Number(l.valor_pagamento),
      tipo: l.tipo === 'por sessão' ? 'por sessão' : 'mensal',
      observacoes: l.observacoes,
    }));
    const valorDito = valorValido(nome === 'propor_exclusao_de_pagamento' ? e.valor : e.valor_atual);
    const filtrados = todos.filter((g) => (!data || g.data === data) && (valorDito === null || g.valor === valorDito));
    const alvo = escolherAlvo(data || valorDito !== null ? filtrados : [], todos);
    if (!alvo) return { erro: `${p.nome} não tem pagamento registrado` };
    if (nome === 'propor_exclusao_de_pagamento') {
      return { rascunho: { tipo: 'exclusao_pagamento', alvo }, resumo: resumoDoAlvo(alvo, (g) => `${g.data} R$ ${g.valor}`) };
    }
    const mudancas: Extract<RascunhoDeRegistro, { tipo: 'edicao_pagamento' }>['mudancas'] = {};
    const valor = valorValido(e.valor);
    if (valor !== null) mudancas.valor = valor;
    if (e.tipo === 'mensal') mudancas.tipo = 'mensal';
    if (e.tipo === 'por sessao' || e.tipo === 'por sessão') mudancas.tipo = 'por sessão';
    if (typeof e.observacoes === 'string') mudancas.observacoes = e.observacoes.trim() || null;
    if (Object.keys(mudancas).length === 0) return { erro: 'nada a mudar: diga o que muda no pagamento' };
    return {
      rascunho: { tipo: 'edicao_pagamento', alvo, mudancas },
      resumo: { ...resumoDoAlvo(alvo, (g) => `${g.data} R$ ${g.valor}`), muda: mudancas },
    };
  }

  return { erro: `proposta desconhecida: ${nome}` };
}

function resumoDoAlvo<T>(alvo: Alvo<T>, rotulo: (t: T) => string) {
  return alvo.situacao === 'ok'
    ? { registro: rotulo(alvo.registro) }
    : { registro: `vários possíveis, a pessoa escolhe no cartão: ${alvo.opcoes.map(rotulo).join('; ')}` };
}

/** Despesa a alterar ou apagar, achada pelo tipo, data e valor ditos. */
async function proporDespesa(
  nome: string,
  e: Entrada,
  cliente: SupabaseClient,
  usuarioId: string,
): Promise<ResultadoDeProposta> {
  const { data: linhas, error } = await cliente
    .from('despesas')
    .select('id, data_competencia, valor_despesa, descricao, observacoes, tipo_despesa_id, tipos_despesa(nome)')
    .eq('usuario_id', usuarioId)
    .order('data_competencia', { ascending: false })
    .limit(60);
  if (error) return { erro: 'falha ao ler as despesas' };
  const todas: RegistroDeDespesa[] = (linhas ?? []).map((l) => ({
    id: l.id,
    tipo_despesa_id: l.tipo_despesa_id,
    tipo_nome: (l.tipos_despesa as { nome?: string } | null)?.nome ?? 'sem tipo',
    data: l.data_competencia ?? '',
    valor: Number(l.valor_despesa),
    descricao: l.descricao,
    observacoes: l.observacoes,
  }));

  const exclusao = nome === 'propor_exclusao_de_despesa';
  const tipo = normalizar(String((exclusao ? e.tipo : e.tipo_atual) ?? ''));
  const data = dataValida(e.data);
  const valorDito = valorValido(exclusao ? e.valor : e.valor_atual);
  const disse = !!tipo || !!data || valorDito !== null;
  const filtradas = todas.filter((d) =>
    (!tipo || normalizar(d.tipo_nome).includes(tipo) || normalizar(d.descricao ?? '').includes(tipo)) &&
    (!data || d.data === data) && (valorDito === null || d.valor === valorDito)
  );
  const alvo = escolherAlvo(disse ? filtradas : [], todas);
  if (!alvo) return { erro: 'não há despesa registrada' };
  const rotulo = (d: RegistroDeDespesa) => `${d.tipo_nome} ${d.data} R$ ${d.valor}`;

  if (exclusao) return { rascunho: { tipo: 'exclusao_despesa', alvo }, resumo: resumoDoAlvo(alvo, rotulo) };

  const mudancas: Extract<RascunhoDeRegistro, { tipo: 'edicao_despesa' }>['mudancas'] = {};
  const valor = valorValido(e.valor);
  if (valor !== null) mudancas.valor = valor;
  if (typeof e.descricao === 'string') mudancas.descricao = e.descricao.trim() || null;
  if (typeof e.observacoes === 'string') mudancas.observacoes = e.observacoes.trim() || null;
  if (Object.keys(mudancas).length === 0) return { erro: 'nada a mudar: diga o que muda na despesa' };
  return { rascunho: { tipo: 'edicao_despesa', alvo, mudancas }, resumo: { ...resumoDoAlvo(alvo, rotulo), muda: mudancas } };
}
