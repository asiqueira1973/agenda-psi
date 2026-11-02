import {
  ofertaDePagamento,
  podeConfirmar,
  problemasDoRascunho,
  quantidadeDeItens,
  rascunhosDaResposta,
  type ItemDeSessao,
  type Rascunho,
} from '../rascunhos';

const beatriz = { situacao: 'ok' as const, id: 'b', nome: 'Beatriz Nogueira', preco_referencia: 280 };
const anaAmbigua = {
  situacao: 'ambiguo' as const,
  termo: 'Ana',
  opcoes: [
    { id: 'a1', nome: 'Ana Paula', preco_referencia: 250 },
    { id: 'a2', nome: 'Ana Lima', preco_referencia: 300 },
  ],
};

const sessao = (paciente: ItemDeSessao['paciente'], pagamento: ItemDeSessao['pagamento']): ItemDeSessao => ({
  paciente,
  data: '2026-11-02',
  pagamento,
  modalidade: 'presencial',
  duracao_minutos: 50,
});

describe('validação do cartão', () => {
  it('paciente ambíguo trava o Confirmar até a pessoa escolher', () => {
    const r: Rascunho = { tipo: 'sessoes', itens: [sessao(beatriz, 'pagou'), sessao(anaAmbigua, 'nao pagou')] };
    expect(problemasDoRascunho(r)[0]).toEqual([]);
    expect(problemasDoRascunho(r)[1]).toEqual(['Escolha qual "Ana"']);
    expect(podeConfirmar(r)).toBe(false);
  });

  it('pagamento sem valor, ou com centavos, não confirma — mesma regra da tela (11.2)', () => {
    const base = { paciente: beatriz, valor_origem: 'nenhum' as const, data: '2026-11-02', tipo: 'mensal' as const };
    expect(podeConfirmar({ tipo: 'pagamentos', itens: [{ ...base, valor: null }] })).toBe(false);
    expect(podeConfirmar({ tipo: 'pagamentos', itens: [{ ...base, valor: 280.5 }] })).toBe(false);
    expect(podeConfirmar({ tipo: 'pagamentos', itens: [{ ...base, valor: 280 }] })).toBe(true);
  });

  it('paciente novo exige telefone e preço, como o cadastro', () => {
    const r: Rascunho = {
      tipo: 'paciente',
      paciente: { nome: 'Laura Mendes', telefone: null, email: null, preco: null, receber_sms: true },
      horarios: [{ dia_semana: 3, hora_inicio: '10:00', hora_fim: '10:50' }],
    };
    expect(podeConfirmar(r)).toBe(false);
    expect(problemasDoRascunho(r)[0]).toContain('O telefone é obrigatório');
    const completo: Rascunho = { ...r, paciente: { ...r.paciente, telefone: '11 98888-0000', preco: 250 } };
    expect(podeConfirmar(completo)).toBe(true);
    expect(quantidadeDeItens(completo)).toBe(2);
  });

  it('horário com fim antes do início não confirma', () => {
    const r: Rascunho = {
      tipo: 'horarios',
      itens: [{ paciente: beatriz, dia_semana: 1, hora_inicio: '15:00', hora_fim: '14:00' }],
    };
    expect(podeConfirmar(r)).toBe(false);
  });

  it('cartão sem itens (todos removidos) não confirma', () => {
    expect(podeConfirmar({ tipo: 'sessoes', itens: [] })).toBe(false);
  });
});

describe('oferta de pagamento depois da sessão paga', () => {
  it('só as sessões pagas viram oferta, com o preço de referência e editável', () => {
    const oferta = ofertaDePagamento([sessao(beatriz, 'pagou'), sessao(beatriz, 'nao pagou')]);
    expect(oferta).toEqual({
      tipo: 'pagamentos',
      itens: [{ paciente: beatriz, valor: 280, valor_origem: 'referencia', data: '2026-11-02', tipo: 'por sessão' }],
    });
  });

  it('nenhuma sessão paga, nenhuma oferta', () => {
    expect(ofertaDePagamento([sessao(beatriz, 'pagamento mensal')])).toBeNull();
  });
});

describe('leitura da resposta', () => {
  it('descarta o que não tem forma de rascunho', () => {
    const bons = rascunhosDaResposta([
      { tipo: 'sessoes', itens: [sessao(beatriz, 'pagou')] },
      { tipo: 'apagar_tudo', itens: [1] },
      { tipo: 'pagamentos', itens: [] },
      null,
    ]);
    expect(bons.map((r) => r.tipo)).toEqual(['sessoes']);
    expect(rascunhosDaResposta(undefined)).toEqual([]);
  });
});
