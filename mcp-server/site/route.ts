/**
 * Para onde a raiz `/` encaminha (6.3). O Supabase monta o authorize sobre a Site URL,
 * que termina em `/`, e o resultado é `//oauth/consent`. Se algum caminho com barra
 * dupla cair na raiz com o `authorization_id`, a página o leva para `/oauth/consent`,
 * mantendo a query. Sem ele, fica na raiz. Função pura, testada.
 */
export function destinoDaRaiz(search: string): string | null {
  const q = new URLSearchParams(search);
  return q.get('authorization_id') ? `/oauth/consent?${q.toString()}` : null;
}
