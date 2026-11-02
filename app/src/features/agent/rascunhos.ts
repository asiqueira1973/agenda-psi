import {
  validarEmailOpcional,
  validarIntervaloDeHoras,
  validarNome,
  validarTelefone,
  validarValorEmReais,
} from '@/lib/validation';

/**
 * Rascunhos do agente — o que a Edge Function propõe e o cartão de confirmação
 * mostra (fase 2 de docs/agente-plano.md).
 *
 * Espelho do contrato de `supabase/functions/agente/propostas.ts`. Rascunho
 * NÃO é registro: nada aqui grava. Quem grava é `use-confirmar.ts`, pelos
 * hooks das telas de cadastro, depois do Confirmar.
 *
 * Os valores de escolha já chegam como os literais do banco (pegadinha 6):
 * `nao pagou`, `pagamento mensal`, `por sessão`.
 */

export type OpcaoDePaciente = { id: string; nome: string; preco_referencia: number | null };

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
  valor: number | null;
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

export type TipoDeDespesaResolvido =
  | { situacao: 'ok'; id: string; nome: string }
  | { situacao: 'ambiguo' | 'nao_encontrado'; termo: string; opcoes: { id: string; nome: string }[] };

export type ItemDeDespesa = {
  tipo_despesa: TipoDeDespesaResolvido;
  valor: number | null;
  data: string;
  descricao: string | null;
};

export type DadosDePacienteNovo = {
  nome: string;
  telefone: string | null;
  email: string | null;
  preco: number | null;
  receber_sms: boolean;
};

export type Rascunho =
  | { tipo: 'sessoes'; itens: ItemDeSessao[] }
  | { tipo: 'pagamentos'; itens: ItemDePagamento[] }
  | { tipo: 'paciente'; paciente: DadosDePacienteNovo; horarios: Omit<ItemDeHorario, 'paciente'>[] }
  | { tipo: 'horarios'; itens: ItemDeHorario[] }
  | { tipo: 'despesas'; itens: ItemDeDespesa[] }
  | { tipo: 'feedback'; categoria: 'problema' | 'sugestao' | 'elogio'; mensagem: string }
  | { tipo: 'troca_horario'; paciente: PacienteOk; atual: HorarioResolvido; novo: HorarioNovo }
  | { tipo: 'remocao_horario'; paciente: PacienteOk; atual: HorarioResolvido }
  | { tipo: 'edicao_paciente'; paciente: PacienteOk; atual: CadastroDoPaciente; novo: CadastroDoPaciente }
  | { tipo: 'edicao_sessao'; alvo: Alvo<RegistroDeSessao>; mudancas: MudancasDeSessao }
  | { tipo: 'exclusao_sessao'; alvo: Alvo<RegistroDeSessao> }
  | { tipo: 'edicao_pagamento'; alvo: Alvo<RegistroDePagamento>; mudancas: MudancasDePagamento }
  | { tipo: 'exclusao_pagamento'; alvo: Alvo<RegistroDePagamento> }
  | { tipo: 'edicao_despesa'; alvo: Alvo<RegistroDeDespesa>; mudancas: MudancasDeDespesa }
  | { tipo: 'exclusao_despesa'; alvo: Alvo<RegistroDeDespesa> };

/** Registros que já existem, como a função os manda (registros.ts). */
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
export type MudancasDeSessao = Partial<Pick<RegistroDeSessao, 'pagamento' | 'modalidade' | 'duracao_minutos' | 'cobrada' | 'observacoes'>>;
export type MudancasDePagamento = Partial<Pick<RegistroDePagamento, 'valor' | 'tipo' | 'observacoes'>>;
export type MudancasDeDespesa = Partial<Pick<RegistroDeDespesa, 'tipo_despesa_id' | 'tipo_nome' | 'valor' | 'descricao' | 'observacoes'>>;

/** O registro que a frase quis dizer; ambíguo, a pessoa escolhe na lista. */
export type Alvo<T> = { situacao: 'ok'; registro: T } | { situacao: 'ambiguo'; opcoes: T[] };

