import * as z from 'zod';
import type { ResultadoDeLeitura, ToolContext } from '../context.js';

type Ctx = Pick<ToolContext, 'db' | 'sub'>;
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Primeiro dia do mês seguinte a `AAAA-MM`, em AAAA-MM-DD (limite exclusivo das consultas). */
function inicioDoMesSeguinte(mes: string): string {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
}

/**
 * Os meses AAAA-MM de `desde` até `ate`, inclusive, com teto de 36 (portado de
 * `mesesDoPeriodo` do agente). Vazio se o intervalo for inválido ou invertido.
 */
export function mesesDoPeriodo(desde: string, ate: string): string[] {
  if (!MES.test(desde) || !MES.test(ate) || desde > ate) return [];
  const meses: string[] = [];
  let [a, m] = desde.split('-').map(Number) as [number, number];
  // Teto de 36 meses: além disso, a resposta deixa de caber numa tela.
  while (meses.length < 36) {
    const atual = `${a}-${String(m).padStart(2, '0')}`;
    meses.push(atual);
    if (atual === ate) break;
    m++;
    if (m === 13) { m = 1; a++; }
  }
  return meses;
}

export const entradaPeriodo = z.object({
  desde: z.string().describe('Primeiro mês, AAAA-MM. "Este ano" começa em janeiro do ano corrente.'),
  ate: z.string().describe('Último mês, AAAA-MM, inclusive. Para "até agora", o mês corrente.'),
});

/**
 * `consultar_periodo` (13.2), portado do agente. Recebido e pendente vêm de
 * `v_financeiro_mensal` (P2 do app); despesas e sessões realizadas são contadas sobre as
 * linhas que a RLS devolve; o saldo é recebido menos despesas, feito aqui porque o modelo
 * não faz conta (a mesma soma que o agente já faz, seção 11).
 */
export async function consultarPeriodo(args: z.infer<typeof entradaPeriodo>, { db, sub }: Ctx): Promise<ResultadoDeLeitura> {
  const meses = mesesDoPeriodo(args.desde ?? '', args.ate ?? '');
  if (meses.length === 0) return { erro: 'período deve ser AAAA-MM a AAAA-MM, em ordem' };
  const inicio = `${meses[0]}-01`;
  const fim = inicioDoMesSeguinte(meses[meses.length - 1]!);

  const [fin, desp, sess] = await Promise.all([
    db.from('v_financeiro_mensal').select('mes_referencia, recebido, pendente')
      .eq('usuario_id', sub).gte('mes_referencia', inicio).lt('mes_referencia', fim),
    db.from('despesas').select('data_competencia, valor_despesa')
      .eq('usuario_id', sub).gte('data_competencia', inicio).lt('data_competencia', fim),
    db.from('sessoes').select('ocorreu_em_dia')
      .eq('usuario_id', sub).eq('status', 'realizada').gte('ocorreu_em_dia', inicio).lt('ocorreu_em_dia', fim),
  ]);
  if (fin.error || desp.error || sess.error) return { erro: 'falha ao ler o período' };

  const porMes = meses.map((mes) => {
    const f = (fin.data ?? []).find((x) => String(x.mes_referencia).startsWith(mes));
    const recebido = Number(f?.recebido ?? 0);
    const despesas = (desp.data ?? [])
      .filter((d) => String(d.data_competencia).startsWith(mes))
      .reduce((soma, d) => soma + Number(d.valor_despesa ?? 0), 0);
    return {
      mes,
      recebido,
      pendente: Number(f?.pendente ?? 0),
      despesas,
      saldo: recebido - despesas,
      sessoes_realizadas: (sess.data ?? []).filter((s) => String(s.ocorreu_em_dia).startsWith(mes)).length,
    };
  });
  const soma = (k: 'recebido' | 'pendente' | 'despesas' | 'saldo' | 'sessoes_realizadas') => porMes.reduce((t, m) => t + m[k], 0);

  return {
    periodo: `${meses[0]} a ${meses[meses.length - 1]}`,
    total: { recebido: soma('recebido'), pendente: soma('pendente'), despesas: soma('despesas'), saldo: soma('saldo'), sessoes_realizadas: soma('sessoes_realizadas') },
    por_mes: porMes,
  };
}

export const entradaMes = z.object({
  mes: z.string().describe('Mês no formato AAAA-MM, por exemplo 2026-10.'),
});

/** `consultar_mes` (13.2), portado do agente: recebido e pendente da view, e a contagem de sessões realizadas. */
export async function consultarMes(args: z.infer<typeof entradaMes>, { db, sub }: Ctx): Promise<ResultadoDeLeitura> {
  const mes = args.mes ?? '';
  if (!MES.test(mes)) return { erro: 'mês deve ser AAAA-MM' };
  const inicio = `${mes}-01`;

  const financeiro = await db
    .from('v_financeiro_mensal')
    .select('recebido, pendente')
    .eq('usuario_id', sub)
    .eq('mes_referencia', inicio)
    .maybeSingle();
  if (financeiro.error) return { erro: 'falha ao ler o financeiro' };

  // Contagem, não soma de dinheiro: mesma definição de "realizada" da `v_pacientes_cartao`.
  const sessoes = await db
    .from('sessoes')
    .select('id', { count: 'exact', head: true })
    .eq('usuario_id', sub)
    .eq('status', 'realizada')
    .gte('ocorreu_em_dia', inicio)
    .lt('ocorreu_em_dia', inicioDoMesSeguinte(mes));
  if (sessoes.error) return { erro: 'falha ao contar sessões' };

  return {
    mes,
    recebido: financeiro.data?.recebido ?? 0,
    pendente: financeiro.data?.pendente ?? 0,
    sessoes_realizadas: sessoes.count ?? 0,
  };
}

export const entradaPendencias = z.object({});

/**
 * `listar_pendencias` (13.2), portado do agente: pagamentos pendentes ou vencidos por
 * paciente e quem tem sessão marcada como "não pagou". Sem preço: com ele, o modelo
 * multiplicava e apresentava como dívida um número que nenhum registro tem (como o agente).
 */
export async function listarPendencias(_args: unknown, { db, sub }: Ctx): Promise<ResultadoDeLeitura> {
  const pagamentos = await db
    .from('v_pendencias_por_paciente')
    .select('nome_completo, qtde_pendencias, total_pendente, proximo_vencimento')
    .eq('usuario_id', sub)
    .gt('qtde_pendencias', 0)
    .order('total_pendente', { ascending: false });
  if (pagamentos.error) return { erro: 'falha ao ler pendências' };

  const sessoes = await db
    .from('v_pacientes_cartao')
    .select('nome_completo, sessoes_nao_pagas')
    .eq('usuario_id', sub)
    .gt('sessoes_nao_pagas', 0)
    .order('sessoes_nao_pagas', { ascending: false });
  if (sessoes.error) return { erro: 'falha ao ler sessões não pagas' };

  return { pagamentos_pendentes: pagamentos.data ?? [], sessoes_nao_pagas: sessoes.data ?? [] };
}
