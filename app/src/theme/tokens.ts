/**
 * Valores crus do design system — espaçamento, forma, alturas, tipografia e a
 * tabela de cores em hexadecimal.
 *
 * Fonte: seção "Design Tokens" do handoff de design e seção 16 do spec.
 *
 * Os hexadecimais existem por dois motivos, e nenhum deles é "colar na view":
 * servem de conferência para saber qual token é qual, e são o valor real usado
 * no Android, onde não há equivalente de UIColor.system*. No iOS quem resolve a
 * cor é PlatformColor, em colors.ts.
 */

/** Grade de 4pt (handoff, "Espaçamento e forma"). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** Margem lateral padrão de toda tela (handoff, 16pt). */
export const screenMargin = 16;

/** Raios. Cada superfície tem o seu; não existe raio "genérico". */
export const radius = {
  listGroup: 10,
  card: 10,
  filledButton: 10,
  sheetTop: 12,
  alert: 14,
  segmentedTrack: 9,
  segmentedThumb: 7,
  chatBubble: 18,
  searchField: 18,
} as const;

/**
 * Alturas fixas. As de linha são MÍNIMO, não teto: com Dynamic Type ligado a
 * linha cresce (handoff, "Interactions & Behavior").
 */
export const size = {
  listRow: 44,
  listRowTwoLines: 56,
  patientRowTwoLines: 64,
  patientRowThreeLines: 72,
  filledButton: 50,
  statusBar: 44,
  navBar: 44,
  tabBar: 49,
  homeIndicator: 34,
  sheetHeader: 52,
  searchField: 36,
  segmented: 34,
  minTouchTarget: 44,
  /** Faixa de hora vazia na grade da agenda. */
  scheduleEmptyHour: 20,
  /** Largura da coluna de horas na grade da agenda. */
  scheduleHourColumn: 46,
  /** Largura revelada pelo deslize de exclusão na célula de paciente. */
  swipeDeleteWidth: 88,
  /** Espessura do hairline. Em tela @2x e @3x isso vira meio pixel de verdade. */
  hairline: 0.5,
  /** Ícone à esquerda de linha de lista. */
  rowIcon: 21,
  /** Ícone de barra de navegação. */
  navIcon: 24,
} as const;

/**
 * Inset do hairline dentro do container: alinha com o texto, não sangra até a
 * borda. Quando a linha tem ícone à esquerda, o texto começa mais adiante e o
 * hairline acompanha (handoff, "Inset grouped list" e "Linha de ação").
 */
export const separatorInset = {
  withoutIcon: 16,
  withIcon: 49,
} as const;

/** Espaço entre grupos de lista e entre o título e o seu container. */
export const groupSpacing = {
  betweenGroups: 24,
  titleToContainer: 6,
} as const;

/**
 * Paleta em hexadecimal. Usada de verdade só no Android; no iOS é referência.
 * Espelha a tabela de Design Tokens do handoff, sem inventar nenhum valor.
 */
export const palette = {
  light: {
    accent: '#007AFF',
    onAccent: '#FFFFFF',
    label: '#000000',
    secondaryLabel: 'rgba(60,60,67,0.6)',
    tertiaryLabel: 'rgba(60,60,67,0.3)',
    systemGray: '#8E8E93',
    groupedBackground: '#F2F2F7',
    listSurface: '#FFFFFF',
    separator: '#C6C6C8',
    controlFill: '#E9E9EB',
    positive: '#34C759',
    warning: '#FF9500',
    destructive: '#FF3B30',
    scrim: 'rgba(0,0,0,0.4)',
  },
  dark: {
    accent: '#0A84FF',
    onAccent: '#FFFFFF',
    label: '#FFFFFF',
    secondaryLabel: 'rgba(235,235,245,0.6)',
    tertiaryLabel: 'rgba(235,235,245,0.3)',
    systemGray: '#8E8E93',
    /** Preto puro, não cinza escuro: é o que dá profundidade no OLED (handoff). */
    groupedBackground: '#000000',
    listSurface: '#1C1C1E',
    separator: '#38383A',
    controlFill: '#2C2C2E',
    positive: '#30D158',
    warning: '#FF9F0A',
    destructive: '#FF453A',
    scrim: 'rgba(0,0,0,0.6)',
  },
} as const;

export type ColorRole = keyof typeof palette.light;
