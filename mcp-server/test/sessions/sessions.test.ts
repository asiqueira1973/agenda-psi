import { describe, expect, it } from 'vitest';
import { conferirTokenDePrevia } from '../../src/preview-token.js';
import { erros } from '../../src/rules/messages.js';
import { gravarSessoes, preencherSessoes, registrarSessoes, salvarSessoes } from '../../src/tools/sessions/index.js';
import { textoDasSessoesParaOModelo, validarSessoes } from '../../src/tools/sessions/model.js';
import { estadoInicialDeLinhas, reduzirLinhas } from '../../ui/shared/linhas.js';
import { ctxDeTeste, dbPorTabela } from '../helpers.js';

const BEA = '3f6c1a9e-1b2c-4d5e-8f90-000000000001';
const CAIO = '3f6c1a9e-1b2c-4d5e-8f90-000000000002';
const HEL1 = '3f6c1a9e-1b2c-4d5e-8f90-000000000003';
const HEL2 = '3f6c1a9e-1b2c-4d5e-8f90-000000000004';
const opcoes = [
  { id: BEA, nome: 'Beatriz Nogueira', preco_referencia: 280, ativo: true },
  { id: CAIO, nome: 'Caio Lemos', preco_referencia: 250, ativo: true },
  { id: HEL1, nome: 'Helena Prado', preco_referencia: null, ativo: true },
  { id: HEL2, nome: 'Helena Souza', preco_referencia: null, ativo: false },
];
const view = { data: opcoes.map((o) => ({ paciente_id: o.id, nome_completo: o.nome, preco_vigente: o.preco_referencia, status: o.ativo ? 'ativo' : 'inativo' })), error: null };
const linha = (paciente_id: string, extra: Record<string, unknown> = {}) => ({ paciente_id, ocorreu_em_dia: '2026-11-14', pagamento: 'pagou', modalidade: 'presencial', duracao_minutos: '50', devesercobrada: true, ...extra });

describe('validarSessoes (11.3, 11.4, 11.8, 11.14)', () => {
  it('padrões do app: pagamento mensal, presencial, 50, cobrada', () => {
    expect(validarSessoes([{ paciente_id: BEA, ocorreu_em_dia: '2026-11-14' }])).toEqual({
      ok: true, dados: [{ paciente_id: BEA, ocorreu_em_dia: '2026-11-14', pagamento: 'pagamento mensal', modalidade: 'presencial', duracao_minutos: 50, devesercobrada: true }],
    });
  });
  it('literais do banco intactos: "nao pagou" sem acento', () => {
    const r = validarSessoes([linha(BEA, { pagamento: 'nao pagou' })]);
    expect(r.ok && r.dados[0]?.pagamento).toBe('nao pagou');
  });
  it('duração fora de 1–600 volta a 50 (11.8, como o agente)', () => {
    for (const d of ['0', '601', 'abc']) {
      const r = validarSessoes([linha(BEA, { duracao_minutos: d })]);
      expect(r.ok && r.dados[0]?.duracao_minutos).toBe(50);
    }
  });
  it('erros por linha: paciente e data', () => {
    expect(validarSessoes([linha(''), linha(BEA, { ocorreu_em_dia: '2026-02-31' })])).toEqual({
      ok: false, erros: [{ campo: '0.paciente_id', mensagem: 'Escolha o paciente' }, { campo: '1.ocorreu_em_dia', mensagem: 'Informe uma data válida' }],
    });
  });
});

describe('preencherSessoes (8.5)', () => {
  it('"atendi a Beatriz e a Helena ontem": Beatriz preenchida; Helena ambígua fica vazia, com candidatos e o aviso do app', () => {
    const p = preencherSessoes({ itens: [{ paciente: 'beatriz', data: '2026-11-14', pagamento: 'pagou' }, { paciente: 'helena', data: '2026-11-14' }] }, opcoes, '2026-11-15', 'f1');
    expect(p.linhas[0]?.campos).toEqual({ paciente_id: BEA, ocorreu_em_dia: '2026-11-14', pagamento: 'pagou', modalidade: 'presencial', duracao_minutos: '50', devesercobrada: true });
    expect(p.linhas[1]?.campos.paciente_id).toBe('');
    expect(p.linhas[1]?.campos.pagamento).toBe('pagamento mensal');
    expect(p.linhas[1]?.paciente.candidatos.map((c) => c.id)).toEqual([HEL1, HEL2]);
    expect(p.avisos).toEqual(['Escolha qual "helena"']);
  });
  it('sem itens: uma linha vazia com a data de hoje', () => {
    const p = preencherSessoes({}, opcoes, '2026-11-15', 'f1');
    expect(p.linhas).toHaveLength(1);
    expect(p.linhas[0]?.campos.ocorreu_em_dia).toBe('2026-11-15');
  });
});

