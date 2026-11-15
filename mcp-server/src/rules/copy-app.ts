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

/** app/src/lib/validation.ts (`mensagens`), os do épico 5. */
export const mensagensEpico5DoApp = {
  nomeVazio: 'O nome é obrigatório',
  telefoneVazio: 'O telefone é obrigatório',
  pacienteNaoEscolhido: 'Escolha o paciente',
  horaFimAntesDoInicio: 'A hora fim precisa ser depois da hora início',
  horarioIncompleto: 'Informe a hora de início e a de fim',
} as const;

/** Avisos de paciente do cartão do agente do app (`problemasDoPaciente`, rascunhos.ts). */
export const avisosDePacienteDoApp = {
  ambiguo: (termo: string) => `Escolha qual "${termo}"`,
  naoEncontrado: (termo: string) => `"${termo}" não está no cadastro. Escolha o paciente`,
} as const;

/** Textos novos aprovados (plans/epico-5.md, seção "Textos"). */
export const textosNovosEpico5 = {
  sessoesRegistradas: 'Sessões registradas.',
  pagamentosRegistrados: 'Pagamentos registrados.',
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
  /** Para o modelo, na abertura (mesmo padrão aprovado na despesa). */
  formularioAberto: (qual: string) =>
    `O formulário de ${qual} está aberto para a pessoa. Responda exatamente "Abri o formulário de ${qual}." e nada mais. Nada foi gravado: só grava quando a pessoa clicar em Salvar, e o formulário informa você quando isso acontecer.`,
} as const;
