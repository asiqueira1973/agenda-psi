/**
 * Preparação da conversa para mandar à Edge Function `agente`.
 *
 * A conversa vive só na memória do aparelho (docs/agente-plano.md, "Interface")
 * e vai inteira a cada pergunta. Esta função garante que ela chega no formato
 * que a função aceita — o mesmo que `supabase/functions/agente/conversa.ts`
 * valida do outro lado.
 */

import type { EstadoDoCartao, Rascunho } from './rascunhos';

/** Um cartão de confirmação dentro de uma resposta do agente. */
export type Cartao = { rascunho: Rascunho; estado: EstadoDoCartao };

export type Mensagem = {
  id: string;
  papel: 'usuario' | 'agente';
  texto: string;
  /** Só nas respostas do agente que propuseram registros (fase 2). */
  cartoes?: Cartao[];
};

/** Nome do tipo de cartão, para a nota que volta à IA. */
const nomeDoCartao: Record<Rascunho['tipo'], string> = {
  sessoes: 'sessões',
  pagamentos: 'pagamentos',
  paciente: 'paciente novo',
  horarios: 'horários',
  despesas: 'despesas',
};

const nomeDoEstado: Record<EstadoDoCartao, string> = {
  aberto: 'ainda não confirmado',
  confirmado: 'confirmado e gravado',
  cancelado: 'cancelado pela pessoa',
};

/**
 * O texto de uma mensagem como a IA vai lê-lo.
 *
 * Resposta com cartão leva uma nota do que aconteceu com ele. Sem isso, a IA
 * não sabe se o "Confira o cartão" virou registro, e numa pergunta seguinte
 * ("e a Helena também") pode repropor o que já foi gravado.
 */
function textoParaEnvio(m: Mensagem): string {
  if (!m.cartoes?.length) return m.texto;
  const notas = m.cartoes.map((c) => `[cartão de ${nomeDoCartao[c.rascunho.tipo]}: ${nomeDoEstado[c.estado]}]`);
  return `${m.texto}\n${notas.join('\n')}`;
}

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
      anterior.texto = `${anterior.texto}\n${textoParaEnvio(m)}`;
    } else {
      juntas.push({ papel: m.papel, texto: textoParaEnvio(m) });
    }
  }

  const recentes = juntas.slice(-MAX_MENSAGENS_ENVIADAS);
  while (recentes.length > 0 && recentes[0].papel !== 'usuario') recentes.shift();
  return recentes;
}
