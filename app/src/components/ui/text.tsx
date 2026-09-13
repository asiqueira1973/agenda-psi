import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useColors, typography, tabularNumbers, listBody, type ColorRole } from '@/theme';

/**
 * Texto do app. Toda string visível passa por aqui.
 *
 * Existe para que ninguém precise lembrar qual é o tamanho do "footnote" nem
 * qual token de cor corresponde a "texto secundário": pede-se o papel, e a
 * escala da seção 16.3 e a paleta da 16.2 resolvem o resto.
 *
 * Dynamic Type fica ativo (requisito 17.4) — `allowFontScaling` nunca é
 * desligado aqui, e não deve ser desligado em lugar nenhum do app.
 */

export type TextVariant = keyof typeof typography | 'listBody';

type Props = RNTextProps & {
  variant?: TextVariant;
  /** Papel de cor do design system. O padrão é o texto primário. */
  color?: ColorRole;
  /** Dígitos de largura fixa. Obrigatório em dinheiro, data e hora (16.3). */
  tabular?: boolean;
};

export function Text({
  variant = 'body',
  color = 'label',
  tabular = false,
  style,
  ...rest
}: Props) {
  const colors = useColors();
  const base = variant === 'listBody' ? listBody : typography[variant];

  return (
    <RNText
      {...rest}
      style={[base, { color: colors[color] }, tabular && tabularNumbers, style]}
    />
  );
}
