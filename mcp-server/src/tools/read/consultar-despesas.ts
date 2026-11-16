import * as z from 'zod';
import { normalizar } from '../../rules/text.js';
import type { ResultadoDeLeitura, ToolContext } from '../context.js';
import { descricoes } from './descricoes.js';

/** Quantas despesas voltam listadas, no máximo (como `MAX_HISTORICO` do agente, 8.4). */
export const MAX_DESPESAS = 30;

/** Descrição copiada byte a byte do agente (13.2); mora em descricoes.ts com as outras. */
export const DESCRICAO = descricoes.consultar_despesas;

/** Entrada da ferramenta (13.2): tudo opcional, como no agente. Sem `usuario_id` (P1). */
export const entrada = z.object({
  desde: z.string().optional().describe('Data inicial AAAA-MM-DD, opcional.'),
  ate: z.string().optional().describe('Data final AAAA-MM-DD, opcional.'),
  tipo: z.string().optional().describe('Parte do nome do tipo de despesa, por exemplo "aluguel". Opcional.'),
});

/**
 * Despesas de um período, com totais (13.2), portada de `consultarDespesas` do agente.
 *
 * A soma é feita aqui, sobre as linhas que a RLS devolveu, e não pelo modelo: quem
 * responde "quanto gastei" precisa receber o total pronto (regra 11, "o que não é
 * automático": é a mesma soma que o agente já faz). O filtro `usuario_id` é a segunda
 * tranca; a primeira é a RLS. Datas fora de AAAA-MM-DD são ignoradas, como no agente.
 * `observacoes` da despesa não é lida. Devolve `{ quantidade, total, total_por_tipo,
 * despesas }` (até 30 linhas) ou `{ erro }`.
 */
export async function consultarDespesas(
  args: z.infer<typeof entrada>,
  { db, sub }: Pick<ToolContext, 'db' | 'sub'>,
): Promise<ResultadoDeLeitura> {
  const data = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const desde = data(args.desde);
  const ate = data(args.ate);
  const tipo = typeof args.tipo === 'string' ? normalizar(args.tipo) : '';

  let consulta = db
    .from('despesas')
    .select('valor_despesa, data_competencia, descricao, tipos_despesa(nome)')
    .eq('usuario_id', sub)
    .order('data_competencia', { ascending: false });
  if (desde) consulta = consulta.gte('data_competencia', desde);
  if (ate) consulta = consulta.lte('data_competencia', ate);
  const { data: linhas, error } = await consulta;
  if (error) return { erro: 'falha ao ler despesas' };

  const despesas = (linhas ?? [])
    .map((d) => ({
      tipo: (d.tipos_despesa as { nome?: string } | null)?.nome ?? 'sem tipo',
      valor: Number(d.valor_despesa ?? 0),
      data: d.data_competencia,
      descricao: d.descricao,
    }))
    // Como no agente: o termo pode casar com o tipo ou com a descrição.
    .filter((d) => !tipo || normalizar(d.tipo).includes(tipo) || normalizar(d.descricao ?? '').includes(tipo));

  const porTipo: Record<string, number> = {};
  for (const d of despesas) porTipo[d.tipo] = (porTipo[d.tipo] ?? 0) + d.valor;

  return {
    quantidade: despesas.length,
    total: despesas.reduce((soma, d) => soma + d.valor, 0),
    total_por_tipo: porTipo,
    despesas: despesas.slice(0, MAX_DESPESAS),
  };
}
