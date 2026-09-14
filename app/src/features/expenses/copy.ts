/**
 * Textos das telas de despesa.
 *
 * O estado vazio desta tela é o texto mais importante do app inteiro, e é
 * literal da seção 15.6 do spec. Ele existe porque a feature não é descoberta:
 * 98 despesas em toda a base contra 451 pagamentos. A pessoa acompanha receita,
 * não lucro — e o trabalho deste texto é mudar isso.
 */
export const copyDespesas = {
  titulo: 'Despesas',
  /** Literal da 15.6. */
  cabecalhoDaLista: 'Últimas 30 despesas',
  registrar: 'Registrar despesa',

  /** Literais da 15.6. Não reescreva: este texto é o que precisa converter. */
  vazioTitulo: 'Você acompanha quanto entra. E quanto sai?',
  vazioCorpo:
    'Aluguel de sala, supervisão, transporte, material. Registrar as despesas é o que mostra o seu lucro de verdade, não só o faturamento.',
  vazioBotao: 'Registrar primeira despesa',

  nova: {
    titulo: 'Registrar despesa',
    data: 'Data',
    tipo: 'Tipo',
    tipoPlaceholder: 'Selecione...',
    tipoFolha: 'Tipo da despesa',
    descricao: 'Descrição',
    /** Do handoff, tela 19. */
    descricaoPlaceholder: 'Ex: Uber até o consultório',
    valor: 'Valor',
    observacoes: 'Observações',
    /** Do handoff, tela 19. */
    rodapeTipoObrigatorio: 'O tipo é obrigatório para salvar.',
    salvar: 'Salvar',
    salvando: 'Salvando...',
  },

  detalhe: {
    titulo: 'Detalhe da despesa',
    competencia: 'Competência',
    rodapeCompetencia:
      'Caso queira mudar a data, exclua a despesa e crie novamente com a data correta.',
    excluir: 'Excluir despesa',
  },

  /** Literais da 15.3. */
  sucessoCriada: 'Despesa registrada.',
  sucessoAtualizada: 'Despesa atualizada.',
  sucessoExcluida: 'Despesa excluída.',
  /** Literal da 15.4. */
  confirmarExclusao: 'Excluir esta despesa? Não dá para desfazer.',
} as const;
