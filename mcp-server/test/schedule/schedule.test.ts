import { describe, expect, it } from 'vitest';
import { gravarHorarios, preencherHorarios, registrarHorarios, salvarHorarios } from '../../src/tools/schedule/index.js';
import { avisoDeConflito, diaDoNome, horaFimPadrao, horaValida, textoDosHorariosParaOModelo, validarHorario } from '../../src/tools/schedule/model.js';
import { ctxDeTeste, dbPorTabela } from '../helpers.js';

const LAURA = '3f6c1a9e-1b2c-4d5e-8f90-000000000001';
const opcoes = [{ id: LAURA, nome: 'Laura Mendes', preco_referencia: 200, ativo: true }];
const view = { data: [{ paciente_id: LAURA, nome_completo: 'Laura Mendes', preco_vigente: 200, status: 'ativo' }], error: null };
const agenda = [{ id: 'h1', paciente_nome: 'Caio Lemos', dia_semana: 3, hora_inicio: '10:30:00', hora_fim: '11:20:00' }];

describe('dias e horas (pegadinha 7, 11.6, 11.7)', () => {
  it('1 = segunda, 7 = domingo; "-feira" e acento não importam', () => {
    expect([diaDoNome('segunda'), diaDoNome('Quarta-feira'), diaDoNome('sábado'), diaDoNome('domingo'), diaDoNome('x')]).toEqual([1, 3, 6, 7, null]);
  });
  it('horas aceitas e fim padrão de 50 minutos, sem passar da meia-noite', () => {
    expect([horaValida('9h'), horaValida('9:5'), horaValida('14:30'), horaValida('24:00')]).toEqual(['09:00', null, '14:30', null]);
    expect([horaFimPadrao('10:00'), horaFimPadrao('23:30')]).toEqual(['10:50', '23:59']);
  });
  it('fim antes do início e horário incompleto com as mensagens do app', () => {
    expect(validarHorario({ dia_semana: '3', hora_inicio: '10:00', hora_fim: '09:00' }, '0.')).toMatchObject({ ok: false, erros: [{ campo: '0.hora_fim' }] });
    expect(validarHorario({ dia_semana: '8', hora_inicio: '10:00', hora_fim: '10:50' }, '')).toMatchObject({ ok: false, erros: [{ campo: 'dia_semana' }] });
  });
  it('sobreposição é aviso com o texto do agente; encostar não é sobrepor', () => {
    expect(avisoDeConflito({ dia_semana: 3, hora_inicio: '10:00', hora_fim: '10:50' }, agenda)).toBe('Este horário coincide com: Caio Lemos (10:30–11:20).');
    expect(avisoDeConflito({ dia_semana: 3, hora_inicio: '09:40', hora_fim: '10:30' }, agenda)).toBeNull();
    expect(avisoDeConflito({ dia_semana: 4, hora_inicio: '10:00', hora_fim: '10:50' }, agenda)).toBeNull();
  });
});

describe('preencherHorarios', () => {
  it('paciente, dia pelo nome, fim padrão e aviso de sobreposição', () => {
    const p = preencherHorarios({ itens: [{ paciente: 'laura', dia: 'quarta', hora_inicio: '10:00' }] }, opcoes, agenda, 'f');
    expect(p.linhas[0]?.campos).toEqual({ paciente_id: LAURA, dia_semana: '3', hora_inicio: '10:00', hora_fim: '10:50' });
    expect(p.avisos).toEqual(['Este horário coincide com: Caio Lemos (10:30–11:20).']);
  });
});

