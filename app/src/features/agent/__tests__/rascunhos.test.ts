import {
  ofertaDePagamento,
  podeConfirmar,
  problemasDoRascunho,
  quantidadeDeItens,
  rascunhosDaResposta,
  textoDoFeedback,
  conflitosDoHorario,
  camposAlterados,
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

describe('feedback pelo agente', () => {
  it('mensagem vazia não confirma; o texto enviado leva categoria e origem', () => {
    expect(podeConfirmar({ tipo: 'feedback', categoria: 'problema', mensagem: ' ' })).toBe(false);
    const r = { tipo: 'feedback' as const, categoria: 'sugestao' as const, mensagem: 'Agenda do mês inteiro ' };
    expect(podeConfirmar(r)).toBe(true);
    expect(quantidadeDeItens(r)).toBe(1);
    expect(textoDoFeedback(r)).toBe('[Sugestão · via assistente] Agenda do mês inteiro');
    expect(rascunhosDaResposta([r]).length).toBe(1);
  });
});

describe('troca de horário', () => {
  const tomas = { situacao: 'ok' as const, id: 't', nome: 'Tomás Ribeiro', preco_referencia: 250 };
  const atual = { situacao: 'ok' as const, id: 'h1', dia_semana: 3, hora_inicio: '09:00', hora_fim: '09:50' };

  it('novo igual ao atual não confirma', () => {
    const r: Rascunho = { tipo: 'troca_horario', paciente: tomas, atual, novo: { dia_semana: 3, hora_inicio: '09:00', hora_fim: '09:50' } };
    expect(podeConfirmar(r)).toBe(false);
    expect(podeConfirmar({ ...r, novo: { dia_semana: 3, hora_inicio: '10:00', hora_fim: '10:50' } })).toBe(true);
  });

  it('horário atual ambíguo trava até a escolha', () => {
    const r: Rascunho = {
      tipo: 'remocao_horario',
      paciente: tomas,
      atual: { situacao: 'ambiguo', opcoes: [atual, { ...atual, id: 'h2', dia_semana: 5 }] },
    };
    expect(podeConfirmar(r)).toBe(false);
  });

  it('conflito com outro paciente vira aviso; o próprio horário trocado não conta', () => {
    const agenda = [
      { id: 'h1', paciente_nome: 'Tomás Ribeiro', dia_semana: 3, hora_inicio: '09:00:00', hora_fim: '09:50:00' },
      { id: 'x', paciente_nome: 'Laura Mendes', dia_semana: 3, hora_inicio: '10:00:00', hora_fim: '10:50:00' },
      { id: 'y', paciente_nome: 'Caio', dia_semana: 4, hora_inicio: '10:00:00', hora_fim: '10:50:00' },
    ];
    expect(conflitosDoHorario({ dia_semana: 3, hora_inicio: '10:30', hora_fim: '11:20' }, agenda, 'h1')).toEqual([
      'Laura Mendes (10:00–10:50)',
    ]);
    expect(conflitosDoHorario({ dia_semana: 3, hora_inicio: '09:10', hora_fim: '09:40' }, agenda, 'h1')).toEqual([]);
  });
});

describe('edição de cadastro', () => {
  const tomas = { situacao: 'ok' as const, id: 't', nome: 'Tomás Ribeiro', preco_referencia: 250 };
  const atual = {
    nome: 'Tomás Ribeiro', telefone: '11 90000-0000', email: null, observacoes: 'manhã',
    status: 'ativo' as const, receber_sms: true, preco: 250,
  };
  it('sem mudança não confirma; telefone vazio também não', () => {
    expect(podeConfirmar({ tipo: 'edicao_paciente', paciente: tomas, atual, novo: atual })).toBe(false);
    expect(podeConfirmar({ tipo: 'edicao_paciente', paciente: tomas, atual, novo: { ...atual, telefone: ' ' } })).toBe(false);
    const novo = { ...atual, receber_sms: false };
    expect(camposAlterados(atual, novo)).toEqual(['receber_sms']);
    expect(podeConfirmar({ tipo: 'edicao_paciente', paciente: tomas, atual, novo })).toBe(true);
  });
});
