/**
 * Copy dos formulários do épico 5. Os blocos `*DoApp` são copiados byte a byte dos
 * `copy.ts` do app e de `app/src/lib/validation.ts`; test/rules/copy-app.test.ts lê esses
 * arquivos e falha se divergir (15). `textosNovosEpico5` são os aprovados pelo Alexandre
 * em 15/11/2026 (plans/epico-5.md). Sem exclamação nem emoji. Arquivo puro (a UI importa).
 */

/** app/src/features/sessions/copy.ts (`copySessoes`). */
export const copySessoesDoApp = {
  nova: 'Registrar sessão',
  data: 'Data',
  duracao: 'Duração',
  duracaoPlaceholder: '50',
  seraCobrada: 'Sessão será cobrada',
  grupoModalidade: 'Modalidade',
  grupoPagamento: 'Pagamento',
  salvar: 'Salvar',
  salvando: 'Salvando...',
  sucessoCriada: 'Sessão registrada.',
} as const;

/** app/src/features/sessions/copy.ts (`copyPagamentos`). */
export const copyPagamentosDoApp = {
  novo: 'Registrar pagamento',
  grupoTipo: 'Tipo',
  competencia: 'Mês de competência',
  valor: 'Valor',
  rodapeValor: 'Preço atual do paciente.',
  salvar: 'Salvar',
  salvando: 'Salvando...',
  sucessoCriado: 'Pagamento registrado.',
} as const;

/** app/src/features/schedule/copy.ts (`copyAgenda.novo`). */
export const copyAgendaDoApp = {
  paciente: 'Paciente',
  pacienteFolha: 'Escolha o paciente',
  horaInicio: 'Hora início',
  horaFim: 'Hora fim',
  grupoDia: 'Dia da semana',
  salvar: 'Salvar',
  salvando: 'Salvando...',
} as const;

/**
 * app/src/features/schedule/copy.ts (`diasDoSegmented`): ordem visual começando no
 * DOMINGO; o valor é o do banco, 1 = segunda … 7 = domingo (pegadinha 7, regra 11.6).
 */
export const diasDoApp = [
  { valor: 7, rotulo: 'Dom' },
  { valor: 1, rotulo: 'Seg' },
  { valor: 2, rotulo: 'Ter' },
  { valor: 3, rotulo: 'Qua' },
  { valor: 4, rotulo: 'Qui' },
  { valor: 5, rotulo: 'Sex' },
  { valor: 6, rotulo: 'Sáb' },
] as const;

/** app/src/features/schedule/copy.ts (`copyAgenda.novo.sucessoCriado`). */
export const sucessoHorarioDoApp = 'Horário criado.';

/** app/src/lib/validation.ts (`mensagens`), os do épico 5. */
export const mensagensEpico5DoApp = {
  nomeVazio: 'O nome é obrigatório',
  telefoneVazio: 'O telefone é obrigatório',
  pacienteNaoEscolhido: 'Escolha o paciente',
  horaFimAntesDoInicio: 'A hora fim precisa ser depois da hora início',
  horarioIncompleto: 'Informe a hora de início e a de fim',
} as const;

/** app/src/features/patients/copy.ts (`copyPacientes.novo`). */
export const copyPacientesDoApp = {
  buscar: 'Buscar',
  titulo: 'Novo paciente',
  nome: 'Nome',
  telefone: 'Telefone',
  email: 'E-mail',
  preco: 'Preço',
  rodapePreco: 'Valor inteiro, sem centavos.',
  receberSms: 'Enviar SMS minutos antes da sessão',
  salvar: 'Cadastrar paciente',
  salvando: 'Cadastrando...',
} as const;

/** app/src/features/patients/copy.ts (`copyPacientes.sucessoCriado`, literal da 15.3). */
export const sucessoPacienteDoApp = (nome: string) => `${nome} cadastrado.`;

/** app/src/features/auth/copy.ts (`copyAuth.erros.emailInvalido`), usado por `validarEmailOpcional`. */
export const emailInvalidoDoApp = 'Digite um e-mail válido';

/** app/src/features/agent/copy.ts (`cartao.tituloDeHorarioDoPacienteNovo`). */
export const horarioDoPacienteNovoDoApp = 'Horário na agenda';

/**
 * Feedback: tela de Ajustes (`copyConfiguracoes.feedbackTela`), cartão do agente
 * (`copyAgente.cartao`, `rotuloDaCategoria`) e a regra de mensagem vazia de rascunhos.ts.
 */
export const copyFeedbackDoApp = {
  titulo: 'Feedback para a equipe',
  mensagem: 'Mensagem',
  aviso: 'Vai para a equipe do Agenda Psi. Confira o texto antes de enviar.',
  placeholder: 'Escreva aqui...',
  enviar: 'Enviar',
  enviando: 'Enviando...',
  sucesso: 'Obrigado. Sua mensagem chegou.',
  vazia: 'Escreva a mensagem',
} as const;

/** `rotuloDaCategoria` (app/src/features/agent/rascunhos.ts). Valores na ordem do cartão. */
export const categoriasDoFeedbackDoApp = [
  { valor: 'problema', rotulo: 'Problema' },
  { valor: 'sugestao', rotulo: 'Sugestão' },
  { valor: 'elogio', rotulo: 'Elogio' },
] as const;

/** Avisos de paciente do cartão do agente do app (`problemasDoPaciente`, rascunhos.ts). */
export const avisosDePacienteDoApp = {
  ambiguo: (termo: string) => `Escolha qual "${termo}"`,
  naoEncontrado: (termo: string) => `"${termo}" não está no cadastro. Escolha o paciente`,
} as const;

/** Textos novos aprovados (plans/epico-5.md, seção "Textos"). */
export const textosNovosEpico5 = {
  sessoesRegistradas: 'Sessões registradas.',
  /** Plural de "Horário criado." do app; aprovado em 15/11/2026, no fechamento do épico 5. */
  horariosCriados: 'Horários criados.',
  pagamentosRegistrados: 'Pagamentos registrados.',
  /** Duração fora de 1–600 (11.8); aprovado em 15/11/2026, no fechamento do épico 5. */
  duracaoInvalida: 'Informe a duração em minutos, de 1 a 600',
  registrarTambemPagamento: 'Registrar também o pagamento',
  /** Mensagem que o botão manda na conversa, para o modelo abrir o formulário de pagamento. */
  pedidoDePagamento: (itens: string[]) => `Quero registrar o pagamento destas sessões: ${itens.join(', ')}.`,
  naoGravadas: (itens: string[]) => `Estas não foram gravadas: ${itens.join('; ')}. As outras foram.`,
  horariosNaoGravados: (itens: string[]) =>
    `Paciente cadastrado, mas estes horários não foram gravados: ${itens.join('; ')}. Adicione pelo app ou peça de novo.`,
  pacienteSemPreco: 'Paciente cadastrado sem preço. Defina o preço no app.',
  /** Literal do agente do app (`copyAgente.cartao.conflito`). */
  conflito: (nomes: string[]) => `Este horário coincide com: ${nomes.join(', ')}.`,
  /** Para o modelo, no Cancelar (mesmo padrão aprovado na despesa). */
  formularioCancelado: (qual: string) => `A pessoa cancelou o formulário de ${qual}. Nada foi gravado.`,
  /** Para o modelo, na abertura: só descreve o estado (16/11/2026, plans/diretorio.md 2.2). */
  formularioAberto: (qual: string) =>
    `Formulário de ${qual} aberto para a pessoa conferir. Nada foi gravado: só grava quando ela clicar em Salvar, e o formulário avisa quando isso acontecer.`,
} as const;
