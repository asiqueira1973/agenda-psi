import { Pressable, View } from 'react-native';
import { Text } from './text';
import { useColors, radius, size, spacing } from '@/theme';

/**
 * Segmented control, no padrão do iOS.
 *
 * Trilha na cor de preenchimento de controle, raio 9, padding 2; o segmento
 * selecionado ganha fundo de superfície, raio 7 e texto 15pt semibold; os
 * outros ficam em 15pt secundário (handoff, "Segmented control").
 *
 * Usado em quatro lugares: status do paciente, modalidade e pagamento da
 * sessão, tipo do pagamento e o seletor de dia da agenda.
 *
 * O valor do item é o LITERAL que vai para o banco (regra 11.4) e o rótulo é o
 * que aparece na tela. Separar os dois é o que impede alguém de "normalizar"
 * `nao pagou` para `não pagou` e quebrar a view.
 */
export type SegmentoOpcao<T extends string | number> = {
  valor: T;
  rotulo: string;
};

export function SegmentedControl<T extends string | number>({
  opcoes,
  valor,
  onChange,
  accessibilityLabel,
}: {
  opcoes: readonly SegmentoOpcao<T>[];
  valor: T;
  onChange: (novo: T) => void;
  accessibilityLabel?: string;
}) {
  const colors = useColors();

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        backgroundColor: colors.controlFill,
        borderRadius: radius.segmentedTrack,
        padding: 2,
        height: size.segmented,
      }}
    >
      {opcoes.map((opcao) => {
        const selecionado = opcao.valor === valor;
        return (
          <Pressable
            key={String(opcao.valor)}
            onPress={() => onChange(opcao.valor)}
            accessibilityRole="tab"
            accessibilityLabel={opcao.rotulo}
            accessibilityState={{ selected: selecionado }}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.segmentedThumb,
              backgroundColor: selecionado ? colors.listSurface : 'transparent',
              paddingHorizontal: spacing.xs,
            }}
          >
            <Text
              variant="subheadline"
              color={selecionado ? 'label' : 'secondaryLabel'}
              numberOfLines={1}
              style={selecionado ? { fontWeight: '600' } : undefined}
            >
              {opcao.rotulo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Envolve o segmented no espaçamento de um grupo de lista. */
export function SegmentedGroupContent({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
      {children}
    </View>
  );
}
