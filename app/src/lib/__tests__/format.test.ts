import {
  formatarDinheiro,
  formatarPercentual,
  formatarInteiro,
  formatarData,
  formatarHora,
  formatarTelefone,
  nomeDoDiaDaSemana,
  diaDaSemanaDoBanco,
} from '../format';

/**
 * Testes da regra 11.3 do spec, exigidos pela seção 22 ("Formatação —
 * testes unitários de moeda, data, percentual e nulo").
 *
 * Cada caso aqui é uma linha da tabela 11.3 ou um defeito da 11.9 que não pode
 * voltar.
 */

describe('formatarDinheiro — regra 11.3', () => {
  it('põe o símbolo e o separador de milhar', () => {
    expect(formatarDinheiro(1234)).toBe('R$ 1.234');
  });

  it('formata o exemplo da tabela do spec', () => {
    expect(formatarDinheiro(12400)).toBe('R$ 12.400');
  });

  it('não inventa centavos — o banco guarda inteiro (regra 11.2)', () => {
    expect(formatarDinheiro(200)).toBe('R$ 200');
  });

  it('nulo vira R$ 0, não travessão', () => {
    expect(formatarDinheiro(null)).toBe('R$ 0');
    expect(formatarDinheiro(undefined)).toBe('R$ 0');
  });

  it('trata o lucro negativo, que existe quando a despesa passa a receita', () => {
    expect(formatarDinheiro(-1500)).toBe('R$ -1.500');
  });

  it('não imprime o inteiro cru, que é o que o app atual faz (24.12)', () => {
    expect(formatarDinheiro(1234)).not.toBe('1234');
  });

  it('separa milhão corretamente', () => {
    expect(formatarDinheiro(1234567)).toBe('R$ 1.234.567');
  });
});

describe('formatarPercentual — regra 11.3', () => {
  it('usa uma casa decimal e vírgula', () => {
    expect(formatarPercentual(42.5)).toBe('42,5%');
  });

  it('arredonda para uma casa', () => {
    expect(formatarPercentual(74.48)).toBe('74,5%');
  });

  it('nulo vira 0%', () => {
    expect(formatarPercentual(null)).toBe('0%');
  });
});

describe('formatarInteiro — regra 11.3', () => {
  it('nulo vira 0', () => {
    expect(formatarInteiro(null)).toBe('0');
  });

  it('separa o milhar', () => {
    expect(formatarInteiro(1178)).toBe('1.178');
  });
});

describe('formatarData — regra 11.3 e assunção 24.11', () => {
  it('usa zero à esquerda, ao contrário do app atual', () => {
    expect(formatarData('2026-03-05')).toBe('05/03/2026');
    expect(formatarData('2026-03-05')).not.toBe('5/3/2026');
  });

  it('não desloca a data por causa de fuso (regra 11.8)', () => {
    // new Date('2026-03-05') é meia-noite UTC, que em Brasília é dia 4. Coluna
    // `date` do banco é data pura e precisa sair exatamente como está gravada.
    expect(formatarData('2026-03-05')).toBe('05/03/2026');
    expect(formatarData('2026-01-01')).toBe('01/01/2026');
  });

  it('aceita timestamp completo', () => {
    expect(formatarData('2026-09-13T15:30:00+00:00')).toMatch(/^\d{2}\/\d{2}\/2026$/);
  });

  it('nulo vira travessão', () => {
    expect(formatarData(null)).toBe('—');
    expect(formatarData('')).toBe('—');
  });
});

describe('formatarHora — regra 11.3', () => {
  it('mostra em 24h sem os segundos do tipo time', () => {
    expect(formatarHora('14:30:00')).toBe('14:30');
    expect(formatarHora('09:00')).toBe('09:00');
  });

  it('nulo vira travessão', () => {
    expect(formatarHora(null)).toBe('—');
  });
});

describe('formatarTelefone — regra 11.3', () => {
  it('formata celular brasileiro com DDI', () => {
    expect(formatarTelefone('+5521999999999')).toBe('+55 21 99999-9999');
  });

  it('formata fixo de oito dígitos', () => {
    expect(formatarTelefone('+552133334444')).toBe('+55 21 3333-4444');
  });

  it('devolve cru o que não reconhece, em vez de embaralhar', () => {
    expect(formatarTelefone('+1 555 0100')).toBe('+1 555 0100');
  });

  it('nulo vira travessão', () => {
    expect(formatarTelefone(null)).toBe('—');
  });
});

describe('dia da semana — regra 11.4 e defeito 11.9.4', () => {
  it('1 é segunda e 7 é domingo, como no banco', () => {
    expect(nomeDoDiaDaSemana(1)).toBe('segunda-feira');
    expect(nomeDoDiaDaSemana(4)).toBe('quinta-feira');
    expect(nomeDoDiaDaSemana(7)).toBe('domingo');
  });

  it('converte o domingo do JavaScript, que é 0, para o 7 do banco', () => {
    const domingo = new Date(2026, 8, 13); // 13/09/2026 é domingo
    expect(domingo.getDay()).toBe(0);
    expect(diaDaSemanaDoBanco(domingo)).toBe(7);
  });

  it('converte a quinta corretamente', () => {
    const quinta = new Date(2026, 8, 10);
    expect(diaDaSemanaDoBanco(quinta)).toBe(4);
  });

  it('valor fora de 1 a 7 vira travessão em vez de quebrar', () => {
    expect(nomeDoDiaDaSemana(0)).toBe('—');
    expect(nomeDoDiaDaSemana(null)).toBe('—');
  });
});
