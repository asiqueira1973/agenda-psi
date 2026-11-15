import type { ClaimsReader } from '../src/auth/verify-token.js';
import { lerConfig } from '../src/config.js';

/** Configuração fixa dos testes; nenhum valor real. */
export const configDeTeste = lerConfig({
  SUPABASE_URL: 'https://exemplo.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_teste',
  MCP_PUBLIC_URL: 'https://mcp.exemplo.com/mcp',
});

/** Claims de um token OAuth válido do Supabase, vencendo daqui a uma hora. */
export function claimsValidas(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: 'https://exemplo.supabase.co/auth/v1',
    sub: '00000000-0000-0000-0000-000000000001',
    aud: 'authenticated',
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
    client_id: 'cliente-dcr',
    ...extra,
  };
}

/**
 * Leitor de claims simulado: o token `valido` devolve `claims`; qualquer outro é
 * recusado, como o Supabase Auth faz com assinatura errada.
 */
export function leitorSimulado(claims: Record<string, unknown>): ClaimsReader {
  return {
    async getClaims(jwt: string) {
      return jwt === 'valido' ? { data: { claims }, error: null } : { data: null, error: new Error('invalid JWT') };
    },
  };
}

/**
 * Consulta simulada do PostgREST: registra as chamadas encadeadas e resolve com `resultado`.
 * Basta para testar quais filtros a ferramenta aplicou e como trata a resposta.
 */
export function dbSimulado(resultado: { data: unknown; error: unknown }) {
  const chamadas: Array<[string, unknown[]]> = [];
  const consulta: Record<string, unknown> = {};
  for (const metodo of ['from', 'select', 'eq', 'gte', 'lte', 'lt', 'gt', 'in', 'order', 'limit']) {
    consulta[metodo] = (...args: unknown[]) => {
      chamadas.push([metodo, args]);
      return consulta;
    };
  }
  consulta.then = (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) =>
    Promise.resolve(resultado).then(ok, erro);
  return { db: consulta as never, chamadas };
}

/** Lê a resposta JSON-RPC, venha como JSON puro ou como um evento SSE. */
export async function lerJsonRpc(r: Response): Promise<{ result: Record<string, unknown> }> {
  const texto = await r.text();
  if (r.headers.get('content-type')?.includes('text/event-stream')) {
    const linha = texto.split('\n').find((l) => l.startsWith('data:'));
    return JSON.parse(linha!.slice(5));
  }
  return JSON.parse(texto);
}
