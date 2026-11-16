import { describe, expect, it } from 'vitest';
import { mensagensDoApp, textosNovosDespesa } from '../../src/rules/messages.js';
import { preencherDespesa } from '../../src/tools/expense/open-form.js';
import { resolverTipo } from '../../src/tools/expense/resolve-type.js';

const tipos = [
  { id: 'a1', nome: 'Aluguel da sala' },
  { id: 'a2', nome: 'Aluguel de equipamento' },
  { id: 's1', nome: 'Supervisão' },
];
const HOJE = '2026-11-15';

describe('resolverTipo (regra 11.15)', () => {
  it('um casamento, sem acento e sem caixa', () => {
    expect(resolverTipo('supervisao', tipos)).toEqual({ situacao: 'ok', tipo: tipos[2] });
  });
  it('dois casamentos: ambíguo, nunca escolhe sozinho', () => {
    expect(resolverTipo('aluguel', tipos)).toMatchObject({ situacao: 'ambiguo', candidatos: [tipos[0], tipos[1]] });
  });
  it('nenhum casamento e nada dito', () => {
    expect(resolverTipo('imposto', tipos).situacao).toBe('nao_encontrado');
    expect(resolverTipo('  ', tipos).situacao).toBe('nao_dito');
  });
});

describe('preencherDespesa (8.2, passo 2)', () => {
  it('"paguei 1450 de aluguel hoje" com dois aluguéis: tipo VAZIO, candidatos e o aviso do spec', () => {
    const p = preencherDespesa({ tipo: 'aluguel', valor: 1450 }, tipos, HOJE);
    expect(p.campos).toEqual({ tipo_despesa_id: null, valor_despesa: '1450', data_competencia: HOJE, descricao: '', observacoes: '' });
    expect(p.candidatos.map((t) => t.id)).toEqual(['a1', 'a2']);
    expect(p.avisos).toEqual(["'aluguel' casou com 2 tipos, escolha um"]);
  });

  it('um tipo só: preenchido, sem aviso', () => {
    const p = preencherDespesa({ tipo: 'aluguel da sala', valor: 1450, data: '2026-11-10' }, tipos, HOJE);
    expect(p.campos.tipo_despesa_id).toBe('a1');
    expect(p.campos.data_competencia).toBe('2026-11-10');
    expect(p.avisos).toEqual([]);
  });

  it('valor com centavos não é arredondado: campo vazio e aviso', () => {
    const p = preencherDespesa({ valor: 1450.5 }, tipos, HOJE);
    expect(p.campos.valor_despesa).toBe('');
    expect(p.avisos).toContain(mensagensDoApp.valorInvalido);
  });

  it('data inválida não vira hoje escondido: campo vazio e aviso', () => {
    const p = preencherDespesa({ data: '2026-02-31' }, tipos, HOJE);
    expect(p.campos.data_competencia).toBe('');
    expect(p.avisos).toContain(textosNovosDespesa.dataInvalida);
  });

  it('descrição longa não é cortada em silêncio: fica inteira e vai um aviso', () => {
    const longa = 'x'.repeat(205);
    const p = preencherDespesa({ descricao: longa }, tipos, HOJE);
    expect(p.campos.descricao).toBe(longa);
    expect(p.avisos).toContain(textosNovosDespesa.descricaoLonga);
  });

  it('nada dito: só a data de hoje', () => {
    expect(preencherDespesa({}, tipos, HOJE)).toEqual({
      formulario_id: expect.any(String),
      campos: { tipo_despesa_id: null, valor_despesa: '', data_competencia: HOJE, descricao: '', observacoes: '' },
      candidatos: [],
      avisos: [],
    });
  });
});
