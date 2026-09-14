import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/features/auth/session-provider';
import { track, eventos, telas } from '@/lib/analytics';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Leituras e escritas de paciente.
 *
 * A regra que este arquivo inteiro obedece: **toda escrita invalida a query
 * afetada**. É o que corrige dois defeitos do app atual de uma vez — a lista que
 * não recarrega depois de uma escrita (11.9.14) e o detalhe do paciente, cujo
 * cartão de preço e totais vêm do parâmetro de rota e nunca recarregam, de modo
 * que atualizar o preço não muda nada na tela (11.9.11).
 *
 * Nunca passe dado de paciente por parâmetro de navegação para exibir. Passe o
 * id e leia aqui.
 *
 * Implementa: 8.4, inventário 10.9 a 10.13.
 */

export type { PacienteCartao } from './filtro';
export { filtrarPacientes } from './filtro';
export type Sessao = Database['public']['Tables']['sessoes']['Row'];
export type Pagamento = Database['public']['Tables']['pagamentos']['Row'];
export type PrecoPaciente = Database['public']['Tables']['precos_paciente']['Row'];

export const chavePacientes = ['pacientes'] as const;
export const chavePaciente = (id: string) => ['paciente', id] as const;
export const chaveHistoricoSessoes = (id: string) => ['paciente', id, 'sessoes'] as const;
export const chaveHistoricoPagamentos = (id: string) => ['paciente', id, 'pagamentos'] as const;
export const chaveHistoricoPrecos = (id: string) => ['paciente', id, 'precos'] as const;

/**
 * Lista de pacientes, de `v_pacientes_cartao`.
 *
 * Ordenada por status e nome (spec 8.4). A busca é feita em memória: são no
 * máximo 500 pacientes por usuário (requisito 17.7), e filtrar no cliente evita
 * uma ida ao servidor a cada tecla — o que na rede de um consultório é a
 * diferença entre buscar e esperar.
 */
