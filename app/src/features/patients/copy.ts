/**
 * Textos das telas de paciente.
 *
 * Os marcados como literais vêm das seções 15.3, 15.4 e 15.5 do spec e são
 * texto final. Os demais vêm do handoff de design.
 */
export const copyPacientes = {
  titulo: 'Pacientes',
  buscar: 'Buscar',

  /** Literal da 15.5. */
  vazioTitulo: 'Você ainda não tem pacientes cadastrados.',
  /** Do handoff, tela 9b. */
  vazioCorpo: 'Cadastre um paciente para começar a registrar sessões e pagamentos.',
  vazioBotao: 'Cadastrar paciente',

  /** Literal da 15.5, com a busca interpolada. */
  buscaSemResultado: (busca: string) => `Nenhum paciente encontrado para "${busca}".`,
  /** Do handoff, tela 9d. */
  buscaSemResultadoCorpo: 'Tente outro nome ou cadastre um paciente novo.',

  grupoAtivos: (quantidade: number) =>
    quantidade === 1 ? '1 paciente ativo' : `${quantidade} pacientes ativos`,
  grupoInativos: 'Inativos',

  novo: {
    titulo: 'Novo paciente',
    nome: 'Nome',
    telefone: 'Telefone',
    email: 'E-mail',
    preco: 'Preço',
    /** Do handoff, tela 10. */
    rodapePreco: 'Valor inteiro, sem centavos.',
    receberSms: 'Enviar SMS minutos antes da sessão',
    observacoes: 'Observações',
    salvar: 'Cadastrar paciente',
    salvando: 'Cadastrando...',
  },

  editar: {
    titulo: 'Editar paciente',
    status: 'Status',
    ativo: 'Ativo',
    inativo: 'Inativo',
    salvar: 'Salvar',
    salvando: 'Salvando...',
  },

  detalhe: {
    registrarSessao: 'Registrar sessão',
    registrarPagamento: 'Registrar pagamento',
    grupoDados: 'Dados cadastrais',
    telefone: 'Telefone',
    email: 'E-mail',
    primeiraConsulta: 'Primeira consulta',
    editar: 'Editar',
    grupoAtendimento: 'Atendimento',
    precoAtual: 'Preço atual',
    totalDeSessoes: 'Total de sessões',
    valorTotalPago: 'Valor total pago',
    sessoesNaoPagas: 'Sessões não pagas',
    atualizarPreco: 'Atualizar o preço',
    grupoHistorico: 'Histórico',
    sessoes: 'Sessões',
    pagamentos: 'Pagamentos',
    precos: 'Preços',
    excluir: 'Excluir paciente',
    /** Literais da 15.5. */
    semSessoes: 'Nenhuma sessão registrada ainda.',
    semPagamentos: 'Nenhum pagamento registrado ainda.',
  },

  atualizarPreco: {
    titulo: 'Atualizar o preço',
    precoAtual: 'Preço atual',
    novoPreco: 'Novo preço',
    placeholder: 'Ex: 500',
    observacoes: 'Observações',
    salvar: 'Salvar',
    salvando: 'Salvando...',
  },

  /** Literais da 15.3. */
  sucessoCriado: (nome: string) => `${nome} cadastrado.`,
  sucessoAtualizado: (nome: string) => `${nome} atualizado.`,
  sucessoPreco: (valor: string) => `Novo preço de ${valor} vigente a partir de hoje.`,

  /** Literais da 15.4. A confirmação nominal é exigência da exclusão em cascata. */
  excluirTitulo: (nome: string) => `Excluir ${nome}?`,
  excluirCorpo:
    'Isso apaga também todas as sessões, pagamentos, preços e horários desse paciente. Não dá para desfazer. Se você só quer parar de atender, mude o status para Inativo.',
  excluirCancelar: 'Cancelar',
  excluirConfirmar: 'Excluir',
} as const;
