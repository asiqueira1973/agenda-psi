/**
 * Textos visíveis do servidor MCP (seção 15). São finais: não reescrever, sem
 * exclamação nem emoji.
 *
 * `mensagensDoApp` é copiado byte a byte de app/src/lib/validation.ts (`mensagens`);
 * o teste test/rules/messages.test.ts lê aquele arquivo e falha se divergir.
 * Divergência registrada em plans/epico-1.md: o spec 11.1 escreve "Ex: 200." com
 * ponto, o app não tem ponto, e o app manda (regra de cópia, seção 11).
 */
export const mensagensDoApp = {
  valorInvalido: 'Informe um valor inteiro, sem centavos. Ex: 200',
} as const;

/** Títulos de sucesso dos formulários (seção 15). */
export const sucesso = {
  despesa: 'Despesa registrada',
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
} as const;
