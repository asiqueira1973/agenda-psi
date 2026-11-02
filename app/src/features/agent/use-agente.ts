import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/features/auth/session-provider';
import { track, eventos, telas } from '@/lib/analytics';
import { historicoParaEnvio, type Mensagem } from './historico';
import { copyAgente } from './copy';

/**
 * Conversa com o agente do Início — fase 1 de docs/agente-plano.md.
 *
 * A conversa vive só neste estado: não é gravada no banco nem no aparelho.
 * "Nova conversa" e fechar o app apagam tudo, e isso é proposital — a conversa
 * cita nome de paciente e valor pago.
 *
 * O corpo da chamada leva SÓ as mensagens. Não existe `usuario_id` aqui: a
 * Edge Function tira do JWT (pegadinha 3).
 *
 * O evento de analytics leva o comprimento da pergunta, se deu certo e quais
 * ferramentas foram usadas — nunca o texto (spec 20.4, pegadinha 5).
 *
 * Devolve: a conversa, `enviar`, `novaConversa`, se está pensando e o erro da
 * última tentativa, já em texto para a tela.
 */
export function useAgente() {
  const { session } = useSession();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const perguntar = useMutation({
    mutationFn: async (conversa: Mensagem[]) => {
      const { data, error } = await supabase.functions.invoke('agente', {
        body: { mensagens: historicoParaEnvio(conversa) },
      });

      if (error) {
        // A função manda o motivo no corpo do erro. Se não vier, texto genérico
        // — nunca o erro cru do servidor (spec 20.5).
        let codigo = '';
        try {
          const corpo = await (error as { context?: Response }).context?.json();
          codigo = corpo?.error ?? '';
        } catch {
          // corpo ilegível: fica o genérico
        }
        throw new Error(
          copyAgente.erros[codigo as keyof typeof copyAgente.erros] ??
            copyAgente.erros.agente_indisponivel,
        );
      }

      const resposta = data as { resposta?: string; ferramentas?: string[] } | null;
      if (!resposta?.resposta) throw new Error(copyAgente.erros.agente_indisponivel);
      return { texto: resposta.resposta, ferramentas: resposta.ferramentas ?? [] };
    },
  });

  /** Manda uma pergunta. Ignora texto vazio e envio enquanto a anterior corre. */
  function enviar(texto: string) {
    const conteudo = texto.trim();
    if (conteudo.length === 0 || perguntar.isPending) return;

    setErro(null);
    const pergunta: Mensagem = { id: Crypto.randomUUID(), papel: 'usuario', texto: conteudo };
    const conversa = [...mensagens, pergunta];
    setMensagens(conversa);

    perguntar.mutate(conversa, {
      onSuccess: ({ texto: resposta, ferramentas }) => {
        setMensagens((anteriores) => [
          ...anteriores,
          { id: Crypto.randomUUID(), papel: 'agente', texto: resposta },
        ]);
        track({
          nome: eventos.perguntouAssistente,
          distinctId: session?.user.email ?? null,
          tela: telas.inicio,
          descricao: 'perguntou ao agente',
          propriedades: {
            tamanho_do_texto: conteudo.length,
            sucesso: true,
            ferramentas: ferramentas.join(','),
          },
        });
      },
      // A pergunta fica na tela e o erro aparece embaixo: perguntar de novo
      // não obriga a redigitar.
      onError: (e) => {
        setErro(e instanceof Error ? e.message : copyAgente.erros.agente_indisponivel);
        track({
          nome: eventos.perguntouAssistente,
          distinctId: session?.user.email ?? null,
          tela: telas.inicio,
          descricao: 'falha ao perguntar ao agente',
          propriedades: { tamanho_do_texto: conteudo.length, sucesso: false },
        });
      },
    });
  }

  /** Apaga a conversa da memória e volta ao estado inicial do Início. */
  function novaConversa() {
    if (perguntar.isPending) return;
    setMensagens([]);
    setErro(null);
  }

  return { mensagens, enviar, novaConversa, pensando: perguntar.isPending, erro };
}
