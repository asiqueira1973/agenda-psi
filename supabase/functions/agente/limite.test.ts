import { assertEquals } from 'jsr:@std/assert@1';
import { estourou, mensagemDoTeto, TETOS } from './limite.ts';

Deno.test('tetos decididos em 02/11/2026', () => {
  assertEquals(TETOS, { free: { dia: 10, semana: 30 }, pro: { dia: 20, semana: 60 } });
});

Deno.test('abaixo dos tetos, passa', () => {
  assertEquals(estourou('free', 9, 29, null), null);
  assertEquals(estourou('pro', 19, 59, null), null);
});

Deno.test('o teto do dia vem antes do da semana', () => {
  assertEquals(estourou('free', 10, 30, null)?.tipo, 'dia');
  assertEquals(estourou('pro', 20, 10, null)?.tipo, 'dia');
});

Deno.test('semana estourada diz quando volta: 7 dias depois da mais antiga', () => {
  const e = estourou('pro', 3, 60, new Date('2026-11-02T15:00:00Z'));
  assertEquals(e?.tipo, 'semana');
  assertEquals(e?.voltaEm, '09/11');
});

Deno.test('a mensagem do gratuito convida para o Pro; a do Pro não', () => {
  assertEquals(
    mensagemDoTeto({ tipo: 'dia', limite: 10, plano: 'free', voltaEm: null }),
    'Você chegou ao limite de 10 perguntas por dia do plano gratuito. O assistente volta amanhã. No plano Pro são 20 por dia e 60 por semana: veja em Ajustes › Meu plano.',
  );
  assertEquals(
    mensagemDoTeto({ tipo: 'semana', limite: 60, plano: 'pro', voltaEm: '09/11' }),
    'Você chegou ao limite de 60 perguntas por semana do plano Pro. O assistente volta em 09/11.',
  );
});
