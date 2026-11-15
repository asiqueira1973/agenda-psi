/**
 * Textos visíveis do servidor MCP e dos formulários (seção 15). São finais: não
 * reescrever, sem exclamação nem emoji. Este arquivo é puro: o formulário também o
 * importa, para a tela e o servidor falarem a mesma coisa.
 *
 * `mensagensDoApp` e `copyDespesaDoApp` são copiados byte a byte de
 * app/src/lib/validation.ts (`mensagens`) e app/src/features/expenses/copy.ts
 * (`copyDespesas`); test/rules/messages.test.ts lê esses arquivos e falha se divergir.
 * Quando o app e o spec divergem num texto que existe no app, o app manda (seção 15):
 * "Ex: 200" sem ponto (plano do épico 1) e "Despesa registrada." com ponto (épico 2).
 */
export const mensagensDoApp = {
  valorInvalido: 'Informe um valor inteiro, sem centavos. Ex: 200',
  tipoDeDespesaNaoEscolhido: 'Escolha o tipo da despesa',
} as const;

/** Rótulos e textos da tela "Registrar despesa" do app (copyDespesas.nova e 15.3). */
export const copyDespesaDoApp = {
  titulo: 'Registrar despesa',
  data: 'Data',
  tipoFolha: 'Tipo da despesa',
  tipoPlaceholder: 'Selecione...',
  descricao: 'Descrição',
  descricaoPlaceholder: 'Ex: Uber até o consultório',
  valor: 'Valor',
  observacoes: 'Observações',
  salvar: 'Salvar',
  salvando: 'Salvando...',
  sucessoCriada: 'Despesa registrada.',
} as const;

/**
 * Textos novos do formulário de despesa, que não existem no app nem no spec.
 * Aprovados pelo Alexandre em 15/11/2026 (plano do épico 2, pergunta 1).
 * "Tentar de novo" e "Cancelar" vêm do spec (8.2 e 16).
 */
export const textosNovosDespesa = {
  dataInvalida: 'Informe uma data válida',
  descricaoLonga: 'A descrição pode ter até 200 caracteres',
  observacoesLongas: 'As observações podem ter até 1000 caracteres',
  erroAoCarregarTipos: 'Não foi possível carregar os tipos de despesa.',
  tentarDeNovo: 'Tentar de novo',
  cancelar: 'Cancelar',
  /** Aprovado em 15/11/2026 (épico 3): o Claude não fecha o formulário no Cancelar. */
  cancelado: 'Cancelado. Nada foi registrado.',
} as const;

/** Títulos de sucesso dos formulários (seção 15). A despesa usa o texto do app, acima. */
export const sucesso = {
  despesa: copyDespesaDoApp.sucessoCriada,
  sessoes: 'Sessões registradas',
  pagamento: 'Pagamento registrado',
  paciente: 'Paciente cadastrado',
  horarioAdicionado: 'Horário adicionado',
  horarioAlterado: 'Horário alterado',
  horarioRemovido: 'Horário removido',
  cadastroAtualizado: 'Cadastro atualizado',
  registroAtualizado: 'Registro atualizado',
  registroExcluido: 'Registro excluído',
  feedback: 'Feedback enviado',
} as const;

/** Erros devolvidos por `salvar_*` (seção 12) e pela regra 11.20. */
export const erros = {
  semPermissao: 'Registro não encontrado ou sem permissão.',
  contaDemoNaoExclui: 'Esta conta de demonstração não permite excluir registros.',
  inesperado: 'Não foi possível salvar agora. Tente de novo.',
  nadaMudou: 'Nada mudou no registro',
  dadosMudaram: 'Os dados mudaram desde a prévia. Mostre a nova prévia à pessoa.',
  // Os dois abaixo são lidos pelo MODELO no fallback (13.4), não pela pessoa; o spec
  // não traz texto para token vencido/adulterado nem para pendência aberta.
  tokenInvalido: 'A prévia venceu ou não confere. Chame a ferramenta de novo, sem confirmar, para gerar outra prévia.',
  pendenciasAbertas: 'Há escolhas pendentes na prévia. Resolva com a pessoa antes de confirmar.',
} as const;

/**
 * Textos lidos pelo MODELO (não pela pessoa), sem equivalente no spec. Ficam aqui para
 * a copy morar num lugar só (seção 15). Aprovados pelo Alexandre em 15/11/2026 (plans/epico-2.md).
 */
export const textosParaOModelo = {
  // Trocado em 15/11/2026 (épico 3, aprovado): o texto antigo fazia o modelo descrever os
  // campos vazios, e essa resposta ficava embaixo do "Despesa registrada." depois do Salvar.
  formularioAberto: 'O formulário de despesa está aberto para a pessoa. Responda em uma frase curta, sem repetir os campos nem explicar como preencher. Nada foi gravado: só grava quando a pessoa clicar em Salvar, e o formulário informa você quando isso acontecer.',
  formularioCancelado: 'A pessoa cancelou o formulário de despesa. Nada foi gravado.',
  previaPronta: 'Prévia pronta. Nada foi gravado. Mostre a prévia à pessoa e só confirme se ela concordar.',
  nadaGravadoComPendencias: 'Nada foi gravado. Resolva as pendências e os erros com a pessoa e chame de novo, sem confirmar.',
  /** O caso ambíguo segue o exemplo literal do spec (8.2, passo 2). */
  tipoAmbiguo: (termo: string, n: number) => `'${termo}' casou com ${n} tipos, escolha um`,
  tipoNaoEncontrado: (termo: string) => `'${termo}' não casou com nenhum tipo, escolha um`,
} as const;
