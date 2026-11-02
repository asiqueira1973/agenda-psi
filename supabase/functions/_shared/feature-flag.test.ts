import { assertEquals } from 'jsr:@std/assert@1';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { sinalizadorLigado } from './feature-flag.ts';

/** Cliente de mentira que devolve sempre a mesma resposta. */
function clienteQueResponde(resposta: { data: unknown; error: unknown } | 'explode'): SupabaseClient {
  const falso = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            resposta === 'explode'
              ? Promise.reject(new Error('rede caiu'))
              : Promise.resolve(resposta),
        }),
      }),
    }),
  };
  return falso as unknown as SupabaseClient;
}

Deno.test('ligado só quando o banco diz true', async () => {
  assertEquals(await sinalizadorLigado(clienteQueResponde({ data: { ativo: true }, error: null }), 'agente'), true);
});

Deno.test('desligado quando o banco diz false', async () => {
  assertEquals(await sinalizadorLigado(clienteQueResponde({ data: { ativo: false }, error: null }), 'agente'), false);
});

Deno.test('linha ausente é desligado', async () => {
  assertEquals(await sinalizadorLigado(clienteQueResponde({ data: null, error: null }), 'agente'), false);
});

Deno.test('erro de leitura é desligado — falha fechada', async () => {
  assertEquals(await sinalizadorLigado(clienteQueResponde({ data: { ativo: true }, error: { message: 'x' } }), 'agente'), false);
});

Deno.test('exceção é desligado', async () => {
  assertEquals(await sinalizadorLigado(clienteQueResponde('explode'), 'agente'), false);
});

Deno.test('valor que não é o booleano true é desligado', async () => {
  assertEquals(await sinalizadorLigado(clienteQueResponde({ data: { ativo: 'true' }, error: null }), 'agente'), false);
});