describe('gravarSessoes (P4: como useCriarSessao)', () => {
  it('colunas exatas do app: sem status e sem ocorreu_em; observacoes null; usuario_id do token', async () => {
    const { db, chamadas } = dbPorTabela({ v_pacientes_cartao: view, sessoes: { data: { id: 's1' }, error: null } });
    const r = await gravarSessoes([{ paciente_id: BEA, ocorreu_em_dia: '2026-11-14', pagamento: 'nao pagou', modalidade: 'remota', duracao_minutos: 45, devesercobrada: false }], ctxDeTeste(db, { sub: 'u1' }));
    expect(r).toMatchObject({ ok: true, ids: ['s1'], titulo: 'Sessão registrada.', resumo: 'Beatriz Nogueira, 14/11/2026, Não pagou', pagas: [] });
    const linhaGravada = chamadas.find((c) => c.metodo === 'insert')?.args[0] as Record<string, unknown>;
    expect(linhaGravada).toEqual({ usuario_id: 'u1', paciente_id: BEA, ocorreu_em_dia: '2026-11-14', modalidade: 'remota', duracao_minutos: 45, pagamento: 'nao pagou', devesercobrada: false, observacoes: null });
  });
  it('várias: título no plural e as "Pagou" para a oferta de pagamento (11.18)', async () => {
    const { db } = dbPorTabela({ v_pacientes_cartao: view, sessoes: [{ data: { id: 's1' }, error: null }, { data: { id: 's2' }, error: null }] });
    const r = await gravarSessoes([
      { paciente_id: BEA, ocorreu_em_dia: '2026-11-14', pagamento: 'pagou', modalidade: 'presencial', duracao_minutos: 50, devesercobrada: true },
      { paciente_id: CAIO, ocorreu_em_dia: '2026-11-14', pagamento: 'pagamento mensal', modalidade: 'presencial', duracao_minutos: 50, devesercobrada: true },
    ], ctxDeTeste(db));
    expect(r).toMatchObject({ ok: true, ids: ['s1', 's2'], titulo: 'Sessões registradas.', pagas: ['Beatriz Nogueira (14/11/2026)'] });
  });
  it('falha na segunda: a primeira fica, e a resposta diz o que faltou (8.5)', async () => {
    const { db } = dbPorTabela({ v_pacientes_cartao: view, sessoes: [{ data: { id: 's1' }, error: null }, { data: null, error: { message: 'x' } }] });
    const r = await gravarSessoes([
      { paciente_id: BEA, ocorreu_em_dia: '2026-11-14', pagamento: 'pagou', modalidade: 'presencial', duracao_minutos: 50, devesercobrada: true },
      { paciente_id: CAIO, ocorreu_em_dia: '2026-11-14', pagamento: 'pagou', modalidade: 'presencial', duracao_minutos: 50, devesercobrada: true },
    ], ctxDeTeste(db));
    expect(r).toEqual({ ok: false, ids: ['s1'], gravadas: [0], erros: [{ campo: null, mensagem: 'Estas não foram gravadas: Caio Lemos, 14/11/2026, Pagou. As outras foram.' }] });
  });
  it('paciente que não é da pessoa (fora da RLS): erro de campo, nada gravado', async () => {
    const { db, chamadas } = dbPorTabela({ v_pacientes_cartao: view });
    const r = await gravarSessoes([{ paciente_id: '3f6c1a9e-1b2c-4d5e-8f90-0000000000ff', ocorreu_em_dia: '2026-11-14', pagamento: 'pagou', modalidade: 'presencial', duracao_minutos: 50, devesercobrada: true }], ctxDeTeste(db));
    expect(r).toMatchObject({ ok: false, erros: [{ campo: '0.paciente_id', mensagem: 'Escolha o paciente' }] });
    expect(chamadas.some((c) => c.metodo === 'insert')).toBe(false);
  });
  it('erro na primeira: mensagem geral, sem texto do Postgres', async () => {
    const { db } = dbPorTabela({ v_pacientes_cartao: view, sessoes: { data: null, error: { message: 'violates foreign key' } } });
    const r = await gravarSessoes([{ paciente_id: BEA, ocorreu_em_dia: '2026-11-14', pagamento: 'pagou', modalidade: 'presencial', duracao_minutos: 50, devesercobrada: true }], ctxDeTeste(db));
    expect(r).toEqual({ ok: false, ids: [], gravadas: [], erros: [{ campo: null, mensagem: erros.inesperado }] });
  });
  it('salvar sem paciente não toca no banco', async () => {
    const { db, chamadas } = dbPorTabela({});
    expect((await salvarSessoes({ sessoes: [linha('')] }, ctxDeTeste(db))).ok).toBe(false);
    expect(chamadas).toEqual([]);
  });
  it('texto para o modelo no padrão aprovado', () => {
    expect(textoDasSessoesParaOModelo('Beatriz Nogueira, 14/11/2026, Pagou', ['s1'])).toBe('Sessão registrada: Beatriz Nogueira, 14/11/2026, Pagou (id s1).');
  });
});

