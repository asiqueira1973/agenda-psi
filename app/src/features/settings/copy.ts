/**
 * Textos das Configurações.
 * Os marcados como literais vêm das seções 15.4 e 15.9 e são texto final.
 */
export const copyConfiguracoes = {
  titulo: 'Configurações',

  grupoConta: 'Conta',
  meuPerfil: 'Meu perfil',
  trocarSenha: 'Trocar senha',

  grupoPlano: 'Plano',
  meuPlano: 'Meu plano',
  planoGratuito: 'Gratuito',
  planoPro: 'Pro',
  planoFundador: 'Fundador',

  grupoSobre: 'Sobre',
  feedback: 'Dar feedback sobre o app',
  politica: 'Política de privacidade',

  sair: 'Sair',
  apagarConta: 'Apagar a minha conta',

  /** Literal da 15.4. */
  confirmarSaida: 'Sair da sua conta?',
  cancelar: 'Cancelar',

  perfil: {
    titulo: 'Meu perfil',
    nome: 'Nome',
    telefone: 'Telefone',
    linkedin: 'LinkedIn',
    instagram: 'Instagram',
    salvar: 'Salvar',
    salvando: 'Salvando...',
    sucesso: 'Perfil atualizado.',
  },

  senha: {
    titulo: 'Trocar senha',
    /** Do handoff, tela 23. */
    rodape: 'Um e-mail para trocar a senha será enviado para o endereço abaixo',
    email: 'E-mail',
    enviar: 'Enviar',
    enviando: 'Enviando...',
  },

  feedbackTela: {
    titulo: 'Dar feedback',
    /** Do handoff, tela 26. */
    rodape:
      'Deixe sua mensagem abaixo com sugestões ou problemas que você encontrou no app.',
    placeholder: 'Escreva aqui...',
    enviar: 'Enviar',
    enviando: 'Enviando...',
    sucesso: 'Obrigado. Sua mensagem chegou.',
  },

  apagar: {
    titulo: 'Apagar minha conta',
    /** Literal da 15.4. */
    aviso: 'Essa operação é irreversível. Para confirmar, digite QUERO DELETAR no campo abaixo.',
    /** Do handoff, tela 27. */
    rodape: 'Pacientes, sessões, pagamentos e despesas são apagados junto.',
    campo: 'Confirmação',
    botao: 'Deletar',
    apagando: 'Apagando...',
    /** Literal da 15.4. */
    sucesso: 'Sua conta foi desativada. Até logo.',
  },
} as const;
