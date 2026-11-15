import { describe, expect, it } from 'vitest';
import { mensagensDoApp, textosNovosDespesa } from '../../src/rules/messages.js';
import { resumoDaDespesa, textoParaOModelo, validarDespesa } from '../../src/tools/expense/validate.js';

const TIPO = '3f6c1a9e-1b2c-4d5e-8f90-123456789abc';
const valida = { tipo_despesa_id: TIPO, valor_despesa: '1450', data_competencia: '2026-11-15' };

describe('validarDespesa (P3, regras 11.1-11.3 e 8.2)', () => {
  it('normaliza uma despesa válida: valor inteiro, textos vazios viram null', () => {
    expect(validarDespesa({ ...valida, descricao: '  ', observacoes: ' obs ' })).toEqual({
      ok: true,
      dados: { tipo_despesa_id: TIPO, valor_despesa: 1450, data_competencia: '2026-11-15', descricao: null, observacoes: 'obs' },
    });
  });

  it('sem tipo: erro no campo tipo_despesa_id, em português (critério 3)', () => {
    const r = validarDespesa({ ...valida, tipo_despesa_id: undefined });
    expect(r).toEqual({ ok: false, erros: [{ campo: 'tipo_despesa_id', mensagem: mensagensDoApp.tipoDeDespesaNaoEscolhido }] });
  });

  it('tipo com formato errado também vira erro de campo, sem chegar ao banco (critério 4)', () => {
    const r = validarDespesa({ ...valida, tipo_despesa_id: 'aluguel' });
    expect(r.ok === false && r.erros[0]?.campo).toBe('tipo_despesa_id');
  });

  it('1450,50 é recusado com a mensagem do app (critério 2)', () => {
    expect(validarDespesa({ ...valida, valor_despesa: '1450,50' })).toEqual({
      ok: false, erros: [{ campo: 'valor_despesa', mensagem: 'Informe um valor inteiro, sem centavos. Ex: 200' }],
    });
  });

  it('competência obrigatória e real', () => {
    for (const data of [undefined, '', '2026-02-31', '15/11/2026']) {
      const r = validarDespesa({ ...valida, data_competencia: data });
      expect(r).toEqual({ ok: false, erros: [{ campo: 'data_competencia', mensagem: textosNovosDespesa.dataInvalida }] });
    }
  });

  it('limites de descrição (200) e observações (1000)', () => {
    expect(validarDespesa({ ...valida, descricao: 'x'.repeat(200), observacoes: 'y'.repeat(1000) }).ok).toBe(true);
    const r = validarDespesa({ ...valida, descricao: 'x'.repeat(201), observacoes: 'y'.repeat(1001) });
    expect(r.ok === false && r.erros.map((e) => e.campo)).toEqual(['descricao', 'observacoes']);
  });

  it('todos os erros voltam de uma vez', () => {
    const r = validarDespesa({});
    expect(r.ok === false && r.erros.map((e) => e.campo)).toEqual(['tipo_despesa_id', 'valor_despesa', 'data_competencia']);
  });
});

describe('textos do resumo', () => {
  it('resumo no formato do app: R$ com milhar e data dd/mm/aaaa', () => {
    expect(resumoDaDespesa('Aluguel da sala', 1450, '2026-11-05')).toBe('Aluguel da sala, R$ 1.450, competência 05/11/2026');
  });
  it('texto do updateModelContext literal do spec (8.2, passo 6)', () => {
    expect(textoParaOModelo('Aluguel da sala, R$ 1.450, competência 05/11/2026', 'abc')).toBe(
      'Despesa registrada: Aluguel da sala, R$ 1.450, competência 05/11/2026 (id abc).',
    );
  });
});
