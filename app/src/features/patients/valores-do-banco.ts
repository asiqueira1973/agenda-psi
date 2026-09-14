import type { SegmentoOpcao } from '@/components/ui';

/**
 * Os valores de escolha, exatamente como o banco os guarda.
 *
 * Esta é a tabela 11.4 do spec transposta para código, e a regra que vale para
 * o arquivo inteiro é: **não normalizar, não acentuar, não traduzir**. Em
 * particular:
 *
 * - `sessoes.pagamento` aceita `nao pagou`, SEM acento e com espaço;
 * - `pagamentos.tipo` aceita `por sessão`, COM acento e com espaço.
 *
 * As duas inconsistências são do banco (spec 7.6), não descuido daqui.
 * "Consertar" qualquer uma delas quebra as views que filtram por esses valores.
 *
 * O rótulo é o que a pessoa lê; o valor é o que o Postgres recebe.
 */

/** `pacientes.status` */
export const statusDoPaciente: readonly SegmentoOpcao<string>[] = [
  { valor: 'ativo', rotulo: 'Ativo' },
  { valor: 'inativo', rotulo: 'Inativo' },
];

/** `sessoes.modalidade` */
export const modalidadeDaSessao: readonly SegmentoOpcao<string>[] = [
  { valor: 'presencial', rotulo: 'Presencial' },
  { valor: 'remota', rotulo: 'Remota' },
];

/**
 * `sessoes.pagamento`.
 *
 * O rótulo do terceiro é "Mensal", e não "Pagamento mensal" da tabela 11.4:
 * decisão de 13/09/2026, porque o rótulo longo não cabe num segmented de três
 * posições. O VALOR gravado continua `pagamento mensal`, intacto.
 */
export const pagamentoDaSessao: readonly SegmentoOpcao<string>[] = [
  { valor: 'pagou', rotulo: 'Pagou' },
  { valor: 'nao pagou', rotulo: 'Não pagou' },
  { valor: 'pagamento mensal', rotulo: 'Mensal' },
];

/** `pagamentos.tipo` */
export const tipoDoPagamento: readonly SegmentoOpcao<string>[] = [
  { valor: 'mensal', rotulo: 'Mensal' },
  { valor: 'por sessão', rotulo: 'Por sessão' },
];

/** Valor que o app sempre grava em `pagamentos.status` e `despesas.status`. */
export const STATUS_PAGO = 'pago';
