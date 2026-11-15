import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { agendaDaSemana, agendaDoDia } from '../../src/tools/read/agenda.js';
import { descricoes } from '../../src/tools/read/descricoes.js';
import { consultarMes, consultarPeriodo, listarPendencias, mesesDoPeriodo } from '../../src/tools/read/financeiro.js';
import { buscarPaciente, historicoDoPaciente, listarPacientes, MAX_BUSCA, MAX_HISTORICO } from '../../src/tools/read/pacientes.js';
import { dbPorTabela } from '../helpers.js';

const sub = 'usuario-do-token';
const agente = readFileSync(new URL('../../../supabase/functions/agente/ferramentas.ts', import.meta.url), 'utf8');

describe('descrições iguais às do agente (13.2)', () => {
  for (const [nome, d] of Object.entries(descricoes)) {
    it(nome, () => {
      // Única exceção (P5): buscar_paciente não cita "observações".
      const esperado = nome === 'buscar_paciente' ? d.replace('telefone, e-mail', 'telefone, e-mail, observações') : d;
      expect(agente).toContain(`'${esperado}'`);
      if (nome === 'buscar_paciente') expect(d).not.toContain('observações');
    });
  }
});

const paciente = (i: number, nome = `Ana ${i}`) => ({ paciente_id: `p${i}`, id: `p${i}`, nome_completo: nome });

describe('buscar_paciente', () => {
  it(`no máximo ${MAX_BUSCA}, com total_encontrado, filtro pelo usuário e horários sem id`, async () => {
    const { db, chamadas } = dbPorTabela({
      v_pacientes_cartao: { data: Array.from({ length: 7 }, (_, i) => paciente(i)), error: null },
      view_agenda_semana_padrao: { data: [{ paciente_id: 'p0', dia_semana: 4, dia_semana_label: 'Quinta', hora_inicio: '14:00:00', hora_fim: '14:50:00' }], error: null },
    });
    const r = await buscarPaciente({ nome: 'ana' }, { db, sub }) as { total_encontrado: number; pacientes: Array<Record<string, unknown>> };
    expect(r.total_encontrado).toBe(7);
    expect(r.pacientes).toHaveLength(MAX_BUSCA);
    expect(r.pacientes[0]).not.toHaveProperty('paciente_id');
    expect(r.pacientes[0]?.horarios_fixos).toEqual([{ dia: 'Quinta', inicio: '14:00', fim: '14:50' }]);
    expect(chamadas).toContainEqual({ tabela: 'v_pacientes_cartao', metodo: 'eq', args: ['usuario_id', sub] });
  });
  it('nome vazio vira erro curto', async () => {
    expect(await buscarPaciente({ nome: '  ' }, { db: dbPorTabela({}).db, sub })).toEqual({ erro: 'nome vazio' });
  });
});

describe('historico_do_paciente', () => {
  it('vários pacientes com o nome: devolve os nomes, nunca escolhe', async () => {
    const { db } = dbPorTabela({ pacientes: { data: [paciente(1, 'Helena A'), paciente(2, 'Helena B')], error: null } });
    expect(await historicoDoPaciente({ nome: 'helena' }, { db, sub })).toEqual({ varios_pacientes: ['Helena A', 'Helena B'] });
  });
  it(`pode_haver_mais quando bate o teto de ${MAX_HISTORICO}; período vira filtro`, async () => {
    const trinta = Array.from({ length: MAX_HISTORICO }, () => ({ ocorreu_em_dia: '2026-11-01' }));
    const { db, chamadas } = dbPorTabela({
      pacientes: { data: [paciente(1, 'Caio')], error: null },
      sessoes: { data: trinta, error: null },
      pagamentos: { data: [], error: null },
    });
    const r = await historicoDoPaciente({ nome: 'caio', desde: '2026-01-01', ate: 'xx' }, { db, sub });
    expect(r).toMatchObject({ paciente: 'Caio', pode_haver_mais: true });
    expect(chamadas).toContainEqual({ tabela: 'sessoes', metodo: 'gte', args: ['ocorreu_em_dia', '2026-01-01'] });
    expect(chamadas.some((c) => c.metodo === 'lte')).toBe(false);
    expect(chamadas).toContainEqual({ tabela: 'sessoes', metodo: 'limit', args: [MAX_HISTORICO] });
  });
  it('ninguém com o nome', async () => {
    const { db } = dbPorTabela({ pacientes: { data: [], error: null } });
    expect(await historicoDoPaciente({ nome: 'zé' }, { db, sub })).toEqual({ erro: 'nenhum paciente com esse nome' });
  });
});

describe('listar_pacientes', () => {
  it('filtros opcionais viram eq', async () => {
    const { db, chamadas } = dbPorTabela({ v_pacientes_cartao: { data: [{ nome_completo: 'A' }], error: null } });
    expect(await listarPacientes({ status: 'ativo', receber_sms: false }, { db, sub })).toEqual({ total: 1, pacientes: [{ nome_completo: 'A' }] });
    expect(chamadas).toContainEqual({ tabela: 'v_pacientes_cartao', metodo: 'eq', args: ['status', 'ativo'] });
    expect(chamadas).toContainEqual({ tabela: 'v_pacientes_cartao', metodo: 'eq', args: ['receber_sms', false] });
  });
});

