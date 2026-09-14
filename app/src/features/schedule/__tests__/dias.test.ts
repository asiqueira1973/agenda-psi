import { diasDoSegmented, HORA_INICIAL_DA_GRADE, HORA_FINAL_DA_GRADE } from '../copy';
import { nomeDoDiaDaSemana, diaDaSemanaDoBanco } from '@/lib/format';

/**
 * Teste de regressão do defeito 11.9.4.
 *
 * O defeito é a confusão entre duas numerações de dia da semana que coexistem:
 * a do banco (1 = segunda ... 7 = domingo, regra 11.4) e a do JavaScript
 * (0 = domingo). No app atual, salvar as notas de um agendamento grava
 * `dia_semana = 1` — e um horário de quinta vira segunda.
 *
 * A ORDEM VISUAL do segmented é uma terceira coisa: o handoff quer domingo
 * primeiro. Três convenções diferentes para a mesma ideia é exatamente o
 * terreno onde esse defeito nasce, e por isso cada uma tem teste.
 */

describe('ordem visual × valor do banco — defeito 11.9.4', () => {
  it('o segmented começa no domingo, como o handoff desenha', () => {
    expect(diasDoSegmented.map((d) => d.rotulo)).toEqual([
      'Dom',
      'Seg',
      'Ter',
      'Qua',
      'Qui',
      'Sex',
      'Sáb',
    ]);
  });

  it('mas o VALOR do domingo é 7, e o da segunda é 1, como no banco', () => {
    expect(diasDoSegmented.map((d) => d.valor)).toEqual([7, 1, 2, 3, 4, 5, 6]);
  });

  it('a primeira posição da tela NÃO é o valor 1', () => {
    // É esta a armadilha: quem assume que "o primeiro do segmented é o dia 1"
    // grava domingo como segunda.
    expect(diasDoSegmented[0].valor).not.toBe(1);
    expect(diasDoSegmented[0].valor).toBe(7);
  });

  it('cada valor do segmento bate com o nome por extenso do banco', () => {
    expect(nomeDoDiaDaSemana(diasDoSegmented[0].valor)).toBe('domingo');
    expect(nomeDoDiaDaSemana(diasDoSegmented[1].valor)).toBe('segunda-feira');
    expect(nomeDoDiaDaSemana(diasDoSegmented[4].valor)).toBe('quinta-feira');
  });

  it('os sete dias aparecem uma vez cada, sem buraco nem repetição', () => {
    const valores = diasDoSegmented.map((d) => d.valor).sort((a, b) => a - b);
    expect(valores).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('a agenda abre no dia de hoje — correção de 8.8', () => {
  it('domingo do JavaScript vira 7, e é o que o segmented seleciona', () => {
    const domingo = new Date(2026, 8, 13);
    const doBanco = diaDaSemanaDoBanco(domingo);
    expect(doBanco).toBe(7);
    expect(diasDoSegmented.some((d) => d.valor === doBanco)).toBe(true);
  });

  it('todo dia da semana tem posição no segmented', () => {
    for (let offset = 0; offset < 7; offset++) {
      const data = new Date(2026, 8, 13 + offset);
      const valor = diaDaSemanaDoBanco(data);
      expect(diasDoSegmented.some((d) => d.valor === valor)).toBe(true);
    }
  });
});

describe('faixa de horas da grade — handoff, tela 6', () => {
  it('vai de 08:00 a 21:00', () => {
    expect(HORA_INICIAL_DA_GRADE).toBe(8);
    expect(HORA_FINAL_DA_GRADE).toBe(21);
  });

  it('são 14 blocos de hora', () => {
    expect(HORA_FINAL_DA_GRADE - HORA_INICIAL_DA_GRADE + 1).toBe(14);
  });
});
