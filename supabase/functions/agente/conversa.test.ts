import { assertEquals } from 'jsr:@std/assert@1';
import { validarConversa } from './conversa.ts';

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
