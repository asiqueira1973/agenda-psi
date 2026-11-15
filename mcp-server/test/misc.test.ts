import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { suporteAUi } from '../src/client-capabilities.js';
import { lerConfig } from '../src/config.js';
import { eventos } from '../src/events.js';
import { formatarData, formatarDinheiro } from '../src/rules/format.js';
import { DESPESA_HTML } from '../src/ui/generated.js';

describe('eventos (21, pegadinha 5)', () => {
  const doApp = readFileSync(new URL('../../app/src/lib/analytics/events.ts', import.meta.url), 'utf8');
  it('cada nome é idêntico, byte a byte, ao do app', () => {
    for (const [chave, nome] of Object.entries(eventos)) expect(doApp).toContain(`${chave}: '${nome}',`);
  });
});

describe('formatação como o app (11.3 do app)', () => {
  it('dinheiro', () => {
    expect(formatarDinheiro(1450)).toBe('R$ 1.450');
    expect(formatarDinheiro(1234567)).toBe('R$ 1.234.567');
    expect(formatarDinheiro(200)).toBe('R$ 200');
    expect(formatarDinheiro(null)).toBe('R$ 0');
  });
  it('data com zero à esquerda, sem passar por Date', () => {
    expect(formatarData('2026-03-05')).toBe('05/03/2026');
    expect(formatarData(null)).toBe('—');
  });
});

describe('suporte a MCP Apps pelo request (13.4)', () => {
  const caps = (c: unknown) => ({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: { 'io.modelcontextprotocol/clientCapabilities': c } } });
  it('2026-07-28 com a extensão de UI → sim', () => {
    expect(suporteAUi(caps({ extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } }))).toBe('sim');
  });
  it('2026-07-28 sem a extensão → nao', () => {
    expect(suporteAUi(caps({ extensions: {} }))).toBe('nao');
  });
  it('2025, sem capacidades no request → desconhecido', () => {
    expect(suporteAUi({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })).toBe('desconhecido');
    expect(suporteAUi(undefined)).toBe('desconhecido');
  });
  it('initialize de 2025 com UI → sim', () => {
    expect(suporteAUi({ method: 'initialize', params: { capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } } } })).toBe('sim');
  });
});

describe('configuração do segredo da prévia', () => {
  const base = { SUPABASE_URL: 'https://e.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'x', MCP_PUBLIC_URL: 'https://m/mcp' };
  it('obrigatório e com 32+ caracteres', () => {
    expect(() => lerConfig(base)).toThrow(/MCP_PREVIEW_SECRET/);
    expect(() => lerConfig({ ...base, MCP_PREVIEW_SECRET: 'curto' })).toThrow(/32/);
  });
  it('analytics só com chave', () => {
    const s = { ...base, MCP_PREVIEW_SECRET: 'x'.repeat(32) };
    expect(lerConfig(s).analytics).toBeNull();
    expect(lerConfig({ ...s, VISAODEPRODUTO_KEY: 'k' }).analytics?.url).toBe('https://api.visaodeproduto.com.br/functions/v1/ingest');
  });
});

describe('HTML do formulário embutido (4.2, 17)', () => {
  it('existe, é um arquivo único e cabe no teto', () => {
    expect(DESPESA_HTML).toContain('<form id="form"');
    expect(DESPESA_HTML).not.toMatch(/<script[^>]+src=/);
    expect(Buffer.byteLength(DESPESA_HTML)).toBeLessThan(300 * 1024);
  });
  it('[hidden] vence o display das classes: erro escondido não pode aparecer (defeito visto no basic-host)', () => {
    // `.carregar-erro { display: flex }` sobrepunha o atributo hidden, e a mensagem de
    // erro ao carregar aparecia com as opções já carregadas.
    expect(DESPESA_HTML).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/);
  });
});
