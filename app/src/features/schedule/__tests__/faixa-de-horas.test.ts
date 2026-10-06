import { faixaDeHorasDaGrade, horasDaGrade } from '../faixa-de-horas';

const PADRAO: [number, number] = [8, 21];

/**
 * O defeito que estes testes guardam: a grade era fixa em 8–21, e agendamento
 * às 7h era gravado e desenhado em lugar nenhum. Em 06/10/2026 havia 19
 * agendamentos reais invisíveis, o mais cedo às 06:00.
 */
describe('faixa de horas da grade da Agenda', () => {
  it('mantém 8–21 quando tudo cabe', () => {
    expect(faixaDeHorasDaGrade([9, 14, 20], ...PADRAO)).toEqual({ primeira: 8, ultima: 21 });
  });

  it('mantém 8–21 quando não há agendamento', () => {
    expect(faixaDeHorasDaGrade([], ...PADRAO)).toEqual({ primeira: 8, ultima: 21 });
  });

  it('estica para cima quando alguém marca antes das 8 — o defeito relatado', () => {
    expect(faixaDeHorasDaGrade([7, 10], ...PADRAO)).toEqual({ primeira: 7, ultima: 21 });
    expect(faixaDeHorasDaGrade([6], ...PADRAO)).toEqual({ primeira: 6, ultima: 21 });
  });

  it('estica para baixo quando alguém marca depois das 21', () => {
    expect(faixaDeHorasDaGrade([22], ...PADRAO)).toEqual({ primeira: 8, ultima: 22 });
  });

  it('estica dos dois lados ao mesmo tempo', () => {
    expect(faixaDeHorasDaGrade([6, 23], ...PADRAO)).toEqual({ primeira: 6, ultima: 23 });
  });

  it('ignora nulo — nulo é dado incompleto, não meia-noite', () => {
    expect(faixaDeHorasDaGrade([null, 10, null], ...PADRAO)).toEqual({ primeira: 8, ultima: 21 });
  });

  it('a lista de horas é contínua e inclui as pontas', () => {
    expect(horasDaGrade([7], ...PADRAO)).toEqual([7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]);
    expect(horasDaGrade([], ...PADRAO)).toHaveLength(14);
  });
});
