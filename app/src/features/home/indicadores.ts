import { formatarDinheiro, formatarInteiro, formatarPercentual } from '@/lib/format';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Os 13 indicadores da Home.
 *
 * Cada um é uma linha da tabela da regra 11.1: o rótulo, a coluna de
 * `v_dashboard_resumo` de onde vem, e o formato.
 *
 * O app NÃO recalcula nenhum deles (princípio P2). Não existe soma, divisão nem
 * regra de três neste arquivo — só a escolha de como escrever o número que o
 * banco já entregou. Se um indicador estiver errado, o lugar de consertar é a
 * view, não aqui.
 *
 * O agrupamento em "este mês", "mês anterior" e "médias e metas" vem do handoff
 * de design; os rótulos vêm da coluna "Cartão" da 11.1.
 */

export type LinhaDoDashboard = Database['public']['Views']['v_dashboard_resumo']['Row'];

/** Cor semântica do valor. Cinza é o normal; verde e vermelho são exceção. */
export type CorDoValor = 'secondaryLabel' | 'positive' | 'destructive';

export type Indicador = {
  rotulo: string;
  /** Devolve o valor já formatado. */
  valor: (linha: LinhaDoDashboard) => string;
  /** Cor do valor. Recebe a linha porque lucro negativo fica vermelho. */
  cor?: (linha: LinhaDoDashboard) => CorDoValor;
};

export type GrupoDeIndicadores = {
  titulo: string;
  indicadores: Indicador[];
};

/** Lucro é verde quando sobra e vermelho quando falta. */
function corDoLucro(valor: number | null): CorDoValor {
  if (valor === null || valor === undefined) return 'secondaryLabel';
  return valor < 0 ? 'destructive' : 'positive';
}

/**
 * Os 12 indicadores em grupos. O décimo terceiro, `pacientes_ativos`, fica fora
 * daqui: ele é o cartão do topo, o único número de 34pt do app inteiro.
 */
export const gruposDoDashboard: GrupoDeIndicadores[] = [
  {
    titulo: 'Este mês',
    indicadores: [
      {
        rotulo: 'Sessões no mês',
        valor: (l) => formatarInteiro(l.sessoes_mes_corrente),
      },
      {
        rotulo: 'Pagamentos no mês',
        valor: (l) => formatarDinheiro(l.pagamentos_mes_corrente),
        // Dinheiro que entrou é um dos três usos de verde do app (handoff).
        cor: () => 'positive',
      },
      {
        rotulo: 'Despesas no mês',
        valor: (l) => formatarDinheiro(l.despesas_mes_corrente),
        cor: () => 'destructive',
      },
      {
        rotulo: 'Lucro no mês',
        valor: (l) => formatarDinheiro(l.rentabilidade_mes_corrente),
        cor: (l) => corDoLucro(l.rentabilidade_mes_corrente),
      },
      {
        rotulo: 'Margem do mês',
        valor: (l) => formatarPercentual(l.margem_mes_corrente_pct),
      },
    ],
  },
  {
    // Todos em cinza, sem cor semântica: é histórico, não é o que está
    // acontecendo agora (handoff, tela 5).
    titulo: 'Mês anterior',
    indicadores: [
      {
        rotulo: 'Sessões mês −1',
        valor: (l) => formatarInteiro(l.sessoes_mes_anterior),
      },
      {
        rotulo: 'Pagamentos mês −1',
        valor: (l) => formatarDinheiro(l.pagamentos_mes_anterior),
      },
      {
        rotulo: 'Despesas mês −1',
        valor: (l) => formatarDinheiro(l.despesas_mes_anterior),
      },
      {
        rotulo: 'Lucro mês −1',
        valor: (l) => formatarDinheiro(l.rentabilidade_mes_anterior),
      },
    ],
  },
  {
    titulo: 'Médias e metas',
    indicadores: [
      {
        rotulo: 'Custo médio/paciente',
        valor: (l) => formatarDinheiro(l.custo_medio_por_paciente_mes_corrente),
      },
      {
        rotulo: 'Receita média/paciente',
        valor: (l) => formatarDinheiro(l.receita_media_por_paciente_mes_corrente),
      },
      {
        rotulo: 'Break-even (sessões)',
        valor: (l) => formatarInteiro(l.break_even_sessoes_mes_corrente),
      },
    ],
  },
];

/** Quantos indicadores a Home mostra ao todo. Usado no teste da regra 11.1. */
export const totalDeIndicadores =
  1 + gruposDoDashboard.reduce((soma, g) => soma + g.indicadores.length, 0);
