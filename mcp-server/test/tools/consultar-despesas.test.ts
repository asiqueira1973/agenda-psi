import { describe, expect, it } from 'vitest';
import { consultarDespesas, MAX_DESPESAS } from '../../src/tools/read/consultar-despesas.js';
import { executar } from '../../src/tools/context.js';
import { dbSimulado } from '../helpers.js';

const sub = 'usuario-do-token';

const linhas = [
  { valor_despesa: 1450, data_competencia: '2026-11-05', descricao: null, tipos_despesa: { nome: 'Aluguel de sala' } },
  { valor_despesa: 120, data_competencia: '2026-11-03', descricao: 'Supervisão clínica', tipos_despesa: { nome: 'Supervisão' } },
  { valor_despesa: 1450, data_competencia: '2026-10-05', descricao: null, tipos_despesa: { nome: 'Aluguel de sala' } },
  { valor_despesa: 80, data_competencia: '2026-10-02', descricao: null, tipos_despesa: null },
];

describe('consultar_despesas (13.2)', () => {
  it('filtra pelo usuário do token (segunda tranca) e não lê observacoes', async () => {
    const { db, chamadas } = dbSimulado({ data: linhas, error: null });
    await consultarDespesas({}, { db, sub });
    expect(chamadas).toContainEqual(['eq', ['usuario_id', sub]]);
    const select = chamadas.find(([m]) => m === 'select')?.[1][0];
    expect(select).not.toContain('observacoes');
  });

  it('totais e total por tipo, com "sem tipo" quando falta', async () => {
    const { db } = dbSimulado({ data: linhas, error: null });
    expect(await consultarDespesas({}, { db, sub })).toEqual({
      quantidade: 4,
      total: 3100,
      total_por_tipo: { 'Aluguel de sala': 2900, Supervisão: 120, 'sem tipo': 80 },
      despesas: [
        { tipo: 'Aluguel de sala', valor: 1450, data: '2026-11-05', descricao: null },
        { tipo: 'Supervisão', valor: 120, data: '2026-11-03', descricao: 'Supervisão clínica' },
        { tipo: 'Aluguel de sala', valor: 1450, data: '2026-10-05', descricao: null },
        { tipo: 'sem tipo', valor: 80, data: '2026-10-02', descricao: null },
      ],
    });
  });

  it('período válido vira filtro; inválido é ignorado, como no agente', async () => {
    const valido = dbSimulado({ data: [], error: null });
    await consultarDespesas({ desde: '2026-10-01', ate: '2026-10-31' }, { db: valido.db, sub });
    expect(valido.chamadas).toContainEqual(['gte', ['data_competencia', '2026-10-01']]);
    expect(valido.chamadas).toContainEqual(['lte', ['data_competencia', '2026-10-31']]);

    const invalido = dbSimulado({ data: [], error: null });
    await consultarDespesas({ desde: '01/10/2026' }, { db: invalido.db, sub });
    expect(invalido.chamadas.some(([m]) => m === 'gte')).toBe(false);
  });

  it('tipo sem acento casa com o tipo ou com a descrição', async () => {
    const { db } = dbSimulado({ data: linhas, error: null });
    const r = await consultarDespesas({ tipo: 'supervisao' }, { db, sub });
    expect(r).toMatchObject({ quantidade: 1, total: 120 });
  });

  it(`lista no máximo ${MAX_DESPESAS} linhas, mas soma todas`, async () => {
    const muitas = Array.from({ length: 40 }, (_, i) => ({
      valor_despesa: 10, data_competencia: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, descricao: null, tipos_despesa: { nome: 'Outros' },
    }));
    const { db } = dbSimulado({ data: muitas, error: null });
    const r = await consultarDespesas({}, { db, sub }) as { quantidade: number; total: number; despesas: unknown[] };
    expect(r.quantidade).toBe(40);
    expect(r.total).toBe(400);
    expect(r.despesas).toHaveLength(MAX_DESPESAS);
  });

  it('erro do banco vira { erro } curto, sem a mensagem crua', async () => {
    const { db } = dbSimulado({ data: null, error: { message: 'relation "despesas" ... detalhe interno' } });
    expect(await consultarDespesas({}, { db, sub })).toEqual({ erro: 'falha ao ler despesas' });
  });

  it('executar converte { erro } em isError e o sucesso em structuredContent', async () => {
    const ctx = { db: dbSimulado({ data: [], error: null }).db, sub };
    const comErro = await executar('x', ctx, async () => ({ erro: 'falha ao ler despesas' }));
    expect(comErro).toEqual({ isError: true, content: [{ type: 'text', text: 'falha ao ler despesas' }] });
    const ok = await executar('x', ctx, async () => ({ total: 0 }));
    expect(ok.structuredContent).toEqual({ total: 0 });
  });
});
