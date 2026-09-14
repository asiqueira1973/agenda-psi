import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/features/auth/session-provider';
import { track, eventos, telas } from '@/lib/analytics';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Sessões: registrar, ler, editar e excluir.
 *
 * ⚠️ O defeito mais grave do app atual mora aqui. Ao EDITAR uma sessão, ele
 * grava `duracao_minutos` a partir do campo de DATA; o parse falha, e toda
 * edição zera a duração no banco (defeito 11.9.1). Uma pessoa que abre a sessão
 * só para corrigir a observação perde a duração sem nunca saber.
 *
 * A defesa aqui é estrutural, não atenção: `editarSessao` recebe um objeto com
 * campos nomeados e tipados, e `duracaoMinutos` é `number | null`. Não existe
 * caminho em que a data chegue ali.
 *
 * Implementa: 8.5, inventário 10.14 e 10.15.
 */

export type Sessao = Database['public']['Tables']['sessoes']['Row'];

export const chaveSessao = (id: string) => ['sessao', id] as const;

/** Uma sessão, para a tela de detalhe. */
export function useSessao(sessaoId: string) {
  return useQuery({
    queryKey: chaveSessao(sessaoId),
    enabled: !!sessaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessoes')
        .select('*')
        .eq('id', sessaoId)
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
 * Registra sessão.
 *
 * Grava exatamente os oito campos do critério de aceite de 8.5 e nada mais.
 * Em particular NÃO grava `ocorreu_em` nem `status`: a primeira tem default
 * `now()` e a segunda default `realizada`, e o app atual também não as escreve
 * (spec 7.2). Escrevê-las aqui mudaria o significado de colunas que as views do
 * dashboard leem.
 */
export function useCriarSessao() {
  const queryClient = useQueryClient();
  const { usuarioId, session } = useSession();

  return useMutation({
    mutationFn: async (params: {
      pacienteId: string;
      ocorreuEmDia: string;
      modalidade: string;
      duracaoMinutos: number | null;
      pagamento: string;
      deveSerCobrada: boolean;
      observacoes: string | null;
    }) => {
      if (!usuarioId) throw new Error('Sem sessão.');
      const { data, error } = await supabase
        .from('sessoes')
        .insert({
          usuario_id: usuarioId,
          paciente_id: params.pacienteId,
          ocorreu_em_dia: params.ocorreuEmDia,
          modalidade: params.modalidade,
          duracao_minutos: params.duracaoMinutos,
          pagamento: params.pagamento,
          devesercobrada: params.deveSerCobrada,
          observacoes: params.observacoes,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (sessaoId, variaveis) => {
      invalidar(queryClient, variaveis.pacienteId);
      track({
        id: sessaoId,
        nome: eventos.novaSessao,
        distinctId: session?.user.email ?? null,
        tela: telas.novaSessao,
        descricao: 'nova sessao criada',
      });
    },
  });
}

/**
 * Edita sessão.
 *
 * A data NÃO é editável (spec 10, tela 15): para mudar a data, exclui-se e
 * cria-se de novo, e o rodapé da folha diz isso. Por isso `ocorreuEmDia` não
 * está entre os parâmetros — não há como confundi-lo com a duração.
 */
export function useEditarSessao(sessaoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      pacienteId: string;
      modalidade: string;
      duracaoMinutos: number | null;
      pagamento: string;
      deveSerCobrada: boolean;
      observacoes: string | null;
    }) => {
      const { error } = await supabase
        .from('sessoes')
        .update({
          modalidade: params.modalidade,
          duracao_minutos: params.duracaoMinutos,
          pagamento: params.pagamento,
          devesercobrada: params.deveSerCobrada,
          observacoes: params.observacoes,
        })
        .eq('id', sessaoId);
      if (error) throw error;
    },
    onSuccess: (_, variaveis) => {
      void queryClient.invalidateQueries({ queryKey: chaveSessao(sessaoId) });
      invalidar(queryClient, variaveis.pacienteId);
    },
  });
}

/** Exclui sessão. A confirmação é da tela (copy 15.4). */
export function useExcluirSessao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { sessaoId: string; pacienteId: string }) => {
      const { error } = await supabase.from('sessoes').delete().eq('id', params.sessaoId);
      if (error) throw error;
    },
    onSuccess: (_, variaveis) => invalidar(queryClient, variaveis.pacienteId),
  });
}