describe('financeiro', () => {
  it('mesesDoPeriodo: atravessa o ano, recusa invertido, teto de 36', () => {
    expect(mesesDoPeriodo('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(mesesDoPeriodo('2026-03', '2026-01')).toEqual([]);
    expect(mesesDoPeriodo('2020-01', '2026-12')).toHaveLength(36);
  });
  it('consultar_periodo: soma por mês e total, saldo = recebido - despesas', async () => {
    const { db } = dbPorTabela({
      v_financeiro_mensal: { data: [{ mes_referencia: '2026-10-01', recebido: 1000, pendente: 200 }, { mes_referencia: '2026-11-01', recebido: 500, pendente: 0 }], error: null },
      despesas: { data: [{ data_competencia: '2026-10-05', valor_despesa: 300 }], error: null },
      sessoes: { data: [{ ocorreu_em_dia: '2026-10-02' }, { ocorreu_em_dia: '2026-11-03' }], error: null },
    });
    const r = await consultarPeriodo({ desde: '2026-10', ate: '2026-11' }, { db, sub });
    expect(r).toMatchObject({ periodo: '2026-10 a 2026-11', total: { recebido: 1500, pendente: 200, despesas: 300, saldo: 1200, sessoes_realizadas: 2 } });
  });
  it('consultar_periodo e consultar_mes: formato errado vira erro curto', async () => {
    const db = dbPorTabela({}).db;
    expect(await consultarPeriodo({ desde: '2026-13', ate: '2026-14' }, { db, sub })).toEqual({ erro: 'período deve ser AAAA-MM a AAAA-MM, em ordem' });
    expect(await consultarMes({ mes: 'outubro' }, { db, sub })).toEqual({ erro: 'mês deve ser AAAA-MM' });
  });
  it('consultar_mes: dezembro vira janeiro do ano seguinte no limite', async () => {
    const { db, chamadas } = dbPorTabela({ v_financeiro_mensal: { data: null, error: null }, sessoes: { data: null, error: null, count: 4 } as never });
    expect(await consultarMes({ mes: '2026-12' }, { db, sub })).toEqual({ mes: '2026-12', recebido: 0, pendente: 0, sessoes_realizadas: 4 });
    expect(chamadas).toContainEqual({ tabela: 'sessoes', metodo: 'lt', args: ['ocorreu_em_dia', '2027-01-01'] });
  });
  it('listar_pendencias: erro do banco vira texto curto', async () => {
    const { db } = dbPorTabela({ v_pendencias_por_paciente: { data: null, error: { message: 'detalhe interno' } } });
    expect(await listarPendencias({}, { db, sub })).toEqual({ erro: 'falha ao ler pendências' });
  });
});

describe('agenda (pegadinha 7)', () => {
  it('domingo consulta dia_semana 7, não 0', async () => {
    const { db, chamadas } = dbPorTabela({ view_agenda_semana_padrao: { data: [], error: null } });
    await agendaDoDia({ data: '2026-11-15' }, { db, sub });
    expect(chamadas).toContainEqual({ tabela: 'view_agenda_semana_padrao', metodo: 'eq', args: ['dia_semana', 7] });
  });
  it('data inválida vira erro curto', async () => {
    expect(await agendaDoDia({ data: '2026-02-31' }, { db: dbPorTabela({}).db, sub })).toEqual({ erro: 'data deve ser AAAA-MM-DD' });
  });
  it('agenda_da_semana: segunda a domingo, cada horário no seu dia', async () => {
    const { db } = dbPorTabela({ view_agenda_semana_padrao: { data: [
      { dia_semana: 1, hora_inicio: '09:00:00', hora_fim: '09:50:00', paciente_nome: 'A' },
      { dia_semana: 7, hora_inicio: '10:00:00', hora_fim: '10:50:00', paciente_nome: 'B' },
    ], error: null } });
    const r = await agendaDaSemana({ data: '2026-11-18' }, { db, sub }) as { dias: Array<{ dia: string; data: string; horarios: unknown[] }> };
    expect(r.dias.map((d) => [d.dia, d.data])).toEqual([
      ['Segunda', '2026-11-16'], ['Terça', '2026-11-17'], ['Quarta', '2026-11-18'], ['Quinta', '2026-11-19'],
      ['Sexta', '2026-11-20'], ['Sábado', '2026-11-21'], ['Domingo', '2026-11-22'],
    ]);
    expect(r.dias[0]?.horarios).toEqual([{ inicio: '09:00', fim: '09:50', paciente: 'A' }]);
    expect(r.dias[6]?.horarios).toEqual([{ inicio: '10:00', fim: '10:50', paciente: 'B' }]);
  });
});
