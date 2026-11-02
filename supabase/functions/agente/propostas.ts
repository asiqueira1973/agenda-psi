import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { diaDaSemanaDoBanco, normalizar } from './ferramentas.ts';
import type { RascunhoDeRegistro } from './registros.ts';

/**
 * As ferramentas de PROPOSTA do agente — fase 2 de docs/agente-plano.md.
 *
 * Nenhuma delas grava. Cada uma devolve um RASCUNHO, que o app mostra como
 * cartão de confirmação; quem grava é o app, quando a pessoa toca em
 * Confirmar, pelos mesmos hooks das telas de cadastro.
 *
 * A divisão de trabalho:
 * - a IA só tira os campos da frase (nome, data, valor, pagou ou não);
 * - este arquivo acha o paciente pelo nome, preenche os padrões das telas e
 *   converte para os valores LITERAIS do banco (pegadinha 6: `nao pagou` sem
 *   acento, `por sessão` com acento);
 * - o app valida de novo, deixa editar e grava.
 *
 * Um cartão, uma coisa do app: sessão, pagamento, paciente, horário e despesa
 * são rascunhos de tipos diferentes. A única junção é paciente novo com os
 * seus horários, que aparece como um cartão de duas seções e é gravada em dois
 * passos (o paciente primeiro, o horário com o id dele depois).
 *
 * Este contrato é espelhado em `app/src/features/agent/rascunhos.ts`.
 */

// ---------------------------------------------------------------------------
// Contrato do rascunho
// ---------------------------------------------------------------------------

export type OpcaoDePaciente = { id: string; nome: string; preco_referencia: number | null };

/** O paciente de uma linha, já procurado no banco. */
export type PacienteResolvido =
  | ({ situacao: 'ok' } & OpcaoDePaciente)
  | { situacao: 'ambiguo'; termo: string; opcoes: OpcaoDePaciente[] }
  | { situacao: 'nao_encontrado'; termo: string };

export type ItemDeSessao = {
  paciente: PacienteResolvido;
  data: string;
  pagamento: 'pagou' | 'nao pagou' | 'pagamento mensal';
  modalidade: 'presencial' | 'remota';
  duracao_minutos: number;
};

export type ItemDePagamento = {
  paciente: PacienteResolvido;
  /** Null quando nem a frase nem o cadastro dão valor: o cartão pede. */
  valor: number | null;
  /** De onde veio o valor: dito na frase ou preço de referência do cadastro. */
  valor_origem: 'frase' | 'referencia' | 'nenhum';
  data: string;
  tipo: 'mensal' | 'por sessão';
};

export type ItemDeHorario = {
  paciente: PacienteResolvido;
  /** 1 = segunda … 7 = domingo (pegadinha 7). */
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
};

export type ItemDeDespesa = {
  tipo_despesa:
    | { situacao: 'ok'; id: string; nome: string }
    | { situacao: 'ambiguo' | 'nao_encontrado'; termo: string; opcoes: { id: string; nome: string }[] };
  valor: number | null;
  data: string;
  descricao: string | null;
};

export type Rascunho =
  | { tipo: 'sessoes'; itens: ItemDeSessao[] }
  | { tipo: 'pagamentos'; itens: ItemDePagamento[] }
  | {
    tipo: 'paciente';
    paciente: {
      nome: string;
      telefone: string | null;
      email: string | null;
      preco: number | null;
      receber_sms: boolean;
    };
    /** Horários fixos que a mesma frase pediu, gravados depois do paciente. */
    horarios: Omit<ItemDeHorario, 'paciente'>[];
  }
  | { tipo: 'horarios'; itens: ItemDeHorario[] }
  | { tipo: 'despesas'; itens: ItemDeDespesa[] }
  | { tipo: 'feedback'; categoria: 'problema' | 'sugestao' | 'elogio'; mensagem: string }
  | {
    tipo: 'troca_horario';
    paciente: Extract<PacienteResolvido, { situacao: 'ok' }>;
    atual: HorarioResolvido;
    novo: { dia_semana: number; hora_inicio: string; hora_fim: string };
  }
  | { tipo: 'remocao_horario'; paciente: Extract<PacienteResolvido, { situacao: 'ok' }>; atual: HorarioResolvido }
  | RascunhoDeRegistro
  | {
    tipo: 'edicao_paciente';
    paciente: Extract<PacienteResolvido, { situacao: 'ok' }>;
    /** O cadastro como está, para o cartão mostrar o "antes". */
    atual: CadastroDoPaciente;
    /** O cadastro com o que a frase pediu para mudar. */
    novo: CadastroDoPaciente;
  };

