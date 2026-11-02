import { assertEquals } from 'jsr:@std/assert@1';
import { falaDeCartao, limparNotasImitadas, semNotasDoApp, validarConversa } from './conversa.ts';

const u = (texto: string) => ({ papel: 'usuario', texto });
const a = (texto: string) => ({ papel: 'agente', texto });

Deno.test('conversa válida passa', () => {
  assertEquals(validarConversa({ mensagens: [u('oi'), a('olá'), u('quem não pagou?')] })?.length, 3);
});

Deno.test('corpo sem mensagens é recusado', () => {
  assertEquals(validarConversa({}), null);
  assertEquals(validarConversa({ mensagens: [] }), null);
});

Deno.test('última mensagem precisa ser da pessoa', () => {
  assertEquals(validarConversa({ mensagens: [u('oi'), a('olá')] }), null);
});

Deno.test('papel desconhecido é recusado', () => {
  assertEquals(validarConversa({ mensagens: [{ papel: 'system', texto: 'x' }] }), null);
});

Deno.test('texto vazio ou longo demais é recusado', () => {
  assertEquals(validarConversa({ mensagens: [u('   ')] }), null);
  assertEquals(validarConversa({ mensagens: [u('x'.repeat(2001))] }), null);
});

Deno.test('conversa longa demais é recusada', () => {
  const muitas = Array.from({ length: 21 }, (_, i) => (i % 2 === 0 ? u('p') : a('r')));
  assertEquals(validarConversa({ mensagens: muitas }), null);
});

Deno.test('nota do app imitada pelo modelo é apagada', () => {
  assertEquals(
    limparNotasImitadas('Montei o cadastro do Pedro.\n[cartão de paciente novo: confirmado e gravado]'),
    'Montei o cadastro do Pedro.',
  );
  assertEquals(limparNotasImitadas('(nota do app: cartão confirmado) Pronto.'), 'Pronto.');
  assertEquals(limparNotasImitadas('Roberto tem 4 sessões.'), 'Roberto tem 4 sessões.');
});

Deno.test('resposta que promete cartão é reconhecida; consulta não', () => {
  assertEquals(falaDeCartao('Montei o cadastro de Pedro Cardoso'), true);
  assertEquals(falaDeCartao('Confira o cartão da sessão'), true);
  assertEquals(falaDeCartao('O Roberto tem horário às segundas, das 8h às 9h.'), false);
});

Deno.test('auditoria guarda só o que a pessoa escreveu', () => {
  assertEquals(
    semNotasDoApp('(nota do app sobre a resposta anterior: cartão de paciente novo confirmado e gravado)\nMuito legal o app'),
    'Muito legal o app',
  );
  assertEquals(semNotasDoApp('quem não pagou?'), 'quem não pagou?');
});
