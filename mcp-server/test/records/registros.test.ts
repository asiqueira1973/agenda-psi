import { describe, expect, it } from 'vitest';
import { edicaoPaciente, remocaoHorario, trocaHorario } from '../../src/tools/records/acoes-cadastro.js';
import { edicaoDespesa, edicaoPagamento, edicaoSessao, exclusaoPagamento, exclusaoSessao } from '../../src/tools/records/acoes-financeiras.js';
import { escolher, preencherRegistro, registrarRegistro, salvarRegistro } from '../../src/tools/records/motor.js';
import { ctxDeTeste, dbPorTabela } from '../helpers.js';

const BEA = '3f6c1a9e-1b2c-4d5e-8f90-000000000001';
const pacientes = { data: [{ paciente_id: BEA, nome_completo: 'Beatriz Nogueira', preco_vigente: 280, status: 'ativo' }], error: null };
const sessao = (id: string, dia: string) => ({ id, paciente_id: BEA, ocorreu_em_dia: dia, pagamento: 'nao pagou', modalidade: 'presencial', duracao_minutos: 50, devesercobrada: true });
const insertOuUpdate = (chamadas: Array<{ tabela: string; metodo: string; args: unknown[] }>, metodo: string) => chamadas.filter((c) => c.metodo === metodo).map((c) => [c.tabela, c.args[0]]);
const semObservacoes = (chamadas: Array<{ metodo: string; args: unknown[] }>, r: unknown) => {
  expect(JSON.stringify(chamadas)).not.toContain('observacoes');
  expect(JSON.stringify(r)).not.toContain('observacoes');
};

describe('escolher (escolherAlvo do agente)', () => {
  const todos = Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, paciente_id: BEA, paciente_nome: 'B', data: `2026-11-0${i + 1}`, pagamento: 'pagou', modalidade: 'presencial', duracao_minutos: 50, cobrada: true }));
  it('um casou: vem escolhido; nenhum dito: os 6 recentes; nunca escolhe entre dois', () => {
    expect(escolher(edicaoSessao, { data: '2026-11-03' }, todos).escolhido?.id).toBe('s2');
    const r = escolher(edicaoSessao, {}, todos);
    expect([r.escolhido, r.lista.length]).toEqual([null, 6]);
    expect(escolher(edicaoSessao, {}, todos.slice(0, 2)).escolhido).toBeNull();
  });
});

describe('edição de sessão (useEditarSessao)', () => {
  it('abre com a data só leitura, o pedido preenchido e o atual para o "Antes"; sem observações', async () => {
    const { db, chamadas } = dbPorTabela({ v_pacientes_cartao: pacientes, sessoes: { data: [sessao('s1', '2026-11-11')], error: null } });
    const p = await preencherRegistro(edicaoSessao, { paciente: 'beatriz', data: '2026-11-11', pagamento: 'pagou' }, ctxDeTeste(db), 'f');
    expect(p).toMatchObject({ escolhido: 's1', ferramentaSalvar: 'salvar_edicao_sessao', modo: 'edicao' });
    const campos = p.candidatos[0]!.campos;
    expect(campos[0]).toMatchObject({ nome: 'data', tipo: 'leitura', valor: '11/11/2026' });
    expect(campos.find((c) => c.nome === 'pagamento')).toMatchObject({ valor: 'pagou', atual: 'nao pagou', atualRotulo: 'Não pagou' });
    semObservacoes(chamadas, p);
  });
  it('grava só as colunas do app, sem observações (P5), com o id e a RLS', async () => {
    const { db, chamadas } = dbPorTabela({ v_pacientes_cartao: pacientes, sessoes: [{ data: sessao('s1', '2026-11-11'), error: null }, { data: [{ id: 's1' }], error: null }] });
    const r = await salvarRegistro(edicaoSessao, 's1', { pagamento: 'pagou', modalidade: 'presencial', duracao_minutos: '50', devesercobrada: 'true' }, {}, ctxDeTeste(db, { sub: 'u1' }));
    expect(r).toEqual({ ok: true, ids: ['s1'], titulo: 'Sessão atualizada.', resumo: 'Beatriz Nogueira, 11/11/2026: Pagamento Pagou' });
    expect(insertOuUpdate(chamadas, 'update')).toEqual([['sessoes', { pagamento: 'pagou', modalidade: 'presencial', duracao_minutos: 50, devesercobrada: true }]]);
    semObservacoes(chamadas, r);
  });
  it('nada mudou, duração inválida e registro de outra pessoa', async () => {
    const banco = () => dbPorTabela({ v_pacientes_cartao: pacientes, sessoes: { data: sessao('s1', '2026-11-11'), error: null } });
    expect(await salvarRegistro(edicaoSessao, 's1', {}, {}, ctxDeTeste(banco().db))).toEqual({ ok: false, erros: [{ campo: null, mensagem: 'Nada mudou no registro' }] });
    expect(await salvarRegistro(edicaoSessao, 's1', { duracao_minutos: '0' }, {}, ctxDeTeste(banco().db))).toMatchObject({ ok: false, erros: [{ campo: 'duracao_minutos' }] });
    const outro = dbPorTabela({ v_pacientes_cartao: pacientes, sessoes: { data: null, error: null } });
    expect(await salvarRegistro(edicaoSessao, 'x', { pagamento: 'pagou' }, {}, ctxDeTeste(outro.db))).toEqual({ ok: false, erros: [{ campo: null, mensagem: 'Registro não encontrado ou sem permissão.' }] });
  });
});