/**
 * Os campos do cadastro que o agente pode alterar — os da tela de editar
 * paciente, mais o preço (que é gravado como linha nova, regra 11.2).
 * As observações vão junto mesmo quando não mudam: a edição grava o cadastro
 * inteiro, e omiti-las as apagaria.
 */
export type CadastroDoPaciente = {
  nome: string;
  telefone: string;
  email: string | null;
  observacoes: string | null;
  status: 'ativo' | 'inativo';
  receber_sms: boolean;
  preco: number | null;
};

/** Um horário fixo que já existe na agenda. */
export type HorarioExistente = { id: string; dia_semana: number; hora_inicio: string; hora_fim: string };

/** Qual horário do paciente a frase quis dizer. Ambíguo: o cartão pergunta. */
export type HorarioResolvido =
  | ({ situacao: 'ok' } & HorarioExistente)
  | { situacao: 'ambiguo'; opcoes: HorarioExistente[] };

// ---------------------------------------------------------------------------
// Definições para a API
// ---------------------------------------------------------------------------

const DIAS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'] as const;

const campoPaciente = {
  type: 'string',
  description: 'Nome do paciente como a pessoa disse. O servidor procura no cadastro.',
};
const campoData = {
  type: 'string',
  description: 'Data AAAA-MM-DD. Resolva "hoje", "ontem", "segunda passada" a partir da data de hoje.',
};
const campoDia = { type: 'string', enum: DIAS, description: 'Dia da semana do horário fixo.' };
const campoHora = { type: 'string', description: 'Hora HH:MM, 24h.' };

