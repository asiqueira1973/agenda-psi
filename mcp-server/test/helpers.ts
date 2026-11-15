import type { ClaimsReader } from '../src/auth/verify-token.js';
import { lerConfig } from '../src/config.js';

/** Configuração fixa dos testes; nenhum valor real. */
export const configDeTeste = lerConfig({
  SUPABASE_URL: 'https://exemplo.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_teste',
  MCP_PUBLIC_URL: 'https://mcp.exemplo.com/mcp',
  MCP_PREVIEW_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres',
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

/**
 * Banco simulado que responde por tabela e registra as chamadas, inclusive o corpo do
 * insert. `respostas[tabela]` pode ser um objeto ou uma lista (uma resposta por consulta,
 * em ordem). Basta para conferir colunas, valores e tratamento de erro (seção 22).
 */
type Resposta = { data: unknown; error: unknown } | { lancar: true };
export function dbPorTabela(respostas: Record<string, Resposta | Resposta[]>) {
  const chamadas: Array<{ tabela: string; metodo: string; args: unknown[] }> = [];
  const usadas: Record<string, number> = {};
  const db = {
    from(tabela: string) {
      const i = usadas[tabela] ?? 0;
      usadas[tabela] = i + 1;
      const r = respostas[tabela];
      const resultado = Array.isArray(r) ? r[i] ?? r[r.length - 1] : r;
      if (!resultado) throw new Error(`tabela não simulada: ${tabela}`);
      const consulta: Record<string, unknown> = {};
      for (const metodo of ['select', 'insert', 'update', 'delete', 'eq', 'gte', 'lte', 'lt', 'gt', 'in', 'order', 'limit', 'maybeSingle', 'single']) {
        consulta[metodo] = (...args: unknown[]) => {
          chamadas.push({ tabela, metodo, args });
          return consulta;
        };
      }
      // `{ lancar: true }` simula exceção (rede caiu), diferente de `{ error }` do PostgREST.
      const promessa = (resultado as { lancar?: boolean }).lancar ? Promise.reject(new Error('rede')) : Promise.resolve(resultado);
      consulta.then = (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) => promessa.then(ok, erro);
      return consulta;
    },
    // RPC: a resposta é a de `rpc:<nome>`.
    rpc(nome: string) {
      chamadas.push({ tabela: `rpc:${nome}`, metodo: 'rpc', args: [] });
      return Promise.resolve(respostas[`rpc:${nome}`] ?? { data: null, error: null });
    },
    // Edge Functions: registra a chamada; a resposta é a de `functions:<nome>`, ou sucesso.
    functions: {
      invoke(nome: string, opcoes: unknown) {
        chamadas.push({ tabela: `functions:${nome}`, metodo: 'invoke', args: [opcoes] });
        const r = respostas[`functions:${nome}`];
        return r && !Array.isArray(r) && 'error' in r && r.error ? Promise.reject(r.error) : Promise.resolve({ data: null, error: null });
      },
    },
  };
  return { db: db as never, chamadas };
}

/** Contexto de ferramenta completo para teste, sem analytics. */
export function ctxDeTeste(db: never, extra: Partial<{ sub: string; email: string | null; ui: 'sim' | 'nao' | 'desconhecido' }> = {}) {
  return {
    db,
    sub: extra.sub ?? 'usuario-do-token',
    email: extra.email ?? 'psi@exemplo.com',
    ui: extra.ui ?? 'sim',
    config: { previewSecret: 'segredo-de-teste-com-mais-de-32-caracteres', analytics: null },
  };
}