describe('gravarHorarios (P4: como useCriarAgendamento)', () => {
  it('colunas exatas, dia_semana 1–7, observacoes null; sobreposição não bloqueia', async () => {
    const { db, chamadas } = dbPorTabela({ v_pacientes_cartao: view, agenda_semana_padrao: { data: { id: 'a1' }, error: null } });
    const r = await gravarHorarios([{ paciente_id: LAURA, dia_semana: 3, hora_inicio: '10:00', hora_fim: '10:50' }], ctxDeTeste(db, { sub: 'u1' }));
    expect(r).toEqual({ ok: true, ids: ['a1'], titulo: 'Horário criado.', resumo: 'Laura Mendes, Quarta 10:00–10:50' });
    const l = chamadas.find((c) => c.metodo === 'insert')?.args[0];
    expect(l).toEqual({ usuario_id: 'u1', paciente_id: LAURA, dia_semana: 3, hora_inicio: '10:00', hora_fim: '10:50', observacoes: null });
  });
  it('paciente de outra conta é recusado sem gravar', async () => {
    const { db, chamadas } = dbPorTabela({ v_pacientes_cartao: view });
    const r = await gravarHorarios([{ paciente_id: 'outro', dia_semana: 1, hora_inicio: '08:00', hora_fim: '08:50' }], ctxDeTeste(db));
    expect(r.ok).toBe(false);
    expect(chamadas.some((c) => c.metodo === 'insert')).toBe(false);
  });
  it('vários: plural; falha parcial diz o que faltou', async () => {
    const dois = [
      { paciente_id: LAURA, dia_semana: 1, hora_inicio: '08:00', hora_fim: '08:50' },
      { paciente_id: LAURA, dia_semana: 7, hora_inicio: '09:00', hora_fim: '09:50' },
    ];
    expect(await gravarHorarios(dois, ctxDeTeste(dbPorTabela({ v_pacientes_cartao: view, agenda_semana_padrao: [{ data: { id: 'a' }, error: null }, { data: { id: 'b' }, error: null }] }).db)))
      .toMatchObject({ ok: true, titulo: 'Horários criados.' });
    const parcial = await gravarHorarios(dois, ctxDeTeste(dbPorTabela({ v_pacientes_cartao: view, agenda_semana_padrao: [{ data: { id: 'a' }, error: null }, { data: null, error: { message: 'x' } }] }).db));
    expect(parcial).toMatchObject({ ok: false, ids: ['a'], gravadas: [0] });
    expect(parcial.ok === false && parcial.erros[0]?.mensagem).toContain('Laura Mendes, Domingo 09:00–09:50');
  });
  it('salvar sem paciente não toca no banco', async () => {
    const { db, chamadas } = dbPorTabela({});
    expect((await salvarHorarios({ horarios: [{ dia_semana: '1', hora_inicio: '08:00', hora_fim: '08:50' }] }, ctxDeTeste(db))).ok).toBe(false);
    expect(chamadas).toEqual([]);
  });
  it('texto para o modelo', () => {
    expect(textoDosHorariosParaOModelo('r', ['a'])).toBe('Horário criado: r (id a).');
  });
});

describe('registrar_horarios (13.4)', () => {
  it('prévia traz o aviso de sobreposição; confirmar grava', async () => {
    const banco = () => dbPorTabela({ v_pacientes_cartao: view, view_agenda_semana_padrao: { data: agenda, error: null }, agenda_semana_padrao: { data: { id: 'a9' }, error: null } });
    const p = await registrarHorarios({ itens: [{ paciente: 'laura', dia: 'quarta', hora_inicio: '10:00' }] }, ctxDeTeste(banco().db));
    const s = p.structuredContent as { previa: { horarios: string[]; avisos: string[] }; token_previa: string };
    expect(s.previa).toEqual({ horarios: ['Laura Mendes, Quarta 10:00–10:50'], avisos: ['Este horário coincide com: Caio Lemos (10:30–11:20).'] });
    const g = banco();
    const r = await registrarHorarios({ itens: [{ paciente: 'laura', dia: 'quarta', hora_inicio: '10:00' }], confirmar: true, token_previa: s.token_previa }, ctxDeTeste(g.db));
    expect(r.isError).toBeUndefined();
    expect(g.chamadas.some((c) => c.metodo === 'insert')).toBe(true);
  });
  it('paciente desconhecido vira pendência, sem token', async () => {
    const r = await registrarHorarios({ itens: [{ paciente: 'zé', dia: 'segunda', hora_inicio: '08:00' }] }, ctxDeTeste(dbPorTabela({ v_pacientes_cartao: view, view_agenda_semana_padrao: { data: [], error: null } }).db));
    expect(r.isError).toBe(true);
    expect((r.structuredContent as { token_previa?: string }).token_previa).toBeUndefined();
  });
});

describe('dia não dito (defeito do verifier, pegadinha 7)', () => {
  it('não vira segunda: fica vazio no formulário e é erro no fallback, sem token', async () => {
    const p = preencherHorarios({ itens: [{ paciente: 'laura', hora_inicio: '10:00' }] }, opcoes, [], 'f');
    expect(p.linhas[0]?.campos.dia_semana).toBe('');
    const r = await registrarHorarios({ itens: [{ paciente: 'laura', hora_inicio: '10:00' }] }, ctxDeTeste(dbPorTabela({ v_pacientes_cartao: view, view_agenda_semana_padrao: { data: [], error: null } }).db));
    expect(r.isError).toBe(true);
    expect(r.structuredContent).toMatchObject({ erros: [{ campo: '0.dia_semana', mensagem: 'dia ou hora inválidos' }] });
  });
  it('falha parcial devolve o resumo do que JÁ foi gravado', async () => {
    const dois = [
      { paciente_id: LAURA, dia_semana: 1, hora_inicio: '08:00', hora_fim: '08:50' },
      { paciente_id: LAURA, dia_semana: 7, hora_inicio: '09:00', hora_fim: '09:50' },
    ];
    const r = await gravarHorarios(dois, ctxDeTeste(dbPorTabela({ v_pacientes_cartao: view, agenda_semana_padrao: [{ data: { id: 'a' }, error: null }, { data: null, error: { message: 'x' } }] }).db));
    expect(r).toMatchObject({ ok: false, ids: ['a'], resumo: 'Laura Mendes, Segunda 08:00–08:50' });
  });
});
