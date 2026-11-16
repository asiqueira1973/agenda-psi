import { describe, expect, it } from 'vitest';
import { conferirTokenDePrevia, emitirTokenDePrevia, jsonCanonico } from '../../src/preview-token.js';
import { erros } from '../../src/rules/messages.js';
import { registrarDespesa } from '../../src/tools/expense/fallback.js';
import { ctxDeTeste, dbPorTabela } from '../helpers.js';

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';
const A1 = '3f6c1a9e-1b2c-4d5e-8f90-000000000001';
const A2 = '3f6c1a9e-1b2c-4d5e-8f90-000000000002';
const tipos = { data: [{ id: A1, nome: 'Aluguel da sala' }, { id: A2, nome: 'Aluguel de equipamento' }], error: null };
const ID = '9a8b7c6d-0000-4000-8000-000000000001';

/** Banco com o catálogo e, se gravar, o tipo conferido e o insert. */
function banco() {
  return dbPorTabela({
    tipos_despesa: [tipos, { data: { id: A1, nome: 'Aluguel da sala' }, error: null }],
    despesas: { data: { id: ID }, error: null },
  });
}
const entrada = { tipo: 'aluguel da sala', valor: 1450, data: '2026-11-15' };
const gravou = (chamadas: Array<{ metodo: string }>) => chamadas.some((c) => c.metodo === 'insert');

describe('token_previa (13.4)', () => {
  const dados = { a: 1, b: 'x' };
  it('JSON canônico independe da ordem das chaves', () => {
    expect(jsonCanonico({ b: 'x', a: 1 })).toBe(jsonCanonico({ a: 1, b: 'x' }));
  });
  it('confere o próprio token; recusa outro sub, outra ação, outros dados, adulterado e vencido', () => {
    const agora = 1_800_000_000;
    const t = emitirTokenDePrevia(SEGREDO, 'sub', 'acao', dados, agora);
    expect(conferirTokenDePrevia(SEGREDO, 'sub', 'acao', dados, t, agora)).toBe('ok');
    expect(conferirTokenDePrevia(SEGREDO, 'outro', 'acao', dados, t, agora)).toBe('divergente');
    expect(conferirTokenDePrevia(SEGREDO, 'sub', 'outra', dados, t, agora)).toBe('divergente');
    expect(conferirTokenDePrevia(SEGREDO, 'sub', 'acao', { ...dados, a: 2 }, t, agora)).toBe('divergente');
    const adulterado = t.slice(0, -1) + (t.endsWith('0') ? '1' : '0');
    expect(conferirTokenDePrevia(SEGREDO, 'sub', 'acao', dados, adulterado, agora)).toBe('divergente');
    // Esticar o exp também quebra o HMAC.
    const [exp, mac] = t.split('.');
    expect(conferirTokenDePrevia(SEGREDO, 'sub', 'acao', dados, `${Number(exp) + 9999}.${mac}`, agora)).toBe('divergente');
    expect(conferirTokenDePrevia(SEGREDO, 'sub', 'acao', dados, t, agora + 601)).toBe('vencido');
    expect(conferirTokenDePrevia(SEGREDO, 'sub', 'acao', dados, 'lixo', agora)).toBe('malformado');
  });
});

describe('registrar_despesa (13.4, 8.2 critério 7)', () => {
  it('chamada 1: prévia com rótulos em português e token, sem gravar', async () => {
    const { db, chamadas } = banco();
    const r = await registrarDespesa(entrada, ctxDeTeste(db, { ui: 'nao' }));
    expect(r.isError).toBeUndefined();
    const s = r.structuredContent as { previa: unknown; pendencias: unknown[]; token_previa: string };
    expect(s.previa).toEqual({ tipo: 'Aluguel da sala', valor: 'R$ 1.450', data: '15/11/2026', descricao: null, observacoes: null });
    expect(s.pendencias).toEqual([]);
    expect(s.token_previa).toMatch(/^\d+\.[0-9a-f]{64}$/);
    expect(gravou(chamadas)).toBe(false);
  });

  it('chamada 2 com o token e os mesmos dados: grava', async () => {
    const p = banco();
    const token = ((await registrarDespesa(entrada, ctxDeTeste(p.db))).structuredContent as { token_previa: string }).token_previa;
    const g = banco();
    const r = await registrarDespesa({ ...entrada, confirmar: true, token_previa: token }, ctxDeTeste(g.db));
    expect(r.isError).toBeUndefined();
    expect(r.structuredContent).toMatchObject({ ok: true, ids: [ID] });
    expect(gravou(g.chamadas)).toBe(true);
  });

  it('dados mudados depois da prévia: não grava e pede nova prévia', async () => {
    const token = ((await registrarDespesa(entrada, ctxDeTeste(banco().db))).structuredContent as { token_previa: string }).token_previa;
    const g = banco();
    const r = await registrarDespesa({ ...entrada, valor: 1500, confirmar: true, token_previa: token }, ctxDeTeste(g.db));
    expect(r.isError).toBe(true);
    expect((r.content[0] as { text: string }).text).toBe(erros.dadosMudaram);
    expect(gravou(g.chamadas)).toBe(false);
  });

  it('token adulterado ou ausente: não grava', async () => {
    const token = ((await registrarDespesa(entrada, ctxDeTeste(banco().db))).structuredContent as { token_previa: string }).token_previa;
    for (const t of [token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a'), undefined, 'qualquer']) {
      const g = banco();
      const r = await registrarDespesa({ ...entrada, confirmar: true, token_previa: t }, ctxDeTeste(g.db));
      expect(r.isError).toBe(true);
      expect(gravou(g.chamadas)).toBe(false);
    }
  });

  it('token de outra pessoa não serve', async () => {
    const token = ((await registrarDespesa(entrada, ctxDeTeste(banco().db, { sub: 'a' }))).structuredContent as { token_previa: string }).token_previa;
    const g = banco();
    const r = await registrarDespesa({ ...entrada, confirmar: true, token_previa: token }, ctxDeTeste(g.db, { sub: 'b' }));
    expect(r.isError).toBe(true);
    expect(gravou(g.chamadas)).toBe(false);
  });

  it('tipo ambíguo vira pendência, sem token; confirmar com pendência é recusado', async () => {
    const r = await registrarDespesa({ ...entrada, tipo: 'aluguel' }, ctxDeTeste(banco().db));
    const s = r.structuredContent as { pendencias: Array<{ opcoes: Array<{ id: string }> }>; token_previa?: string };
    expect(s.pendencias[0]?.opcoes.map((o) => o.id)).toEqual([A1, A2]);
    expect(s.token_previa).toBeUndefined();

    const g = banco();
    const c = await registrarDespesa({ ...entrada, tipo: 'aluguel', confirmar: true, token_previa: 'x' }, ctxDeTeste(g.db));
    expect((c.content[0] as { text: string }).text).toBe(erros.pendenciasAbertas);
    expect(gravou(g.chamadas)).toBe(false);
  });

  it('escolher pelo tipo_despesa_id resolve a pendência', async () => {
    const r = await registrarDespesa({ tipo_despesa_id: A2, valor: 300 }, ctxDeTeste(banco().db));
    expect((r.structuredContent as { previa: { tipo: string } }).previa.tipo).toBe('Aluguel de equipamento');
  });

  it('valor com centavos: erro, sem token', async () => {
    const r = await registrarDespesa({ ...entrada, valor: 1450.5 }, ctxDeTeste(banco().db));
    expect(r.isError).toBe(true);
    expect(r.structuredContent).toMatchObject({ erros: [{ campo: 'valor_despesa' }] });
  });
});
