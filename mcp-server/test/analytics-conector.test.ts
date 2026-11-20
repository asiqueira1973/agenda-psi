import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clienteDoInitialize, idDeConexao } from '../src/analytics.js';
import { criarApp } from '../src/app.js';
import { lerConfig } from '../src/config.js';
import { registrarLeituras } from '../src/tools/read/index.js';
import { claimsValidas, ctxDeTeste, dbSimulado, leitorSimulado } from './helpers.js';

/** Eventos só do conector (divergência 12): conexão e consulta. */

const config = lerConfig({
  SUPABASE_URL: 'https://exemplo.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_teste',
  MCP_PUBLIC_URL: 'https://mcp.exemplo.com/mcp',
  MCP_PREVIEW_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres',
  VISAODEPRODUTO_URL: 'https://ingest.exemplo.com',
  VISAODEPRODUTO_KEY: 'chave-de-teste',
});

let enviados: Array<Record<string, unknown>>;
let fetchFalso: ReturnType<typeof vi.fn>;

beforeEach(() => {
  enviados = [];
  fetchFalso = vi.fn(async (_url: string, init: RequestInit) => {
    enviados.push(...(JSON.parse(String(init.body)).eventos as Array<Record<string, unknown>>));
    return new Response('{}');
  });
  vi.stubGlobal('fetch', fetchFalso);
});
afterEach(() => vi.unstubAllGlobals());

function initialize(nomeDoCliente: string, token = 'valido') {
  return new Request('https://mcp.exemplo.com/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: nomeDoCliente, version: '1' } },
    }),
  });
}

describe('agenda_psi_mcp_conectado', () => {
  const mcp = { fetch: async () => new Response('{}') } as never;
  const app = criarApp(config, { leitorDeClaims: leitorSimulado(claimsValidas({ email: 'psi@exemplo.com' })), mcp });

  it('initialize com token válido emite um evento, com tela do cliente e sem dado pessoal além do distinct_id', async () => {
    await app.fetch(initialize('claude-ai'));
    expect(enviados).toHaveLength(1);
    const e = enviados[0]!;
    expect(e.nome).toBe('agenda_psi_mcp_conectado');
    expect(e.tela).toBe('mcp_claude');
    expect(e.distinct_id).toBe('psi@exemplo.com');
    expect(e.propriedades).toEqual({});
    expect(JSON.stringify(e)).not.toContain('00000000-0000-0000-0000-000000000001');
  });

  it('o id é o mesmo a cada conexão da mesma pessoa no mesmo cliente, e muda de cliente para cliente', async () => {
    await app.fetch(initialize('claude-ai'));
    await app.fetch(initialize('Claude Desktop'));
    await app.fetch(initialize('openai-mcp'));
    expect(enviados[0]!.id).toBe(enviados[1]!.id);
    expect(enviados[2]!.tela).toBe('mcp_chatgpt');
    expect(enviados[2]!.id).not.toBe(enviados[0]!.id);
  });

  it('nada é emitido fora do initialize nem sem token', async () => {
    await app.fetch(new Request('https://mcp.exemplo.com/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer valido' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    }));
    const r = await app.fetch(initialize('claude-ai', 'adulterado'));
    expect(r.status).toBe(401);
    expect(enviados).toHaveLength(0);
  });

  it('falha do Visão do Produto não falha a conexão', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('fora do ar'); }));
    const r = await app.fetch(initialize('claude-ai'));
    expect(r.status).toBe(200);
  });

  it('classificação do cliente e id estável', () => {
    expect(clienteDoInitialize({ method: 'initialize', params: { clientInfo: { name: 'Anthropic/ClaudeAI' } } })).toBe('claude');
    expect(clienteDoInitialize({ method: 'initialize', params: { clientInfo: { name: 'ChatGPT' } } })).toBe('chatgpt');
    expect(clienteDoInitialize({ method: 'initialize', params: {} })).toBe('outro');
    expect(clienteDoInitialize({ method: 'tools/list' })).toBeNull();
    expect(idDeConexao('a', 'claude')).toBe(idDeConexao('a', 'claude'));
    expect(idDeConexao('a', 'claude')).not.toBe(idDeConexao('b', 'claude'));
  });
});

describe('agenda_psi_mcp_consulta', () => {
  /** Servidor falso que guarda o handler de cada ferramenta registrada. */
  function registrar(db: never) {
    const handlers: Record<string, (args: unknown) => Promise<{ isError?: boolean }>> = {};
    const server = { registerTool: (nome: string, _c: unknown, h: never) => { handlers[nome] = h; } };
    const ctx = { ...ctxDeTeste(db), config: { previewSecret: 'x'.repeat(40), analytics: config.analytics } };
    registrarLeituras(server as never, ctx as never);
    return handlers;
  }

  it('leitura que deu certo emite o evento com a tela da leitura, sem argumento nem resultado', async () => {
    const handlers = registrar(dbSimulado({ data: [{ id: 'p1', nome_completo: 'Fulana de Tal' }], error: null }).db);
    const r = await handlers.listar_pacientes!({});
    expect(r.isError).toBeFalsy();
    expect(enviados).toHaveLength(1);
    expect(enviados[0]!.nome).toBe('agenda_psi_mcp_consulta');
    expect(enviados[0]!.tela).toBe('mcp_listar_pacientes');
    expect(JSON.stringify(enviados[0])).not.toContain('Fulana');
  });

  it('leitura com erro não emite', async () => {
    const handlers = registrar(dbSimulado({ data: null, error: { message: 'falhou' } }).db);
    const r = await handlers.listar_pacientes!({});
    expect(r.isError).toBe(true);
    expect(enviados).toHaveLength(0);
  });
});
