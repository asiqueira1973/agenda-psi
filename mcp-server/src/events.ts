/**
 * Nomes de evento do Visão do Produto que o servidor emite (seção 21, pegadinha 5).
 *
 * Copiados byte a byte de app/src/lib/analytics/events.ts; test/events.test.ts lê
 * aquele arquivo e falha se divergir. Renomear qualquer um parte a série histórica.
 */
export const eventos = {
  novoPaciente: 'agenda_psi_novopaciente',
  novaSessao: 'agenda_psi_novasessao',
  novoPagamento: 'agenda_psi_novopagamento',
  novoAgendamento: 'agenda_psi_novoagendamento',
  novaDespesa: 'agenda_psi_novadespesa',
} as const;

export type NomeDeEvento = (typeof eventos)[keyof typeof eventos];