describe('registrar_sessoes (13.4)', () => {
  const banco = () => dbPorTabela({ v_pacientes_cartao: view, sessoes: { data: { id: 's9' }, error: null } });
  it('ambíguo vira pendência, sem token; escolher por paciente_id resolve', async () => {
    const r = await registrarSessoes({ itens: [{ paciente: 'helena', data: '2026-11-14' }] }, ctxDeTeste(banco().db));
    expect(r.isError).toBe(true);
    expect(r.structuredContent).toMatchObject({ pendencias: [{ item: 0, aviso: 'Escolha qual "helena"' }] });
    const ok = await registrarSessoes({ itens: [{ paciente_id: HEL1, data: '2026-11-14' }] }, ctxDeTeste(banco().db));
    expect((ok.structuredContent as { previa: { sessoes: Array<{ paciente: string }> } }).previa.sessoes[0]?.paciente).toBe('Helena Prado');
  });
  it('prévia → token → confirma e grava; token amarra os dados normalizados', async () => {
    const p = await registrarSessoes({ itens: [{ paciente: 'beatriz', data: '2026-11-14', pagamento: 'pagou' }] }, ctxDeTeste(banco().db));
    const token = (p.structuredContent as { token_previa: string }).token_previa;
    expect(conferirTokenDePrevia('segredo-de-teste-com-mais-de-32-caracteres', 'usuario-do-token', 'registrar_sessoes',
      [{ paciente_id: BEA, ocorreu_em_dia: '2026-11-14', pagamento: 'pagou', modalidade: 'presencial', duracao_minutos: 50, devesercobrada: true }], token)).toBe('ok');
    const g = banco();
    const r = await registrarSessoes({ itens: [{ paciente: 'beatriz', data: '2026-11-14', pagamento: 'pagou' }], confirmar: true, token_previa: token }, ctxDeTeste(g.db));
    expect((r.content[0] as { text: string }).text).toBe('Sessão registrada: Beatriz Nogueira, 14/11/2026, Pagou (id s9).');
    expect(g.chamadas.some((c) => c.metodo === 'insert')).toBe(true);
  });
});

describe('estado de várias linhas (12)', () => {
  type L = { paciente_id: string };
  const comLinhas = () => reduzirLinhas(reduzirLinhas(estadoInicialDeLinhas<L>(), { tipo: 'preenchimento', linhas: [{ paciente_id: 'a' }, { paciente_id: 'b' }], candidatos: [[], []], avisos: [] }), { tipo: 'opcoes_ok' });
  it('falha parcial: as gravadas saem, só as que faltaram ficam', () => {
    let s = reduzirLinhas(comLinhas(), { tipo: 'salvar_inicio' });
    s = reduzirLinhas(s, { tipo: 'salvar_erro', erros: [{ campo: null, mensagem: 'faltou b' }], gravadas: [0] });
    expect(s.fase).toBe('pronto');
    expect(s.linhas).toEqual([{ paciente_id: 'b' }]);
    expect(s.erroGeral).toBe('faltou b');
  });
  it('sucesso tranca e guarda o extra (oferta de pagamento)', () => {
    let s = reduzirLinhas(comLinhas(), { tipo: 'salvar_inicio' });
    s = reduzirLinhas(s, { tipo: 'salvar_ok', titulo: 'Sessões registradas.', resumo: 'r', extra: ['Beatriz (14/11/2026)'] });
    expect(s.fase).toBe('sucesso');
    expect(reduzirLinhas(s, { tipo: 'cancelar' })).toBe(s);
    expect(s.extra).toEqual(['Beatriz (14/11/2026)']);
  });
});
