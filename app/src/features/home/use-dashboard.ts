import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/features/auth/session-provider';

/**
 * Leituras da Home: os indicadores do mês e o plano do usuário.
 *
 * As duas views se auto-filtram por `auth.uid()` — não há `where` a escrever, e
 * não deve haver (princípio P2).
 *
 * Implementa: 8.3, regra 11.1 e o inventário 10.5.
 */

export const chaveDashboard = ['dashboard-resumo'] as const;
export const chaveMeuPlano = ['meu-plano'] as const;

/** Os 13 indicadores do mês, calculados inteiramente pela view (regra 11.1). */
export function useDashboardResumo() {
  const { usuarioId } = useSession();

  return useQuery({
    queryKey: [...chaveDashboard, usuarioId],
    enabled: !!usuarioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_dashboard_resumo')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Plano, limite e consumo de SMS do mês.
 *
 * Fonte única do estado do plano. O app não deduz plano de resposta local do
 * StoreKit, em nenhuma hipótese (regra 11.6 e máquina 12.1) — quem diz se
 * alguém é Pro é esta view, alimentada pelas notificações das lojas.
 */
export function useMeuPlano() {
  const { usuarioId } = useSession();

  return useQuery({
    queryKey: [...chaveMeuPlano, usuarioId],
    enabled: !!usuarioId,
    queryFn: async () => {
      const { data, error } = await supabase.from('v_meu_plano').select('*').maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Quantos pacientes o usuário tem. Decide entre a Home cheia e a de boas-vindas. */
export function useTemPacientes() {
  const { usuarioId } = useSession();

  return useQuery({
    queryKey: ['tem-pacientes', usuarioId],
    enabled: !!usuarioId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('pacientes')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });
}
