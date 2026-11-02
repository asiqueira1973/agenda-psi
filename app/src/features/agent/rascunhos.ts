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
  | { tipo: 'despesas'; itens: ItemDeDespesa[] };

/** Estado de um cartão na conversa. */
export type EstadoDoCartao = 'aberto' | 'confirmado' | 'cancelado';

/** Quantos registros o cartão grava — o que vai no evento de analytics. */
export function quantidadeDeItens(r: Rascunho): number {
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
  if (r.tipo !== 'paciente' && r.itens.length === 0) return false;
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

/** Lê os rascunhos da resposta da função, descartando o que não tiver forma. */
export function rascunhosDaResposta(bruto: unknown): Rascunho[] {
  if (!Array.isArray(bruto)) return [];
  const tipos = ['sessoes', 'pagamentos', 'paciente', 'horarios', 'despesas'];
  return bruto.filter((r): r is Rascunho => {
    if (!r || typeof r !== 'object' || !tipos.includes((r as { tipo?: string }).tipo ?? '')) return false;
    const x = r as { tipo: string; itens?: unknown; paciente?: unknown; horarios?: unknown };
    return x.tipo === 'paciente'
      ? !!x.paciente && Array.isArray(x.horarios)
      : Array.isArray(x.itens) && x.itens.length > 0;
  });
}
