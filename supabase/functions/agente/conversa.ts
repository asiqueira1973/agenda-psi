/**
 * Validação da conversa que o app manda para a Edge Function `agente`.
 *
 * Fica fora do index.ts para poder ser testada sem subir o servidor.
 */

/** Limites da conversa recebida: quantas mensagens e quantos caracteres cada. */
const MAX_MENSAGENS = 20;
const MAX_CARACTERES = 2000;

export type MensagemDoApp = { papel: 'usuario' | 'agente'; texto: string };

/**
 * Valida a conversa recebida. Devolve `null` se algo estiver fora do formato —
 * inclusive a última mensagem não ser da pessoa, que não faria sentido responder.
 */
export function validarConversa(corpo: unknown): MensagemDoApp[] | null {
  const mensagens = (corpo as { mensagens?: unknown })?.mensagens;
  if (!Array.isArray(mensagens) || mensagens.length === 0) return null;
  if (mensagens.length > MAX_MENSAGENS) return null;

  for (const m of mensagens) {
    if (m?.papel !== 'usuario' && m?.papel !== 'agente') return null;
    if (typeof m.texto !== 'string') return null;
    if (m.texto.trim().length === 0 || m.texto.length > MAX_CARACTERES) return null;
  }
  if (mensagens[mensagens.length - 1].papel !== 'usuario') return null;
  return mensagens as MensagemDoApp[];
}
