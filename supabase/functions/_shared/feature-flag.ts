import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Leitura de um sinalizador de funcionalidade (tabela `feature_flags`, 0014).
 *
 * REGRA DE OURO: falha fechada. Linha ausente, erro de leitura ou qualquer
 * resposta que não seja `ativo === true` conta como DESLIGADO. Um interruptor
 * de emergência que liga sozinho quando o banco engasga não é interruptor.
 *
 * Recebe o cliente já autenticado como o usuário — a tabela tem leitura para
 * `authenticated`, então não há motivo para service_role aqui.
 *
 * Devolve: `true` só quando o banco disse, sem erro, que está ligado.
 *
 * Implementa: a migration 0014 e a seção "Interface" de docs/agente-plano.md.
 */
export async function sinalizadorLigado(
  cliente: SupabaseClient,
  chave: string,
): Promise<boolean> {
  try {
    const { data, error } = await cliente
      .from('feature_flags')
      .select('ativo')
      .eq('chave', chave)
      .maybeSingle();
    if (error) return false;
    // Comparação estrita: só o booleano true liga. "true" em texto, 1 ou
    // qualquer outra coisa que um dia apareça por engano fica desligado.
    return data?.ativo === true;
  } catch {
    return false;
  }
}
