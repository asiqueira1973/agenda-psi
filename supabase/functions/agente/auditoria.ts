import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Auditoria do agente — uma linha por pergunta em `agente_auditoria` (0016).
 *
 * É o ÚNICO uso de service_role da função, e só para inserir nesta tabela de
 * sistema, que não tem policy nenhuma. Todo o resto (consultas, propostas)
 * continua com o JWT do usuário.
 *
 * Auditoria nunca derruba a resposta: falha de gravação vai para o log e a
 * pessoa recebe a resposta do mesmo jeito.
 */

/**
 * Preço por milhão de tokens, em dólar, usado na ESTIMATIVA de custo.
 *
 * DECISÃO de 02/11/2026, a conferir com a tabela de preços da Anthropic: o
 * valor do Sonnet nas gerações anteriores (US$ 3 entrada, US$ 15 saída). O
 * preço vai gravado em cada linha, então corrigir aqui não perde o histórico —
 * dá para recalcular as linhas antigas com o preço certo.
 */
export const PRECO_POR_MILHAO = { entrada: 3, saida: 15 } as const;

/** Custo estimado em dólar de uma pergunta. */
export function custoEstimado(tokensEntrada: number, tokensSaida: number): number {
  const custo = (tokensEntrada * PRECO_POR_MILHAO.entrada + tokensSaida * PRECO_POR_MILHAO.saida) / 1_000_000;
  return Math.round(custo * 1_000_000) / 1_000_000;
}

export type LinhaDeAuditoria = {
  usuarioId: string;
  pergunta: string;
  resultado: 'ok' | 'erro' | 'limite_excedido' | 'conversa_invalida' | 'desligado';
  modelo: string | null;
  rodadas: number;
  tokensEntrada: number;
  tokensSaida: number;
  ferramentas: string[];
  rascunhos: number;
  duracaoMs: number;
};

/** Grava a linha. Nunca lança. */
export async function registrarAuditoria(l: LinhaDeAuditoria): Promise<void> {
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !chave) {
      console.error('agente: auditoria sem credencial');
      return;
    }
    const admin = createClient(url, chave, { auth: { persistSession: false } });
    const { error } = await admin.from('agente_auditoria').insert({
      usuario_id: l.usuarioId,
      // Teto de tamanho: a conversa já é limitada, mas a auditoria não deve
      // depender disso.
      pergunta: l.pergunta.slice(0, 2000),
      resultado: l.resultado,
      modelo: l.modelo,
      rodadas: l.rodadas,
      tokens_entrada: l.tokensEntrada,
      tokens_saida: l.tokensSaida,
      preco_entrada_por_mi: PRECO_POR_MILHAO.entrada,
      preco_saida_por_mi: PRECO_POR_MILHAO.saida,
      custo_estimado_usd: custoEstimado(l.tokensEntrada, l.tokensSaida),
      ferramentas: l.ferramentas,
      rascunhos: l.rascunhos,
      duracao_ms: l.duracaoMs,
    });
    if (error) console.error('agente: falha ao gravar auditoria', error.code);
  } catch (e) {
    console.error('agente: falha ao gravar auditoria', e instanceof Error ? e.name : '');
  }
}
