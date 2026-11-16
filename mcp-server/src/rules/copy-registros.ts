/**
 * Copy das edições e exclusões (épico 6, 8.6). Os blocos `*DoApp` são copiados byte a
 * byte dos `copy.ts` do app; `doAgente` do cartão de confirmação do agente do app
 * (`copyAgente.cartao`); `doSpec` da seção 15 e da tabela 12 do mcp-server/spec.md.
 * test/rules/copy-registros.test.ts lê os arquivos do app e falha se divergir.
 * `textosNovosEpico6` são novos, aprovados pelo Alexandre em 15/11/2026 (plans/epico-6.md).
 * Sem exclamação nem emoji. Arquivo puro (a UI importa).
 */

/** app/src/features/sessions/copy.ts (`copySessoes`). */
export const sessaoDoApp = {
  detalhe: 'Detalhe da sessão',
  excluir: 'Excluir sessão',
  rodapeData: 'Caso queira mudar a data, exclua a sessão e crie novamente com a data correta.',
  sucessoAtualizada: 'Sessão atualizada.',
  sucessoExcluida: 'Sessão excluída.',
  confirmarExclusao: 'Excluir esta sessão? Não dá para desfazer.',
} as const;

/** app/src/features/sessions/copy.ts (`copyPagamentos`). */
export const pagamentoDoApp = {
  detalhe: 'Detalhe do pagamento',
  excluir: 'Excluir pagamento',
  rodapeCompetencia: 'Caso queira mudar o mês de competência, exclua o pagamento e crie novamente.',
  sucessoAtualizado: 'Pagamento atualizado.',
  sucessoExcluido: 'Pagamento excluído.',
  confirmarExclusao: 'Excluir este pagamento? Não dá para desfazer.',
} as const;

/** app/src/features/expenses/copy.ts (`copyDespesas.detalhe` e sucessos). */
export const despesaDoApp = {
  titulo: 'Detalhe da despesa',
  competencia: 'Competência',
  rodapeCompetencia: 'Caso queira mudar a data, exclua a despesa e crie novamente com a data correta.',
  excluir: 'Excluir despesa',
  sucessoAtualizada: 'Despesa atualizada.',
  sucessoExcluida: 'Despesa excluída.',
  confirmarExclusao: 'Excluir esta despesa? Não dá para desfazer.',
} as const;

/** app/src/features/schedule/copy.ts (`copyAgenda`). */
export const horarioDoApp = {
  excluir: 'Excluir horário',
  sucessoExcluido: 'Horário excluído.',
  confirmarExclusaoTitulo: 'Excluir este horário?',
} as const;

/** app/src/features/patients/copy.ts (`copyPacientes.editar`, `detalhe` e sucessos). */
export const pacienteDoApp = {
  titulo: 'Editar paciente',
  status: 'Status',
  salvar: 'Salvar',
  salvando: 'Salvando...',
  semSessoes: 'Nenhuma sessão registrada ainda.',
  semPagamentos: 'Nenhum pagamento registrado ainda.',
  sucessoAtualizado: (nome: string) => `${nome} atualizado.`,
  sucessoPreco: (valor: string) => `Novo preço de ${valor} vigente a partir de hoje.`,
} as const;

/** app/src/features/agent/copy.ts (`copyAgente.cartao`). */
export const doAgente = {
  trocaHorario: 'Troca de horário',
  remocaoHorario: 'Tirar da agenda',
  edicaoPaciente: 'Alteração de cadastro',
  edicaoSessao: 'Alterar sessão',
  exclusaoSessao: 'Apagar sessão',
  edicaoPagamento: 'Alterar pagamento',
  exclusaoPagamento: 'Apagar pagamento',
  edicaoDespesa: 'Alterar despesa',
  exclusaoDespesa: 'Apagar despesa',
  registro: 'Registro',
  avisoDeExclusao: 'Apaga só este registro, sem volta.',
  horarioAtual: 'Horário atual',
  novoHorario: 'Novo horário',
  avisoDaTroca: 'O horário novo é gravado primeiro; o antigo sai depois.',
  avisoDaRemocao: 'O paciente continua cadastrado, com as sessões. Só este horário sai da agenda, e o lembrete por SMS dele deixa de ser enviado.',
  tirarDaAgenda: 'Tirar da agenda',
  antes: (valor: string) => `Antes: ${valor}`,
  avisoDoPreco: 'O preço novo vale a partir de hoje. As sessões anteriores mantêm o preço antigo.',
  trocaParcial: 'O horário novo foi gravado, mas não consegui tirar o antigo. Tente de novo abaixo.',
} as const;

/** mcp-server/spec.md, seções 8.6, 15 e 12. */
export const doSpec = {
  excluirDefinitivamente: 'Excluir definitivamente',
  /** "Horário alterado" da 15, com ponto, como os outros sucessos (decisão do épico 5). */
  horarioAlterado: 'Horário alterado.',
} as const;

/** Novos, no padrão de `semSessoes`/`semPagamentos` do app. Aprovados em 15/11/2026. */
export const textosNovosEpico6 = {
  semDespesas: 'Nenhuma despesa registrada ainda.',
  semHorarios: 'Nenhum horário fixo na agenda.',
} as const;