/** O registro como ficará: o atual com as mudanças por cima. */
export function comMudancas<T, M extends Partial<T>>(alvo: Alvo<T>, mudancas: M): T | null {
  return alvo.situacao === 'ok' ? { ...alvo.registro, ...mudancas } : null;
}

/** Alguma mudança difere do que está gravado? Sem isso, não há o que confirmar. */
function mudaAlgo<T extends object>(alvo: Alvo<T>, mudancas: Partial<T>): boolean {
  if (alvo.situacao !== 'ok') return true;
  return (Object.keys(mudancas) as (keyof T)[]).some((k) => mudancas[k] !== alvo.registro[k]);
}

/**
 * Versão dos cartões que este app sabe mostrar, mandada à Edge Function a cada
 * pergunta. 2 = troca e remoção de horário e edição de cadastro; 3 = alterar e
 * apagar sessão, pagamento e despesa (build 2 da 5.0.2). Sem
 * isso, a função não oferece essas ferramentas — a 5.0.2 descartaria o cartão.
 */
export const VERSAO_DOS_CARTOES = 3;

type PacienteOk = Extract<PacienteResolvido, { situacao: 'ok' }>;

/** Um horário fixo que já existe na agenda. */
export type HorarioExistente = { id: string; dia_semana: number; hora_inicio: string; hora_fim: string };
export type HorarioNovo = Omit<HorarioExistente, 'id'>;

/** Qual horário do paciente a frase quis dizer; ambíguo, a pessoa escolhe. */
export type HorarioResolvido =
  | ({ situacao: 'ok' } & HorarioExistente)
  | { situacao: 'ambiguo'; opcoes: HorarioExistente[] };

/** Campos do cadastro que o agente altera (os da tela de editar, mais o preço). */
export type CadastroDoPaciente = {
  nome: string;
  telefone: string;
  email: string | null;
  observacoes: string | null;
  status: 'ativo' | 'inativo';
  receber_sms: boolean;
  preco: number | null;
};

/** Estado de um cartão na conversa. */
export type EstadoDoCartao = 'aberto' | 'confirmado' | 'cancelado';

/** Quantos registros o cartão grava — o que vai no evento de analytics. */
export function quantidadeDeItens(r: Rascunho): number {
  if (!('itens' in r) && r.tipo !== 'paciente') return 1;
  return r.tipo === 'paciente' ? 1 + r.horarios.length : r.itens.length;
}

/**
 * Problemas de uma linha, já em texto para o cartão. Lista vazia = pode gravar.
 *
 * As regras são as mesmas das telas de cadastro (`lib/validation.ts`): valor
 * inteiro positivo sem centavos (regra 11.2), telefone obrigatório, hora fim
 * depois da hora início. O cartão não pode ser mais frouxo que a tela.
 */
export function problemasDoPaciente(p: PacienteResolvido): string[] {
  if (p.situacao === 'ok') return [];
  return [p.situacao === 'ambiguo' ? `Escolha qual "${p.termo}"` : `"${p.termo}" não está no cadastro. Escolha o paciente`];
}

function problemasDoValor(valor: number | null): string[] {
  const v = validarValorEmReais(valor === null ? '' : String(valor));
  return v.valido ? [] : [v.mensagem];
}