describe('exclusões (useExcluir*, 12)', () => {
  it('apaga por id; conta demo recebe a mensagem da 12; sem linha e sem demo, não encontrado', async () => {
    const ok = dbPorTabela({ v_pacientes_cartao: pacientes, sessoes: [{ data: sessao('s1', '2026-11-11'), error: null }, { data: [{ id: 's1' }], error: null }] });
    expect(await salvarRegistro(exclusaoSessao, 's1', {}, {}, ctxDeTeste(ok.db))).toMatchObject({ ok: true, titulo: 'Sessão excluída.' });
    expect(ok.chamadas.some((c) => c.metodo === 'delete')).toBe(true);
    const demo = dbPorTabela({ v_pacientes_cartao: pacientes, sessoes: [{ data: sessao('s1', '2026-11-11'), error: null }, { data: [], error: null }], 'rpc:demo_uid': { data: 'u-demo', error: null } });
    expect(await salvarRegistro(exclusaoSessao, 's1', {}, {}, ctxDeTeste(demo.db, { sub: 'u-demo' }))).toEqual({ ok: false, erros: [{ campo: null, mensagem: 'Esta conta de demonstração não permite excluir registros.' }] });
    const nada = dbPorTabela({ v_pacientes_cartao: pacientes, pagamentos: [{ data: { id: 'g1', paciente_id: BEA, data_competencia: '2026-11-01', valor_pagamento: 280, tipo: 'mensal' }, error: null }, { data: [], error: null }], 'rpc:demo_uid': { data: 'u-demo', error: null } });
    expect(await salvarRegistro(exclusaoPagamento, 'g1', {}, {}, ctxDeTeste(nada.db, { sub: 'u1' }))).toEqual({ ok: false, erros: [{ campo: null, mensagem: 'Registro não encontrado ou sem permissão.' }] });
  });
  it('fallback: prévia com token, sem apagar; confirmar apaga; vários registros viram pendência', async () => {
    const lista = { data: [sessao('s1', '2026-11-11'), sessao('s2', '2026-11-04')], error: null };
    const p = await registrarRegistro(exclusaoSessao, { paciente: 'beatriz', data: '2026-11-11' }, ctxDeTeste(dbPorTabela({ v_pacientes_cartao: pacientes, sessoes: lista }).db));
    const s = p.structuredContent as { previa: { registro: string; apaga: boolean }; token_previa: string };
    expect(s.previa).toMatchObject({ registro: '11/11/2026, Não pagou, Presencial', apaga: true });
    const g = dbPorTabela({ v_pacientes_cartao: pacientes, sessoes: [lista, { data: sessao('s1', '2026-11-11'), error: null }, { data: [{ id: 's1' }], error: null }] });
    const r = await registrarRegistro(exclusaoSessao, { paciente: 'beatriz', data: '2026-11-11', confirmar: true, token_previa: s.token_previa }, ctxDeTeste(g.db));
    expect(r.isError).toBeUndefined();
    expect(g.chamadas.some((c) => c.metodo === 'delete')).toBe(true);
    const amb = await registrarRegistro(exclusaoSessao, { paciente: 'beatriz' }, ctxDeTeste(dbPorTabela({ v_pacientes_cartao: pacientes, sessoes: lista }).db));
    expect(amb.isError).toBe(true);
    expect(amb.structuredContent).toMatchObject({ pendencias: [{ opcoes: [{ id: 's1' }, { id: 's2' }] }] });
  });
});