export const definicoesDePropostas = [
  {
    name: 'propor_sessoes',
    description:
      'Monta um rascunho de UMA OU MAIS sessões realizadas (atendimentos que aconteceram) para a pessoa confirmar num cartão. Não grava nada. Use para "atendi a Beatriz hoje", "segunda passada atendi Caio e Helena". Uma sessão marcada como paga NÃO cria pagamento.',
    input_schema: {
      type: 'object',
      properties: {
        itens: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              paciente: campoPaciente,
              data: campoData,
              pagamento: {
                type: 'string',
                enum: ['pagou', 'nao pagou', 'mensal'],
                description: 'Só se a pessoa disser. Omita se não disser: vale o padrão do app (mensal).',
              },
              modalidade: { type: 'string', enum: ['presencial', 'remota'], description: 'Só se a pessoa disser.' },
              duracao_minutos: { type: 'integer', description: 'Só se a pessoa disser. Padrão 50.' },
            },
            required: ['paciente', 'data'],
          },
        },
      },
      required: ['itens'],
    },
  },
  {
    name: 'propor_pagamentos',
    description:
      'Monta um rascunho de UM OU MAIS pagamentos recebidos (dinheiro que entrou) para a pessoa confirmar. Não grava nada e não cria sessão. Use para "a Beatriz pagou 280", "recebi do Caio e da Helena hoje".',
    input_schema: {
      type: 'object',
      properties: {
        itens: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              paciente: campoPaciente,
              valor: { type: 'number', description: 'Valor em reais, só se a pessoa disser. Omita se não disser.' },
              data: campoData,
              tipo: {
                type: 'string',
                enum: ['mensal', 'por sessao'],
                description: 'Só se a pessoa disser. Padrão: mensal.',
              },
            },
            required: ['paciente', 'data'],
          },
        },
      },
      required: ['itens'],
    },
  },
  {
    name: 'propor_paciente',
    description:
      'Monta o rascunho do cadastro de UM paciente novo, e opcionalmente dos horários fixos dele na agenda semanal, se a mesma frase pedir. Não grava nada. Telefone e preço são obrigatórios no app: se a pessoa não disser, omita e o cartão pede.',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string', description: 'Nome completo como a pessoa disse.' },
        telefone: { type: 'string', description: 'Só se a pessoa disser.' },
        email: { type: 'string', description: 'Só se a pessoa disser.' },
        preco: { type: 'number', description: 'Preço por sessão em reais, só se a pessoa disser.' },
        receber_sms: { type: 'boolean', description: 'Só se a pessoa disser. Padrão: sim.' },
        horarios: {
          type: 'array',
          items: {
            type: 'object',
            properties: { dia: campoDia, hora_inicio: campoHora, hora_fim: campoHora },
            required: ['dia', 'hora_inicio'],
          },
        },
      },
      required: ['nome'],
    },
  },
  {
    name: 'propor_horarios',
    description:
      'Monta um rascunho de UM OU MAIS horários fixos na agenda semanal para pacientes JÁ cadastrados. Não grava nada. Use para "põe a Laura toda quarta às 10h". Paciente novo usa propor_paciente.',
    input_schema: {
      type: 'object',
      properties: {
        itens: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              paciente: campoPaciente,
              dia: campoDia,
              hora_inicio: campoHora,
              hora_fim: { ...campoHora, description: 'Só se a pessoa disser. Padrão: 50 minutos depois.' },
            },
            required: ['paciente', 'dia', 'hora_inicio'],
          },
        },
      },
      required: ['itens'],
    },
  },
  {
    name: 'propor_despesas',
    description:
      'Monta um rascunho de UMA OU MAIS despesas do consultório (dinheiro que saiu: aluguel, supervisão, impostos). Não grava nada.',
    input_schema: {
      type: 'object',
      properties: {
        itens: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              tipo: { type: 'string', description: 'Tipo da despesa como a pessoa disse, por exemplo "aluguel".' },
              valor: { type: 'number', description: 'Valor em reais.' },
              data: campoData,
              descricao: { type: 'string', description: 'Descrição curta, só se a pessoa disser.' },
            },
            required: ['tipo', 'data'],
          },
        },
      },
      required: ['itens'],
    },
  },
  {
    name: 'propor_feedback',
    description:
      'Monta o rascunho de um feedback para a equipe do Agenda Psi: um problema, erro ou bug no app, uma sugestão de melhoria, ou um elogio. Não envia nada: a pessoa confere o texto num cartão e confirma. Use quando a pessoa reclamar de algo que não funciona, relatar um erro, sugerir uma melhoria ou elogiar o app.',
    input_schema: {
      type: 'object',
      properties: {
        categoria: {
          type: 'string',
          enum: ['problema', 'sugestao', 'elogio'],
          description: 'problema para erro, bug ou algo que não funciona; sugestao para melhoria ou ideia; elogio para quando a pessoa diz que gostou.',
        },
        mensagem: {
          type: 'string',
          description:
            'O feedback com as palavras da pessoa, fiel ao que ela disse, em uma a três frases. Sem nome de paciente nem valores, a menos que sejam necessários para entender o problema.',
        },
      },
      required: ['categoria', 'mensagem'],
    },
  },
  {
    name: 'propor_troca_de_horario',
    description:
      'Monta o rascunho da TROCA de um horário fixo da agenda semanal de um paciente já cadastrado: de um dia/hora para outro. Não grava nada. Use para "o Tomás passou de quarta às 9h para quarta às 10h" ou "muda a Laura para quinta". Informe o horário atual se a pessoa disser; o servidor procura entre os horários do paciente.',
    input_schema: {
      type: 'object',
      properties: {
        paciente: campoPaciente,
        dia_atual: { ...campoDia, description: 'Dia do horário que vai mudar, se a pessoa disser.' },
        hora_atual: { ...campoHora, description: 'Hora de início atual, se a pessoa disser.' },
        novo_dia: { ...campoDia, description: 'Dia novo. Omita se continuar o mesmo dia.' },
        nova_hora_inicio: { ...campoHora, description: 'Hora de início nova. Omita se só mudar o dia.' },
        nova_hora_fim: { ...campoHora, description: 'Só se a pessoa disser. Padrão: mantém a duração atual.' },
      },
      required: ['paciente'],
    },
  },
  {
    name: 'propor_remocao_de_horario',
    description:
      'Monta o rascunho para TIRAR um horário fixo da agenda semanal de um paciente (ele parou de vir naquele horário). Não apaga nada: a pessoa confirma num cartão. Use para "o Tomás parou de vir às quartas" ou "tira a Laura da agenda de quinta". Não apaga o paciente nem as sessões dele.',
    input_schema: {
      type: 'object',
      properties: {
        paciente: campoPaciente,
        dia: { ...campoDia, description: 'Dia do horário a tirar, se a pessoa disser.' },
        hora: { ...campoHora, description: 'Hora de início, se a pessoa disser.' },
      },
      required: ['paciente'],
    },
  },
  {
    name: 'propor_edicao_de_paciente',
    description:
      'Monta o rascunho de uma ALTERAÇÃO no cadastro de um paciente já cadastrado: nome, telefone, e-mail, observações, se recebe lembrete por SMS, se está ativo ou inativo, e o preço por sessão. Não grava nada. Preencha SÓ os campos que a pessoa pediu para mudar.',
    input_schema: {
      type: 'object',
      properties: {
        paciente: campoPaciente,
        nome: { type: 'string', description: 'Nome completo novo.' },
        telefone: { type: 'string', description: 'Telefone novo.' },
        email: { type: 'string', description: 'E-mail novo. String vazia para apagar o e-mail.' },
        observacoes: { type: 'string', description: 'Observações novas, substituindo as atuais.' },
        receber_sms: { type: 'boolean', description: 'true liga o lembrete por SMS, false desliga.' },
        status: { type: 'string', enum: ['ativo', 'inativo'] },
        preco: { type: 'number', description: 'Preço novo por sessão, em reais. Vale a partir de hoje.' },
      },
      required: ['paciente'],
    },
  },
] as const;

