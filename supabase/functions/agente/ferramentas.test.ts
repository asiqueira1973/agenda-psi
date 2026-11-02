import { assertEquals } from 'jsr:@std/assert@1';
import { definicoesDeFerramentas, diaDaSemanaDoBanco, diasDaSemanaDe, normalizar } from './ferramentas.ts';

Deno.test('normalizar tira acento e caixa', () => {
  assertEquals(normalizar('  José Conceição '), 'jose conceicao');
});

Deno.test('fase 1 só tem ferramentas de consulta', () => {
  // Se alguém acrescentar uma ferramenta de escrita aqui, este teste falha de
  // propósito: escrita é fase 2 e passa pelo cartão de confirmação no app.
  const nomes = definicoesDeFerramentas.map((f) => f.name).sort();
  assertEquals(nomes, ['agenda_da_semana', 'agenda_do_dia', 'buscar_paciente', 'consultar_despesas', 'consultar_mes', 'historico_do_paciente', 'listar_pacientes', 'listar_pendencias']);
});

Deno.test('dia da semana na convenção do banco: 1 = segunda, 7 = domingo', () => {
  assertEquals(diaDaSemanaDoBanco('2026-11-02'), 1); // segunda
  assertEquals(diaDaSemanaDoBanco('2026-11-05'), 4); // quinta
  assertEquals(diaDaSemanaDoBanco('2026-11-08'), 7); // domingo, não 0
});

Deno.test('data inválida não vira dia nenhum', () => {
  assertEquals(diaDaSemanaDoBanco('2026-02-30'), null);
  assertEquals(diaDaSemanaDoBanco('amanhã'), null);
});

Deno.test('semana de segunda a domingo, mesmo a partir de um domingo', () => {
  const semana = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];
  assertEquals(diasDaSemanaDe('2026-11-04'), semana);
  assertEquals(diasDaSemanaDe('2026-11-08'), semana);
  assertEquals(diasDaSemanaDe('2026-11-02'), semana);
});
