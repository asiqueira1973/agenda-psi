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
        authorization_servers: ['https://exemplo.supabase.co/auth/v1'],
        bearer_methods_supported: ['header'],
        resource_name: 'Agenda Psi',
      });
    },
  );

  it('rota desconhecida → 404', async () => {
    expect((await app.fetch(new Request(`${base}/inicio`))).status).toBe(404);
  });
});

describe('tools/list com token válido', () => {
  it('lista as ferramentas, com a visibilidade de cada uma (13.1)', async () => {
    const r = await app.fetch(toolsList('valido'));
    expect(r.status).toBe(200);
    const corpo = await lerJsonRpc(r);
    const tools = corpo.result.tools as Array<{ name: string; annotations?: { readOnlyHint?: boolean }; _meta?: { ui?: { visibility?: string[] } } }>;
    const porNome = Object.fromEntries(tools.map((t) => [t.name, t]));
    expect(Object.keys(porNome).sort()).toEqual(['consultar_despesas', 'listar_tipos_despesa']);
    expect(porNome.consultar_despesas?._meta?.ui?.visibility).toEqual(['model']);
    expect(porNome.listar_tipos_despesa?._meta?.ui?.visibility).toEqual(['app']);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
  });
});
