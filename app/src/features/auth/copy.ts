/**
 * Textos das telas de autenticação.
 *
 * Copiados da seção 15.2 do spec, que é texto FINAL, não rascunho: não
 * reescreva, não melhore, não acrescente exclamação. Onde o handoff de design
 * divergiu da 15, a decisão de 13/09/2026 foi caso a caso, e está marcada.
 *
 * Ficam num arquivo só para que revisar a copy contra o spec seja ler um
 * arquivo, e não caçar string espalhada por seis telas.
 */
export const copyAuth = {
  login: {
    titulo: 'Seja bem-vindo(a)',
    subtitulo: 'Vamos começar preenchendo as informações abaixo',
    email: 'E-mail',
    senha: 'Senha',
    entrar: 'Entrar',
    entrando: 'Entrando...',
    esqueciSenha: 'Esqueci minha senha',
    criarConta: 'Não tem uma conta? Crie uma conta aqui',
    politica: 'Política de privacidade',
    assinatura: 'Dab Lab',
  },

  novaConta: {
    titulo: 'Crie sua conta',
    nome: 'Nome',
    email: 'E-mail',
    senha: 'Senha',
    confirmacao: 'Confirmação',
    criar: 'Criar conta',
    criando: 'Criando...',
    jaTemConta: 'Já tem uma conta? Entre aqui',
  },

  confirmeEmail: {
    titulo: 'Confirme seu e-mail',
    /** Recebe o e-mail digitado. Literal da 15.2. */
    corpo: (email: string) =>
      `Enviamos um link de confirmação para ${email}. Abra o e-mail e toque no link para ativar sua conta.`,
    reenviar: 'Reenviar o e-mail',
    voltar: 'Voltar para o login',
  },

  novaSenha: {
    titulo: 'Nova senha',
    subtitulo: 'Escolha uma senha nova para entrar no Agenda Psi.',
    senha: 'Nova senha',
    confirmacao: 'Confirmação',
    salvar: 'Salvar a nova senha',
    salvando: 'Salvando...',
  },

  erros: {
    /** Literal da 15.2. */
    credencialIncorreta: 'E-mail ou senha incorretos.',
    /**
     * Literal da 15.2. O handoff propunha "Esta conta foi desativada. Fale com
     * o suporte da Dab Lab para reativar o acesso." — o spec venceu, decisão de
     * 13/09/2026, porque o texto dele diz PARA ONDE escrever e cobre o caso de
     * quem pediu a exclusão. "Fale com o suporte" sem endereço não resolve.
     */
    contaDesativada:
      'Sua conta está desativada. Se você pediu a exclusão, o acesso foi encerrado. Escreva para alexandre@dablab.com.br se quiser reativar.',
    /** Literal da 15.2. Substitui o `Passwords don't match!` do app atual. */
    senhasDiferentes: 'As senhas não são iguais.',
    /** Literal da 15.2. */
    emailDeSenhaEnviado: 'Enviamos um link para trocar sua senha.',
    emailObrigatorio: 'O e-mail é obrigatório',
    senhaObrigatoria: 'A senha é obrigatória',
    nomeObrigatorio: 'O nome é obrigatório',
    emailInvalido: 'Digite um e-mail válido',
    senhaCurta: 'A senha precisa ter ao menos 6 caracteres',
    emailJaCadastrado: 'Já existe uma conta com esse e-mail. Tente entrar.',
    /** Literais da 15.9, para o que não é específico de autenticação. */
    semConexao: 'Sem conexão. Verifique sua internet e tente de novo.',
    falhaGenerica: 'Algo deu errado. Se continuar, escreva para alexandre@dablab.com.br.',
  },

  /**
   * Explicação de por que a pessoa está vendo a tela de login numa atualização.
   *
   * Não vem do spec: nasce da decisão de 13/09/2026 de não construir a
   * importação de sessão. Quem atualiza o app cai aqui, e sem este texto
   * conclui que perdeu a conta.
   */
  avisoDaAtualizacao:
    'O Agenda Psi foi reconstruído e precisa que você entre de novo. Seus pacientes, sessões e pagamentos estão todos lá.',
} as const;
