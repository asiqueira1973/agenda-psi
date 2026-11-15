import { describe, expect, it } from 'vitest';
import { erros } from '../../src/rules/messages.js';
import { errosLocais, estadoInicial, podeSalvar, reduzir, type Acao, type Estado } from '../../ui/expense/state.js';

const TIPO = '3f6c1a9e-1b2c-4d5e-8f90-123456789abc';
const tipos = [{ id: TIPO, nome: 'Aluguel da sala' }];
const rodar = (...acoes: Acao[]) => acoes.reduce<Estado>(reduzir, estadoInicial());
const preenchido: Acao = {
  tipo: 'preenchimento',
  dados: { campos: { tipo_despesa_id: TIPO, valor_despesa: '1450', data_competencia: '2026-11-15', descricao: '', observacoes: '' }, candidatos: [], avisos: [] },
};

// Máquina de estados da seção 12 e estados da 8.2.
describe('estado do formulário de despesa', () => {
  it('começa carregando e com o Salvar desabilitado', () => {
    const s = estadoInicial();
    expect(s.fase).toBe('carregando');
    expect(podeSalvar(s)).toBe(false);
  });

  it('opções carregadas + obrigatórios preenchidos → pode salvar', () => {
    expect(podeSalvar(rodar(preenchido, { tipo: 'opcoes_ok', tipos }))).toBe(true);
  });

  it('falta campo obrigatório → Salvar desabilitado', () => {
    const s = rodar(preenchido, { tipo: 'opcoes_ok', tipos }, { tipo: 'editar', campo: 'tipo_despesa_id', valor: '' });
    expect(podeSalvar(s)).toBe(false);
  });

  it('erro ao carregar opções e tentar de novo', () => {
    const s = rodar({ tipo: 'opcoes_erro' });
    expect(s.fase).toBe('erro_opcoes');
    expect(rodar({ tipo: 'opcoes_erro' }, { tipo: 'recarregar' }).fase).toBe('carregando');
  });

  it('durante o envio, Salvar desabilitado e edição ignorada', () => {
    const s = rodar(preenchido, { tipo: 'opcoes_ok', tipos }, { tipo: 'salvar_inicio' });
    expect(s.fase).toBe('salvando');
    expect(podeSalvar(s)).toBe(false);
    expect(reduzir(s, { tipo: 'editar', campo: 'valor_despesa', valor: '9' }).campos.valor_despesa).toBe('1450');
  });

  it('erro do servidor vai para o campo, e nada de sucesso', () => {
    const s = rodar(preenchido, { tipo: 'opcoes_ok', tipos }, { tipo: 'salvar_inicio' }, {
      tipo: 'salvar_fim', resposta: { ok: false, erros: [{ campo: 'tipo_despesa_id', mensagem: 'Escolha o tipo da despesa' }] },
    });
    expect(s.fase).toBe('pronto');
    expect(s.erros.tipo_despesa_id).toBe('Escolha o tipo da despesa');
    expect(s.resumo).toBeNull();
  });

  it('erro geral (rede ou banco) aparece como mensagem geral', () => {
    const s = rodar(preenchido, { tipo: 'opcoes_ok', tipos }, { tipo: 'salvar_inicio' }, {
      tipo: 'salvar_fim', resposta: { ok: false, erros: [{ campo: null, mensagem: erros.inesperado }] },
    });
    expect(s.erroGeral).toBe(erros.inesperado);
    expect(s.fase).toBe('pronto');
  });

  it('editar o campo apaga o erro dele', () => {
    let s = rodar(preenchido, { tipo: 'opcoes_ok', tipos }, { tipo: 'erros_locais', erros: [{ campo: 'valor_despesa', mensagem: 'x' }] });
    s = reduzir(s, { tipo: 'editar', campo: 'valor_despesa', valor: '1400' });
    expect(s.erros.valor_despesa).toBeUndefined();
  });

  it('sucesso tranca o formulário: nenhuma ação muda mais nada (sem segundo Salvar)', () => {
    const s = rodar(preenchido, { tipo: 'opcoes_ok', tipos }, { tipo: 'salvar_inicio' }, {
      tipo: 'salvar_fim', resposta: { ok: true, ids: ['id-1'], resumo: 'Aluguel da sala, R$ 1.450, competência 15/11/2026' },
    });
    expect(s.fase).toBe('sucesso');
    expect(s.idSalvo).toBe('id-1');
    expect(reduzir(s, { tipo: 'salvar_inicio' })).toBe(s);
    expect(podeSalvar(s)).toBe(false);
  });

  it('a tela recusa 1450,50 com a mensagem do app (critério 2)', () => {
    const s = rodar(preenchido, { tipo: 'opcoes_ok', tipos }, { tipo: 'editar', campo: 'valor_despesa', valor: '1450,50' });
    expect(errosLocais(s)).toEqual([{ campo: 'valor_despesa', mensagem: 'Informe um valor inteiro, sem centavos. Ex: 200' }]);
  });

  it('candidatos ambíguos não pré-selecionam nada (11.15)', () => {
    const s = rodar({
      tipo: 'preenchimento',
      dados: { campos: { tipo_despesa_id: null, valor_despesa: '1450', data_competencia: '2026-11-15', descricao: '', observacoes: '' }, candidatos: tipos, avisos: ["'aluguel' casou com 2 tipos, escolha um"] },
    });
    expect(s.campos.tipo_despesa_id).toBe('');
    expect(s.candidatos).toEqual([TIPO]);
  });
});