/**
 * Versão mínima de cartões que o app precisa avisar (`versao_cartoes` no
 * pedido) para receber cada ferramenta. A 5.0.2 não avisa: se recebesse um destes
 * cartões, o descartaria em silêncio e o agente diria "confira o cartão" sobre
 * um cartão que não aparece.
 */
export const versaoMinimaDosCartoes: Record<string, number> = {
  propor_troca_de_horario: 2,
  propor_remocao_de_horario: 2,
  propor_edicao_de_paciente: 2,
  // Alterar e apagar sessão, pagamento e despesa: build 2 da 5.0.2 em diante.
  propor_edicao_de_sessao: 3,
  propor_exclusao_de_sessao: 3,
  propor_edicao_de_pagamento: 3,
  propor_exclusao_de_pagamento: 3,
  propor_edicao_de_despesa: 3,
  propor_exclusao_de_despesa: 3,
};

/** O app com esta versão de cartões sabe mostrar o cartão desta ferramenta? */
export function appMostra(ferramenta: string, versaoCartoes: number): boolean {
  return versaoCartoes >= (versaoMinimaDosCartoes[ferramenta] ?? 1);
}

export const nomesDePropostas: readonly string[] = definicoesDePropostas.map((d) => d.name);

// ---------------------------------------------------------------------------
// Peças puras (testadas em propostas.test.ts)
// ---------------------------------------------------------------------------

/** Data AAAA-MM-DD válida, ou null. */
export function dataValida(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  return diaDaSemanaDoBanco(v) === null ? null : v;
}

/** Valor em reais positivo e plausível, ou null. */
export function valorValido(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  return Math.round(n * 100) / 100;
}

