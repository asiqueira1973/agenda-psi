/**
 * Dia da semana na convenção DO BANCO: 1 = segunda, 7 = domingo (regra 11.6, pegadinha 7).
 *
 * Não é a do JavaScript, onde 0 é domingo. A data vem como AAAA-MM-DD e é lida em
 * UTC de propósito: é só um dia do calendário, sem hora, e ler no fuso do servidor
 * poderia voltar um dia. Copiada de supabase/functions/agente/ferramentas.ts.
 *
 * Devolve o número de 1 a 7, ou `null` se a data não for válida (inclusive 31/02).
 */
export function diaDaSemanaDoBanco(data: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const d = new Date(`${data}T00:00:00Z`);
  // A volta pela ISO recusa datas que o Date "corrige" sozinho (31/02 vira 03/03).
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== data) return null;
  const js = d.getUTCDay(); // 0 = domingo
  return js === 0 ? 7 : js;
}

/**
 * As datas de segunda a domingo da semana que contém `data`, na ordem
 * (usada por `agenda_da_semana`, regra 11.6). Devolve `null` se a data não for válida.
 */
export function diasDaSemanaDe(data: string): string[] | null {
  const dia = diaDaSemanaDoBanco(data);
  if (dia === null) return null;
  const base = new Date(`${data}T00:00:00Z`);
  return [1, 2, 3, 4, 5, 6, 7].map((d) => {
    const x = new Date(base);
    x.setUTCDate(base.getUTCDate() + (d - dia));
    return x.toISOString().slice(0, 10);
  });
}
