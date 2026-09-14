import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/features/auth/session-provider';
import { track, eventos, telas } from '@/lib/analytics';
import { STATUS_PAGO } from '@/features/patients/valores-do-banco';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Despesas: catálogo de tipos, lista das últimas 30, e o CRUD.
 *
 * ⚠️ O defeito 11.9.5 mora aqui, e é o mais constrangedor do app atual: o
 * dropdown de tipo começa com a string literal `Option 1`, placeholder do
 * FlutterFlow. Sem seleção, o insert falha contra uma coluna `uuid NOT NULL` —
 * e o app mostra "Despesa cadastrada" assim mesmo.
 *
 * O catálogo do Visão do Produto confirma o estrago: o evento
 * `agenda_psi_nova despesa` NUNCA disparou. São 98 despesas em toda a base
 * contra 451 pagamentos, e essa é a feature de menor adesão do app.
 *
 * A correção é de três partes, e nenhuma é "lembrar de validar": o tipo começa
 * NULO, o botão fica desabilitado enquanto for nulo, e o erro de escrita
 * aparece em vez de virar sucesso.
 *
 * Implementa: 8.7, inventário 10.18 a 10.20.
 */

export type TipoDespesa = Database['public']['Tables']['tipos_despesa']['Row'];
export type DespesaRecente = Database['public']['Views']['v_despesas_ultimas_30']['Row'];
export type Despesa = Database['public']['Tables']['despesas']['Row'];

export const chaveDespesas = ['despesas'] as const;
export const chaveTiposDespesa = ['tipos-despesa'] as const;
export const chaveDespesa = (id: string) => ['despesa', id] as const;

/**
 * Catálogo de tipos de despesa, ORDENADO POR NOME.
 *
 * A ordenação é a correção do spec 7.2: hoje a ordem é inconsistente entre a
 * tela de criação e a de detalhe, então o mesmo tipo aparece em posições
 * diferentes conforme a tela.
 *
 * Não há filtro de `ativo` aqui, e isso é proposital: o filtro já vive na
 * policy `tipos_despesa_select` (princípio P2). Filtrar de novo no cliente daria
 * a impressão de que quem decide é o app.
 */
export function useTiposDeDespesa() {
  const { usuarioId } = useSession();

  return useQuery({
    queryKey: chaveTiposDespesa,
    enabled: !!usuarioId,
    // O catálogo tem 13 linhas e quase nunca muda: uma hora de cache poupa uma
    // consulta a cada abertura de formulário.
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tipos_despesa')
        .select('*')
        .order('nome', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * As 30 despesas mais recentes, DA MAIS NOVA PARA A MAIS ANTIGA.
 *
 * A view já entrega as 30 certas; a ordenação é reafirmada aqui porque o app
 * atual reordena o resultado e acaba mostrando da mais antiga para a mais nova
 * (critério de aceite de 8.7).
 */
export function useDespesasRecentes() {
  const { usuarioId } = useSession();

  return useQuery({
    queryKey: [...chaveDespesas, usuarioId],
    enabled: !!usuarioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_despesas_ultimas_30')
        .select('*')
        .order('data_referencia', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDespesa(despesaId: string) {
  return useQuery({
    queryKey: chaveDespesa(despesaId),
    enabled: !!despesaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('despesas')
        .select('*')
        .eq('id', despesaId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function invalidar(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: chaveDespesas });
  void queryClient.invalidateQueries({ queryKey: ['dashboard-resumo'] });
}

/** Registra despesa. `tipoDespesaId` é obrigatório e tipado como string. */
export function useCriarDespesa() {
  const queryClient = useQueryClient();
  const { usuarioId, session } = useSession();

  return useMutation({
    mutationFn: async (params: {
      tipoDespesaId: string;
      valorDespesa: number;
      dataCompetencia: string;
      descricao: string | null;
      observacoes: string | null;
    }) => {
      if (!usuarioId) throw new Error('Sem sessão.');
      const { data, error } = await supabase
        .from('despesas')
        .insert({
          usuario_id: usuarioId,
          tipo_despesa_id: params.tipoDespesaId,
          valor_despesa: params.valorDespesa,
          data_competencia: params.dataCompetencia,
          pago_em: new Date().toISOString(),
          status: STATUS_PAGO,
          descricao: params.descricao,
          observacoes: params.observacoes,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (despesaId) => {
      invalidar(queryClient);
      track({
        id: despesaId,
        nome: eventos.novaDespesa,
        distinctId: session?.user.email ?? null,
        tela: telas.novaDespesa,
        descricao: 'nova despesa criada',
      });
    },
  });
}

/** Edita despesa. A competência não é editável, como nas outras telas de detalhe. */
export function useEditarDespesa(despesaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      tipoDespesaId: string;
      valorDespesa: number;
      descricao: string | null;
      observacoes: string | null;
    }) => {
      const { error } = await supabase
        .from('despesas')
        .update({
          tipo_despesa_id: params.tipoDespesaId,
          valor_despesa: params.valorDespesa,
          descricao: params.descricao,
          observacoes: params.observacoes,
        })
        .eq('id', despesaId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chaveDespesa(despesaId) });
      invalidar(queryClient);
    },
  });
}

/** Exclui despesa. A confirmação é da tela (copy 15.4). */
export function useExcluirDespesa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (despesaId: string) => {
      const { error } = await supabase.from('despesas').delete().eq('id', despesaId);
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient),
  });
}
