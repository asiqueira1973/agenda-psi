import { ScrollView, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, spacing, size } from '@/theme';

/**
 * Casca de tela: fundo agrupado, área segura e rolagem.
 *
 * O fundo é `systemGroupedBackground` — cinza claro no modo claro e PRETO PURO
 * no escuro, não cinza escuro. É esse preto que faz a tela parecer profunda no
 * OLED, e é o detalhe que mais denuncia um app que só inverteu as cores
 * (handoff, "Modo escuro").
 *
 * Implementa: 16.2, 16.6 e o layout base do handoff.
 */
type Props = ViewProps & {
  /** Conteúdo rolável. Desligue em tela que gerencia a própria rolagem. */
  scroll?: boolean;
  /** Espaço extra no fim, para o botão preenchido fixo do rodapé não cobrir. */
  footerSpace?: boolean;
};

export function Screen({
  scroll = true,
  footerSpace = false,
  children,
  style,
  ...rest
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const paddingBottom =
    insets.bottom + spacing.xxl + (footerSpace ? size.filledButton + spacing.lg : 0);

  // A área segura do topo é do conteúdo, não do ScrollView: pôr no estilo do
  // container faria a barra de status ficar com fundo diferente ao rolar. Sem
  // isto, o large title sobe por baixo do relógio.
  const paddingTop = insets.top + spacing.lg;

  if (!scroll) {
    return (
      <View
        style={[
          { flex: 1, paddingTop: insets.top, backgroundColor: colors.groupedBackground },
          style,
        ]}
        {...rest}
      >
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: colors.groupedBackground }, style]}
      contentContainerStyle={{ paddingTop, paddingBottom }}
      keyboardShouldPersistTaps="handled"
      // A lista de indicadores e os históricos passam da altura da tela; o
      // indicador some ao parar de rolar, como nas telas nativas.
      showsVerticalScrollIndicator
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

/**
 * Rodapé fixo para o botão preenchido da tela, quando houver um.
 * Respeita o home indicator.
 */
export function ScreenFooter({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const colors = useColors();

  return (
    <View
      style={{
        // O fundo precisa ser declarado: o rodapé fica FORA do Screen, e sem
        // isto ele cai no branco padrão da raiz — no modo escuro vira uma faixa
        // clara no pé da tela, com o texto secundário sumindo dentro dela.
        backgroundColor: colors.groupedBackground,
        paddingTop: spacing.lg,
        paddingBottom: insets.bottom + spacing.lg,
      }}
    >
      {children}
    </View>
  );
}
