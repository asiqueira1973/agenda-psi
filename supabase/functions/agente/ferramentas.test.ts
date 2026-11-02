import { assertEquals } from 'jsr:@std/assert@1';
import { definicoesDeFerramentas, normalizar } from './ferramentas.ts';

Deno.test('normalizar tira acento e caixa', () => {
  assertEquals(normalizar('  José Conceição '), 'jose conceicao');
});

Deno.test('fase 1 só tem ferramentas de consulta', () => {
  // Se alguém acrescentar uma ferramenta de escrita aqui, este teste falha de
  // propósito: escrita é fase 2 e passa pelo cartão de confirmação no app.
  const nomes = definicoesDeFerramentas.map((f) => f.name).sort();
  assertEquals(nomes, ['buscar_paciente', 'consultar_mes', 'listar_pendencias']);
});
