import {
  validarValorEmReais,
  valorEmReaisParaInteiro,
  validarNome,
  validarTelefone,
  validarIntervaloDeHoras,
  mensagens,
} from '../validation';

/**
 * Testes da regra 11.2, exigidos nominalmente pela seção 22:
 * "Validação de preço (11.2) — `200`, `200,00`, `200.00`, vazio, `abc`, `-5`, `0`".
 *
 * É o teste de regressão do defeito 11.9.6, em que preço vazio ou com vírgula
 * vira NULL numa coluna NOT NULL e o app mostra sucesso mesmo assim.
 */

describe('validarValorEmReais — regra 11.2 e defeito 11.9.6', () => {
  it('aceita inteiro positivo', () => {
    expect(validarValorEmReais('200').valido).toBe(true);
    expect(valorEmReaisParaInteiro('200')).toBe(200);
  });

  it('rejeita 200,00 — o app não trabalha com centavos', () => {
    const r = validarValorEmReais('200,00');
    expect(r.valido).toBe(false);
    expect(r.valido === false && r.mensagem).toBe(mensagens.valorInvalido);
  });

  it('rejeita 200.00 pelo mesmo motivo', () => {
    expect(validarValorEmReais('200.00').valido).toBe(false);
  });

  it('rejeita vazio', () => {
    expect(validarValorEmReais('').valido).toBe(false);
    expect(validarValorEmReais('   ').valido).toBe(false);
  });

  it('rejeita texto', () => {
    expect(validarValorEmReais('abc').valido).toBe(false);
  });

  it('rejeita negativo', () => {
    expect(validarValorEmReais('-5').valido).toBe(false);
  });

  it('rejeita zero, mesmo o banco aceitando', () => {
    // O CHECK do banco é `preco >= 0`. A diferença é proposital (regra 11.2):
    // zero é tecnicamente válido e não faz sentido de negócio.
    expect(validarValorEmReais('0').valido).toBe(false);
  });

  it('usa o texto literal da seção 15.3', () => {
    const r = validarValorEmReais('');
    expect(r.valido === false && r.mensagem).toBe('Informe um valor inteiro, sem centavos. Ex: 200');
  });

  it('ignora espaço em volta', () => {
    expect(validarValorEmReais(' 350 ').valido).toBe(true);
  });
});

describe('nome e telefone — defeito 11.9.23', () => {
  it('nome vazio é rejeitado com o texto da 15.3', () => {
    const r = validarNome('  ');
    expect(r.valido).toBe(false);
    expect(r.valido === false && r.mensagem).toBe('O nome é obrigatório');
  });

  it('telefone vazio é rejeitado com o texto da 15.3', () => {
    const r = validarTelefone('');
    expect(r.valido).toBe(false);
    expect(r.valido === false && r.mensagem).toBe('O telefone é obrigatório');
  });

  it('aceita preenchidos', () => {
    expect(validarNome('Fernanda Souza').valido).toBe(true);
    expect(validarTelefone('+5521999999999').valido).toBe(true);
  });
});

describe('intervalo de horas — critério de aceite de 8.8', () => {
  it('rejeita hora fim anterior à hora início', () => {
    const r = validarIntervaloDeHoras('15:00', '14:00');
    expect(r.valido).toBe(false);
    expect(r.valido === false && r.mensagem).toBe(
      'A hora fim precisa ser depois da hora início',
    );
  });

  it('rejeita hora fim igual à hora início', () => {
    expect(validarIntervaloDeHoras('14:00', '14:00').valido).toBe(false);
  });

  it('aceita intervalo normal de sessão', () => {
    expect(validarIntervaloDeHoras('14:30', '15:20').valido).toBe(true);
  });

  it('rejeita horário incompleto', () => {
    expect(validarIntervaloDeHoras('', '15:00').valido).toBe(false);
  });
});
