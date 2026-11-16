import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  STATUS_PAGO,
  modalidadeDaSessao,
  pagamentoDaSessao,
  statusDoPaciente,
  tipoDoPagamento,
} from '../../src/rules/db-literals.js';

// Regra de cópia (seção 11): o arquivo do app é lido como TEXTO. Se o app mudar um
// literal, este teste quebra, e a intenção é exatamente essa (pegadinha 6).
const doApp = readFileSync(
  new URL('../../../app/src/features/patients/valores-do-banco.ts', import.meta.url),
  'utf8',
);

describe('literais 11.4 iguais, byte a byte, aos do app', () => {
  const grupos = { statusDoPaciente, modalidadeDaSessao, pagamentoDaSessao, tipoDoPagamento };

  for (const [nome, opcoes] of Object.entries(grupos)) {
    it(`${nome}: cada par valor/rótulo existe no app`, () => {
      for (const { valor, rotulo } of opcoes) {
        expect(doApp).toContain(`{ valor: '${valor}', rotulo: '${rotulo}' }`);
      }
    });
  }

  it('as duas inconsistências do banco ficam como estão', () => {
    expect(pagamentoDaSessao.map((o) => o.valor)).toContain('nao pagou');
    expect(tipoDoPagamento.map((o) => o.valor)).toContain('por sessão');
  });

  it('o mesmo número de opções do app, sem acréscimo', () => {
    const total = Object.values(grupos).reduce((n, g) => n + g.length, 0);
    expect(doApp.match(/\{ valor: '/g)).toHaveLength(total);
  });

  it('STATUS_PAGO é o do app', () => {
    expect(doApp).toContain(`export const STATUS_PAGO = '${STATUS_PAGO}';`);
  });
});
