import { assertEquals } from 'jsr:@std/assert@1';
import { custoEstimado } from './auditoria.ts';

Deno.test('custo estimado: tokens vezes preço por milhão', () => {
  // 10 mil de entrada a US$ 3/mi + 500 de saída a US$ 15/mi = 0,03 + 0,0075
  assertEquals(custoEstimado(10_000, 500), 0.0375);
  assertEquals(custoEstimado(0, 0), 0);
});
