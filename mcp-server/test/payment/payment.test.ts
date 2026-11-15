import { describe, expect, it } from 'vitest';
import { gravarPagamentos, preencherPagamentos, registrarPagamentos, salvarPagamentos } from '../../src/tools/payment/index.js';
import { textoDosPagamentosParaOModelo, validarPagamentos } from '../../src/tools/payment/model.js';
import { ctxDeTeste, dbPorTabela } from '../helpers.js';

const BEA = '3f6c1a9e-1b2c-4d5e-8f90-000000000001';
const CAIO = '3f6c1a9e-1b2c-4d5e-8f90-000000000002';
const opcoes = [
  { id: BEA, nome: 'Beatriz Nogueira', preco_referencia: 280, ativo: true },
  { id: CAIO, nome: 'Caio Lemos', preco_referencia: null, ativo: true },
];
const view = { data: opcoes.map((o) => ({ paciente_id: o.id, nome_completo: o.nome, preco_vigente: o.preco_referencia, status: 'ativo' })), error: null };

describe('validarPagamentos (11.1, 11.3, 11.4)', () => {
  it('normaliza e mantém "por sessão" com acento', () => {
    expect(validarPagamentos([{ paciente_id: BEA, valor_pagamento: '280', data_competencia: '2026-11-14', tipo: 'por sessão' }])).toEqual({
      ok: true, dados: [{ paciente_id: BEA, valor_pagamento: 280, data_competencia: '2026-11-14', tipo: 'por sessão' }],
    });
  });
  it('centavos recusados com a mensagem do app; tipo desconhecido vira mensal', () => {
    expect(validarPagamentos([{ paciente_id: BEA, valor_pagamento: '280,50', data_competencia: '2026-11-14' }])).toEqual({
      ok: false, erros: [{ campo: '0.valor_pagamento', mensagem: 'Informe um valor inteiro, sem centavos. Ex: 200' }],
    });
    const r = validarPagamentos([{ paciente_id: BEA, valor_pagamento: '1', data_competencia: '2026-11-14', tipo: 'qualquer' }]);
    expect(r.ok && r.dados[0]?.tipo).toBe('mensal');
  });
});

describe('preencherPagamentos (11.11)', () => {
  it('valor dito vence; senão o preço de referência da view; senão vazio', () => {
    const p = preencherPagamentos({ itens: [{ paciente: 'beatriz', valor: 300 }, { paciente: 'beatriz' }, { paciente: 'caio' }] }, opcoes, '2026-11-15', 'f');
    expect(p.linhas.map((l) => [l.campos.valor_pagamento, l.campos.valor_origem])).toEqual([['300', 'frase'], ['280', 'referencia'], ['', 'nenhum']]);
    expect(p.linhas[0]?.campos.tipo).toBe('mensal');
  });
  it('oferta vinda das sessões: "por sessao" vira o literal "por sessão", data da sessão', () => {
    const p = preencherPagamentos({ itens: [{ paciente: 'Beatriz Nogueira', data: '2026-11-14', tipo: 'por sessao' }] }, opcoes, '2026-11-15', 'f');
    expect(p.linhas[0]?.campos).toEqual({ paciente_id: BEA, valor_pagamento: '280', valor_origem: 'referencia', data_competencia: '2026-11-14', tipo: 'por sessão' });
  });
  it('valor com centavos dito não é aceito: cai na referência', () => {
    const p = preencherPagamentos({ itens: [{ paciente: 'beatriz', valor: 280.5 }] }, opcoes, '2026-11-15', 'f');
    expect(p.linhas[0]?.campos.valor_origem).toBe('referencia');
  });
});

