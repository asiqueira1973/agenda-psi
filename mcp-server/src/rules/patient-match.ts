import { normalizar } from './text.js';

/** Um paciente como opção de escolha: id, nome e preço de referência (da view). */
export type OpcaoDePaciente = { id: string; nome: string; preco_referencia: number | null };

/** O resultado de procurar um paciente pelo nome dito. */
export type PacienteResolvido =
  | ({ situacao: 'ok' } & OpcaoDePaciente)
  | { situacao: 'ambiguo'; termo: string; opcoes: OpcaoDePaciente[] }
  | { situacao: 'nao_encontrado'; termo: string };

/** Quantas opções voltam quando o nome é ambíguo (regra 11.14). */
const MAX_OPCOES = 8;

/**
 * Acha o paciente pelo nome dito (regra 11.14), portado de `resolverPaciente` em
 * supabase/functions/agente/propostas.ts.
 *
 * Ordem: nome inteiro igual (sem acento e caixa) vence; senão, todas as palavras do
 * termo contidas no nome. Um achado é `ok`; mais de um é `ambiguo`, com os ativos
 * primeiro e no máximo 8; nenhum é `nao_encontrado`. NUNCA escolhe sozinho entre
 * dois: "Helena pagou" gravado na Helena errada é pior que perguntar.
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

  const sem = ({ ativo: _a, ...p }: OpcaoDePaciente & { ativo: boolean }): OpcaoDePaciente => p;
  const [unico] = candidatos;
  if (candidatos.length === 1 && unico) return { situacao: 'ok', ...sem(unico) };
  if (candidatos.length === 0) return { situacao: 'nao_encontrado', termo };
  const ordenados = [...candidatos].sort((a, b) => Number(b.ativo) - Number(a.ativo));
  return { situacao: 'ambiguo', termo, opcoes: ordenados.slice(0, MAX_OPCOES).map(sem) };
}
