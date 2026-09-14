import { TextInput, View } from 'react-native';
import { Icon } from './icon';
import { TextLink } from './text-link';
import { useColors, radius, screenMargin, size, spacing, typography } from '@/theme';

/**
 * Campo de busca, no padrão do iOS: 36pt de altura, fundo de preenchimento de
 * controle, lupa à esquerda e "Cancelar" ao lado quando está ativo.
 *
 * Implementa: tela 9 e o estado 9d do handoff.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Buscar',
  onCancel,
}: {
  value: string;
  onChangeText: (texto: string) => void;
  placeholder?: string;
  onCancel?: () => void;
}) {
  const colors = useColors();
  const ativo = value.length > 0;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: screenMargin,
        gap: spacing.sm,
      }}
    >
      <View
        style={{
          flex: 1,
          height: size.searchField,
          borderRadius: radius.listGroup,
          backgroundColor: colors.controlFill,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.sm,
          gap: spacing.xs,
        }}
      >
        <Icon name="search" color={colors.secondaryLabel} size={17} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.secondaryLabel}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel={placeholder}
          style={[typography.body, { flex: 1, color: colors.label as string }]}
        />
      </View>
      {ativo && onCancel ? <TextLink label="Cancelar" onPress={onCancel} /> : null}
    </View>
  );
}