describe('pagamento e despesa', () => {
  it('pagamento: valor e tipo literal "por sessão"; competência só leitura', async () => {
    const linha = { id: 'g1', paciente_id: BEA, data_competencia: '2026-11-01', valor_pagamento: 280, tipo: 'mensal' };
    const { db, chamadas } = dbPorTabela({ v_pacientes_cartao: pacientes, pagamentos: [{ data: linha, error: null }, { data: [{ id: 'g1' }], error: null }] });
    const r = await salvarRegistro(edicaoPagamento, 'g1', { valor_pagamento: '300', tipo: 'por sessão' }, {}, ctxDeTeste(db));
    expect(r).toMatchObject({ ok: true, titulo: 'Pagamento atualizado.' });
    expect(insertOuUpdate(chamadas, 'update')).toEqual([['pagamentos', { valor_pagamento: 300, tipo: 'por sessão' }]]);
  });
  it('despesa: tipo, valor e descrição; observações nunca', async () => {
    const linha = { id: 'd1', data_competencia: '2026-11-05', valor_despesa: 1450, descricao: '', tipo_despesa_id: 't1', tipos_despesa: { nome: 'Aluguel' } };
    const { db, chamadas } = dbPorTabela({ despesas: [{ data: linha, error: null }, { data: [{ id: 'd1' }], error: null }], tipos_despesa: { data: [{ id: 't1', nome: 'Aluguel' }], error: null } });
    const r = await salvarRegistro(edicaoDespesa, 'd1', { valor_despesa: '1500' }, {}, ctxDeTeste(db));
    expect(r).toMatchObject({ ok: true, titulo: 'Despesa atualizada.', resumo: 'Aluguel, 05/11/2026: Valor R$ 1.500' });
    expect(insertOuUpdate(chamadas, 'update')).toEqual([['despesas', { tipo_despesa_id: 't1', valor_despesa: 1500, descricao: null }]]);
    semObservacoes(chamadas, r);
  });
});

describe('edição de paciente (useEditarPaciente + useAtualizarPreco)', () => {
  const cartao = { data: { paciente_id: BEA, nome_completo: 'Beatriz Nogueira', telefone: '11 9', email: '', status: 'ativo', receber_sms: true, preco_vigente: 280 }, error: null };
  it('cadastro sem observações; preço novo é LINHA NOVA (pegadinha 2)', async () => {
    const { db, chamadas } = dbPorTabela({ v_pacientes_cartao: cartao, pacientes: { data: [{ id: BEA }], error: null }, precos_paciente: { data: null, error: null } });
    const r = await salvarRegistro(edicaoPaciente, BEA, { nome: 'Beatriz Nogueira', telefone: '11 9', email: '', status: 'inativo', receber_sms: 'true', preco: '300' }, {}, ctxDeTeste(db, { sub: 'u1' }));
    expect(r).toEqual({ ok: true, ids: [BEA], titulo: 'Beatriz Nogueira atualizado.', resumo: 'Beatriz Nogueira: Status Inativo. Novo preço de R$ 300 vigente a partir de hoje.' });
    expect(insertOuUpdate(chamadas, 'update')).toEqual([['pacientes', { nome_completo: 'Beatriz Nogueira', telefone: '11 9', email: null, status: 'inativo', receber_sms: true }]]);
    expect(insertOuUpdate(chamadas, 'insert')).toEqual([['precos_paciente', { usuario_id: 'u1', paciente_id: BEA, preco: 300 }]]);
    semObservacoes(chamadas, r);
  });
  it('só o preço: nenhum update no cadastro', async () => {
    const { db, chamadas } = dbPorTabela({ v_pacientes_cartao: cartao, precos_paciente: { data: null, error: null } });
    expect((await salvarRegistro(edicaoPaciente, BEA, { preco: '320' }, {}, ctxDeTeste(db))).ok).toBe(true);
    expect(insertOuUpdate(chamadas, 'update')).toEqual([]);
  });
});