describe('gravarPagamentos (P4: como useCriarPagamento)', () => {
  it('colunas exatas do app: status pago, pago_em agora, observacoes null', async () => {
    const { db, chamadas } = dbPorTabela({ v_pacientes_cartao: view, pagamentos: { data: { id: 'pg1' }, error: null } });
    const antes = Date.now();
    const r = await gravarPagamentos([{ paciente_id: BEA, valor_pagamento: 280, data_competencia: '2026-11-14', tipo: 'por sessão' }], ctxDeTeste(db, { sub: 'u1' }));
    expect(r).toEqual({ ok: true, ids: ['pg1'], titulo: 'Pagamento registrado.', resumo: 'Beatriz Nogueira, R$ 280, 14/11/2026, Por sessão' });
    const l = chamadas.find((c) => c.metodo === 'insert')?.args[0] as Record<string, unknown>;
    expect(Object.keys(l).sort()).toEqual(['data_competencia', 'observacoes', 'paciente_id', 'pago_em', 'status', 'tipo', 'usuario_id', 'valor_pagamento']);
    expect(l).toMatchObject({ usuario_id: 'u1', paciente_id: BEA, valor_pagamento: 280, data_competencia: '2026-11-14', status: 'pago', tipo: 'por sessão', observacoes: null });
    expect(Date.parse(l.pago_em as string)).toBeGreaterThanOrEqual(antes - 1000);
  });
  it('vários: plural; falha parcial diz o que faltou', async () => {
    const ok = await gravarPagamentos([
      { paciente_id: BEA, valor_pagamento: 280, data_competencia: '2026-11-14', tipo: 'mensal' },
      { paciente_id: CAIO, valor_pagamento: 250, data_competencia: '2026-11-14', tipo: 'mensal' },
    ], ctxDeTeste(dbPorTabela({ v_pacientes_cartao: view, pagamentos: [{ data: { id: 'a' }, error: null }, { data: { id: 'b' }, error: null }] }).db));
    expect(ok).toMatchObject({ ok: true, titulo: 'Pagamentos registrados.' });
    const parcial = await gravarPagamentos([
      { paciente_id: BEA, valor_pagamento: 280, data_competencia: '2026-11-14', tipo: 'mensal' },
      { paciente_id: CAIO, valor_pagamento: 250, data_competencia: '2026-11-14', tipo: 'mensal' },
    ], ctxDeTeste(dbPorTabela({ v_pacientes_cartao: view, pagamentos: [{ data: { id: 'a' }, error: null }, { data: null, error: { message: 'x' } }] }).db));
    expect(parcial).toMatchObject({ ok: false, ids: ['a'], gravadas: [0], resumo: 'Beatriz Nogueira, R$ 280, 14/11/2026, Mensal', erros: [{ campo: null, mensagem: 'Estas não foram gravadas: Caio Lemos, R$ 250, 14/11/2026, Mensal. As outras foram.' }] });
  });
  it('salvar com valor inválido não toca no banco', async () => {
    const { db, chamadas } = dbPorTabela({});
    expect((await salvarPagamentos({ pagamentos: [{ paciente_id: BEA, valor_pagamento: '0', data_competencia: '2026-11-14' }] }, ctxDeTeste(db))).ok).toBe(false);
    expect(chamadas).toEqual([]);
  });
  it('texto para o modelo', () => {
    expect(textoDosPagamentosParaOModelo('r', ['a', 'b'])).toBe('Pagamentos registrados: r (ids a, b).');
  });
});

describe('registrar_pagamentos (13.4)', () => {
  it('prévia avisa que o valor veio do cadastro; confirmar grava', async () => {
    const banco = () => dbPorTabela({ v_pacientes_cartao: view, pagamentos: { data: { id: 'pg9' }, error: null } });
    const p = await registrarPagamentos({ itens: [{ paciente: 'beatriz', data: '2026-11-14' }] }, ctxDeTeste(banco().db));
    const s = p.structuredContent as { previa: { pagamentos: Array<{ valor: string; valor_sugerido_pelo_cadastro: boolean }> }; token_previa: string };
    expect(s.previa.pagamentos[0]).toMatchObject({ valor: 'R$ 280', valor_sugerido_pelo_cadastro: true });
    const g = banco();
    const r = await registrarPagamentos({ itens: [{ paciente: 'beatriz', data: '2026-11-14' }], confirmar: true, token_previa: s.token_previa }, ctxDeTeste(g.db));
    expect(r.isError).toBeUndefined();
    expect(g.chamadas.some((c) => c.metodo === 'insert')).toBe(true);
  });
  it('sem preço de referência e sem valor: erro de valor, sem token', async () => {
    const r = await registrarPagamentos({ itens: [{ paciente: 'caio' }] }, ctxDeTeste(dbPorTabela({ v_pacientes_cartao: view }).db));
    expect(r.isError).toBe(true);
    expect(r.structuredContent).toMatchObject({ erros: [{ campo: '0.valor_pagamento' }] });
  });
});
