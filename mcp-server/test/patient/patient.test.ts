import { describe, expect, it } from 'vitest';
import { gravarPaciente, preencherPaciente, registrarPaciente, salvarPaciente } from '../../src/tools/patient/index.js';
import { textoDoPacienteParaOModelo, validarPaciente } from '../../src/tools/patient/model.js';
import { ctxDeTeste, dbPorTabela } from '../helpers.js';

const agenda = [{ id: 'h1', paciente_nome: 'Caio Lemos', dia_semana: 3, hora_inicio: '10:30:00', hora_fim: '11:20:00' }];
const base = { nome: ' Laura Mendes ', telefone: ' (11) 98888-7777 ', email: '', preco: '200', receber_sms: true, horarios: [] };
const normal = { nome_completo: 'Laura Mendes', telefone: '(11) 98888-7777', email: null, preco: 200, receber_sms: true, horarios: [{ dia_semana: 3, hora_inicio: '10:00', hora_fim: '10:50' }] };

describe('validarPaciente (como a tela Novo paciente do app)', () => {
  it('trim no nome e no telefone, telefone sem normalizar (11.13), e-mail vazio vira null', () => {
    expect(validarPaciente(base)).toEqual({ ok: true, dados: { ...normal, horarios: [] } });
  });
  it('mensagens do app para nome, telefone, e-mail e preço', () => {
    const r = validarPaciente({ nome: ' ', telefone: '', email: 'x@', preco: '200,00' });
    expect(r).toEqual({ ok: false, erros: [
      { campo: 'nome', mensagem: 'O nome é obrigatório' },
      { campo: 'telefone', mensagem: 'O telefone é obrigatório' },
      { campo: 'email', mensagem: 'Digite um e-mail válido' },
      { campo: 'preco', mensagem: 'Informe um valor inteiro, sem centavos. Ex: 200' },
    ] });
  });
  it('erro de horário vai para o campo da linha; SMS padrão sim (11.12)', () => {
    const r = validarPaciente({ ...base, horarios: [{ dia_semana: '3', hora_inicio: '10:00', hora_fim: '09:00' }] });
    expect(r).toMatchObject({ ok: false, erros: [{ campo: 'horarios.0.hora_fim' }] });
    const s = validarPaciente({ ...base, receber_sms: undefined });
    expect(s.ok && s.dados.receber_sms).toBe(true);
  });
});

describe('preencherPaciente', () => {
  it('só o que a pessoa disse; preço com centavos fica vazio; fim padrão e aviso de sobreposição', () => {
    const p = preencherPaciente({ nome: 'Laura', preco: 200.5, horarios: [{ dia: 'quarta', hora_inicio: '10:00' }] }, agenda, 'f');
    expect(p.campos).toEqual({ nome: 'Laura', telefone: '', email: '', preco: '', receber_sms: true, horarios: [{ dia_semana: '3', hora_inicio: '10:00', hora_fim: '10:50' }] });
    expect(p.avisos).toEqual(['Este horário coincide com: Caio Lemos (10:30–11:20).']);
  });
});

describe('gravarPaciente (P4: como useCriarPaciente + useCriarAgendamento)', () => {
  it('paciente → preço → horário, colunas exatas do app, observacoes null', async () => {
    const { db, chamadas } = dbPorTabela({
      pacientes: { data: { id: 'p1' }, error: null },
      precos_paciente: { data: null, error: null },
      agenda_semana_padrao: { data: { id: 'a1' }, error: null },
    });
    const r = await gravarPaciente(normal, ctxDeTeste(db, { sub: 'u1' }));
    expect(r).toEqual({ ok: true, ids: ['p1'], titulo: 'Laura Mendes cadastrado.', resumo: 'Laura Mendes, R$ 200; Quarta 10:00–10:50', avisos: [] });
    const inserts = chamadas.filter((c) => c.metodo === 'insert').map((c) => [c.tabela, c.args[0]]);
    expect(inserts).toEqual([
      ['pacientes', { usuario_id: 'u1', nome_completo: 'Laura Mendes', telefone: '(11) 98888-7777', email: null, observacoes: null, receber_sms: true, status: 'ativo' }],
      ['precos_paciente', { usuario_id: 'u1', paciente_id: 'p1', preco: 200 }],
      ['agenda_semana_padrao', { usuario_id: 'u1', paciente_id: 'p1', dia_semana: 3, hora_inicio: '10:00', hora_fim: '10:50', observacoes: null }],
    ]);
  });
  it('paciente falhou: nada mais é gravado', async () => {
    const { db, chamadas } = dbPorTabela({ pacientes: { data: null, error: { message: 'x' } } });
    expect((await gravarPaciente(normal, ctxDeTeste(db))).ok).toBe(false);
    expect(chamadas.filter((c) => c.metodo === 'insert')).toHaveLength(1);
  });
  it('preço falhou depois do paciente: ok com aviso, resumo sem preço, horários seguem', async () => {
    const { db } = dbPorTabela({
      pacientes: { data: { id: 'p1' }, error: null },
      precos_paciente: { data: null, error: { message: 'x' } },
      agenda_semana_padrao: { data: { id: 'a1' }, error: null },
    });
    const r = await gravarPaciente(normal, ctxDeTeste(db));
    expect(r).toMatchObject({ ok: true, ids: ['p1'], resumo: 'Laura Mendes; Quarta 10:00–10:50', avisos: ['Paciente cadastrado sem preço. Defina o preço no app.'] });
  });
  it('horário falhou: o aviso lista o que faltou', async () => {
    const { db } = dbPorTabela({
      pacientes: { data: { id: 'p1' }, error: null },
      precos_paciente: { data: null, error: null },
      agenda_semana_padrao: { data: null, error: { message: 'x' } },
    });
    const r = await gravarPaciente(normal, ctxDeTeste(db));
    expect(r).toMatchObject({ ok: true, resumo: 'Laura Mendes, R$ 200', avisos: ['Paciente cadastrado, mas estes horários não foram gravados: Quarta 10:00–10:50. Adicione pelo app ou peça de novo.'] });
  });
  it('salvar inválido não toca no banco', async () => {
    const { db, chamadas } = dbPorTabela({});
    expect((await salvarPaciente({ paciente: { nome: 'Laura' } }, ctxDeTeste(db))).ok).toBe(false);
    expect(chamadas).toEqual([]);
  });
  it('texto para o modelo leva o id e os avisos', () => {
    expect(textoDoPacienteParaOModelo('r', 'p1', ['A.'])).toBe('Paciente cadastrado: r (id p1). A.');
  });
});

