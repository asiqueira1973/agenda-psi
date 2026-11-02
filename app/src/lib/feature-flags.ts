import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/features/auth/session-provider';

/**
 * Sinalizadores de funcionalidade, lidos da tabela `feature_flags` (0014).
 *
 * Servem para desligar uma funcionalidade em produção pelo painel do Supabase,
 * sem build novo e sem revisão de loja.
 *
 * REGRA DE OURO: falha fechada. Enquanto carrega, em erro, ou com a linha
 * ausente, o sinalizador vale `false`. Quem chama não precisa tratar estado de
 * carregamento: "ainda não sei" e "desligado" mostram a mesma tela.
 *
 * O app esconde a entrada; quem RECUSA de verdade é a Edge Function, que confere
 * o mesmo sinalizador a cada chamada. Este hook sozinho não é tranca.
 *
 * Implementa: a migration 0014 e a seção "Interface" de docs/agente-plano.md.
 */

export type ChaveDeSinalizador = 'agente' | 'agente_registros';

/**
 * Lê um sinalizador e relê quando o app volta para o primeiro plano — é o
 * momento em que um desligamento feito no painel precisa chegar ao aparelho.
 *
 * Recebe a chave. Devolve `true` só quando o banco respondeu `ativo = true`.
 */
export function useSinalizador(chave: ChaveDeSinalizador): boolean {
  const { usuarioId } = useSession();
  const queryClient = useQueryClient();
  const queryKey = ['feature-flag', chave, usuarioId];

  const consulta = useQuery({
    queryKey,
    enabled: !!usuarioId,
    // Erro aqui não deve virar tela de erro nem tentativa infinita: desligado
    // é um estado válido do app.
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('ativo')
        .eq('chave', chave)
        .maybeSingle();
      if (error) throw error;
      return data?.ativo === true;
    },
  });

  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void queryClient.invalidateQueries({ queryKey: ['feature-flag', chave] });
    });
    return () => assinatura.remove();
  }, [queryClient, chave]);

  return consulta.isSuccess && consulta.data === true;
}
