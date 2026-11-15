import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { decidir, entrar, esqueciSenha, iniciar, traduzirErro, type AuthDaPagina } from '../../site/oauth/consent/flow.js';
import { destinoDaRaiz } from '../../site/route.js';
import {
  consentimento,
  copyLoginDoApp,
  errosDoAppAuth,
  paginaInicial,
  textosNovosConsentimento,
} from '../../src/rules/auth-copy.js';

const ID = 'auth-123';
const detalhes = { authorization_id: ID, redirect_uri: 'https://claude.ai/api/mcp/auth_callback', client: { id: 'c', name: 'Claude', uri: '', logo_uri: '' }, user: { id: 'u', email: 'x@y.z' }, scope: 'openid email' };

/** Supabase simulado; cada teste troca o que precisa. */
function authSimulado(sobre: Partial<Omit<AuthDaPagina, 'oauth'>> & { oauth?: Partial<AuthDaPagina['oauth']> } = {}): AuthDaPagina {
  const base: AuthDaPagina = {
    getSession: async () => ({ data: { session: { access_token: 't' } } }),
    signInWithPassword: async () => ({ data: { session: { access_token: 't' } }, error: null }),
    resetPasswordForEmail: async () => ({ error: null }),
    oauth: {
      getAuthorizationDetails: async () => ({ data: detalhes, error: null }),
      approveAuthorization: async () => ({ data: { redirect_url: 'https://claude.ai/cb?code=1' }, error: null }),
      denyAuthorization: async () => ({ data: { redirect_url: 'https://claude.ai/cb?error=access_denied' }, error: null }),
    },
  };
  return { ...base, ...sobre, oauth: { ...base.oauth, ...sobre.oauth } };
}

describe('página de consentimento (6.2 passo 5, 6.3)', () => {
  it('sem authorization_id: pedido inválido, sem login', async () => {
    expect(await iniciar(authSimulado(), null)).toEqual({ fase: 'invalido', mensagem: textosNovosConsentimento.pedidoInvalido });
  });

  it('sem sessão: pede login', async () => {
    expect(await iniciar(authSimulado({ getSession: async () => ({ data: { session: null } }) }), ID)).toEqual({ fase: 'login' });
  });

  it('com sessão: mostra o consentimento com o client_name do DCR', async () => {
    expect(await iniciar(authSimulado(), ID)).toEqual({ fase: 'consentimento', cliente: 'Claude' });
    expect(consentimento.pedido('Claude')).toBe(
      'Claude quer acessar seu Agenda Psi para consultar e registrar pacientes, sessões, pagamentos e despesas. Você pode desconectar quando quiser.',
    );
  });

  it('já consentiu antes: segue direto o redirect_url do Supabase', async () => {
    const a = authSimulado({ oauth: { getAuthorizationDetails: async () => ({ data: { redirect_url: 'https://claude.ai/cb?code=2' }, error: null }) } });
    expect(await iniciar(a, ID)).toEqual({ fase: 'redirecionar', url: 'https://claude.ai/cb?code=2' });
  });

  it('sem client_name, usa o host do redirect_uri (nenhum texto inventado)', async () => {
    const semNome = { ...detalhes, client: { ...detalhes.client, name: '' } };
    const a = authSimulado({ oauth: { getAuthorizationDetails: async () => ({ data: semNome, error: null }) } });
    expect(await iniciar(a, ID)).toEqual({ fase: 'consentimento', cliente: 'claude.ai' });
  });

  it('pedido vencido ou inválido: mensagem, sem botões', async () => {
    const a = authSimulado({ oauth: { getAuthorizationDetails: async () => ({ data: null, error: { code: 'not_found' } }) } });
    expect(await iniciar(a, ID)).toEqual({ fase: 'invalido', mensagem: textosNovosConsentimento.pedidoInvalido });
  });

  it('login: senha errada vira a mensagem do app (9.1), e o e-mail vai em minúsculas e sem espaço', async () => {
    const sign = vi.fn(async () => ({ data: { session: null }, error: { code: 'invalid_credentials', message: 'Invalid login credentials' } }));
    const r = await entrar(authSimulado({ signInWithPassword: sign }), ID, '  Psi@Exemplo.com ', 'x');
    expect(r).toEqual({ fase: 'login', erro: 'E-mail ou senha incorretos.' });
    expect(sign).toHaveBeenCalledWith({ email: 'psi@exemplo.com', password: 'x' });
  });

  it('login: campos obrigatórios e e-mail inválido, sem chamar o Supabase', async () => {
    const sign = vi.fn();
    const a = authSimulado({ signInWithPassword: sign as never });
    expect(await entrar(a, ID, '', 'x')).toEqual({ fase: 'login', erro: errosDoAppAuth.emailObrigatorio });
    expect(await entrar(a, ID, 'abc', 'x')).toEqual({ fase: 'login', erro: errosDoAppAuth.emailInvalido });
    expect(await entrar(a, ID, 'a@b.co', '')).toEqual({ fase: 'login', erro: errosDoAppAuth.senhaObrigatoria });
    expect(sign).not.toHaveBeenCalled();
  });

  it('login certo: vai para o consentimento', async () => {
    expect(await entrar(authSimulado(), ID, 'a@b.co', 'senha')).toEqual({ fase: 'consentimento', cliente: 'Claude' });
  });

  it('esqueci a senha: mesmo e-mail do app, com retorno ao app pelo deep link', async () => {
    const reset = vi.fn(async () => ({ error: null }));
    expect(await esqueciSenha(authSimulado({ resetPasswordForEmail: reset }), ' A@B.co ')).toEqual({ fase: 'login', aviso: errosDoAppAuth.emailDeSenhaEnviado });
    expect(reset).toHaveBeenCalledWith('a@b.co', { redirectTo: 'agendapsi://nova-senha' });
  });

  it('permitir segue o redirect_url; negar mostra a frase e segue o redirect com access_denied', async () => {
    expect(await decidir(authSimulado(), ID, true)).toEqual({ fase: 'redirecionar', url: 'https://claude.ai/cb?code=1' });
    expect(await decidir(authSimulado(), ID, false)).toEqual({
      fase: 'redirecionar', url: 'https://claude.ai/cb?error=access_denied', mensagem: textosNovosConsentimento.acessoNegado,
    });
  });

  it('erro de rede nunca mostra texto cru', () => {
    expect(traduzirErro(new TypeError('Failed to fetch'))).toBe(errosDoAppAuth.semConexao);
    expect(traduzirErro({ code: 'xyz', message: 'pq: relation does not exist' })).toBe(errosDoAppAuth.falhaGenerica);
  });
});

