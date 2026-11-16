/**
 * Os valores de escolha exatamente como o banco os guarda (regra 11.4, pegadinha 6),
 * com o rótulo que a tela mostra (regra 11.5).
 *
 * Copiados byte a byte de app/src/features/patients/valores-do-banco.ts; o teste
 * test/rules/db-literals.test.ts lê aquele arquivo como texto e falha se divergir.
 * Não normalizar, não acentuar, não traduzir:
 * - `sessoes.pagamento` aceita `nao pagou`, SEM acento;
 * - `pagamentos.tipo` aceita `por sessão`, COM acento e espaço.
 */

/** Um par valor gravado / rótulo exibido. */
export type OpcaoDoBanco<V extends string> = { readonly valor: V; readonly rotulo: string };

/** `pacientes.status` */
export const statusDoPaciente = [
  { valor: 'ativo', rotulo: 'Ativo' },
  { valor: 'inativo', rotulo: 'Inativo' },
] as const satisfies readonly OpcaoDoBanco<string>[];

/** `sessoes.modalidade` */
export const modalidadeDaSessao = [
  { valor: 'presencial', rotulo: 'Presencial' },
  { valor: 'remota', rotulo: 'Remota' },
] as const satisfies readonly OpcaoDoBanco<string>[];

/** `sessoes.pagamento`. O rótulo "Mensal" é decisão do app (13/09/2026); o valor segue `pagamento mensal`. */
export const pagamentoDaSessao = [
  { valor: 'pagou', rotulo: 'Pagou' },
  { valor: 'nao pagou', rotulo: 'Não pagou' },
  { valor: 'pagamento mensal', rotulo: 'Mensal' },
] as const satisfies readonly OpcaoDoBanco<string>[];

/** `pagamentos.tipo` */
export const tipoDoPagamento = [
  { valor: 'mensal', rotulo: 'Mensal' },
  { valor: 'por sessão', rotulo: 'Por sessão' },
] as const satisfies readonly OpcaoDoBanco<string>[];

/** Valor que o app sempre grava em `pagamentos.status` e `despesas.status` (regra 11.10). */
export const STATUS_PAGO = 'pago';

export type StatusDoPaciente = (typeof statusDoPaciente)[number]['valor'];
export type ModalidadeDaSessao = (typeof modalidadeDaSessao)[number]['valor'];
export type PagamentoDaSessao = (typeof pagamentoDaSessao)[number]['valor'];
export type TipoDoPagamento = (typeof tipoDoPagamento)[number]['valor'];
