/**
 * Textos das telas de sessão e de pagamento.
 * Os marcados como literais vêm das seções 15.3 e 15.4 e são texto final.
 */
export const copySessoes = {
  nova: 'Registrar sessão',
  detalhe: 'Detalhe da sessão',
  data: 'Data',
  duracao: 'Duração',
  duracaoPlaceholder: '50',
  seraCobrada: 'Sessão será cobrada',
  grupoModalidade: 'Modalidade',
  grupoPagamento: 'Pagamento',
  observacoes: 'Observações',
  salvar: 'Salvar',
  salvando: 'Salvando...',
  excluir: 'Excluir sessão',
  /** Do handoff, tela 15. */
  rodapeData: 'Caso queira mudar a data, exclua a sessão e crie novamente com a data correta.',
  /** Literais da 15.3. */
  sucessoCriada: 'Sessão registrada.',
  sucessoAtualizada: 'Sessão atualizada.',
  sucessoExcluida: 'Sessão excluída.',
  /** Literal da 15.4. */
  confirmarExclusao: 'Excluir esta sessão? Não dá para desfazer.',
} as const;

export const copyPagamentos = {
  novo: 'Registrar pagamento',
  detalhe: 'Detalhe do pagamento',
  grupoTipo: 'Tipo',
  /** O rótulo passa a dizer o que o campo de fato é (spec 8.6). */
  competencia: 'Mês de competência',
  valor: 'Valor',
  /** Do handoff, tela 16. */
  rodapeValor: 'Preço atual do paciente.',
  observacoes: 'Observações',
  salvar: 'Salvar',
  salvando: 'Salvando...',
  excluir: 'Excluir pagamento',
  rodapeCompetencia:
    'Caso queira mudar o mês de competência, exclua o pagamento e crie novamente.',
  /** Literais da 15.3. */
  sucessoCriado: 'Pagamento registrado.',
  sucessoAtualizado: 'Pagamento atualizado.',
  sucessoExcluido: 'Pagamento excluído.',
  /** Literal da 15.4. */
  confirmarExclusao: 'Excluir este pagamento? Não dá para desfazer.',
} as const;

export const copyComum = {
  cancelar: 'Cancelar',
  excluir: 'Excluir',
} as const;
