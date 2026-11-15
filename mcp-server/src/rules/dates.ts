import { diaDaSemanaDoBanco } from './weekday.js';

/** Fuso civil do produto (regra 11.3). */
export const FUSO_DO_PRODUTO = 'America/Sao_Paulo';

/**
 * "Hoje" como data civil em São Paulo, AAAA-MM-DD (regra 11.3).
 *
 * O servidor roda em UTC: às 23h30 de Brasília já é o dia seguinte em UTC, e usar
 * `toISOString()` gravaria a despesa no dia errado. Recebe o instante (padrão: agora)
 * para o teste poder fixá-lo. O locale `en-CA` formata como AAAA-MM-DD.
 */
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_DO_PRODUTO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

/**
 * Data AAAA-MM-DD válida no calendário, ou `null` (regra 11.3: 31/02 é recusada).
 * Mesma regra de `dataValida` do agente (propostas.ts).
 */
export function dataValida(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  return diaDaSemanaDoBanco(v) === null ? null : v;
}
