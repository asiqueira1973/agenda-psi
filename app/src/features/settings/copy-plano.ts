/**
 * Textos da tela do plano e do paywall.
 *
 * Tudo aqui é literal da seção 15.7 do spec, incluindo o aviso mais importante:
 * o de que os lembretes perdidos NÃO são reenviados depois de assinar. Sem essa
 * frase na tela, a assinatura vira reclamação no dia seguinte (fluxo 9.3).
 *
 * Os preços estão marcados como placeholder porque a pergunta aberta 25.1 —
 * preço, periodicidade e teste gratuito — ainda não foi respondida.
 */
export const copyPlano = {
  titulo: 'Meu plano',

  /** Literal da 15.7. */
  consumo: (usados: number, limite: number) =>
    `Você usou ${usados} de ${limite} lembretes por SMS neste mês.`,
  /** Literal da 15.7. */
  planoFreeSemConsumo: (limite: number) =>
    `Plano gratuito — ${limite} lembretes por SMS por mês.`,
  /** Literal da 15.7. */
  limiteAtingidoTitulo: (data: string) => `Seus lembretes por SMS pausaram até ${data}`,
  /** Literal da 15.7. */
  limiteAtingidoCorpo: (limite: number) =>
    `Você usou os ${limite} lembretes do plano gratuito. Seus pacientes com horário marcado não vão receber o SMS até a virada do mês.`,
  /** Literal da 15.7. */
  verPro: 'Ver o plano Pro',

  grupoBeneficios: 'No plano Pro',
  beneficios: [
    'Lembretes por SMS sem limite',
    'Para todos os seus pacientes, todo mês',
    'Cancela quando quiser, direto na loja',
  ],

  /** Literal da 15.7. */
  proTitulo: 'Agenda Psi Pro',
  /** Literal da 15.7, com a loja interpolada. */
  proCorpo: (loja: string) =>
    `Lembretes por SMS sem limite, para todos os seus pacientes, todo mês. Cancela quando quiser, direto na sua conta da ${loja}.`,

  proAtivo: {
    plano: 'Plano',
    lembretes: 'Lembretes',
    ilimitados: 'Ilimitados',
    proximaCobranca: 'Próxima cobrança',
    gerenciar: (loja: string) => `Gerenciar na ${loja}`,
    rodape: (loja: string) => `A assinatura é cobrada e cancelada na sua conta da ${loja}.`,
  },

  fundador: {
    plano: 'Plano',
    rotulo: 'Fundador',
    lembretes: 'Lembretes',
    ilimitados: 'Ilimitados',
    mensalidade: 'Mensalidade',
    valor: 'R$ 0',
    /** Literal da 15.7. */
    rodape:
      'Você é um dos fundadores do Agenda Psi. Seus lembretes são ilimitados, sem mensalidade.',
  },

  paywall: {
    grupoEscolha: 'Escolha o plano',
    mensal: 'Mensal',
    anual: 'Anual',
    /** A 25.1 ainda não foi respondida: preço e periodicidade estão em aberto. */
    precoMensalPlaceholder: '[placeholder: preço mensal]',
    precoAnualPlaceholder: '[placeholder: preço anual]',
    assinar: 'Assinar o Pro',
    /** Literal da 15.7. */
    restaurar: 'Restaurar compras',
    /** Literal da 15.7. É o aviso que evita a reclamação do dia seguinte. */
    aviso:
      'Assinando agora, os lembretes voltam a sair a partir do próximo horário agendado. Os lembretes que não saíram neste mês não são reenviados.',
    /** Literal da 15.7. */
    processando: 'Estamos confirmando sua assinatura. Isso leva alguns segundos.',
    /** Literal da 15.7. */
    confirmado: 'Pronto. Seus lembretes estão liberados.',
    continuar: 'Continuar',
    /** Literal da 15.7. */
    nadaARestaurar: (loja: string) =>
      `Não encontramos nenhuma assinatura ativa nesta conta da ${loja}.`,
    /** A compra ainda não está configurada. Aparece enquanto faltar a 25.1. */
    indisponivel:
      'A assinatura ainda não está disponível. Estamos terminando de configurar na loja.',
  },
} as const;

/** Nome da loja, para a copy que fala em "sua conta da {loja}". */
export function nomeDaLoja(plataforma: 'ios' | 'android' | string): string {
  return plataforma === 'ios' ? 'App Store' : 'Google Play';
}
