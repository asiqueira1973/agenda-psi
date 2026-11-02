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
 * A nota do que aconteceu com os cartões de uma resposta do agente.
 *
 * Vai na mensagem SEGUINTE da pessoa, e não no texto do agente: em 02/11/2026,
 * com a nota no texto do agente, o modelo passou a imitá-la — escreveu
 * "[cartão … confirmado e gravado]" sem ter proposto nada. Como fala do app
 * dentro da vez da pessoa, ela é contexto, não modelo de resposta.
 */
function notaDosCartoes(m: Mensagem): string | null {
  if (m.papel !== 'agente' || !m.cartoes?.length) return null;
  const partes = m.cartoes.map((c) => `cartão de ${nomeDoCartao[c.rascunho.tipo]} ${nomeDoEstado[c.estado]}`);
  return `(nota do app sobre a resposta anterior: ${partes.join('; ')})`;
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
  let notaPendente: string | null = null;
  for (const m of conversa) {
    // A nota dos cartões entra no começo da próxima fala da pessoa.
    const texto = m.papel === 'usuario' && notaPendente ? `${notaPendente}\n${m.texto}` : m.texto;
    if (m.papel === 'usuario') notaPendente = null;

    const anterior = juntas[juntas.length - 1];
    if (anterior && anterior.papel === m.papel) {
      anterior.texto = `${anterior.texto}\n${texto}`;
    } else {
      juntas.push({ papel: m.papel, texto });
    }

    const nota = notaDosCartoes(m);
    if (nota) notaPendente = notaPendente ? `${notaPendente}\n${nota}` : nota;
  }

  const recentes = juntas.slice(-MAX_MENSAGENS_ENVIADAS);
  while (recentes.length > 0 && recentes[0].papel !== 'usuario') recentes.shift();
  return recentes;
}
