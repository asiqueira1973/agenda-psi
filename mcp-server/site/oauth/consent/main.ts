import { createClient } from '@supabase/supabase-js';
import { consentimento, copyLoginDoApp, textosNovosConsentimento } from '../../../src/rules/auth-copy.js';
import { decidir, entrar, esqueciSenha, iniciar, type AuthDaPagina, type Tela } from './flow.js';

/**
 * Página de login e consentimento do OAuth (6.2, passo 5, e 6.3), em
 * `https://app.agendapsi.app.br/oauth/consent?authorization_id=…`.
 *
 * Só a chave publicável, injetada no build (nenhuma chave secreta, 6.3). A sessão
 * fica em `sessionStorage`: fechar a aba encerra o login neste domínio. Toda a lógica
 * está em flow.ts; aqui só se desenha a tela e se liga os botões.
 */
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_PUBLISHABLE_KEY__: string;

const supabase = createClient(__SUPABASE_URL__, __SUPABASE_PUBLISHABLE_KEY__, {
  auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
const auth = supabase.auth as unknown as AuthDaPagina;
const id = new URLSearchParams(location.search).get('authorization_id');

const $ = <T extends HTMLElement>(i: string) => document.getElementById(i) as T;

// --- Textos fixos (15 e 6.3) --------------------------------------------------------
$('titulo').textContent = copyLoginDoApp.titulo;
document.querySelector<HTMLLabelElement>('label[for="email"]')!.textContent = copyLoginDoApp.email;
document.querySelector<HTMLLabelElement>('label[for="senha"]')!.textContent = copyLoginDoApp.senha;
$('entrar').textContent = copyLoginDoApp.entrar;
$('esqueci').textContent = copyLoginDoApp.esqueciSenha;
$('permitir').textContent = consentimento.permitir;
$('negar').textContent = consentimento.negar;
$('permissoes').replaceChildren(
  ...textosNovosConsentimento.permissoes.map((t) => Object.assign(document.createElement('li'), { textContent: t })),
);

/** Desenha uma tela. Redirecionar sai da página: é o `redirect_url` do Supabase. */
function mostrar(t: Tela & { erro?: string; aviso?: string }): void {
  document.querySelector('main')!.setAttribute('aria-busy', 'false');
  $('login').hidden = t.fase !== 'login';
  $('consentimento').hidden = t.fase !== 'consentimento';

  const mensagem = $('mensagem');
  const textoMensagem = t.fase === 'invalido' || t.fase === 'redirecionar' ? t.mensagem ?? '' : '';
  mensagem.textContent = textoMensagem;
  mensagem.hidden = !textoMensagem;

  const erroAlvo = t.fase === 'consentimento' ? 'erro-consentimento' : 'erro-login';
  for (const e of ['erro-login', 'erro-consentimento']) {
    const p = $(e);
    p.textContent = e === erroAlvo ? t.erro ?? '' : '';
    p.hidden = !(e === erroAlvo && t.erro);
  }
  const aviso = $('aviso-login');
  aviso.textContent = t.aviso ?? '';
  aviso.hidden = !t.aviso;

  if (t.fase === 'consentimento') {
    // O nome do cliente vai em negrito, como na seção 15; o resto do texto é o literal.
    const [antes, depois] = consentimento.pedido('\u0000').split('\u0000');
    $('pedido').replaceChildren(antes ?? '', Object.assign(document.createElement('strong'), { textContent: t.cliente }), depois ?? '');
  }
  if (t.fase === 'redirecionar') location.assign(t.url);
}

/** Trava os botões durante uma chamada, para não haver clique duplo. */
async function ocupado<T>(botoes: string[], rotulo: [string, string] | null, f: () => Promise<T>): Promise<T> {
  const els = botoes.map((b) => $<HTMLButtonElement>(b));
  els.forEach((b) => (b.disabled = true));
  if (rotulo) $(rotulo[0]).textContent = rotulo[1];
  try {
    return await f();
  } finally {
    els.forEach((b) => (b.disabled = false));
    if (rotulo) $(rotulo[0]).textContent = copyLoginDoApp.entrar;
  }
}

$('login').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const email = $<HTMLInputElement>('email').value;
  const senha = $<HTMLInputElement>('senha').value;
  mostrar(await ocupado(['entrar', 'esqueci'], ['entrar', copyLoginDoApp.entrando], () => entrar(auth, id ?? '', email, senha)));
});

$('esqueci').addEventListener('click', async () => {
  mostrar(await ocupado(['entrar', 'esqueci'], null, () => esqueciSenha(auth, $<HTMLInputElement>('email').value)));
});

for (const [botao, permitir] of [['permitir', true], ['negar', false]] as const) {
  $(botao).addEventListener('click', async () => {
    mostrar(await ocupado(['permitir', 'negar'], null, () => decidir(auth, id ?? '', permitir)));
  });
}

void iniciar(auth, id).then(mostrar);
