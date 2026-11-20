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
  // Épico 6: edição de paciente e preço novo, como useEditarPaciente e useAtualizarPreco.
  pacienteEditado: 'agenda_psi_paciente_editado',
  atualizacaoPreco: 'agenda_psi_atualizacao_preco',
} as const;

/**
 * Eventos SÓ do conector, sem equivalente no app (DOCUMENTACAO-TECNICA, seção 7,
 * divergência 12). Ficam fora de `eventos` porque test/misc.test.ts exige que todo nome
 * de lá exista byte a byte no app. Mesmas regras: sem nome, valor nem texto digitado.
 */
export const eventosDoConector = {
  // Abertura da conexão (`initialize`), um por pessoa e por cliente: o id é derivado dos dois.
  conectorConectado: 'agenda_psi_mcp_conectado',
  // Uma das 9 leituras que deu certo; a tela diz qual.
  consultaFeita: 'agenda_psi_mcp_consulta',
} as const;

export type NomeDeEvento =
  | (typeof eventos)[keyof typeof eventos]
  | (typeof eventosDoConector)[keyof typeof eventosDoConector];