/** Hora HH:MM normalizada ("9:00" vira "09:00"), ou null. */
export function horaValida(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^(\d{1,2})[:h](\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Hora de fim padrão das telas: 50 minutos depois do início (tela 7). */
export function horaFimPadrao(inicio: string): string {
  const [h, m] = inicio.split(':').map(Number);
  const total = Math.min(h * 60 + m + 50, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Nome do dia ("quarta") no número do banco (3). Pegadinha 7: 1 = segunda. */
export function diaDoNome(nome: unknown): number | null {
  if (typeof nome !== 'string') return null;
  const i = (DIAS as readonly string[]).indexOf(normalizar(nome).replace('-feira', ''));
  return i === -1 ? null : i + 1;
}

/**
 * Acha o paciente pelo nome dito.
 *
 * Ordem: nome inteiro igual (sem acento e caixa) vence; senão, todas as
 * palavras do termo contidas no nome. Um achado é `ok`; mais de um é
 * `ambiguo`, com os ativos primeiro; nenhum é `nao_encontrado`. Nunca escolhe
 * sozinho entre dois — "Helena pagou" gravado na Helena errada é pior que
 * perguntar.
 */
export function resolverPaciente(
  termo: string,
  pacientes: Array<OpcaoDePaciente & { ativo: boolean }>,
): PacienteResolvido {
  const procurado = normalizar(termo);
  if (!procurado) return { situacao: 'nao_encontrado', termo };

  const exatos = pacientes.filter((p) => normalizar(p.nome) === procurado);
  const palavras = procurado.split(/\s+/);
  const candidatos = exatos.length > 0
    ? exatos
    : pacientes.filter((p) => palavras.every((w) => normalizar(p.nome).includes(w)));

  const sem = ({ ativo: _a, ...p }: OpcaoDePaciente & { ativo: boolean }) => p;
  if (candidatos.length === 1) return { situacao: 'ok', ...sem(candidatos[0]) };
  if (candidatos.length === 0) return { situacao: 'nao_encontrado', termo };
  const ordenados = [...candidatos].sort((a, b) => Number(b.ativo) - Number(a.ativo));
  return { situacao: 'ambiguo', termo, opcoes: ordenados.slice(0, 8).map(sem) };
}

/** Valor do pagamento: o da frase, senão o preço de referência, senão nenhum. */
export function valorDoPagamento(
  dito: unknown,
  paciente: PacienteResolvido,
): { valor: number | null; valor_origem: ItemDePagamento['valor_origem'] } {
  const daFrase = valorValido(dito);
  if (daFrase !== null) return { valor: daFrase, valor_origem: 'frase' };
  if (paciente.situacao === 'ok' && paciente.preco_referencia) {
    return { valor: paciente.preco_referencia, valor_origem: 'referencia' };
  }
  return { valor: null, valor_origem: 'nenhum' };
}

/** "mensal" da IA vira o literal do banco `pagamento mensal` (pegadinha 6). */
export function pagamentoDaSessao(v: unknown): ItemDeSessao['pagamento'] {
  if (v === 'pagou') return 'pagou';
  if (v === 'nao pagou') return 'nao pagou';
  return 'pagamento mensal';
}

/**
 * Qual horário do paciente a frase quis dizer.
 *
 * Filtra pelo dia e pela hora ditos. Um que casa é `ok`; vários é `ambiguo`;
 * nenhum que case com o que foi dito também vira `ambiguo` com TODOS os
 * horários dele — o cartão mostra e a pessoa escolhe, em vez de o agente
 * adivinhar. Devolve `null` só se o paciente não tem horário nenhum.
 */
export function resolverHorario(
  horarios: HorarioExistente[],
  dia: number | null,
  hora: string | null,
): HorarioResolvido | null {
  if (horarios.length === 0) return null;
  const casam = horarios.filter((h) =>
    (dia === null || h.dia_semana === dia) && (hora === null || h.hora_inicio === hora)
  );
  if (casam.length === 1) return { situacao: 'ok', ...casam[0] };
  return { situacao: 'ambiguo', opcoes: casam.length > 1 ? casam : horarios };
}

/** Soma minutos a uma hora HH:MM, sem passar de 23:59. */
export function somarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(':').map(Number);
  const total = Math.min(h * 60 + m + minutos, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Duração em minutos entre duas horas HH:MM. */
export function duracaoEmMinutos(inicio: string, fim: string): number {
  const [hi, mi] = inicio.split(':').map(Number);
  const [hf, mf] = fim.split(':').map(Number);
  return hf * 60 + mf - (hi * 60 + mi);
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

/** O que a ferramenta devolve: o rascunho para o app e um resumo para a IA. */
export type ResultadoDeProposta =
  | { rascunho: Rascunho; resumo: unknown }
  | { erro: string };

/** Pacientes do usuário, uma leitura por proposta. */
export async function lerPacientes(cliente: SupabaseClient, usuarioId: string) {
  const { data, error } = await cliente
    .from('v_pacientes_cartao')
    .select('paciente_id, nome_completo, preco_vigente, status')
    .eq('usuario_id', usuarioId);
  if (error) return null;
  return (data ?? [])
    .filter((p) => p.paciente_id && p.nome_completo)
    .map((p) => ({
      id: p.paciente_id as string,
      nome: p.nome_completo as string,
      preco_referencia: p.preco_vigente ? Number(p.preco_vigente) : null,
      ativo: p.status === 'ativo',
    }));
}

/** Como o paciente de uma linha aparece no resumo que volta para a IA. */
function resumoDoPaciente(p: PacienteResolvido) {
  if (p.situacao === 'ok') return p.nome;
  if (p.situacao === 'ambiguo') return `"${p.termo}" é ambíguo: ${p.opcoes.map((o) => o.nome).join(', ')}`;
  return `"${p.termo}" não encontrado no cadastro`;
}

type Entrada = Record<string, unknown>;
const itensDe = (e: Entrada) => (Array.isArray(e.itens) ? (e.itens as Entrada[]) : []);

/**
 * Executa uma proposta. Recebe o nome da ferramenta, o que a IA preencheu, o
 * cliente do usuário e o id dele (do JWT). Linha com dado impossível (data que
 * não existe, hora inválida) é recusada inteira com `erro`, para a IA
 * perguntar — o cartão não deve nascer com campo que a pessoa não disse.
 */
export async function executarProposta(
  nome: string,
  entrada: Entrada,
  cliente: SupabaseClient,
  usuarioId: string,
): Promise<ResultadoDeProposta> {
  if (nome === 'propor_paciente') return proporPaciente(entrada);
  if (nome === 'propor_feedback') return proporFeedback(entrada);
  if (nome === 'propor_despesas') return await proporDespesas(entrada, cliente);

  const pacientes = await lerPacientes(cliente, usuarioId);
  if (!pacientes) return { erro: 'falha ao ler pacientes' };

  if (nome === 'propor_sessoes') {
    const itens: ItemDeSessao[] = [];
    for (const i of itensDe(entrada)) {
      const data = dataValida(i.data);
      if (!data) return { erro: `data inválida: ${String(i.data)}` };
      const duracao = Number(i.duracao_minutos);
      itens.push({
        paciente: resolverPaciente(String(i.paciente ?? ''), pacientes),
        data,
        pagamento: pagamentoDaSessao(i.pagamento),
        modalidade: i.modalidade === 'remota' ? 'remota' : 'presencial',
        duracao_minutos: Number.isInteger(duracao) && duracao > 0 && duracao <= 600 ? duracao : 50,
      });
    }
    if (itens.length === 0) return { erro: 'nenhuma sessão na proposta' };
    return {
      rascunho: { tipo: 'sessoes', itens },
      resumo: itens.map((i) => ({ paciente: resumoDoPaciente(i.paciente), data: i.data, pagamento: i.pagamento })),
    };
  }

  if (nome === 'propor_pagamentos') {
    const itens: ItemDePagamento[] = [];
    for (const i of itensDe(entrada)) {
      const data = dataValida(i.data);
      if (!data) return { erro: `data inválida: ${String(i.data)}` };
      const paciente = resolverPaciente(String(i.paciente ?? ''), pacientes);
      itens.push({
        paciente,
        ...valorDoPagamento(i.valor, paciente),
        data,
        tipo: i.tipo === 'por sessao' || i.tipo === 'por sessão' ? 'por sessão' : 'mensal',
      });
    }
    if (itens.length === 0) return { erro: 'nenhum pagamento na proposta' };
    return {
      rascunho: { tipo: 'pagamentos', itens },
      resumo: itens.map((i) => ({
        paciente: resumoDoPaciente(i.paciente),
        valor: i.valor,
        origem_do_valor: i.valor_origem,
        data: i.data,
      })),
    };
  }

  if (nome === 'propor_edicao_de_paciente') return await proporEdicaoDePaciente(entrada, pacientes, cliente, usuarioId);

  if (nome === 'propor_troca_de_horario' || nome === 'propor_remocao_de_horario') {
    return await proporMudancaDeHorario(nome, entrada, pacientes, cliente, usuarioId);
  }

  if (nome === 'propor_horarios') {
    const itens: ItemDeHorario[] = [];
    for (const i of itensDe(entrada)) {
      const dia = diaDoNome(i.dia);
      const inicio = horaValida(i.hora_inicio);
      if (!dia || !inicio) return { erro: 'dia ou hora inválidos' };
      const fim = horaValida(i.hora_fim) ?? horaFimPadrao(inicio);
      if (fim <= inicio) return { erro: 'hora de fim antes do início' };
      itens.push({
        paciente: resolverPaciente(String(i.paciente ?? ''), pacientes),
        dia_semana: dia,
        hora_inicio: inicio,
        hora_fim: fim,
      });
    }
    if (itens.length === 0) return { erro: 'nenhum horário na proposta' };
    return {
      rascunho: { tipo: 'horarios', itens },
      resumo: itens.map((i) => ({
        paciente: resumoDoPaciente(i.paciente),
        dia: DIAS[i.dia_semana - 1],
        inicio: i.hora_inicio,
        fim: i.hora_fim,
      })),
    };
  }

  return { erro: `proposta desconhecida: ${nome}` };
}

/**
 * Aplica ao cadastro atual só o que a IA preencheu. Puro, para teste.
 * Campo ausente fica como está; e-mail vazio apaga o e-mail.
 */
export function aplicarEdicao(atual: CadastroDoPaciente, e: Entrada): CadastroDoPaciente {
  const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : undefined);
  const nome = texto(e.nome);
  const telefone = texto(e.telefone);
  const email = texto(e.email);
  const observacoes = texto(e.observacoes);
  return {
    nome: nome || atual.nome,
    telefone: telefone || atual.telefone,
    email: email === undefined ? atual.email : email || null,
    observacoes: observacoes === undefined ? atual.observacoes : observacoes || null,
    status: e.status === 'ativo' || e.status === 'inativo' ? e.status : atual.status,
    receber_sms: typeof e.receber_sms === 'boolean' ? e.receber_sms : atual.receber_sms,
    preco: valorValido(e.preco) ?? atual.preco,
  };
}

/** Quais campos mudaram, pelo nome que aparece no cartão. */
export function camposAlterados(a: CadastroDoPaciente, b: CadastroDoPaciente): string[] {
  return (Object.keys(a) as (keyof CadastroDoPaciente)[]).filter((k) => a[k] !== b[k]);
}

/** Alteração de cadastro: lê o cadastro atual e aplica o que foi pedido. */
async function proporEdicaoDePaciente(
  e: Entrada,
  pacientes: Array<OpcaoDePaciente & { ativo: boolean }>,
  cliente: SupabaseClient,
  usuarioId: string,
): Promise<ResultadoDeProposta> {
  const p = resolverPaciente(String(e.paciente ?? ''), pacientes);
  if (p.situacao === 'nao_encontrado') return { erro: `"${p.termo}" não está no cadastro` };
  if (p.situacao === 'ambiguo') {
    return { erro: `"${p.termo}" é ambíguo, pergunte qual: ${p.opcoes.map((o) => o.nome).join(', ')}` };
  }

  const { data, error } = await cliente
    .from('v_pacientes_cartao')
    .select('nome_completo, telefone, email, observacoes, status, receber_sms, preco_vigente')
    .eq('usuario_id', usuarioId)
    .eq('paciente_id', p.id)
    .maybeSingle();
  if (error || !data) return { erro: 'falha ao ler o cadastro' };

  const atual: CadastroDoPaciente = {
    nome: data.nome_completo ?? p.nome,
    telefone: data.telefone ?? '',
    email: data.email ?? null,
    observacoes: data.observacoes ?? null,
    status: data.status === 'inativo' ? 'inativo' : 'ativo',
    receber_sms: data.receber_sms ?? true,
    preco: data.preco_vigente ? Number(data.preco_vigente) : null,
  };
  const novo = aplicarEdicao(atual, e);
  const mudou = camposAlterados(atual, novo);
  if (mudou.length === 0) return { erro: 'nada a mudar: os dados pedidos já são os do cadastro' };

  return {
    rascunho: { tipo: 'edicao_paciente', paciente: p, atual, novo },
    resumo: { paciente: p.nome, campos_alterados: mudou },
  };
}

/**
 * Troca ou remoção de um horário fixo.
 *
 * O paciente PRECISA estar resolvido aqui: se o nome for ambíguo, a IA recebe
 * as opções e pergunta — os horários dependem de quem é o paciente, e um cartão
 * que troca o horário da Ana errada é exatamente o que não pode acontecer.
 */
async function proporMudancaDeHorario(
  nome: string,
  e: Entrada,
  pacientes: Array<OpcaoDePaciente & { ativo: boolean }>,
  cliente: SupabaseClient,
  usuarioId: string,
): Promise<ResultadoDeProposta> {
  const p = resolverPaciente(String(e.paciente ?? ''), pacientes);
  if (p.situacao === 'nao_encontrado') return { erro: `"${p.termo}" não está no cadastro` };
  if (p.situacao === 'ambiguo') {
    return { erro: `"${p.termo}" é ambíguo, pergunte qual: ${p.opcoes.map((o) => o.nome).join(', ')}` };
  }

  const { data, error } = await cliente
    .from('view_agenda_semana_padrao')
    .select('id, dia_semana, hora_inicio, hora_fim')
    .eq('usuario_id', usuarioId)
    .eq('paciente_id', p.id)
    .order('dia_semana', { ascending: true })
    .order('hora_inicio', { ascending: true });
  if (error) return { erro: 'falha ao ler a agenda' };
  const horarios: HorarioExistente[] = (data ?? []).map((h) => ({
    id: h.id as string,
    dia_semana: h.dia_semana as number,
    hora_inicio: String(h.hora_inicio).slice(0, 5),
    hora_fim: String(h.hora_fim).slice(0, 5),
  }));

  const remocao = nome === 'propor_remocao_de_horario';
  const atual = resolverHorario(
    horarios,
    diaDoNome(remocao ? e.dia : e.dia_atual),
    horaValida(remocao ? e.hora : e.hora_atual),
  );
  if (!atual) return { erro: `${p.nome} não tem horário fixo na agenda` };

  const resumoAtual = atual.situacao === 'ok'
    ? `${DIAS[atual.dia_semana - 1]} ${atual.hora_inicio}–${atual.hora_fim}`
    : `ambíguo, a pessoa escolhe no cartão entre: ${atual.opcoes.map((h) => `${DIAS[h.dia_semana - 1]} ${h.hora_inicio}`).join(', ')}`;

  if (remocao) {
    return {
      rascunho: { tipo: 'remocao_horario', paciente: p, atual },
      resumo: { paciente: p.nome, horario_a_tirar: resumoAtual },
    };
  }

  // O novo herda do atual o que a frase não disse: o dia e a duração.
  const base = atual.situacao === 'ok' ? atual : atual.opcoes[0];
  const novoDia = diaDoNome(e.novo_dia) ?? base.dia_semana;
  const novoInicio = horaValida(e.nova_hora_inicio) ?? base.hora_inicio;
  const novoFim = horaValida(e.nova_hora_fim) ??
    somarMinutos(novoInicio, duracaoEmMinutos(base.hora_inicio, base.hora_fim));
  if (novoFim <= novoInicio) return { erro: 'hora de fim antes do início' };

  return {
    rascunho: {
      tipo: 'troca_horario',
      paciente: p,
      atual,
      novo: { dia_semana: novoDia, hora_inicio: novoInicio, hora_fim: novoFim },
    },
    resumo: {
      paciente: p.nome,
      de: resumoAtual,
      para: `${DIAS[novoDia - 1]} ${novoInicio}–${novoFim}`,
    },
  };
}

/** Paciente novo, com os horários fixos que vierem na mesma frase. */
function proporPaciente(e: Entrada): ResultadoDeProposta {
  const nome = typeof e.nome === 'string' ? e.nome.trim() : '';
  if (!nome) return { erro: 'nome vazio' };

  const horarios: Omit<ItemDeHorario, 'paciente'>[] = [];
  for (const h of Array.isArray(e.horarios) ? (e.horarios as Entrada[]) : []) {
    const dia = diaDoNome(h.dia);
    const inicio = horaValida(h.hora_inicio);
    if (!dia || !inicio) return { erro: 'dia ou hora inválidos no horário' };
    const fim = horaValida(h.hora_fim) ?? horaFimPadrao(inicio);
    if (fim <= inicio) return { erro: 'hora de fim antes do início' };
    horarios.push({ dia_semana: dia, hora_inicio: inicio, hora_fim: fim });
  }

  const paciente = {
    nome,
    telefone: typeof e.telefone === 'string' && e.telefone.trim() ? e.telefone.trim() : null,
    email: typeof e.email === 'string' && e.email.trim() ? e.email.trim() : null,
    preco: valorValido(e.preco),
    receber_sms: e.receber_sms === false ? false : true,
  };
  return {
    rascunho: { tipo: 'paciente', paciente, horarios },
    resumo: {
      nome,
      falta_preencher: [
        ...(paciente.telefone ? [] : ['telefone']),
        ...(paciente.preco ? [] : ['preço']),
      ],
      horarios: horarios.length,
    },
  };
}

/** Feedback para a equipe: categoria e o texto, conferidos no cartão. */
export function proporFeedback(e: Entrada): ResultadoDeProposta {
  const mensagem = typeof e.mensagem === 'string' ? e.mensagem.trim() : '';
  if (!mensagem) return { erro: 'mensagem vazia' };
  const categoria = e.categoria === 'sugestao' || e.categoria === 'elogio' ? e.categoria : 'problema';
  return {
    rascunho: { tipo: 'feedback', categoria, mensagem: mensagem.slice(0, 2000) },
    resumo: { categoria, mensagem },
  };
}

/** Despesas, com o tipo procurado no catálogo global `tipos_despesa`. */
async function proporDespesas(e: Entrada, cliente: SupabaseClient): Promise<ResultadoDeProposta> {
  const { data, error } = await cliente.from('tipos_despesa').select('id, nome').eq('ativo', true);
  if (error) return { erro: 'falha ao ler tipos de despesa' };
  const tipos = (data ?? []).map((t) => ({ id: t.id as string, nome: t.nome as string }));

  const itens: ItemDeDespesa[] = [];
  for (const i of itensDe(e)) {
    const dataOk = dataValida(i.data);
    if (!dataOk) return { erro: `data inválida: ${String(i.data)}` };
    const termo = String(i.tipo ?? '');
    const achados = tipos.filter((t) => normalizar(t.nome).includes(normalizar(termo)) && normalizar(termo));
    itens.push({
      tipo_despesa: achados.length === 1
        ? { situacao: 'ok', ...achados[0] }
        : { situacao: achados.length ? 'ambiguo' : 'nao_encontrado', termo, opcoes: achados.length ? achados : tipos },
      valor: valorValido(i.valor),
      data: dataOk,
      descricao: typeof i.descricao === 'string' && i.descricao.trim() ? i.descricao.trim() : null,
    });
  }
  if (itens.length === 0) return { erro: 'nenhuma despesa na proposta' };
  return {
    rascunho: { tipo: 'despesas', itens },
    resumo: itens.map((i) => ({
      tipo: i.tipo_despesa.situacao === 'ok' ? i.tipo_despesa.nome : `"${i.tipo_despesa.termo}" precisa ser escolhido`,
      valor: i.valor,
      data: i.data,
    })),
  };
}