describe('troca e remoção de horário', () => {
  const h = { id: 'h1', paciente_id: BEA, paciente_nome: 'Beatriz Nogueira', dia_semana: 3, hora_inicio: '10:00:00', hora_fim: '10:50:00' };
  it('abre com o fim mantendo a duração; aviso quando coincide', async () => {
    const outro = { id: 'h2', paciente_nome: 'Caio Lemos', dia_semana: 4, hora_inicio: '11:00:00', hora_fim: '11:50:00' };
    const { db } = dbPorTabela({ v_pacientes_cartao: pacientes, view_agenda_semana_padrao: [{ data: [h], error: null }, { data: [h, outro], error: null }] });
    const p = await preencherRegistro(trocaHorario, { paciente: 'beatriz', novo_dia: 'quinta', nova_hora_inicio: '11:30' }, ctxDeTeste(db), 'f');
    const c = p.candidatos[0]!;
    expect(c.campos.filter((x) => x.tipo !== 'leitura').map((x) => [x.nome, x.valor])).toEqual([['dia_semana', '4'], ['hora_inicio', '11:30'], ['hora_fim', '12:20']]);
    expect(c.aviso).toBe('Este horário coincide com: Caio Lemos (11:00–11:50).');
  });
  it('grava o novo antes de tirar o antigo; se só a saída falhar, diz isso e o próximo Salvar só tira o antigo', async () => {
    const g = dbPorTabela({ view_agenda_semana_padrao: { data: h, error: null }, agenda_semana_padrao: [{ data: { id: 'novo' }, error: null }, { data: null, error: { message: 'x' } }, { data: [{ id: 'h1' }], error: null }] });
    const valores = { dia_semana: '4', hora_inicio: '11:30', hora_fim: '12:20' };
    const r1 = await salvarRegistro(trocaHorario, 'h1', valores, {}, ctxDeTeste(g.db));
    expect(r1).toEqual({ ok: false, erros: [{ campo: null, mensagem: 'O horário novo foi gravado, mas não consegui tirar o antigo. Tente de novo abaixo.' }], continuar: { novo_id: 'novo' } });
    expect(g.chamadas.filter((c) => c.tabela === 'agenda_semana_padrao').map((c) => c.metodo).filter((m) => m === 'insert' || m === 'delete')).toEqual(['insert', 'delete']);
    const r2 = await salvarRegistro(trocaHorario, 'h1', valores, { novo_id: 'novo' }, ctxDeTeste(g.db));
    expect(r2).toMatchObject({ ok: true, ids: ['novo'], titulo: 'Horário alterado.', resumo: 'Beatriz Nogueira: Quarta 10:00–10:50 para Quinta 11:30–12:20' });
    expect(g.chamadas.filter((c) => c.metodo === 'insert')).toHaveLength(1);
  });
  it('remoção apaga o horário, não o paciente', async () => {
    const { db, chamadas } = dbPorTabela({ view_agenda_semana_padrao: { data: h, error: null }, agenda_semana_padrao: { data: [{ id: 'h1' }], error: null } });
    expect(await salvarRegistro(remocaoHorario, 'h1', {}, {}, ctxDeTeste(db))).toMatchObject({ ok: true, titulo: 'Horário excluído.' });
    expect(chamadas.filter((c) => c.metodo === 'delete').map((c) => c.tabela)).toEqual(['agenda_semana_padrao']);
  });
});

describe('correções do verifier (épico 6)', () => {
  const h = { id: 'h1', paciente_id: BEA, paciente_nome: 'Beatriz Nogueira', dia_semana: 3, hora_inicio: '10:00:00', hora_fim: '10:50:00' };
  const novo = { id: 'novo', paciente_id: BEA, paciente_nome: 'Beatriz Nogueira', dia_semana: 4, hora_inicio: '11:30:00', hora_fim: '12:20:00' };
  const valores = { dia_semana: '4', hora_inicio: '11:30', hora_fim: '12:20' };
  it('troca repetida (fallback, ou o formulário sem o continuar) reaproveita o horário novo, sem duplicar', async () => {
    const g = dbPorTabela({ view_agenda_semana_padrao: [{ data: h, error: null }, { data: [h, novo], error: null }], agenda_semana_padrao: { data: [{ id: 'h1' }], error: null } });
    const r = await salvarRegistro(trocaHorario, 'h1', valores, {}, ctxDeTeste(g.db));
    expect(r).toMatchObject({ ok: true, ids: ['novo'] });
    expect(g.chamadas.filter((c) => c.metodo === 'insert')).toHaveLength(0);
  });
  it('conta demo não tira nem troca horário (8.6), e nada é gravado', async () => {
    const demo = () => dbPorTabela({ view_agenda_semana_padrao: [{ data: h, error: null }, { data: [h], error: null }], agenda_semana_padrao: { data: [{ id: 'x' }], error: null }, 'rpc:demo_uid': { data: 'u-demo', error: null } });
    const msg = { ok: false, erros: [{ campo: null, mensagem: 'Esta conta de demonstração não permite excluir registros.' }] };
    const a = demo();
    expect(await salvarRegistro(remocaoHorario, 'h1', {}, {}, ctxDeTeste(a.db, { sub: 'u-demo' }))).toEqual(msg);
    const b = demo();
    expect(await salvarRegistro(trocaHorario, 'h1', valores, {}, ctxDeTeste(b.db, { sub: 'u-demo' }))).toEqual(msg);
    expect([...a.chamadas, ...b.chamadas].some((c) => c.metodo === 'delete' || c.metodo === 'insert')).toBe(false);
  });
  it('paciente sem preço vigente edita o telefone sem inventar preço', async () => {
    const cartao = { data: { paciente_id: BEA, nome_completo: 'Beatriz Nogueira', telefone: '11 9', email: '', status: 'ativo', receber_sms: true, preco_vigente: null }, error: null };
    const { db, chamadas } = dbPorTabela({ v_pacientes_cartao: cartao, pacientes: { data: [{ id: BEA }], error: null } });
    const r = await salvarRegistro(edicaoPaciente, BEA, { telefone: '11 8', preco: '' }, {}, ctxDeTeste(db));
    expect(r).toMatchObject({ ok: true });
    expect(chamadas.some((c) => c.tabela === 'precos_paciente')).toBe(false);
  });
});

