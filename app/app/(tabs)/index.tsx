import { View } from 'react-native';
import { Screen, EmptyState, Text } from '@/components/ui';
import { spacing, screenMargin } from '@/theme';

/**
 * Aba Início — ESQUELETO DO ÉPICO 8.1.
 *
 * Existe para a navegação de cinco abas ficar de pé e o login ter onde chegar.
 * O conteúdo é do épico 8.3 em diante. Não escreva tela de produto aqui sem o
 * épico correspondente estar aberto.
 */
export default function IncioScreen() {
  return (
    <Screen>
      <View style={{ paddingHorizontal: screenMargin, marginBottom: spacing.xxl }}>
        <Text variant="largeTitle">Início</Text>
      </View>
      <EmptyState
        icon="home"
        title="Em construção"
        body="Esta aba entra no épico correspondente do spec."
      />
    </Screen>
  );
}
