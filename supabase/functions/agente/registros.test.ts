import { assertEquals } from 'jsr:@std/assert@1';
import { definicoesDeRegistros, escolherAlvo, mudancasDeSessao } from './registros.ts';

Deno.test('um registro que casa: ok; vários: a pessoa escolhe', () => {
  assertEquals(escolherAlvo(['a'], ['a', 'b']), { situacao: 'ok', registro: 'a' });
  assertEquals(escolherAlvo(['a', 'b'], ['a', 'b', 'c']), { situacao: 'ambiguo', opcoes: ['a', 'b'] });
});

Deno.test('nada casa com o dito: mostra os recentes; nenhum registro: nada a propor', () => {
  assertEquals(escolherAlvo([], ['a', 'b']), { situacao: 'ambiguo', opcoes: ['a', 'b'] });
  assertEquals(escolherAlvo([], []), null);
});

Deno.test('mudanças de sessão: só o que veio, com o literal do banco', () => {
  assertEquals(mudancasDeSessao({ pagamento: 'pagou' }), { pagamento: 'pagou' });
  assertEquals(mudancasDeSessao({ pagamento: 'mensal', modalidade: 'remota' }), {
    pagamento: 'pagamento mensal',
    modalidade: 'remota',
  });
  // A data não é campo de mudança: não existe como ela entrar.
  assertEquals(mudancasDeSessao({ data: '2026-11-03' }), {});
});

Deno.test('apagar paciente não existe no agente (decisão de 02/11/2026)', () => {
  assertEquals(definicoesDeRegistros.some((d) => d.name.includes('paciente')), false);
});
