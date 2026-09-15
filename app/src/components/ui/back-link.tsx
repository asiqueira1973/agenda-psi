import { router } from 'expo-router';
import { View } from 'react-native';
import { TextLink } from './text-link';
import { spacing } from '@/theme';

/**
 * Voltar explícito no topo da tela.
 *
 * Existe porque o app roda com `headerShown: false` — o cabeçalho é desenhado
 * por cada tela, com large title próprio, e sem header nativo **não há botão
 * de voltar nenhum**. Sobrava só o gesto de arrastar da borda, que funciona mas
 * é invisível: quem não conhece o gesto fica preso na tela e conclui que o app
 * travou. Feedback do teste em aparelho, 14/09/2026.
 *
 * O componente existe em vez de cada tela repetir o `TextLink` para que a
 * próxima tela nova não dependa de alguém lembrar de desenhar o voltar.
 *
 * O rótulo padrão é "‹ Voltar". Telas que sabem de onde vieram passam o nome do
 * lugar — "‹ Pacientes" diz mais do que "‹ Voltar" e é o padrão do iOS.
 *
 * Implementa: 17.4 (área de toque de 44×44pt, herdada do TextLink) e o
 * cabeçalho do handoff.
 *
 * @param label rótulo do link; use o nome da tela de origem quando ele for conhecido
 * @param aoVoltar ação alternativa ao `router.back()`, para telas que precisam
 *   confirmar algo antes de sair
 */
export function BackLink({
  label = '‹ Voltar',
  aoVoltar,
}: {
  label?: string;
  aoVoltar?: () => void;
}) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <TextLink label={label} align="start" onPress={aoVoltar ?? (() => router.back())} />
    </View>
  );
}
