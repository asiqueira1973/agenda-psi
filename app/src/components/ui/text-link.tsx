import { Pressable, View } from 'react-native';
import { Text, type TextVariant } from './text';
import { useColors, size, spacing } from '@/theme';

/**
 * Link de texto centralizado — "Esqueci minha senha", "Crie uma conta aqui".
 *
 * Existe por um motivo específico: texto azul dentro de um Pressable sem
 * preenchimento tem área de toque da altura da LETRA, uns 20pt. O handoff e o
 * requisito 17.4 exigem 44×44pt, e essa diferença não aparece no simulador com
 * mouse — aparece no dedo de quem usa o app, que erra e acha que travou.
 *
 * Implementa: "Espaçamento e forma" do handoff (área mínima de toque) e o
 * requisito 17.4 de acessibilidade.
 */
export function TextLink({
  label,
  onPress,
  disabled = false,
  variant = 'body',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: TextVariant;
}) {
  const colors = useColors();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={({ pressed }) => ({
        minHeight: size.minTouchTarget,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        alignSelf: 'center',
        opacity: disabled ? 0.4 : pressed ? 0.5 : 1,
      })}
    >
      <Text variant={variant} style={{ color: colors.accent, textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
}
