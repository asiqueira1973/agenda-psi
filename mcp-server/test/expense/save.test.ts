import { describe, expect, it, vi } from 'vitest';
import { enviarEvento } from '../../src/analytics.js';
import { erros, mensagensDoApp } from '../../src/rules/messages.js';
import { salvarDespesa } from '../../src/tools/expense/save.js';
import { ctxDeTeste, dbPorTabela } from '../helpers.js';

const TIPO = '3f6c1a9e-1b2c-4d5e-8f90-123456789abc';
const ID = '9a8b7c6d-0000-4000-8000-000000000001';
const entrada = { tipo_despesa_id: TIPO, valor_despesa: '1450', data_competencia: '2026-11-15', descricao: 'Teste MCP', observacoes: '' };
const tipoOk = { data: { id: TIPO, nome: 'Aluguel da sala' }, error: null };
const insertOk = { data: { id: ID }, error: null };

describe('salvar_despesa (8.2, P3 e P4)', () => {
  it('grava as MESMAS colunas do app, com usuario_id do token, status pago e pago_em agora', async () => {
    const { db, chamadas } = dbPorTabela({ tipos_despesa: tipoOk, despesas: insertOk });
    const antes = Date.now();
    const r = await salvarDespesa(entrada, ctxDeTeste(db, { sub: 'sub-do-token' }));
    expect(r).toEqual({ ok: true, ids: [ID], resumo: 'Aluguel da sala, R$ 1.450, competência 15/11/2026' });

    const insert = chamadas.find((c) => c.metodo === 'insert');
    const linha = insert?.args[0] as Record<string, unknown>;
    expect(Object.keys(linha).sort()).toEqual(
      ['data_competencia', 'descricao', 'observacoes', 'pago_em', 'status', 'tipo_despesa_id', 'usuario_id', 'valor_despesa'],
    );
    expect(linha).toMatchObject({
      usuario_id: 'sub-do-token', tipo_despesa_id: TIPO, valor_despesa: 1450, data_competencia: '2026-11-15',
      status: 'pago', descricao: 'Teste MCP', observacoes: null,
    });
    expect(Date.parse(linha.pago_em as string)).toBeGreaterThanOrEqual(antes - 1000);
  });

  it('o tipo é conferido no catálogo antes do insert, pelo id', async () => {
    const { db, chamadas } = dbPorTabela({ tipos_despesa: tipoOk, despesas: insertOk });
    await salvarDespesa(entrada, ctxDeTeste(db));
    expect(chamadas).toContainEqual({ tabela: 'tipos_despesa', metodo: 'eq', args: ['id', TIPO] });
  });

  it('tipo inexistente ou inativo (a policy não mostra): erro de campo, sem insert (critério 4)', async () => {
    const { db, chamadas } = dbPorTabela({ tipos_despesa: { data: null, error: null }, despesas: insertOk });
    const r = await salvarDespesa(entrada, ctxDeTeste(db));
    expect(r).toEqual({ ok: false, erros: [{ campo: 'tipo_despesa_id', mensagem: mensagensDoApp.tipoDeDespesaNaoEscolhido }] });
    expect(chamadas.some((c) => c.metodo === 'insert')).toBe(false);
  });

  it('sem tipo: erro de campo e NADA vai ao banco (critério 3)', async () => {
    const { db, chamadas } = dbPorTabela({});
    const r = await salvarDespesa({ ...entrada, tipo_despesa_id: undefined }, ctxDeTeste(db));
    expect(r.ok === false && r.erros[0]?.campo).toBe('tipo_despesa_id');
    expect(chamadas).toEqual([]);
  });

  it('1450,50 é recusado no servidor também (critério 2)', async () => {
    const { db, chamadas } = dbPorTabela({});
    const r = await salvarDespesa({ ...entrada, valor_despesa: '1450,50' }, ctxDeTeste(db));
    expect(r).toEqual({ ok: false, erros: [{ campo: 'valor_despesa', mensagem: 'Informe um valor inteiro, sem centavos. Ex: 200' }] });
    expect(chamadas).toEqual([]);
  });

  it('erro do banco no insert vira a mensagem geral, nunca o texto do Postgres', async () => {
    const { db } = dbPorTabela({
      tipos_despesa: tipoOk,
      despesas: { data: null, error: { code: '23503', message: 'insert or update on table "despesas" violates foreign key constraint' } },
    });
    expect(await salvarDespesa(entrada, ctxDeTeste(db))).toEqual({ ok: false, erros: [{ campo: null, mensagem: erros.inesperado }] });
  });

  it('violação de RLS vira "Registro não encontrado ou sem permissão."', async () => {
    const { db } = dbPorTabela({ tipos_despesa: tipoOk, despesas: { data: null, error: { code: '42501', message: 'rls' } } });
    expect(await salvarDespesa(entrada, ctxDeTeste(db))).toEqual({ ok: false, erros: [{ campo: null, mensagem: erros.semPermissao }] });
  });

  it('exceção inesperada vira a mensagem geral', async () => {
    const db = { from() { throw new Error('rede caiu'); } } as never;
    expect(await salvarDespesa(entrada, ctxDeTeste(db))).toEqual({ ok: false, erros: [{ campo: null, mensagem: erros.inesperado }] });
  });
});

describe('evento agenda_psi_novadespesa (21)', () => {
  const evento = { nome: 'agenda_psi_novadespesa', id: ID, distinctId: 'psi@exemplo.com', tela: 'mcp_despesa', descricao: 'nova despesa criada' } as const;

  it('mesmo contrato do app: id do registro, e-mail, tela mcp_despesa e propriedades vazias', async () => {
    const f = vi.fn(async () => new Response(null, { status: 200 }));
    await enviarEvento({ analytics: { url: 'https://vp.exemplo/ingest', key: 'chave-publica' } }, evento, f as never);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://vp.exemplo/ingest');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('chave-publica');
    const corpo = JSON.parse(init.body as string);
    expect(corpo.eventos[0]).toMatchObject({
      id: ID, nome: 'agenda_psi_novadespesa', distinct_id: 'psi@exemplo.com', tela: 'mcp_despesa',
      descricao: 'nova despesa criada', propriedades: {},
    });
  });

  it('falha do analytics nunca quebra a gravação', async () => {
    const f = vi.fn(async () => { throw new Error('fora do ar'); });
    await expect(enviarEvento({ analytics: { url: 'https://x', key: 'k' } }, evento, f as never)).resolves.toBeUndefined();
  });

  it('sem chave configurada, não envia nada', async () => {
    const f = vi.fn();
    await enviarEvento({ analytics: null }, evento, f as never);
    expect(f).not.toHaveBeenCalled();
  });
});
