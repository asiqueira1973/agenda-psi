/**
 * Tira acento e caixa, para "jose" achar "José".
 *
 * Copiada de `normalizar` em supabase/functions/agente/ferramentas.ts, para o MCP
 * comparar nomes do mesmo jeito que o agente (regras 11.14 e 11.15). Recebe um
 * texto qualquer e devolve a forma comparável, sem espaços nas pontas.
 */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
