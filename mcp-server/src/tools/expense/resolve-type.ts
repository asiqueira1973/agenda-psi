import { textosParaOModelo } from '../../rules/messages.js';
import { normalizar } from '../../rules/text.js';
import type { TipoDespesa } from './model.js';

/** O tipo de despesa dito pela pessoa, procurado no catálogo. */
export type TipoResolvido =
  | { situacao: 'ok'; tipo: TipoDespesa }
  | { situacao: 'ambiguo'; termo: string; candidatos: TipoDespesa[] }
  | { situacao: 'nao_encontrado'; termo: string }
  | { situacao: 'nao_dito' };

/**
 * Resolve o tipo pelo nome (regra 11.15), portado de `proporDespesas` do agente.
 *
 * Substring sem acento e sem caixa. Exatamente um casamento → ok. Mais de um →
 * ambíguo, com os candidatos. Nenhum → não encontrado. NUNCA escolhe sozinho: fora do
 * caso único, o campo começa vazio (defeito 11.9.5 do app, que pré-selecionava
 * "Option 1" e gravava errado).
 */
export function resolverTipo(termo: string | undefined, tipos: TipoDespesa[]): TipoResolvido {
  const procurado = normalizar(termo ?? '');
  if (!procurado) return { situacao: 'nao_dito' };
  const achados = tipos.filter((t) => normalizar(t.nome).includes(procurado));
  const [unico] = achados;
  if (achados.length === 1 && unico) return { situacao: 'ok', tipo: unico };
  if (achados.length === 0) return { situacao: 'nao_encontrado', termo: termo ?? '' };
  return { situacao: 'ambiguo', termo: termo ?? '', candidatos: achados };
}

/**
 * Aviso para a pessoa quando o tipo não resolveu sozinho. O texto do caso ambíguo é o
 * do exemplo do spec (8.2, passo 2): "'aluguel' casou com 2 tipos, escolha um".
 */
export function avisoDoTipo(r: TipoResolvido): string | null {
  if (r.situacao === 'ambiguo') return textosParaOModelo.tipoAmbiguo(r.termo, r.candidatos.length);
  if (r.situacao === 'nao_encontrado') return textosParaOModelo.tipoNaoEncontrado(r.termo);
  return null;
}
