/**
 * Textos da página de login e consentimento (6.3) e da página `/` (6.3, assunção 24.8).
 * Sem exclamação nem emoji (15). Arquivo puro: a página web o importa.
 *
 * `copyLoginDoApp` é copiado byte a byte de app/src/features/auth/copy.ts (`copyAuth`);
 * test/site/consent.test.ts lê aquele arquivo e falha se divergir.
 */
export const copyLoginDoApp = {
  titulo: 'Seja bem-vindo(a)',
  email: 'E-mail',
  senha: 'Senha',
  entrar: 'Entrar',
  entrando: 'Entrando...',
  esqueciSenha: 'Esqueci minha senha',
} as const;

/** Erros de autenticação do app (`copyAuth.erros`), byte a byte. */
export const errosDoAppAuth = {
  credencialIncorreta: 'E-mail ou senha incorretos.',
  emailDeSenhaEnviado: 'Enviamos um link para trocar sua senha.',
  emailObrigatorio: 'O e-mail é obrigatório',
  senhaObrigatoria: 'A senha é obrigatória',
  emailInvalido: 'Digite um e-mail válido',
  semConexao: 'Sem conexão. Verifique sua internet e tente de novo.',
  falhaGenerica: 'Algo deu errado. Se continuar, escreva para alexandre@dablab.com.br.',
} as const;

/** Texto de consentimento, literal da seção 15, e os botões. */
export const consentimento = {
  pedido: (cliente: string) =>
    `${cliente} quer acessar seu Agenda Psi para consultar e registrar pacientes, sessões, pagamentos e despesas. Você pode desconectar quando quiser.`,
  permitir: 'Permitir',
  negar: 'Negar',
} as const;

/**
 * Textos novos desta página, aprovados pelo Alexandre em 15/11/2026 (plano do épico 3,
 * pergunta 2). Permissões em linguagem simples, como pede a 6.3.
 */
export const textosNovosConsentimento = {
  pedidoInvalido: 'Este pedido de acesso não é mais válido. Volte ao Claude ou ao ChatGPT e conecte de novo.',
  acessoNegado: 'Acesso negado. Você já pode fechar esta página.',
  permissoes: [
    'Ver seus pacientes, agenda, sessões, pagamentos e despesas',
    'Registrar e editar esses dados quando você confirmar',
  ],
} as const;

/** Página `/`: destino do link de confirmação de cadastro (6.3, assunção 24.8, aprovado). */
export const paginaInicial = {
  texto: 'E-mail confirmado. Volte ao app Agenda Psi e entre com seu e-mail e senha.',
} as const;

/** Deep link de troca de senha do app (`urlDeRetornoDaSenha`): a troca termina no app (6.3). */
export const DEEP_LINK_NOVA_SENHA = 'agendapsi://nova-senha';