describe('raiz `/` (6.3)', () => {
  it('sem authorization_id fica na raiz; com ele, encaminha para /oauth/consent mantendo a query', () => {
    expect(destinoDaRaiz('')).toBeNull();
    expect(destinoDaRaiz('?authorization_id=abc')).toBe('/oauth/consent?authorization_id=abc');
  });
  it('texto aprovado (24.8)', () => {
    expect(paginaInicial.texto).toBe('E-mail confirmado. Volte ao app Agenda Psi e entre com seu e-mail e senha.');
  });
});

describe('copy de login igual à do app (15)', () => {
  const doApp = readFileSync(new URL('../../../app/src/features/auth/copy.ts', import.meta.url), 'utf8');
  it('rótulos e erros byte a byte', () => {
    for (const [k, t] of [...Object.entries(copyLoginDoApp), ...Object.entries(errosDoAppAuth)]) {
      expect(doApp, k).toContain(`${k}: '${t}'`);
    }
  });
  it('sem exclamação nem emoji nos textos novos', () => {
    const todos = [...Object.values(textosNovosConsentimento).flat(), consentimento.permitir, consentimento.negar, paginaInicial.texto, consentimento.pedido('X')];
    for (const t of todos) expect(t).not.toMatch(/!|\p{Extended_Pictographic}/u);
  });
});

describe('vercel.json (4.2, 6.3)', () => {
  const v = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  it('serve o site de public/ e manda /mcp e o PRM para a função', () => {
    expect(v.outputDirectory).toBe('public');
    const destinos = Object.fromEntries(v.rewrites.map((r: { source: string; destination: string }) => [r.source, r.destination]));
    expect(destinos['/mcp']).toBe('/api/index');
    expect(destinos['/.well-known/oauth-protected-resource']).toBe('/api/index');
    expect(destinos['/oauth/consent']).toBe('/oauth/consent/index.html');
    // Desvio do authorize (épico 3): metadata de AS e authorize vão para a função.
    for (const r of ['/.well-known/oauth-authorization-server', '/.well-known/openid-configuration', '/oauth/authorize']) {
      expect(destinos[r], r).toBe('/api/index');
    }
  });
  it('o ignore compara com o último deploy, não com o commit anterior (deploy cancelado no épico 3)', () => {
    // Com `HEAD^`, um commit só de docs depois de um de código fazia a Vercel pular o build.
    expect(v.ignoreCommand).toBe('git diff --quiet "${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}" HEAD -- .');
  });

  it('nenhum redirect que possa capturar /mcp (os caminhos antigos vão pela 404.html)', () => {
    expect(v.redirects ?? []).toEqual([]);
    const pagina404 = readFileSync(new URL('../../site/public/404.html', import.meta.url), 'utf8');
    expect(pagina404).toContain("location.replace('/'");
  });

  it('a 404 preserva a query: //oauth/consent?authorization_id=… chega à raiz com o id (defeito achado pelo verifier)', () => {
    const pagina404 = readFileSync(new URL('../../site/public/404.html', import.meta.url), 'utf8');
    expect(pagina404).toContain("location.replace('/' + location.search)");
    // meta refresh não carrega a query: não pode existir, senão ganha a corrida e perde o id.
    expect(pagina404).not.toMatch(/http-equiv="refresh"/);
  });

  it('a 404.html é versionada: o .gitignore não pode pegar site/public/', () => {
    const gi = readFileSync(new URL('../../.gitignore', import.meta.url), 'utf8').split('\n').map((l) => l.trim());
    expect(gi).not.toContain('public/');
    expect(gi).toContain('/public/');
  });
});
