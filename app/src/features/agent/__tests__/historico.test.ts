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
});
