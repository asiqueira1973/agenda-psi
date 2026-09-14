import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/features/auth/session-provider';
import { track, eventos, telas } from '@/lib/analytics';

/**
 * Conversa com o Agente Psi.
 *
 * Duas correções de segurança e privacidade acontecem aqui, e nenhuma delas é
 * visível na tela:
 *
 * 1. O app chama a Edge Function `agente-psi`, e não mais o webhook n8n aberto.
 *    O corpo leva SÓ o texto — o `usuario_id` é derivado do JWT do outro lado
 *    (spec 13.1 e defeito 11.9.17). Hoje ele vai no corpo, e quem tiver a URL,
 *    que está no bundle, lê e escreve dado de qualquer psicólogo.
 *
 * 2. O evento de analytics leva o COMPRIMENTO do texto e se deu certo — nunca o
 *    texto (spec 20.4 e defeito 11.9.18). Comando de agente costuma conter nome
 *    de paciente e valor pago: "O João pagou 400 reais hoje no pix" é dado de
 *    saúde de terceiro indo para uma ferramenta de produto.
 *
 * Implementa: 8.9, contrato 13.1, regras 20.4 e 20.5.
 */

export type Mensagem = {
  id: string;
  autor: 'usuaria' | 'agente';
  texto: string;
};

/** Erros que a função pode devolver, já traduzidos (copy 15.8 e 15.9). */
const mensagensDeErro: Record<string, string> = {
  nao_autenticado: 'Sua sessão expirou. Entre de novo.',
  chat_vazio: 'Escreva alguma coisa antes de enviar.',
  limite_excedido: 'Você já fez muitas perguntas nesta hora. Tente de novo mais tarde.',
  agente_indisponivel: 'Não consegui responder agora. Tente de novo em alguns instantes.',
};

export function usePerguntarAoAgente() {
  const { session } = useSession();

  return useMutation({
    mutationFn: async (texto: string): Promise<string> => {
      const { data, error } = await supabase.functions.invoke('agente-psi', {
        // O corpo tem UM campo. Não existe usuario_id aqui, e é esse o ponto.
        body: { chat: texto },
      });

      if (error) {
        // A função devolve o motivo no corpo mesmo em erro; se não vier, cai no
        // texto genérico de 15.8 — nunca no erro cru do servidor (spec 20.5).
        const codigo =
          (error as { context?: { body?: { error?: string } } }).context?.body?.error ?? '';
        throw new Error(mensagensDeErro[codigo] ?? mensagensDeErro.agente_indisponivel);
      }

      const saida = (data as { output?: string })?.output;
      if (!saida) throw new Error(mensagensDeErro.agente_indisponivel);
      return saida;
    },

    onSuccess: (_, texto) => {
      track({
        nome: eventos.perguntouAssistente,
        distinctId: session?.user.email ?? null,
        tela: telas.agentePsi,
        descricao: 'usuario perguntou ao agente',
        // Comprimento e sucesso. NUNCA o texto (spec 20.4).
        propriedades: { tamanho_do_texto: texto.length, sucesso: true },
      });
    },

    onError: (_, texto) => {
      track({
        nome: eventos.perguntouAssistente,
        distinctId: session?.user.email ?? null,
        tela: telas.agentePsi,
        descricao: 'falha ao perguntar ao agente',
        propriedades: { tamanho_do_texto: texto.length, sucesso: false },
      });
    },
  });
}
