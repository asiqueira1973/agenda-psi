import { View } from 'react-native';
import { Text } from './text';
import { useColors, radius, screenMargin, spacing, homeHeroNumber } from '@/theme';

/**
 * Cartão de indicador. Existe em UM lugar do app: o topo da Home.
 *
 * É aqui, e só aqui, que mora o número de 34pt (handoff, "iOS é lista, não
 * cartão"). Em tela de detalhe, nunca — o dia em que um 34pt aparecer no
 * detalhe do paciente, a linguagem visual do app virou dashboard web.
 *
 * Sem borda, sem sombra, sem ícone: a separação do fundo é feita pela cor da
 * superfície, como nos apps nativos.
 *
 * Implementa: "Cartão de indicador" do handoff e seção 16.5 do spec.
 */
export function StatCard({ rotulo, valor }: { rotulo: string; valor: string }) {
  const colors = useColors();

  return (
    <View
      style={{
        marginHorizontal: screenMargin,
        backgroundColor: colors.listSurface,
        borderRadius: radius.card,
        paddingTop: spacing.md,
        paddingHorizontal: screenMargin,
        paddingBottom: 14,
      }}
    >
      <Text variant="footnote" color="secondaryLabel">
        {rotulo}
      </Text>
      <Text style={[homeHeroNumber, { color: colors.label, marginTop: spacing.xs }]}>
        {valor}
      </Text>
    </View>
  );
}
