import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/features/auth/session-provider';
import { chaveProfissionalAtual } from '@/features/auth/use-profissional-atual';

/**
 * Escritas das Configurações: perfil, feedback e desativação de conta.
 *
 * A leitura do perfil NÃO está aqui: ela é `useProfissionalAtual`, a mesma
 * consulta de `v_profissional_atual` que o guardião de rota usa. É de propósito
 * — o app atual mostra "Meu perfil" a partir do cache local do estado global, e
 * por isso exibe dado defasado quando algo muda fora do app (spec 8.10).
 *
 * Implementa: 8.10, inventário 10.22, 10.26 e 10.27.
 */

/** Atualiza os quatro campos editáveis do perfil. */
export function useAtualizarPerfil() {
  const queryClient = useQueryClient();
  const { usuarioId } = useSession();

  return useMutation({
    mutationFn: async (params: {
      nome: string;
      telefone: string | null;
      linkedin: string | null;
      instagram: string | null;
    }) => {
      if (!usuarioId) throw new Error('Sem sessão.');
      const { error } = await supabase
        .from('profissionais')
        .update({
          nome: params.nome.trim(),
          telefone: params.telefone?.trim() || null,
          linkedin: params.linkedin?.trim() || null,
          instagram: params.instagram?.trim() || null,
        })
        .eq('usuario_id', usuarioId);
      if (error) throw error;
    },
    // Invalida a consulta do perfil: a próxima abertura lê do banco, não de um
    // valor guardado aqui. É o que faz "alterar o nome, sair e voltar mostra o
    // nome novo" ser verdade (critério de aceite de 8.10).
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chaveProfissionalAtual });
    },
  });
}

/**
 * Envia feedback.
 *
 * A mensagem é obrigatória. O app atual aceita em branco e dispara um e-mail
 * vazio ao administrador (spec 8.10) — a validação é da tela, e aqui a escrita
 * apenas confia nela.
 *
 * Depois de gravar, avisa o administrador pela Edge Function `notifica-admin`,
 * que busca o conteúdo no banco pelo id. O app não manda o texto para fora
 * (defeito 11.9.17).
 */
export function useEnviarFeedback() {
  const { session } = useSession();

  return useMutation({
    mutationFn: async (mensagem: string) => {
      const { data, error } = await supabase
        .from('feedback')
        .insert({
          mensagem: mensagem.trim(),
          email: session?.user.email ?? null,
          app_name: 'agenda_psi',
        })
        .select('id')
        .single();
      if (error) throw error;

      // O aviso ao administrador é secundário: se falhar, o feedback já está
      // gravado e a pessoa não precisa saber nem tentar de novo.
      void supabase.functions
        .invoke('notifica-admin', {
          body: { tipo: 'feedback', referencia: String(data.id) },
        })
        .catch(() => undefined);

      return data.id;
    },
  });
}

/**
 * Desativa a própria conta. Soft delete: `ativo = false` (regra 6.4).
 *
 * Duas correções em relação ao app atual, e a primeira é o defeito 11.9.7: lá o
 * campo de confirmação é READ-ONLY, o que torna a feature INOPERANTE — não há
 * como digitar QUERO DELETAR, logo não há como apagar a conta. Uma feature que
 * a Política de Privacidade promete e que nunca funcionou.
 *
 * A segunda: o app desloga imediatamente depois. Hoje não desloga, e o usuário
 * continua navegando numa conta que acabou de desativar.
 *
 * Nenhum dado é apagado — ver risco 23.6 e a pergunta aberta 25.4.
 */
export function useDesativarConta() {
  const { usuarioId } = useSession();

  return useMutation({
    mutationFn: async () => {
      if (!usuarioId) throw new Error('Sem sessão.');
      const { error } = await supabase
        .from('profissionais')
        .update({ ativo: false })
        .eq('usuario_id', usuarioId);
      if (error) throw error;

      // Deslogar faz parte da operação, não é um passo separado que alguém
      // possa esquecer de chamar.
      await supabase.auth.signOut();
    },
  });
}

/** Texto que precisa ser digitado para confirmar a exclusão (copy 15.4). */
export const CONFIRMACAO_DE_EXCLUSAO = 'QUERO DELETAR';
