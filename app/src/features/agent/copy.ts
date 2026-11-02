/**
 * Textos do agente no Início (docs/agente-plano.md).
 *
 * As sugestões de consulta aparecem sempre; as de registro só com o
 * sinalizador `agente_registros` ligado — oferecê-las com ele desligado
 * prometeria o que o agente não faz. Cada sugestão mexe numa coisa só do app.
 */
export const copyAgente = {
  placeholder: 'Pergunte sobre pacientes, sessões e pagamentos',
  placeholderContinuar: 'Continuar…',
  grupoSugestoes: 'Experimente',
  sugestoes: [
    'Qual é a minha agenda de hoje?',
    'Quais pacientes não me pagaram?',
    'Quanto recebi no mês passado?',
    'Quantas sessões fiz este mês?',
  ],
  sugestoesDeRegistro: [
    'Quero incluir um novo paciente',
    'Quero registrar uma sessão',
    'Quero registrar um pagamento',
  ],
  novaConversa: 'Nova conversa',
  pensando: 'Consultando…',
  enviar: 'Enviar',
  cartao: {
    titulo: {
      sessoes: 'Sessão',
      pagamentos: 'Pagamento',
      paciente: 'Paciente novo',
      horarios: 'Horário na agenda',
      despesas: 'Despesa',
    },
    tituloDeHorarioDoPacienteNovo: 'Horário na agenda',
    paciente: 'Paciente',
    escolher: 'Escolher',
    data: 'Data',
    modalidade: 'Modalidade',
    duracao: 'Duração',
    minutos: (n: number) => `${n} min`,
    pagamento: 'Pagamento',
    valor: 'Valor',
    valorDeReferencia: 'Valor sugerido pelo preço do cadastro. Confira: a sessão pode ter custado outro valor.',
    tipo: 'Tipo',
    dia: 'Dia',
    inicio: 'Início',
    fim: 'Fim',
    nome: 'Nome',
    telefone: 'Telefone',
    email: 'E-mail',
    preco: 'Preço',
    tipoDeDespesa: 'Tipo',
    descricao: 'Descrição',
    remover: 'Remover',
    confirmar: (n: number) => (n > 1 ? `Confirmar ${n} registros` : 'Confirmar'),
    registrando: 'Registrando…',
    cancelar: 'Cancelar',
    registrado: (n: number) => (n > 1 ? `${n} registros gravados` : 'Registrado'),
    cancelado: 'Cancelado. Nada foi gravado.',
    falhaParcial: (gravados: number) =>
      gravados > 0
        ? `Gravei ${gravados}, mas o restante falhou. O que falta continua neste cartão; tente de novo.`
        : 'Não consegui gravar. Confira a conexão e tente de novo.',
    ofertaDePagamento: 'Quer registrar também o pagamento? Confira o valor antes de confirmar.',
  },
  erros: {
    nao_autenticado: 'Sua sessão expirou. Entre de novo.',
    conversa_invalida: 'Não consegui ler a pergunta. Tente escrever de outro jeito.',
    limite_excedido: 'Você já fez muitas perguntas nesta hora. Tente de novo mais tarde.',
    desligado: 'O assistente está indisponível no momento.',
    agente_indisponivel: 'Não consegui responder agora. Tente de novo em alguns instantes.',
  },
} as const;
