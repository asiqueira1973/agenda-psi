import { Pressable } from 'react-native';
import type { ColorValue } from 'react-native';
import { Icon, type IconName } from './icon';
import { size } from '@/theme';

/**
 * Ícone tocável com área de toque de 44×44pt.
 *
 * A área mínima de toque é 44×44 (handoff, "Espaçamento e forma", e requisito
 * 17.4). O ícone desenhado tem 21pt; sem este invólucro, o alvo do dedo teria
 * 21pt e erraria — sobretudo o olho da senha, que fica colado na borda.
 */
export function IconButton({
  name,
  color,
  onPress,
  accessibilityLabel,
}: {
  name: IconName;
  color: ColorValue;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size.minTouchTarget,
        height: size.minTouchTarget,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.5 : 1,
      })}
    >
      <Icon name={name} color={color} />
    </Pressable>
  );
}
