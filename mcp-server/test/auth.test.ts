import { describe, expect, it } from 'vitest';
import { criarVerificador, subDoAuthInfo } from '../src/auth/verify-token.js';
import { lerConfig } from '../src/config.js';
import { claimsValidas, configDeTeste, leitorSimulado } from './helpers.js';

// Seção 6.4: cada checagem recusa com 401 invalid_token.
describe('verificação do token (6.4)', () => {
  const verificar = (claims: Record<string, unknown>, token = 'valido', config = configDeTeste) =>
    criarVerificador(config, leitorSimulado(claims)).verifyAccessToken(token);

  it('token OAuth válido vira AuthInfo com sub, clientId e expiresAt', async () => {
    const c = claimsValidas({ scope: 'openid email' });
    const info = await verificar(c);
    expect(info.clientId).toBe('cliente-dcr');
    expect(info.expiresAt).toBe(c.exp);
    expect(info.scopes).toEqual(['openid', 'email']);
    expect(subDoAuthInfo(info)).toBe(c.sub);
  });

  it('assinatura recusada pelo Supabase Auth → recusa', async () => {
    await expect(verificar(claimsValidas(), 'adulterado')).rejects.toMatchObject({ code: 'invalid_token' });
  });

  it('iss de outro projeto → recusa', async () => {
    await expect(verificar(claimsValidas({ iss: 'https://outro.supabase.co/auth/v1' }))).rejects.toMatchObject({ code: 'invalid_token' });
  });

  it('vencido → recusa', async () => {
    await expect(verificar(claimsValidas({ exp: Math.floor(Date.now() / 1000) - 1 }))).rejects.toMatchObject({ code: 'invalid_token' });
  });

  it('role anon → recusa', async () => {
    await expect(verificar(claimsValidas({ role: 'anon' }))).rejects.toMatchObject({ code: 'invalid_token' });
  });

  it('token de sessão do app (sem client_id) → recusa', async () => {
    await expect(verificar(claimsValidas({ client_id: undefined }))).rejects.toMatchObject({ code: 'invalid_token' });
  });

  it('sem client_id é aceito SÓ com MCP_DEV_ALLOW_SESSION_TOKEN=1 (8.1.3)', async () => {
    const dev = lerConfig({
      SUPABASE_URL: 'https://exemplo.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'x',
      MCP_PUBLIC_URL: 'http://localhost:3000/mcp',
      MCP_PREVIEW_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres',
      MCP_DEV_ALLOW_SESSION_TOKEN: '1',
    });
    const info = await verificar(claimsValidas({ client_id: undefined }), 'valido', dev);
    expect(subDoAuthInfo(info)).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('a flag de dev só liga com o valor exato "1"', () => {
    const base = { SUPABASE_URL: 'https://e.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'x', MCP_PUBLIC_URL: 'https://m/mcp', MCP_PREVIEW_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres' };
    expect(lerConfig({ ...base, MCP_DEV_ALLOW_SESSION_TOKEN: 'true' }).devAllowSessionToken).toBe(false);
    expect(lerConfig(base).devAllowSessionToken).toBe(false);
  });

  it('os motivos de recusa são ASCII, porque vão no cabeçalho WWW-Authenticate', async () => {
    const casos = [
      verificar(claimsValidas(), 'adulterado'),
      verificar(claimsValidas({ iss: 'x' })),
      verificar(claimsValidas({ exp: 0 })),
      verificar(claimsValidas({ role: 'anon' })),
      verificar(claimsValidas({ sub: '' })),
      verificar(claimsValidas({ client_id: undefined })),
    ];
    for (const caso of casos) {
      const erro = await caso.then(() => null, (e: Error) => e);
      expect(erro?.message).toMatch(/^[\x20-\x7e]+$/);
    }
  });

  it('a flag de dev na Vercel impede o servidor de subir (8.1.3: ela nunca existe no deploy)', () => {
    const base = { SUPABASE_URL: 'https://e.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'x', MCP_PUBLIC_URL: 'https://m/mcp', MCP_PREVIEW_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres' };
    expect(() => lerConfig({ ...base, VERCEL: '1', MCP_DEV_ALLOW_SESSION_TOKEN: '1' })).toThrow(/MCP_DEV_ALLOW_SESSION_TOKEN/);
    expect(lerConfig({ ...base, VERCEL: '1' }).devAllowSessionToken).toBe(false);
  });

  it('subDoAuthInfo lança sem usuário', () => {
    expect(() => subDoAuthInfo(undefined)).toThrow();
  });
});
