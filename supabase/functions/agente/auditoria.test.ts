import { assertEquals } from 'jsr:@std/assert@1';
import { custoEstimado } from './auditoria.ts';

Deno.test('custo estimado: tokens vezes preço por milhão', () => {
  // 10 mil de entrada a US$ 3/mi + 500 de saída a US$ 15/mi = 0,03 + 0,0075
  assertEquals(custoEstimado(10_000, 500), 0.0375);
  assertEquals(custoEstimado(0, 0), 0);
});

Deno.test('cache: lido custa 10%, gravado 125% do preço de entrada', () => {
  // 1.000 normais + 10.000 lidos do cache + 500 de saída
  // = (1.000 + 10.000 × 0,1) × 3 + 500 × 15 = 6.000 + 7.500 = 13.500 por milhão
  assertEquals(custoEstimado(1_000, 500, 0, 10_000), 0.0135);
  // o mesmo, gravando o cache em vez de ler: (1.000 + 12.500) × 3 + 7.500
  assertEquals(custoEstimado(1_000, 500, 10_000, 0), 0.048);
});
