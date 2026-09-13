import { Platform, type TextStyle } from 'react-native';

/**
 * Escala tipográfica do app.
 *
 * Fonte: seção "Tipografia" do handoff e seção 16.3 do spec. A fonte é sempre a
 * do sistema — SF Pro no iOS, Roboto no Android (spec 16.1) — e por isso
 * fontFamily fica de fora: o padrão do React Native já é a fonte do sistema, e
 * declará-la à mão quebraria a substituição automática em outros idiomas e nos
 * tamanhos grandes de Dynamic Type.
 *
 * Dynamic Type fica ativo em tudo (requisito 17.4). Os tamanhos abaixo são o
 * ponto de partida; o sistema escala a partir deles. Nenhum texto do app leva
 * allowFontScaling={false}.
 */

/** Dígitos de largura fixa. Sem isso a coluna de valores dança (handoff 16.3). */
export const tabularNumbers: TextStyle = {
  fontVariant: ['tabular-nums'],
};

export const typography = {
  /** Título de aba e de tela; colapsa ao rolar. */
  largeTitle: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.68, // −0.02em sobre 34pt
  },
  /** Número principal do cartão da Home e título de estado vazio forte. */
  title2: {
    fontSize: 22,
    fontWeight: '700',
  },
  /** Nome do paciente, título de alerta e de folha modal, rótulo de botão. */
  headline: {
    fontSize: 17,
    fontWeight: '600',
  },
  /** Rótulo e valor de linha de lista, corpo de estado vazio. */
  body: {
    fontSize: 17,
    fontWeight: '400',
  },
  /** Segunda linha de célula de paciente e de despesa. */
  subheadline: {
    fontSize: 15,
    fontWeight: '400',
  },
  /** Título de grupo, rodapé, metadado, erro, coluna de horas da agenda. */
  footnote: {
    fontSize: 13,
    fontWeight: '400',
  },
  /** Rótulo de aba e aviso legal do paywall. */
  caption: {
    fontSize: 12,
    fontWeight: '400',
  },
} as const satisfies Record<string, TextStyle>;

/**
 * O número grande de 34pt existe em UM lugar do app inteiro: o cartão
 * "Pacientes Ativos" no topo da Home. Em tela de detalhe, nunca (handoff,
 * "iOS é lista, não cartão"). Está separado da escala para que usá-lo fora dali
 * seja uma decisão consciente, e não um descuido de copiar e colar.
 */
export const homeHeroNumber: TextStyle = {
  fontSize: 34,
  fontWeight: '700',
  ...tabularNumbers,
};

/**
 * Título de grupo de lista. No iOS é footnote em maiúsculas na cor secundária;
 * no Android é 14pt medium na cor de destaque, sem maiúsculas (handoff,
 * "Android"). A cor entra na view; aqui fica só a forma da letra.
 */
export const groupTitle: TextStyle = Platform.select({
  ios: { fontSize: 13, fontWeight: '400', letterSpacing: 0.5 },
  default: { fontSize: 14, fontWeight: '500' },
});

/** No Android o corpo de lista é 16pt, não 17pt (handoff, "Android"). */
export const listBody: TextStyle = Platform.select({
  ios: typography.body,
  default: { fontSize: 16, fontWeight: '400' },
});
