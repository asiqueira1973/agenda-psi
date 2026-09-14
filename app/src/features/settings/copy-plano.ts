/**
 * Textos da tela do plano e do paywall.
 *
 * Tudo aqui é literal da seção 15.7 do spec, incluindo o aviso mais importante:
 * o de que os lembretes perdidos NÃO são reenviados depois de assinar. Sem essa
 * frase na tela, a assinatura vira reclamação no dia seguinte (fluxo 9.3).
 *
 * A pergunta aberta 25.1 foi respondida em 14/09/2026: **R$ 9,90 por mês, só
 * mensal, sem teste gratuito**. O preço exibido, porém, NÃO vem daqui — vem da
 * própria loja, já formatado na moeda e no locale da conta de quem está
 * comprando. Preço de assinatura escrito à mão no app fica errado no dia em que
 * a loja reajusta ou em que alguém abre o app com conta de outro país.
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
    grupoEscolha: 'O plano',
    mensal: 'Mensal',
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
    /** Aparece quando a loja não responde — produto não cadastrado, sem rede. */
    indisponivel:
      'A assinatura não está disponível agora. Tente de novo em alguns instantes.',
    /**
     * Comportamento de 12.3 quando a notificação da loja demora: em vez de
     * spinner eterno, orienta a usar Restaurar compras.
     */
    demorou:
      'A loja confirmou a compra, mas ainda não recebemos o aviso dela. Toque em Restaurar compras em alguns minutos — nada foi perdido.',
  },
} as const;

/** Nome da loja, para a copy que fala em "sua conta da {loja}". */
export function nomeDaLoja(plataforma: 'ios' | 'android' | string): string {
  return plataforma === 'ios' ? 'App Store' : 'Google Play';
}
