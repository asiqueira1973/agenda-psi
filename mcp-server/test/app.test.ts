import { describe, expect, it } from 'vitest';
import { criarApp } from '../src/app.js';
import { claimsValidas, configDeTeste, leitorSimulado, lerJsonRpc } from './helpers.js';

const app = criarApp(configDeTeste, { leitorDeClaims: leitorSimulado(claimsValidas()) });
const base = 'https://mcp.exemplo.com';

/** Um `tools/list` no formato de 2025 (fallback stateless do SDK). */
function toolsList(token?: string) {
  return new Request(`${base}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-11-25',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  });
}

describe('rotas (6.2)', () => {
  it('sem token → 401 com WWW-Authenticate apontando o resource_metadata', async () => {
    const r = await app.fetch(toolsList());
    expect(r.status).toBe(401);
    expect(r.headers.get('www-authenticate')).toMatch(
      /^Bearer .*resource_metadata="https:\/\/mcp\.exemplo\.com\/\.well-known\/oauth-protected-resource\/mcp"/,
    );
  });

  it('token adulterado → 401', async () => {
    const r = await app.fetch(toolsList('adulterado'));
    expect(r.status).toBe(401);
    expect(r.headers.get('www-authenticate')).toContain('invalid_token');
  });

  it.each(['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'])(
    'GET %s devolve o metadata da 6.2',
    async (caminho) => {
      const r = await app.fetch(new Request(`${base}${caminho}`));
      expect(r.status).toBe(200);
      expect(r.headers.get('access-control-allow-origin')).toBe('*');
      expect(await r.json()).toEqual({
        resource: 'https://mcp.exemplo.com/mcp',
        authorization_servers: ['https://mcp.exemplo.com'],
        bearer_methods_supported: ['header'],
        resource_name: 'Agenda Psi',
        scopes_supported: ['email'],
      });
    },
  );

  it('rota desconhecida → 404', async () => {
    expect((await app.fetch(new Request(`${base}/inicio`))).status).toBe(404);
  });
});

/** `tools/list` com as capacidades do cliente no envelope de 2026-07-28 (13.4). */
function toolsListCom(capacidades?: Record<string, unknown>) {
  const params = capacidades ? { _meta: { 'io.modelcontextprotocol/clientCapabilities': capacidades } } : {};
  return new Request(`${base}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-11-25',
      authorization: 'Bearer valido',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params }),
  });
}

type ToolListada = { name: string; annotations?: { readOnlyHint?: boolean }; _meta?: { ui?: { visibility?: string[]; resourceUri?: string } } };
async function listar(capacidades?: Record<string, unknown>) {
  const r = await app.fetch(toolsListCom(capacidades));
  expect(r.status).toBe(200);
  const tools = (await lerJsonRpc(r)).result.tools as ToolListada[];
  return Object.fromEntries(tools.map((t) => [t.name, t]));
}

const COM_UI = { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } };

describe('tools/list conforme o cliente (13.1 e 13.4)', () => {
  it('cliente com MCP Apps: formulário, sem o fallback', async () => {
    const t = await listar(COM_UI);
    expect(Object.keys(t).sort()).toEqual([
      'abrir_formulario_despesa', 'consultar_despesas', 'listar_tipos_despesa', 'salvar_despesa',
    ]);
    expect(t.abrir_formulario_despesa?._meta?.ui).toMatchObject({ visibility: ['model'], resourceUri: 'ui://agenda-psi/despesa.html' });
    // 8.2, critério 6: o que só o formulário chama fica fora da vista do modelo.
    expect(t.listar_tipos_despesa?._meta?.ui?.visibility).toEqual(['app']);
    expect(t.salvar_despesa?._meta?.ui?.visibility).toEqual(['app']);
    expect(t.consultar_despesas?._meta?.ui?.visibility).toEqual(['model']);
    expect(t.consultar_despesas?.annotations?.readOnlyHint).toBe(true);
  });

  it('cliente que anuncia capacidades sem MCP Apps: só o fallback', async () => {
    const t = await listar({ extensions: {} });
    expect(Object.keys(t).sort()).toEqual(['consultar_despesas', 'registrar_despesa']);
    expect(t.registrar_despesa?._meta?.ui?.visibility).toEqual(['model']);
  });

  it('cliente de 2025, que não repete as capacidades: os dois caminhos', async () => {
    const t = await listar();
    expect(Object.keys(t).sort()).toEqual([
      'abrir_formulario_despesa', 'consultar_despesas', 'listar_tipos_despesa', 'registrar_despesa', 'salvar_despesa',
    ]);
  });
});

