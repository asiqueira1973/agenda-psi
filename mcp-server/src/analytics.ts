import { createHash, randomUUID } from 'node:crypto';
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

/** Cliente MCP reconhecido pelo nome que ele informa no `initialize` (`clientInfo.name`). */
export type ClienteMcp = 'claude' | 'chatgpt' | 'outro';

/**
 * Classifica o cliente pelo `clientInfo.name` (divergência 12). Só o rótulo sai do
 * servidor, nunca o nome cru, que é texto livre do cliente.
 */
export function clienteDoInitialize(corpo: unknown): ClienteMcp | null {
  const msg = Array.isArray(corpo) ? corpo[0] : corpo;
  const m = msg as { method?: unknown; params?: { clientInfo?: { name?: unknown } } } | undefined;
  if (m?.method !== 'initialize') return null;
  const nome = typeof m.params?.clientInfo?.name === 'string' ? m.params.clientInfo.name.toLowerCase() : '';
  if (nome.includes('claude') || nome.includes('anthropic')) return 'claude';
  if (nome.includes('openai') || nome.includes('chatgpt')) return 'chatgpt';
  return 'outro';
}

/**
 * Id estável do evento de conexão: hash de pessoa + cliente. Como o Visão do Produto
 * deduplica pelo id, cada pessoa conta uma vez por cliente, e não uma vez por conversa.
 * O `sub` entra no hash e não sai em claro.
 */
export function idDeConexao(sub: string, cliente: ClienteMcp): string {
  return createHash('sha256').update(`mcp_conectado:${sub}:${cliente}`).digest('hex').slice(0, 32);
}
