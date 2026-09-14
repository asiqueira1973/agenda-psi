import {
  statusDoPaciente,
  modalidadeDaSessao,
  pagamentoDaSessao,
  tipoDoPagamento,
  STATUS_PAGO,
} from '../valores-do-banco';

/**
 * Teste de regressão da tabela 11.4 do spec.
 *
 * Estes valores são LITERAIS DO BANCO. As views e as policies filtram por eles.
 * "Normalizar" `nao pagou` para `não pagou`, ou `por sessão` para `por sessao`,
 * não quebra o TypeScript, não quebra o build, não quebra na revisão de código —
 * quebra silenciosamente a contagem de sessões não pagas do dashboard, semanas
 * depois, sem ninguém relacionar uma coisa com a outra.
 *
 * Por isso o teste compara byte a byte, e por isso ele existe.
 */

function valores(opcoes: readonly { valor: string }[]) {
  return opcoes.map((o) => o.valor);
}

describe('valores literais da tabela 11.4', () => {
  it('pacientes.status', () => {
    expect(valores(statusDoPaciente)).toEqual(['ativo', 'inativo']);
  });

  it('sessoes.modalidade', () => {
    expect(valores(modalidadeDaSessao)).toEqual(['presencial', 'remota']);
  });

  it('sessoes.pagamento — "nao pagou" SEM acento, como está no banco', () => {
    expect(valores(pagamentoDaSessao)).toEqual(['pagou', 'nao pagou', 'pagamento mensal']);
  });

  it('sessoes.pagamento não pode ganhar acento em "nao"', () => {
    expect(valores(pagamentoDaSessao)).not.toContain('não pagou');
  });

  it('pagamentos.tipo — "por sessão" COM acento, como está no banco', () => {
    expect(valores(tipoDoPagamento)).toEqual(['mensal', 'por sessão']);
  });

  it('pagamentos.tipo não pode perder o acento em "sessão"', () => {
    expect(valores(tipoDoPagamento)).not.toContain('por sessao');
  });

  it('status gravado em pagamentos e despesas é sempre "pago"', () => {
    expect(STATUS_PAGO).toBe('pago');
  });
});

describe('rótulos de interface — tabela 11.4, coluna "Rótulo na interface"', () => {
  it('o rótulo de "nao pagou" é acentuado, mesmo o valor não sendo', () => {
    const opcao = pagamentoDaSessao.find((o) => o.valor === 'nao pagou');
    expect(opcao?.rotulo).toBe('Não pagou');
  });

  it('"pagamento mensal" aparece como "Mensal" no segmented de três posições', () => {
    // Decisão de 13/09/2026: o rótulo da 11.4 é "Pagamento mensal", que não cabe
    // num segmented de três. O VALOR gravado continua intacto, que é o que
    // importa para o banco.
    const opcao = pagamentoDaSessao.find((o) => o.valor === 'pagamento mensal');
    expect(opcao?.rotulo).toBe('Mensal');
  });
});