describe('log da recusa de token (diagnóstico do épico 3, seção 18)', () => {
  it('o 401 registra só o motivo e o método, nunca o token', async () => {
    const linhas: string[] = [];
    const original = console.log;
    console.log = (l: string) => linhas.push(String(l));
    try {
      await app.fetch(toolsList('adulterado'));
      await app.fetch(toolsList());
    } finally {
      console.log = original;
    }
    const registros = linhas.map((l) => JSON.parse(l));
    expect(registros).toEqual([
      { evento: 'token_recusado', motivo: 'Invalid token', metodo: 'POST' },
      { evento: 'token_recusado', motivo: 'Missing Authorization header', metodo: 'POST' },
    ]);
    expect(linhas.join('\n')).not.toContain('adulterado');
  });
});

describe('escopo pedido ao cliente (épico 3: HS256 sem ID token)', () => {
  // O /oauth/token do Supabase respondeu 500 "HS256 is not suppo..." ao Claude: com o
  // escopo openid, ele precisa emitir ID token, e o projeto assina em HS256 (25.4).
  it('o 401 pede scope="email", que o cliente MCP usa antes do PRM, e nunca openid', async () => {
    const r = await app.fetch(toolsList());
    const desafio = r.headers.get('www-authenticate') ?? '';
    expect(desafio).toContain('scope="email"');
    expect(desafio).not.toContain('openid');
  });
});

describe('desvio do authorize (épico 3, opção A aprovada): o Claude sempre pede openid', () => {
  it.each(['/.well-known/oauth-authorization-server', '/.well-known/openid-configuration'])(
    'GET %s: emissor é o nosso domínio; só o authorize é nosso, o resto é do Supabase',
    async (caminho) => {
      const r = await app.fetch(new Request(`${base}${caminho}`));
      expect(r.status).toBe(200);
      const m = await r.json();
      expect(m.issuer).toBe('https://mcp.exemplo.com');
      expect(m.authorization_endpoint).toBe('https://mcp.exemplo.com/oauth/authorize');
      expect(m.token_endpoint).toBe('https://exemplo.supabase.co/auth/v1/oauth/token');
      expect(m.registration_endpoint).toBe('https://exemplo.supabase.co/auth/v1/oauth/clients/register');
      expect(m.code_challenge_methods_supported).toEqual(['S256']);
      expect(m.scopes_supported).not.toContain('openid');
    },
  );

  it('/oauth/authorize redireciona ao Supabase com a mesma query, sem openid no escopo', async () => {
    const q = 'response_type=code&client_id=c1&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback&code_challenge=abc&code_challenge_method=S256&state=xyz&scope=openid+email+profile&resource=https%3A%2F%2Fmcp.exemplo.com%2Fmcp';
    const r = await app.fetch(new Request(`${base}/oauth/authorize?${q}`));
    expect(r.status).toBe(302);
    const destino = new URL(r.headers.get('location')!);
    expect(destino.origin + destino.pathname).toBe('https://exemplo.supabase.co/auth/v1/oauth/authorize');
    const p = destino.searchParams;
    expect(p.get('scope')).toBe('email profile');
    for (const k of ['response_type', 'client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'state', 'resource']) {
      expect(p.get(k), k).toBe(new URLSearchParams(q).get(k));
    }
  });

  it('só openid, ou sem escopo: vira email (o padrão do Supabase)', async () => {
    for (const q of ['scope=openid', '']) {
      const r = await app.fetch(new Request(`${base}/oauth/authorize?client_id=c&${q}`));
      expect(new URL(r.headers.get('location')!).searchParams.get('scope')).toBe('email');
    }
  });

  it('o token continua sendo conferido contra o emissor do Supabase, não o nosso (6.4)', async () => {
    const r = await app.fetch(new Request(`${base}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-11-25', authorization: 'Bearer valido' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    }));
    expect(r.status).toBe(200);
  });
});
