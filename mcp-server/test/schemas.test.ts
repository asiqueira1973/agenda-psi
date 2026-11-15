import { describe, expect, it } from 'vitest';
import { criarApp } from '../src/app.js';
import { claimsValidas, configDeTeste, leitorSimulado, lerJsonRpc } from './helpers.js';

// Seção 22 e P1: nenhuma ferramenta pode aceitar usuario_id como entrada. Percorre o
// tools/list de verdade, para pegar também ferramentas registradas no futuro.
describe('schemas das ferramentas', () => {
  it('nenhum inputSchema menciona usuario_id', async () => {
    const app = criarApp(configDeTeste, { leitorDeClaims: leitorSimulado(claimsValidas()) });
    const r = await app.fetch(new Request('https://mcp.exemplo.com/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2025-11-25',
        authorization: 'Bearer valido',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    }));
    const tools = (await lerJsonRpc(r)).result.tools as Array<{ name: string; inputSchema: unknown }>;
    expect(tools.length).toBeGreaterThan(0);
    for (const t of tools) {
      expect(JSON.stringify(t.inputSchema), t.name).not.toContain('usuario_id');
    }
  });
});
