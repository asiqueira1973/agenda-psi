import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

/**
 * Análise financeira por IA.
 *
 * Chama a Edge Function `analise-financeira`, com o corpo VAZIO. É a função que
 * lê `v_dashboard_payload_json` com o JWT do usuário e chama o n8n — o app não
 * lê a view nem manda os números para fora (spec 13.2 e defeito 11.9.17).
 *
 * Implementa: 8.3 e o contrato 13.2.
 */

export type Analise = {
  resumo: string;
  riscos: string;
  oportunidades: string;
  acoes_prioritarias: string;
};

const mensagensDeErro: Record<string, string> = {
  nao_autenticado: 'Sua sessão expirou. Entre de novo.',
  limite_excedido: 'Você já pediu muitas análises hoje. Tente de novo amanhã.',
  analise_indisponivel: 'Não foi possível carregar. Toque para tentar de novo.',
};

export function useAnaliseFinanceira() {
  return useMutation({
    mutationFn: async (): Promise<Analise> => {
      const { data, error } = await supabase.functions.invoke('analise-financeira', {
        body: {},
      });

      if (error) {
        const codigo =
          (error as { context?: { body?: { error?: string } } }).context?.body?.error ?? '';
        throw new Error(mensagensDeErro[codigo] ?? mensagensDeErro.analise_indisponivel);
      }

      return data as Analise;
    },
  });
}
