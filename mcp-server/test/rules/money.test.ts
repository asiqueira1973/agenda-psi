import { describe, expect, it } from 'vitest';
import { mensagensDoApp } from '../../src/rules/messages.js';
import { validarValorEmReais } from '../../src/rules/money.js';

// Os casos que a seção 22 do spec do app exige: 200, 200,00, 200.00, vazio, abc, -5 e 0.
describe('validarValorEmReais (regras 11.1 e 11.2)', () => {
  const recusa = { valido: false, mensagem: mensagensDoApp.valorInvalido };

  it('200 passa, como texto e como número', () => {
    expect(validarValorEmReais('200')).toEqual({ valido: true, valor: 200 });
    expect(validarValorEmReais(' 200 ')).toEqual({ valido: true, valor: 200 });
    expect(validarValorEmReais(200)).toEqual({ valido: true, valor: 200 });
  });

  it.each(['200,00', '200.00', '', 'abc', '-5', '0'])('"%s" é recusado, nunca arredondado', (v) => {
    expect(validarValorEmReais(v)).toEqual(recusa);
  });

  it('número com centavos é recusado', () => {
    expect(validarValorEmReais(199.9)).toEqual(recusa);
  });

  it('teto de 1.000.000', () => {
    expect(validarValorEmReais('1000000')).toEqual({ valido: true, valor: 1_000_000 });
    expect(validarValorEmReais('1000001')).toEqual(recusa);
  });

  it('tipos estranhos são recusados', () => {
    expect(validarValorEmReais(null)).toEqual(recusa);
    expect(validarValorEmReais(undefined)).toEqual(recusa);
  });
});
