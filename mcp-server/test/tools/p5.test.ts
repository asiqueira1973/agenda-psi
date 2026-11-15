import { describe, expect, it } from 'vitest';
import { LEITURAS } from '../../src/tools/read/index.js';
import { executar } from '../../src/tools/context.js';
import { dbPorTabela } from '../helpers.js';

// P5 e seção 20: nenhuma leitura devolve `observacoes`, nem se o banco a mandar por
// engano. Os dados simulados abaixo TRAZEM a chave em todas as linhas.
const comObs = (o: Record<string, unknown>) => ({ ...o, observacoes: 'texto clínico que não pode sair' });
const PACIENTE = comObs({ id: 'p1', paciente_id: 'p1', nome_completo: 'Ana Teste', telefone: '1', email: 'a@b.c', status: 'ativo', receber_sms: true, preco_vigente: 200, sessoes_realizadas: 3, sessoes_nao_pagas: 1, ultima_sessao: '2026-11-01', primeira_consulta: '2026-01-01', valor_total_pago_ate_hoje: 600 });
const linhas = { data: [PACIENTE], error: null };
const banco = () => dbPorTabela({
  v_pacientes_cartao: linhas,
  pacientes: linhas,
  view_agenda_semana_padrao: { data: [comObs({ paciente_id: 'p1', dia_semana: 1, dia_semana_label: 'Segunda', hora_inicio: '09:00:00', hora_fim: '09:50:00', paciente_nome: 'Ana Teste' })], error: null },
  sessoes: { data: [comObs({ ocorreu_em_dia: '2026-11-01', status: 'realizada', pagamento: 'pagou', modalidade: 'presencial', duracao_minutos: 50 })], error: null, count: 1 } as never,
  pagamentos: { data: [comObs({ data_competencia: '2026-11-01', valor_pagamento: 200, tipo: 'mensal', status: 'pago' })], error: null },
  despesas: { data: [comObs({ valor_despesa: 10, data_competencia: '2026-11-01', descricao: 'x', tipos_despesa: { nome: 'Outros' } })], error: null },
  v_financeiro_mensal: { data: [comObs({ mes_referencia: '2026-11-01', recebido: 200, pendente: 0 })], error: null },
  v_pendencias_por_paciente: { data: [comObs({ nome_completo: 'Ana Teste', qtde_pendencias: 1, total_pendente: 200, proximo_vencimento: '2026-11-10' })], error: null },
});
const ARGS: Record<string, unknown> = {
  buscar_paciente: { nome: 'ana' }, historico_do_paciente: { nome: 'ana' }, consultar_despesas: {}, listar_pacientes: {},
  consultar_periodo: { desde: '2026-10', ate: '2026-11' }, consultar_mes: { mes: '2026-11' },
  agenda_do_dia: { data: '2026-11-16' }, agenda_da_semana: { data: '2026-11-16' }, listar_pendencias: {},
};

describe('P5: nenhuma das 9 leituras devolve observacoes (8.4, 20)', () => {
  it('são as 9 do agente', () => {
    expect(LEITURAS.map((l) => l.nome)).toEqual([
      'buscar_paciente', 'historico_do_paciente', 'consultar_despesas', 'listar_pacientes',
      'consultar_periodo', 'consultar_mes', 'agenda_do_dia', 'agenda_da_semana', 'listar_pendencias',
    ]);
  });

  for (const l of LEITURAS) {
    it(`${l.nome}: nem pede o campo ao banco, nem o devolve`, async () => {
      const { db, chamadas } = banco();
      const r = await executar(l.nome, { sub: 'u' }, () => l.executar(ARGS[l.nome], { db, sub: 'u' }));
      expect(r.isError, JSON.stringify(r.content)).toBeFalsy();
      expect(JSON.stringify(r)).not.toContain('observacoes');
      for (const c of chamadas.filter((x) => x.metodo === 'select')) {
        expect(String(c.args[0])).not.toContain('observacoes');
      }
    });
  }
});
