/**
 * Preparação da conversa para mandar à Edge Function `agente`.
 *
 * A conversa vive só na memória do aparelho (docs/agente-plano.md, "Interface")
 * e vai inteira a cada pergunta. Esta função garante que ela chega no formato
 * que a função aceita — o mesmo que `supabase/functions/agente/conversa.ts`
 * valida do outro lado.
 */

export type Mensagem = {
  id: string;
  papel: 'usuario' | 'agente';
  texto: string;
};

/** Mesmo teto da Edge Function. Passou disso, as mais antigas ficam de fora. */
export const MAX_MENSAGENS_ENVIADAS = 20;

/**
 * Monta o histórico a enviar.
 *
 * Recebe a conversa da tela, na ordem. Devolve só `{ papel, texto }`, com três
 * ajustes:
 * - mensagens seguidas do mesmo papel viram uma só — acontece quando uma
 *   pergunta falhou e a pessoa perguntou de novo, e a API exige alternância;
 * - fica com as últimas `MAX_MENSAGENS_ENVIADAS`;
 * - começa sempre pela pessoa: o corte pode deixar uma resposta do agente na
 *   frente, e a conversa não pode abrir com ela.
 */
export function historicoParaEnvio(
  conversa: Mensagem[],
): Array<{ papel: Mensagem['papel']; texto: string }> {
  const juntas: Array<{ papel: Mensagem['papel']; texto: string }> = [];
  for (const m of conversa) {
    const anterior = juntas[juntas.length - 1];
    if (anterior && anterior.papel === m.papel) {
      anterior.texto = `${anterior.texto}\n${m.texto}`;
    } else {
      juntas.push({ papel: m.papel, texto: m.texto });
    }
  }

  const recentes = juntas.slice(-MAX_MENSAGENS_ENVIADAS);
  while (recentes.length > 0 && recentes[0].papel !== 'usuario') recentes.shift();
  return recentes;
}
