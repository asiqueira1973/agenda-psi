import { randomUUID } from 'node:crypto';
import type { Config } from './config.js';
import type { NomeDeEvento } from './events.js';

/**
 * Um evento do Visão do Produto, com as MESMAS regras do app (21 e
 * app/src/lib/analytics/client.ts): sem nome de paciente, valor, observação ou texto
 * digitado. Por isso não há campo de propriedades livre aqui: o servidor manda `{}`,
 * como o app manda nos eventos de criação.
 */
export type EventoDoServidor = {
  nome: NomeDeEvento;
  /** Id do registro criado: é a chave de deduplicação do lado de lá. */
  id: string;
  /** E-mail do psicólogo, do claim `email` do token (assunção 24.4). */
  distinctId: string | null;
  /** `mcp_<acao>`, para separar a origem sem partir a série (21). */
  tela: `mcp_${string}`;
  /** A mesma frase curta do app para o mesmo evento. */
  descricao: string;
};

/** Tempo máximo esperando o Visão do Produto; depois disso, desiste (como o app). */
const TIMEOUT_MS = 1500;

/**
 * Envia um evento. Nunca lança e nunca falha a gravação (21: "falha do analytics nunca
 * falha a gravação").
 *
 * Diferente do app, aqui se ESPERA o envio, com teto de 1,5 s: numa função serverless,
 * uma promessa solta depois da resposta pode ser cortada, e o evento se perderia. O teto
 * mantém o `salvar_*` dentro dos 2 s da seção 17. Sem chave configurada, não faz nada.
 */
export async function enviarEvento(
  config: Pick<Config, 'analytics'>,
  evento: EventoDoServidor,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!config.analytics) return;
  const corpo = {
    eventos: [{
      id: evento.id || randomUUID(),
      nome: evento.nome,
      distinct_id: evento.distinctId ?? '',
      ocorrido_em: new Date().toISOString(),
      tela: evento.tela,
      descricao: evento.descricao,
      propriedades: {},
    }],
  };
  try {
    await fetchImpl(config.analytics.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': config.analytics.key },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Silêncio proposital, como no app: falha de analytics não vira erro nem retentativa.
  }
}
