import { describe, expect, it } from 'vitest';
import { gravarFeedback, preencherFeedback, registrarFeedback, salvarFeedback } from '../../src/tools/feedback/index.js';
import { textoDoFeedback, validarFeedback } from '../../src/tools/feedback/model.js';
import { ctxDeTeste, dbPorTabela } from '../helpers.js';

describe('validarFeedback (8.10, 11.21)', () => {
  it('mensagem obrigatória com o texto do app; categoria desconhecida vira problema; corta em 2000', () => {
    expect(validarFeedback({ categoria: 'problema', mensagem: '  ' })).toEqual({ ok: false, erros: [{ campo: 'mensagem', mensagem: 'Escreva a mensagem' }] });
    expect(validarFeedback({ categoria: 'x', mensagem: ' a ' })).toEqual({ ok: true, dados: { categoria: 'problema', mensagem: 'a' } });
    const r = validarFeedback({ categoria: 'elogio', mensagem: 'a'.repeat(2500) });
    expect(r.ok && r.dados.mensagem.length).toBe(2000);
  });
  it('prefixo do agente com a origem "via conector"', () => {
    expect(textoDoFeedback({ categoria: 'sugestao', mensagem: 'Exportar em PDF' })).toBe('[Sugestão · via conector] Exportar em PDF');
  });
  it('preenche com a categoria e as palavras da pessoa', () => {
    expect(preencherFeedback({ mensagem: ' Travou ' }, 'f')).toEqual({ formulario_id: 'f', campos: { categoria: 'problema', mensagem: 'Travou' } });
  });
});

describe('gravarFeedback (P4: como useEnviarFeedback)', () => {
  it('colunas do app, e-mail do token; avisa notifica-admin só com tipo e id (pegadinha 3)', async () => {
    const { db, chamadas } = dbPorTabela({ feedback: { data: { id: 42 }, error: null } });
    const r = await gravarFeedback({ categoria: 'elogio', mensagem: 'Ótimo' }, ctxDeTeste(db, { email: 'psi@x.com' }));
    expect(r).toEqual({ ok: true, ids: ['42'], resumo: '[Elogio · via conector] Ótimo', titulo: 'Obrigado. Sua mensagem chegou.' });
    expect(chamadas.find((c) => c.metodo === 'insert')?.args[0]).toEqual({ mensagem: '[Elogio · via conector] Ótimo', email: 'psi@x.com', app_name: 'agenda_psi' });
    expect(chamadas.find((c) => c.metodo === 'invoke')).toEqual({ tabela: 'functions:notifica-admin', metodo: 'invoke', args: [{ body: { tipo: 'feedback', referencia: '42' } }] });
  });
  it('falha do aviso não derruba o feedback já gravado', async () => {
    const { db } = dbPorTabela({ feedback: { data: { id: 7 }, error: null }, 'functions:notifica-admin': { data: null, error: new Error('x') } });
    expect((await gravarFeedback({ categoria: 'problema', mensagem: 'a' }, ctxDeTeste(db))).ok).toBe(true);
  });
  it('falha ao gravar: erro, sem aviso', async () => {
    const { db, chamadas } = dbPorTabela({ feedback: { data: null, error: { message: 'x' } } });
    expect((await gravarFeedback({ categoria: 'problema', mensagem: 'a' }, ctxDeTeste(db))).ok).toBe(false);
    expect(chamadas.some((c) => c.metodo === 'invoke')).toBe(false);
  });
  it('salvar vazio não toca no banco', async () => {
    const { db, chamadas } = dbPorTabela({});
    expect((await salvarFeedback({ feedback: { mensagem: '' } }, ctxDeTeste(db))).ok).toBe(false);
    expect(chamadas).toEqual([]);
  });
});

describe('registrar_feedback (13.4)', () => {
  it('prévia mostra o texto que será gravado; confirmar grava', async () => {
    const p = await registrarFeedback({ categoria: 'problema', mensagem: 'Travou' }, ctxDeTeste(dbPorTabela({}).db));
    const s = p.structuredContent as { previa: { texto: string }; token_previa: string };
    expect(s.previa.texto).toBe('[Problema · via conector] Travou');
    const g = dbPorTabela({ feedback: { data: { id: 9 }, error: null } });
    const r = await registrarFeedback({ categoria: 'problema', mensagem: 'Travou', confirmar: true, token_previa: s.token_previa }, ctxDeTeste(g.db));
    expect(r.isError).toBeUndefined();
    expect(r.content[0]).toMatchObject({ text: 'Feedback enviado à equipe do Agenda Psi (id 9).' });
  });
});
