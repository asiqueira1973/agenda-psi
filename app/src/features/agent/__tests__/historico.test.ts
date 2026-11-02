import { historicoParaEnvio, MAX_MENSAGENS_ENVIADAS, type Mensagem } from '../historico';

let n = 0;
const u = (texto: string): Mensagem => ({ id: `u${n++}`, papel: 'usuario', texto });
const a = (texto: string): Mensagem => ({ id: `a${n++}`, papel: 'agente', texto });

describe('historicoParaEnvio', () => {
  it('mantém a conversa alternada como está, sem ids', () => {
    expect(historicoParaEnvio([u('oi'), a('olá'), u('quem deve?')])).toEqual([
      { papel: 'usuario', texto: 'oi' },
      { papel: 'agente', texto: 'olá' },
      { papel: 'usuario', texto: 'quem deve?' },
    ]);
  });

  it('junta perguntas seguidas — a primeira falhou e a pessoa perguntou de novo', () => {
    expect(historicoParaEnvio([u('quem deve?'), u('quem deve?')])).toEqual([
      { papel: 'usuario', texto: 'quem deve?\nquem deve?' },
    ]);
  });

  it('corta as mais antigas e nunca começa pela resposta do agente', () => {
    const longa: Mensagem[] = [];
    for (let i = 0; i < 15; i++) longa.push(u(`p${i}`), a(`r${i}`));
    longa.push(u('última'));

    const enviado = historicoParaEnvio(longa);
    expect(enviado.length).toBeLessThanOrEqual(MAX_MENSAGENS_ENVIADAS);
    expect(enviado[0].papel).toBe('usuario');
    expect(enviado[enviado.length - 1]).toEqual({ papel: 'usuario', texto: 'última' });
  });

  it('não altera a conversa da tela', () => {
    const conversa = [u('a'), u('b')];
    historicoParaEnvio(conversa);
    expect(conversa.map((m) => m.texto)).toEqual(['a', 'b']);
  });

  it('a nota do cartão vai na fala seguinte da pessoa, nunca no texto do agente', () => {
    const resposta: Mensagem = {
      ...a('Confira o cartão.'),
      cartoes: [
        {
          estado: 'confirmado',
          rascunho: { tipo: 'despesas', itens: [{ tipo_despesa: { situacao: 'ok', id: 't', nome: 'Aluguel' }, valor: 1450, data: '2026-11-02', descricao: null }] },
        },
      ],
    };
    const enviado = historicoParaEnvio([u('paguei 1450 de aluguel'), resposta, u('obrigado')]);
    // O texto do agente fica intacto: é o que ele imitaria.
    expect(enviado[1].texto).toBe('Confira o cartão.');
    expect(enviado[2].texto).toBe(
      '(nota do app sobre a resposta anterior: cartão de despesas confirmado e gravado)\nobrigado',
    );
  });
});
