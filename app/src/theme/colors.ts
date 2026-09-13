import { Platform, PlatformColor, useColorScheme } from 'react-native';
import type { ColorValue } from 'react-native';
import { palette, type ColorRole } from './tokens';

/**
 * Resolve as cores do app.
 *
 * Regra do handoff ("About the Design Files"): no app vai a paleta semântica
 * nativa, não hexadecimal cravado. No iOS isso é PlatformColor, que devolve a
 * cor dinâmica do sistema — ela já troca sozinha entre claro e escuro, já
 * responde a Aumentar Contraste e já acompanha qualquer ajuste que a Apple faça
 * numa versão futura do iOS. No Android não existe equivalente exposto ao React
 * Native, então lá as cores vêm da tabela de tokens, escolhidas pelo esquema
 * atual (spec 16.1: tokens únicos, dois temas de plataforma).
 *
 * Implementa: seção 16 do spec e a seção "Design Tokens" do handoff.
 */

/** Nome do token de cor do iOS para cada papel do design system. */
const iosSemanticName: Record<ColorRole, string | null> = {
  accent: 'systemBlue',
  // Branco sobre o azul. Não há token semântico do sistema para isto.
  onAccent: null,
  label: 'label',
  secondaryLabel: 'secondaryLabel',
  tertiaryLabel: 'tertiaryLabel',
  systemGray: 'systemGray',
  groupedBackground: 'systemGroupedBackground',
  listSurface: 'secondarySystemGroupedBackground',
  separator: 'opaqueSeparator',
  controlFill: 'tertiarySystemFill',
  positive: 'systemGreen',
  warning: 'systemOrange',
  destructive: 'systemRed',
  // O scrim é uma sobreposição preta com alfa, não uma cor do sistema.
  scrim: null,
};

export type Colors = Record<ColorRole, ColorValue>;

/**
 * Monta a paleta para um esquema de cor.
 *
 * Recebe: 'light' ou 'dark' — usado só no Android e no fallback do iOS.
 * Devolve: um objeto com uma cor por papel do design system.
 *
 * No iOS o esquema é ignorado de propósito: PlatformColor já devolve a cor
 * dinâmica, e trocá-la à mão desligaria o comportamento nativo.
 */
export function buildColors(scheme: 'light' | 'dark'): Colors {
  const fallback = palette[scheme];

  if (Platform.OS !== 'ios') {
    return { ...fallback };
  }

  const resolved = {} as Colors;
  for (const role of Object.keys(fallback) as ColorRole[]) {
    const semantic = iosSemanticName[role];
    resolved[role] = semantic ? PlatformColor(semantic) : fallback[role];
  }
  return resolved;
}

/**
 * Devolve a paleta do esquema de cor vigente no aparelho.
 *
 * O modo escuro é obrigatório e segue o aparelho (spec 16.6). Quando o sistema
 * não informa o esquema, o padrão é claro — mesmo comportamento do iOS.
 */
export function useColors(): Colors {
  const scheme = useColorScheme();
  return buildColors(scheme === 'dark' ? 'dark' : 'light');
}

/**
 * Diz se o esquema vigente é o escuro. Serve para o que não é cor — barra de
 * status, teclado, estilo de folha modal.
 */
export function useIsDarkMode(): boolean {
  return useColorScheme() === 'dark';
}