describe('registrar_paciente (13.4)', () => {
  const banco = () => dbPorTabela({
    view_agenda_semana_padrao: { data: agenda, error: null },
    pacientes: { data: { id: 'p9' }, error: null },
    precos_paciente: { data: null, error: null },
    agenda_semana_padrao: { data: { id: 'a9' }, error: null },
  });
  const entrada = { nome: 'Laura Mendes', telefone: '11 98888-7777', preco: 200, horarios: [{ dia: 'quarta' as const, hora_inicio: '10:00' }] };
  it('prévia com aviso de sobreposição; confirmar grava', async () => {
    const p = await registrarPaciente(entrada, ctxDeTeste(banco().db));
    const s = p.structuredContent as { previa: Record<string, unknown>; token_previa: string };
    expect(s.previa).toEqual({ nome: 'Laura Mendes', telefone: '11 98888-7777', email: null, preco: 'R$ 200', receber_sms: true, horarios: ['Quarta 10:00–10:50'], avisos: ['Este horário coincide com: Caio Lemos (10:30–11:20).'] });
    const g = banco();
    const r = await registrarPaciente({ ...entrada, confirmar: true, token_previa: s.token_previa }, ctxDeTeste(g.db));
    expect(r.isError).toBeUndefined();
    expect(r.content[0]).toMatchObject({ text: 'Paciente cadastrado: Laura Mendes, R$ 200; Quarta 10:00–10:50 (id p9).' });
  });
  it('sem telefone nem preço: erros, sem token, nada gravado', async () => {
    const g = banco();
    const r = await registrarPaciente({ nome: 'Laura' }, ctxDeTeste(g.db));
    expect(r.isError).toBe(true);
    expect(r.structuredContent).toMatchObject({ erros: [{ campo: 'telefone' }, { campo: 'preco' }] });
    expect(g.chamadas.some((c) => c.metodo === 'insert')).toBe(false);
  });
  it('preço com centavos no fallback é erro, não campo vazio silencioso', async () => {
    const r = await registrarPaciente({ ...entrada, preco: 200.5 }, ctxDeTeste(banco().db));
    expect(r.structuredContent).toMatchObject({ erros: [{ campo: 'preco' }] });
  });
});

describe('exceção depois de o paciente existir (defeito do verifier)', () => {
  it('preço que lança vira aviso, nunca "tente de novo" (não duplica o paciente)', async () => {
    const { db } = dbPorTabela({
      pacientes: { data: { id: 'p1' }, error: null },
      precos_paciente: { lancar: true },
      agenda_semana_padrao: { lancar: true },
    });
    const r = await salvarPaciente({ paciente: { nome: 'Laura', telefone: '1', preco: '200', horarios: [{ dia_semana: '3', hora_inicio: '10:00', hora_fim: '10:50' }] } }, ctxDeTeste(db));
    expect(r).toMatchObject({ ok: true, ids: ['p1'], avisos: [
      'Paciente cadastrado sem preço. Defina o preço no app.',
      'Paciente cadastrado, mas estes horários não foram gravados: Quarta 10:00–10:50. Adicione pelo app ou peça de novo.',
    ] });
  });
  it('horário sem dia dito fica vazio no formulário', () => {
    expect(preencherPaciente({ horarios: [{ hora_inicio: '10:00' }] }, [], 'f').campos.horarios[0]?.dia_semana).toBe('');
  });
});
