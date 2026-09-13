import { Pressable, View } from 'react-native';
import { Text } from './text';
import { Icon } from './icon';
import { useColors, spacing, screenMargin } from '@/theme';

/**
 * Estado de erro de carregamento.
 *
 * O app atual não tem nenhum: lista que falha aparece em branco e o usuário
 * conclui que não tem dado (defeito 11.9.14). Aqui a falha diz o que houve e
 * oferece o caminho de volta, num toque.
 *
 * O texto é literal da seção 15.9 do spec e não deve ser reescrito.
 *
 * Implementa: princípio P3, 12.3 e a copy de 15.9.
 */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const colors = useColors();

  return (
    <Pressable
      onPress={onRetry}
      accessibilityRole="button"
      accessibilityLabel="Não foi possível carregar. Toque para tentar de novo."
      style={{ flex: 1, justifyContent: 'center' }}
    >
      <View style={{ alignItems: 'center', paddingHorizontal: screenMargin * 2 }}>
        <Icon name="warning" color={colors.systemGray} size={52} />
        <Text
          color="secondaryLabel"
          style={{ textAlign: 'center', marginTop: spacing.xl }}
        >
          Não foi possível carregar. Toque para tentar de novo.
        </Text>
      </View>
    </Pressable>
  );
}
