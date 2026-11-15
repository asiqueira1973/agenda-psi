import {
  DEEP_LINK_NOVA_SENHA,
  errosDoAppAuth,
  textosNovosConsentimento,
} from '../../../src/rules/auth-copy.js';

/**
 * Lógica da página de login e consentimento (6.2, passo 5, e 6.3), sem DOM e sem
 * Supabase de verdade: recebe um cliente com a forma mínima abaixo, para o teste
 * simular cada caminho. main.ts só desenha o que estas funções devolvem.
 */

/** Erro de auth como o supabase-js entrega. */
type ErroDeAuth = { code?: string; message?: string; name?: string } | null;

/** O pedaço do `supabase.auth` que a página usa. */
export type AuthDaPagina = {
  getSession(): Promise<{ data: { session: unknown | null } }>;
  signInWithPassword(c: { email: string; password: string }): Promise<{ data: { session: unknown | null }; error: ErroDeAuth }>;
  resetPasswordForEmail(email: string, o: { redirectTo: string }): Promise<{ error: ErroDeAuth }>;
  oauth: {
    getAuthorizationDetails(id: string): Promise<{ data: unknown; error: ErroDeAuth }>;
    approveAuthorization(id: string): Promise<{ data: { redirect_url?: string } | null; error: ErroDeAuth }>;
    denyAuthorization(id: string): Promise<{ data: { redirect_url?: string } | null; error: ErroDeAuth }>;
  };
};

/** O que a tela mostra a cada passo. */
export type Tela =
  | { fase: 'invalido'; mensagem: string }
  | { fase: 'login'; erro?: string; aviso?: string }
  | { fase: 'consentimento'; cliente: string }
  | { fase: 'redirecionar'; url: string; mensagem?: string };

/**
 * Traduz o erro de login como o app (`traduzirErro` em auth-service.ts): credencial
 * errada, rede, ou a mensagem genérica. Nunca mostra o texto cru do Supabase.
 */
export function traduzirErro(erro: ErroDeAuth | unknown): string {
  const e = erro as { code?: string; message?: string } | null;
  const codigo = e?.code ?? '';
  const mensagem = (e?.message ?? '').toLowerCase();
  if (codigo === 'invalid_credentials' || mensagem.includes('invalid login credentials')) return errosDoAppAuth.credencialIncorreta;
  if (mensagem.includes('network') || mensagem.includes('fetch') || erro instanceof TypeError) return errosDoAppAuth.semConexao;
  return errosDoAppAuth.falhaGenerica;
}

/** E-mail obrigatório e com cara de e-mail (mesma regra de `validarEmailOpcional` do app). */
function validarEmail(email: string): string | null {
  const t = email.trim();
  if (!t) return errosDoAppAuth.emailObrigatorio;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? null : errosDoAppAuth.emailInvalido;
}

/** Host de uma URL, ou o texto inteiro se não for URL. */
function hostDe(url: string | undefined): string {
  try {
    return new URL(url ?? '').host;
  } catch {
    return url ?? '';
  }
}

/**
 * Carrega o pedido de autorização (6.2, passo 5). Três saídas:
 * - pedido inválido ou vencido → mensagem, sem botão;
 * - a pessoa já consentiu antes → o Supabase devolve o `redirect_url`, e a página segue;
 * - senão → tela de consentimento com o nome do cliente (`client_name` do DCR).
 */
export async function carregarPedido(auth: AuthDaPagina, id: string): Promise<Tela> {
  const { data, error } = await auth.oauth.getAuthorizationDetails(id);
  if (error || !data) return { fase: 'invalido', mensagem: textosNovosConsentimento.pedidoInvalido };
  const d = data as { redirect_url?: string; redirect_uri?: string; client?: { name?: string } };
  if (d.redirect_url) return { fase: 'redirecionar', url: d.redirect_url };
  // Sem `client_name` no DCR, mostra o host para onde o código vai (ex.: claude.ai):
  // é um dado do pedido, não um texto inventado (15).
  const cliente = d.client?.name?.trim() || hostDe(d.redirect_uri);
  return { fase: 'consentimento', cliente };
}

/** Início da página: sem `authorization_id` é pedido inválido; sem sessão, pede login. */
export async function iniciar(auth: AuthDaPagina, id: string | null): Promise<Tela> {
  if (!id) return { fase: 'invalido', mensagem: textosNovosConsentimento.pedidoInvalido };
  const { data } = await auth.getSession();
  if (!data.session) return { fase: 'login' };
  return carregarPedido(auth, id);
}

/** Login com e-mail e senha, como o app (`entrar`): e-mail em minúsculas e sem espaço. */
export async function entrar(auth: AuthDaPagina, id: string, email: string, senha: string): Promise<Tela> {
  const erroEmail = validarEmail(email);
  if (erroEmail) return { fase: 'login', erro: erroEmail };
  if (!senha) return { fase: 'login', erro: errosDoAppAuth.senhaObrigatoria };
  try {
    const { data, error } = await auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
    if (error || !data.session) return { fase: 'login', erro: traduzirErro(error) };
  } catch (e) {
    return { fase: 'login', erro: traduzirErro(e) };
  }
  return carregarPedido(auth, id);
}

/** "Esqueci minha senha": o mesmo e-mail do app, com retorno ao app (deep link). */
export async function esqueciSenha(auth: AuthDaPagina, email: string): Promise<Tela> {
  const erroEmail = validarEmail(email);
  if (erroEmail) return { fase: 'login', erro: erroEmail };
  try {
    const { error } = await auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: DEEP_LINK_NOVA_SENHA });
    if (error) return { fase: 'login', erro: traduzirErro(error) };
  } catch (e) {
    return { fase: 'login', erro: traduzirErro(e) };
  }
  return { fase: 'login', aviso: errosDoAppAuth.emailDeSenhaEnviado };
}

/**
 * Decisão da pessoa (6.2, passo 5): aprova ou nega e segue o `redirect_url` que o
 * Supabase devolve. Negar mostra a frase de acesso negado enquanto redireciona (o
 * cliente recebe `access_denied`, 9.1). Erro vira a mensagem genérica, sem texto cru.
 */
export async function decidir(auth: AuthDaPagina, id: string, permitir: boolean): Promise<Tela | { fase: 'consentimento'; cliente: string; erro: string }> {
  try {
    const { data, error } = permitir ? await auth.oauth.approveAuthorization(id) : await auth.oauth.denyAuthorization(id);
    if (error || !data?.redirect_url) return { fase: 'invalido', mensagem: textosNovosConsentimento.pedidoInvalido };
    return permitir
      ? { fase: 'redirecionar', url: data.redirect_url }
      : { fase: 'redirecionar', url: data.redirect_url, mensagem: textosNovosConsentimento.acessoNegado };
  } catch (e) {
    return { fase: 'invalido', mensagem: traduzirErro(e) };
  }
}
