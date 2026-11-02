/**
 * Textos do agente no Início — fase 1, só consultas (docs/agente-plano.md).
 *
 * As sugestões são todas de consulta: oferecer "registre…" agora prometeria o
 * que a fase 1 não faz. Cada uma mexe numa coisa só do app.
 */
export const copyAgente = {
  placeholder: 'Pergunte sobre pacientes, sessões e pagamentos',
  placeholderContinuar: 'Continuar…',
  grupoSugestoes: 'Experimente',
  sugestoes: [
    'Quem está me devendo?',
    'Quanto recebi no mês passado?',
    'Quantas sessões fiz este mês?',
  ],
  novaConversa: 'Nova conversa',
  pensando: 'Consultando…',
  enviar: 'Enviar',
  erros: {
    nao_autenticado: 'Sua sessão expirou. Entre de novo.',
    conversa_invalida: 'Não consegui ler a pergunta. Tente escrever de outro jeito.',
    limite_excedido: 'Você já fez muitas perguntas nesta hora. Tente de novo mais tarde.',
    desligado: 'O assistente está indisponível no momento.',
    agente_indisponivel: 'Não consegui responder agora. Tente de novo em alguns instantes.',
  },
} as const;