/** Problemas de cada item do rascunho, na ordem dos itens. */
export function problemasDoRascunho(r: Rascunho): string[][] {
  switch (r.tipo) {
    case 'sessoes':
      return r.itens.map((i) => problemasDoPaciente(i.paciente));
    case 'pagamentos':
      return r.itens.map((i) => [...problemasDoPaciente(i.paciente), ...problemasDoValor(i.valor)]);
    case 'horarios':
      return r.itens.map((i) => {
        const horas = validarIntervaloDeHoras(i.hora_inicio, i.hora_fim);
        return [...problemasDoPaciente(i.paciente), ...(horas.valido ? [] : [horas.mensagem])];
      });
    case 'despesas':
      return r.itens.map((i) => [
        ...(i.tipo_despesa.situacao === 'ok' ? [] : ['Escolha o tipo da despesa']),
        ...problemasDoValor(i.valor),
      ]);
    case 'troca_horario': {
      const horas = validarIntervaloDeHoras(r.novo.hora_inicio, r.novo.hora_fim);
      const mesmo =
        r.atual.situacao === 'ok' &&
        r.atual.dia_semana === r.novo.dia_semana &&
        r.atual.hora_inicio === r.novo.hora_inicio &&
        r.atual.hora_fim === r.novo.hora_fim;
      return [[
        ...(r.atual.situacao === 'ok' ? [] : ['Escolha qual horário vai mudar']),
        ...(horas.valido ? [] : [horas.mensagem]),
        ...(mesmo ? ['O novo horário é igual ao atual'] : []),
      ]];
    }
    case 'remocao_horario':
      return [r.atual.situacao === 'ok' ? [] : ['Escolha qual horário sai da agenda']];
    case 'edicao_paciente': {
      const nome = validarNome(r.novo.nome);
      const telefone = validarTelefone(r.novo.telefone);
      const email = validarEmailOpcional(r.novo.email ?? '');
      return [[
        ...(nome.valido ? [] : [nome.mensagem]),
        ...(telefone.valido ? [] : [telefone.mensagem]),
        ...(email.valido ? [] : [email.mensagem]),
        ...problemasDoValor(r.novo.preco),
        ...(camposAlterados(r.atual, r.novo).length === 0 ? ['Nada mudou no cadastro'] : []),
      ]];
    }
    case 'edicao_sessao':
    case 'exclusao_sessao':
    case 'edicao_pagamento':
    case 'exclusao_pagamento':
    case 'edicao_despesa':
    case 'exclusao_despesa': {
      const escolher = r.alvo.situacao === 'ok' ? [] : ['Escolha qual registro'];
      if (r.tipo.startsWith('exclusao')) return [escolher];
      const m = (r as { mudancas: Record<string, unknown> }).mudancas;
      const valor = 'valor' in m ? problemasDoValor((m.valor as number | null) ?? null) : [];
      const nada = mudaAlgo(r.alvo as Alvo<object>, m) ? [] : ['Nada mudou no registro'];
      return [[...escolher, ...valor, ...nada]];
    }
    case 'feedback':
      // Mesma regra da tela de feedback: mensagem obrigatória (spec 8.10).
      return [r.mensagem.trim() ? [] : ['Escreva a mensagem']];
    case 'paciente': {
      const nome = validarNome(r.paciente.nome);
      const telefone = validarTelefone(r.paciente.telefone ?? '');
      const email = validarEmailOpcional(r.paciente.email ?? '');
      const doPaciente = [
        ...(nome.valido ? [] : [nome.mensagem]),
        ...(telefone.valido ? [] : [telefone.mensagem]),
        ...(email.valido ? [] : [email.mensagem]),
        ...problemasDoValor(r.paciente.preco),
      ];
      const dosHorarios = r.horarios.flatMap((h) => {
        const horas = validarIntervaloDeHoras(h.hora_inicio, h.hora_fim);
        return horas.valido ? [] : [horas.mensagem];
      });
      return [[...doPaciente, ...dosHorarios]];
    }
  }
}

/** O Confirmar só libera com o cartão inteiro válido e ao menos um item. */
export function podeConfirmar(r: Rascunho): boolean {
  if ('itens' in r && r.itens.length === 0) return false;
  return problemasDoRascunho(r).every((p) => p.length === 0);
}

/**
 * A oferta que segue uma sessão paga: "registrar também o pagamento?".
 *
 * Sessão marcada como paga NÃO cria pagamento — são coisas separadas no app,
 * como nas telas (decisão de 02/11/2026). Esta função só monta o rascunho da
 * oferta; ele vira um cartão próprio, com o valor editável.
 *
 * O valor vem do preço de referência do cadastro: é só sugestão, a sessão pode
 * ter custado outra coisa. Devolve `null` se nenhuma sessão foi marcada paga.
 */
export function ofertaDePagamento(sessoes: ItemDeSessao[]): Rascunho | null {
  const pagas = sessoes.filter((s) => s.pagamento === 'pagou' && s.paciente.situacao === 'ok');
  if (pagas.length === 0) return null;
  return {
    tipo: 'pagamentos',
    itens: pagas.map((s) => {
      const preco = s.paciente.situacao === 'ok' ? s.paciente.preco_referencia : null;
      return {
        paciente: s.paciente,
        valor: preco,
        valor_origem: preco ? 'referencia' : 'nenhum',
        data: s.data,
        tipo: 'por sessão',
      };
    }),
  };
}