export function usePacientes() {
  const { usuarioId } = useSession();

  return useQuery({
    queryKey: [...chavePacientes, usuarioId],
    enabled: !!usuarioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_pacientes_cartao')
        .select('*')
        .order('status', { ascending: true })
        .order('nome_completo', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Um paciente, lido da view — não do parâmetro de rota.
 *
 * Esta escolha é a correção do defeito 11.9.11: no app atual a tela de detalhe
 * recebe a linha inteira pela navegação, então o preço e os totais congelam no
 * valor que tinham quando a lista foi carregada.
 */
export function usePaciente(pacienteId: string) {
  return useQuery({
    queryKey: chavePaciente(pacienteId),
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_pacientes_cartao')
        .select('*')
        .eq('paciente_id', pacienteId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Histórico de sessões do paciente.
 *
 * Ordenado por `ocorreu_em_dia`, que é a MESMA coluna que a tela exibe. O app
 * atual ordena por `criado_em` e exibe `ocorreu_em_dia`, então uma sessão
 * lançada com atraso aparece fora de ordem sem explicação (defeito 8.4).
 */
export function useHistoricoDeSessoes(pacienteId: string) {
  return useQuery({
    queryKey: chaveHistoricoSessoes(pacienteId),
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessoes')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('ocorreu_em_dia', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Histórico de pagamentos, ordenado por `data_competencia`, que é o exibido. */
export function useHistoricoDePagamentos(pacienteId: string) {
  return useQuery({
    queryKey: chaveHistoricoPagamentos(pacienteId),
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pagamentos')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('data_competencia', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Histórico de preços, ordenado por `vigencia_desde`, que é o exibido. */
export function useHistoricoDePrecos(pacienteId: string) {
  return useQuery({
    queryKey: chaveHistoricoPrecos(pacienteId),
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('precos_paciente')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('vigencia_desde', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Invalida tudo que depende de um paciente. Chamado depois de toda escrita. */
function invalidarPaciente(queryClient: ReturnType<typeof useQueryClient>, pacienteId?: string) {
  void queryClient.invalidateQueries({ queryKey: chavePacientes });
  void queryClient.invalidateQueries({ queryKey: ['dashboard-resumo'] });
  void queryClient.invalidateQueries({ queryKey: ['tem-pacientes'] });
  if (pacienteId) {
    void queryClient.invalidateQueries({ queryKey: ['paciente', pacienteId] });
  }
}

/**
 * Cadastra paciente E o primeiro preço, nesta ordem.
 *
 * São duas escritas. O preço é obrigatório e inteiro, validado ANTES (regra
 * 11.2): o app atual grava `NULL` numa coluna `NOT NULL` quando o campo está
 * vazio ou tem vírgula, a escrita falha, e a tela mostra sucesso assim mesmo
 * (defeito 11.9.6).
 *
 * Se o insert do preço falhar depois do paciente ter sido criado, o paciente
 * fica sem preço — e é melhor assim do que apagar o paciente por baixo do
 * usuário. O erro aparece, e atualizar o preço é um toque no detalhe.
 */
export function useCriarPaciente() {
  const queryClient = useQueryClient();
  const { usuarioId, session } = useSession();

  return useMutation({
    mutationFn: async (params: {
      nomeCompleto: string;
      telefone: string;
      email: string | null;
      observacoes: string | null;
      preco: number;
      receberSms: boolean;
    }) => {
      if (!usuarioId) throw new Error('Sem sessão.');

      const { data: paciente, error: erroPaciente } = await supabase
        .from('pacientes')
        .insert({
          usuario_id: usuarioId,
          nome_completo: params.nomeCompleto.trim(),
          telefone: params.telefone.trim(),
          email: params.email?.trim() || null,
          observacoes: params.observacoes?.trim() || null,
          receber_sms: params.receberSms,
          status: 'ativo',
        })
        .select('id')
        .single();

      if (erroPaciente) throw erroPaciente;

      const { error: erroPreco } = await supabase.from('precos_paciente').insert({
        usuario_id: usuarioId,
        paciente_id: paciente.id,
        preco: params.preco,
      });

      if (erroPreco) throw erroPreco;

      return paciente.id;
    },
    onSuccess: (pacienteId) => {
      invalidarPaciente(queryClient, pacienteId);
      track({
        nome: eventos.novoPaciente,
        distinctId: session?.user.email ?? null,
        tela: telas.novoPaciente,
        descricao: 'novo paciente criado',
      });
    },
  });
}

/**
 * Edita paciente.
 *
 * Nome e telefone continuam obrigatórios aqui, e não só no cadastro — o app
 * atual valida na criação e não na edição (defeito 11.9.23). A validação está
 * na tela; esta função só grava.
 *
 * Emite evento de analytics, que a edição do app atual não emite (defeito 8.4).
 */
export function useEditarPaciente(pacienteId: string) {
  const queryClient = useQueryClient();
  const { session } = useSession();

  return useMutation({
    mutationFn: async (params: {
      nomeCompleto: string;
      telefone: string;
      email: string | null;
      observacoes: string | null;
      status: string;
      receberSms: boolean;
    }) => {
      const { error } = await supabase
        .from('pacientes')
        .update({
          nome_completo: params.nomeCompleto.trim(),
          telefone: params.telefone.trim(),
          email: params.email?.trim() || null,
          observacoes: params.observacoes?.trim() || null,
          status: params.status,
          receber_sms: params.receberSms,
        })
        .eq('id', pacienteId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarPaciente(queryClient, pacienteId);
      track({
        nome: eventos.pacienteEditado,
        distinctId: session?.user.email ?? null,
        tela: telas.editarPaciente,
        descricao: 'paciente editado',
      });
    },
  });
}

/**
 * Atualiza o preço criando uma linha NOVA.
 *
 * `precos_paciente` é append-only: nunca se faz update de preço (regra 11.2). A
 * vigência é sempre `CURRENT_DATE`, default do banco — não há preço futuro nem
 * retroativo pela interface, e isso é decisão declarada do spec, não limitação.
 */
export function useAtualizarPreco(pacienteId: string) {
  const queryClient = useQueryClient();
  const { usuarioId, session } = useSession();

  return useMutation({
    mutationFn: async (params: { preco: number; observacoes: string | null }) => {
      if (!usuarioId) throw new Error('Sem sessão.');
      const { error } = await supabase.from('precos_paciente').insert({
        usuario_id: usuarioId,
        paciente_id: pacienteId,
        preco: params.preco,
        observacoes: params.observacoes?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarPaciente(queryClient, pacienteId);
      track({
        nome: eventos.atualizacaoPreco,
        distinctId: session?.user.email ?? null,
        tela: telas.atualizarPreco,
        descricao: 'preco atualizado',
      });
    },
  });
}

/**
 * Exclui paciente. HARD DELETE, com cascata.
 *
 * É a única entidade do app com exclusão definitiva (spec 7.2), e por isso a
 * única com confirmação nominal — o alerta diz o nome e lista o que vai junto:
 * sessões, pagamentos, preços e horários. A cascata é do banco, não daqui.
 */
export function useExcluirPaciente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pacienteId: string) => {
      const { error } = await supabase.from('pacientes').delete().eq('id', pacienteId);
      if (error) throw error;
    },
    onSuccess: (_, pacienteId) => invalidarPaciente(queryClient, pacienteId),
  });
}
