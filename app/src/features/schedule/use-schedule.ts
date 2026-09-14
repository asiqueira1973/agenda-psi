import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/features/auth/session-provider';
import { track, eventos, telas } from '@/lib/analytics';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Agenda semanal — horários fixos recorrentes.
 *
 * Não é agenda de calendário: é "segunda às 14h com a Fernanda", que se repete
 * toda semana até ser excluída (anti-escopo da seção 1). Não há data, não há
 * exceção, não há feriado.
 *
 * ⚠️ O defeito 11.9.4 mora aqui, e é sorrateiro: no app atual, salvar as NOTAS
 * de um agendamento grava `dia_semana = 1` junto. Um horário de quinta vira
 * segunda porque alguém corrigiu uma observação. E como o lembrete por SMS sai
 * do horário fixo, o paciente passa a ser avisado no dia errado.
 *
 * A correção é a mesma estratégia das sessões e pagamentos: `editarObservacoes`
 * só aceita `observacoes`. Não existe caminho em que o dia viaje junto.
 *
 * Implementa: 8.8, inventário 10.6 a 10.8.
 */

export type Agendamento = Database['public']['Views']['view_agenda_semana_padrao']['Row'];

export const chaveAgenda = ['agenda'] as const;
export const chaveAgendamento = (id: string) => ['agendamento', id] as const;

/**
 * Todos os horários fixos do usuário.
 *
 * A grade filtra por dia em memória: são no máximo algumas dezenas de linhas, e
 * trocar de dia no segmented precisa ser instantâneo.
 */
export function useAgenda() {
  const { usuarioId } = useSession();

  return useQuery({
    queryKey: [...chaveAgenda, usuarioId],
    enabled: !!usuarioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('view_agenda_semana_padrao')
        .select('*')
        .order('dia_semana', { ascending: true })
        .order('hora_inicio', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAgendamento(agendamentoId: string) {
  return useQuery({
    queryKey: chaveAgendamento(agendamentoId),
    enabled: !!agendamentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agenda_semana_padrao')
        .select('*, pacientes(nome_completo)')
        .eq('id', agendamentoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function invalidar(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: chaveAgenda });
}

/**
 * Cria horário fixo.
 *
 * `dia_semana` segue a convenção do banco: 1 é SEGUNDA e 7 é domingo (regra
 * 11.4), que não é a do JavaScript. A conversão fica em `diaDaSemanaDoBanco`,
 * num lugar só.
 *
 * Criar o horário é o que LIGA o lembrete por SMS — é por `agenda_semana_padrao`
 * que a `v_sms_lembretes_pendentes` monta a fila (regra 11.5).
 */
export function useCriarAgendamento() {
  const queryClient = useQueryClient();
  const { usuarioId, session } = useSession();

  return useMutation({
    mutationFn: async (params: {
      pacienteId: string;
      diaSemana: number;
      horaInicio: string;
      horaFim: string;
      observacoes: string | null;
    }) => {
      if (!usuarioId) throw new Error('Sem sessão.');
      const { data, error } = await supabase
        .from('agenda_semana_padrao')
        .insert({
          usuario_id: usuarioId,
          paciente_id: params.pacienteId,
          dia_semana: params.diaSemana,
          hora_inicio: params.horaInicio,
          hora_fim: params.horaFim,
          observacoes: params.observacoes,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (agendamentoId) => {
      invalidar(queryClient);
      track({
        id: agendamentoId,
        nome: eventos.novoAgendamento,
        distinctId: session?.user.email ?? null,
        tela: telas.novoAgendamento,
        descricao: 'novo agendamento criado',
      });
    },
  });
}

/**
 * Salva APENAS as observações de um agendamento.
 *
 * O nome da função é deliberadamente específico, e a assinatura também: um
 * único parâmetro, `observacoes`. É a correção estrutural do defeito 11.9.4 —
 * não existe como o dia da semana entrar aqui por descuido, porque não há onde.
 *
 * Para mudar dia ou hora, exclui-se e cria-se de novo, e o rodapé da tela 8 diz
 * isso ao usuário.
 */
export function useEditarObservacoesDoAgendamento(agendamentoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (observacoes: string | null) => {
      const { error } = await supabase
        .from('agenda_semana_padrao')
        .update({ observacoes })
        .eq('id', agendamentoId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chaveAgendamento(agendamentoId) });
      invalidar(queryClient);
    },
  });
}

/** Exclui horário fixo. Isso DESLIGA o lembrete por SMS daquele paciente. */
export function useExcluirAgendamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (agendamentoId: string) => {
      const { error } = await supabase
        .from('agenda_semana_padrao')
        .delete()
        .eq('id', agendamentoId);
      if (error) throw error;
    },
    onSuccess: () => invalidar(queryClient),
  });
}