/** Quais campos do cadastro mudaram. */
export function camposAlterados(a: CadastroDoPaciente, b: CadastroDoPaciente): (keyof CadastroDoPaciente)[] {
  return (Object.keys(a) as (keyof CadastroDoPaciente)[]).filter((k) => a[k] !== b[k]);
}

/**
 * Horários de OUTROS pacientes que se sobrepõem ao novo horário.
 *
 * É aviso, não bloqueio: o app aceita horários sobrepostos (há quem atenda em
 * dupla, ou deixe dois horários marcados de propósito). Calculado aqui, e não
 * no servidor, para continuar certo quando a pessoa edita o horário no cartão.
 * O horário que está sendo trocado (`ignorarId`) não conta.
 */
export function conflitosDoHorario(
  novo: HorarioNovo,
  agenda: Array<{ id: string | null; paciente_nome: string | null; dia_semana: number | null; hora_inicio: string | null; hora_fim: string | null }>,
  ignorarId: string | null,
): string[] {
  return agenda
    .filter((h) => h.id !== ignorarId && h.dia_semana === novo.dia_semana && h.hora_inicio && h.hora_fim)
    .filter((h) => novo.hora_inicio < (h.hora_fim as string).slice(0, 5) && novo.hora_fim > (h.hora_inicio as string).slice(0, 5))
    .map((h) => `${h.paciente_nome ?? 'Outro paciente'} (${(h.hora_inicio as string).slice(0, 5)}–${(h.hora_fim as string).slice(0, 5)})`);
}

/** Rótulo da categoria do feedback, como aparece no cartão e no texto enviado. */
export const rotuloDaCategoria = { problema: 'Problema', sugestao: 'Sugestão', elogio: 'Elogio' } as const;

/**
 * O texto que vai para a tabela `feedback`. A tabela não tem coluna de tipo,
 * então a categoria e a origem vão no começo da mensagem — quem lê o feedback
 * sabe se é problema ou sugestão e que chegou pelo assistente.
 */
export function textoDoFeedback(r: Extract<Rascunho, { tipo: 'feedback' }>): string {
  return `[${rotuloDaCategoria[r.categoria]} · via assistente] ${r.mensagem.trim()}`;
}

/** Lê os rascunhos da resposta da função, descartando o que não tiver forma. */
export function rascunhosDaResposta(bruto: unknown): Rascunho[] {
  if (!Array.isArray(bruto)) return [];
  const tipos = [
    'sessoes', 'pagamentos', 'paciente', 'horarios', 'despesas', 'feedback',
    'troca_horario', 'remocao_horario', 'edicao_paciente',
    'edicao_sessao', 'exclusao_sessao', 'edicao_pagamento', 'exclusao_pagamento', 'edicao_despesa', 'exclusao_despesa',
  ];
  return bruto.filter((r): r is Rascunho => {
    if (!r || typeof r !== 'object' || !tipos.includes((r as { tipo?: string }).tipo ?? '')) return false;
    const x = r as { tipo: string; itens?: unknown; paciente?: unknown; horarios?: unknown; mensagem?: unknown };
    if (x.tipo === 'feedback') return typeof x.mensagem === 'string';
    if (/^(edicao|exclusao)_(sessao|pagamento|despesa)$/.test(x.tipo)) {
      const y = r as { alvo?: { situacao?: string } };
      return y.alvo?.situacao === 'ok' || y.alvo?.situacao === 'ambiguo';
    }
    if (x.tipo === 'troca_horario' || x.tipo === 'remocao_horario' || x.tipo === 'edicao_paciente') {
      const y = r as { paciente?: { situacao?: string }; atual?: unknown };
      return y.paciente?.situacao === 'ok' && !!y.atual;
    }
    return x.tipo === 'paciente'
      ? !!x.paciente && Array.isArray(x.horarios)
      : Array.isArray(x.itens) && x.itens.length > 0;
  });
}
