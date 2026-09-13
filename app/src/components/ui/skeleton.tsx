import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useColors, spacing, screenMargin, size } from '@/theme';
import { ListGroup, RowSeparator } from './list-group';

/**
 * Esqueleto de carregamento.
 *
 * "Esqueleto na forma do conteúdo, nunca zeros nem spinner de tela cheia"
 * (handoff, "Interactions & Behavior"). Cartão zerado é pior que espera: quem
 * vê `R$ 0` de lucro acredita, fecha o app e não volta.
 *
 * Implementa: princípio P3, critério de aceite de 8.3 e o estado 5a do handoff.
 */

/** Barra arredondada na cor de preenchimento de controle. */
export function SkeletonBar({ width, height = 17 }: { width: number | `${number}%`; height?: number }) {
  const colors = useColors();
  const opacidade = useSharedValue(0.5);

  useEffect(() => {
    opacidade.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacidade]);

  const estilo = useAnimatedStyle(() => ({ opacity: opacidade.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: height / 2, backgroundColor: colors.controlFill },
        estilo,
      ]}
    />
  );
}

/** Uma linha de lista em esqueleto: rótulo à esquerda, valor à direita. */
export function SkeletonRow() {
  return (
    <View
      style={{
        minHeight: size.listRow,
        paddingHorizontal: screenMargin,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <SkeletonBar width={140} />
      <SkeletonBar width={64} />
    </View>
  );
}

/** Grupo inteiro em esqueleto, com o número de linhas do conteúdo real. */
export function SkeletonGroup({ rows = 3, title }: { rows?: number; title?: string }) {
  return (
    <ListGroup title={title}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i}>
          {i > 0 ? <RowSeparator /> : null}
          <SkeletonRow />
        </View>
      ))}
    </ListGroup>
  );
}

/** Espaço padrão entre blocos de esqueleto. */
export const skeletonGap = spacing.xxl;
