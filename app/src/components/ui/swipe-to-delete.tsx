import { useRef } from 'react';
import { Pressable, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Text } from './text';
import { useColors, size, typography } from '@/theme';

/**
 * Deslize para revelar "Excluir", como nas listas nativas do iOS.
 *
 * O handoff é explícito: exclusão por DESLIZE, revelando `Excluir` em vermelho
 * ocupando 88pt à direita — "nunca botão visível em cima da célula", que é o
 * que o app atual faz, deixando uma ação destrutiva sempre à mão em cada cartão.
 *
 * A confirmação NÃO é aqui: tocar em Excluir fecha o deslize e chama
 * `onDelete`; quem mostra o alerta nominal é a tela, com a copy de 15.4. Duas
 * responsabilidades, dois lugares.
 *
 * Implementa: "Célula de paciente" do handoff e o estado 9e.
 */
export function SwipeToDelete({
  children,
  onDelete,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  accessibilityLabel: string;
}) {
  const colors = useColors();
  const swipeable = useRef<SwipeableMethods>(null);

  return (
    <Swipeable
      ref={swipeable}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          onPress={() => {
            // Fecha antes de perguntar: manter a célula aberta por trás do
            // alerta faz parecer que a exclusão já aconteceu.
            swipeable.current?.close();
            onDelete();
          }}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={{
            width: size.swipeDeleteWidth,
            backgroundColor: colors.destructive,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={[typography.body, { color: colors.onAccent }]}>Excluir</Text>
        </Pressable>
      )}
    >
      <View style={{ backgroundColor: colors.listSurface }}>{children}</View>
    </Swipeable>
  );
}
