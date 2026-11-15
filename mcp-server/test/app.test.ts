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
