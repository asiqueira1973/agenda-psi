import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/features/auth/session-provider';
import { track, eventos, telas } from '@/lib/analytics';
import { STATUS_PAGO } from '@/features/patients/valores-do-banco';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Pagamentos: registrar, ler, editar e excluir.
 *
 * ⚠️ Dois defeitos do app atual moram aqui, e são irmãos do 11.9.1:
 *
 * - ao EDITAR, ele grava `valor_pagamento` a partir do campo de DATA, zerando o
 *   valor (defeito 11.9.2);
 * - o dropdown de tipo é editável mas nunca é salvo (defeito 11.9.3).
 *
 * A defesa é a mesma: parâmetros nomeados e tipados. `valorPagamento` é
 * `number`, `dataCompetencia` é `string`, e `tipo` está na lista do update.
 *
 * Implementa: 8.6, inventário 10.16 e 10.17.
 */

export type Pagamento = Database['public']['Tables']['pagamentos']['Row'];

export const chavePagamento = (id: string) => ['pagamento', id] as const;

export function usePagamento(pagamentoId: string) {
  return useQuery({
    queryKey: chavePagamento(pagamentoId),
    enabled: !!pagamentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pagamentos')
        .select('*')
        .eq('id', pagamentoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function invalidar(queryClient: ReturnType<typeof useQueryClient>, pacienteId: string) {
  void queryClient.invalidateQueries({ queryKey: ['paciente', pacienteId] });
  void queryClient.invalidateQueries({ queryKey: ['pacientes'] });
  void queryClient.invalidateQueries({ queryKey: ['dashboard-resumo'] });
}

/**
 * Registra pagamento.
 *
 * Grava os oito campos do critério de aceite de 8.6. Duas distinções que o
 * spec faz questão de separar (7.2):
 *
 * - `data_competencia` é o MÊS a que o pagamento pertence, escolhido pela
 *   pessoa, e é o que a interface mostra;
 * - `pago_em` é o instante do registro no app, `now()`, e não a data escolhida.
 *
 * Trocar um pelo outro desloca o dinheiro de mês no dashboard.
 */
export function useCriarPagamento() {
  const queryClient = useQueryClient();
  const { usuarioId, session } = useSession();

  return useMutation({
    mutationFn: async (params: {
      pacienteId: string;
      valorPagamento: number;
      dataCompetencia: string;
      tipo: string;
      observacoes: string | null;
    }) => {
      if (!usuarioId) throw new Error('Sem sessão.');
      const { data, error } = await supabase
        .from('pagamentos')
        .insert({
          usuario_id: usuarioId,
          paciente_id: params.pacienteId,
          valor_pagamento: params.valorPagamento,
          data_competencia: params.dataCompetencia,
          pago_em: new Date().toISOString(),
          status: STATUS_PAGO,
          tipo: params.tipo,
          observacoes: params.observacoes,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (pagamentoId, variaveis) => {
      invalidar(queryClient, variaveis.pacienteId);
      track({
        id: pagamentoId,
        nome: eventos.novoPagamento,
        distinctId: session?.user.email ?? null,
        tela: telas.novoPagamento,
        descricao: 'novo pagamento criado',
      });
    },
  });
}

/**
 * Edita pagamento.
 *
 * `tipo` ESTÁ na lista — é a correção do defeito 11.9.3. A competência não é
 * editável (spec 10, tela 17), pelo mesmo motivo da data da sessão.
 */
export function useEditarPagamento(pagamentoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      pacienteId: string;
      valorPagamento: number;
      tipo: string;
      observacoes: string | null;
    }) => {
      const { error } = await supabase
        .from('pagamentos')
        .update({
          valor_pagamento: params.valorPagamento,
          tipo: params.tipo,
          observacoes: params.observacoes,
        })
        .eq('id', pagamentoId);
      if (error) throw error;
    },
    onSuccess: (_, variaveis) => {
      void queryClient.invalidateQueries({ queryKey: chavePagamento(pagamentoId) });
      invalidar(queryClient, variaveis.pacienteId);
    },
  });
}

/** Exclui pagamento. A confirmação é da tela (copy 15.4). */
export function useExcluirPagamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { pagamentoId: string; pacienteId: string }) => {
      const { error } = await supabase.from('pagamentos').delete().eq('id', params.pagamentoId);
      if (error) throw error;
    },
    onSuccess: (_, variaveis) => invalidar(queryClient, variaveis.pacienteId),
  });
}
