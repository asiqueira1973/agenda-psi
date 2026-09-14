import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './text';
import { Icon } from './icon';
import { TextLink } from './text-link';
import { ListGroup, RowSeparator } from './list-group';
import { SearchField } from './search-field';
import { useColors, listBody, radius, screenMargin, size, spacing } from '@/theme';

/**
 * Linha que abre um seletor de item, sobre um scrim.
 *
 * O handoff descreve o tipo da despesa e o paciente do agendamento como "linha
 * de navegação, seletor com busca". Aqui a navegação é uma folha modal em vez
 * de uma rota: escolher um item e devolvê-lo para a tela anterior, com
 * expo-router, exige guardar o resultado num lugar que as duas telas enxerguem —
 * e esse lugar vira estado global para resolver um problema que não é global.
 * A folha mantém a escolha dentro do formulário que a pediu.
 *
 * Visualmente é o que o handoff pede: linha com rótulo à esquerda, valor à
 * direita e chevron; a folha tem título, Cancelar à esquerda e a lista de
 * opções com check azul na selecionada.
 *
 * Implementa: telas 19 e 7 do handoff.
 */
export type OpcaoDoSeletor = { id: string; rotulo: string; detalhe?: string };

export function PickerRow({
  label,
  opcoes,
  valorSelecionado,
  onSelecionar,
  placeholder = 'Selecione...',
  tituloDaFolha,
  comBusca = false,
  hasError = false,
  labelWidth = 96,
}: {
  label: string;
  opcoes: OpcaoDoSeletor[];
  valorSelecionado: string | null;
  onSelecionar: (id: string) => void;
  placeholder?: string;
  tituloDaFolha?: string;
  comBusca?: boolean;
  hasError?: boolean;
  labelWidth?: number;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');

  const selecionada = opcoes.find((o) => o.id === valorSelecionado);

  const visiveis = busca.trim()
    ? opcoes.filter((o) =>
        o.rotulo.toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR')),
      )
    : opcoes;

  return (
    <>
      <Pressable
        onPress={() => setAberto(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selecionada?.rotulo ?? placeholder}`}
        style={({ pressed }) => ({
          minHeight: size.listRow,
          paddingHorizontal: screenMargin,
          paddingVertical: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          backgroundColor: pressed ? colors.controlFill : 'transparent',
        })}
      >
        <Text style={[listBody, { width: labelWidth }]} color={hasError ? 'destructive' : 'label'}>
          {label}
        </Text>
        <Text
          style={[listBody, { flex: 1 }]}
          color={selecionada ? 'label' : 'tertiaryLabel'}
          numberOfLines={1}
        >
          {selecionada?.rotulo ?? placeholder}
        </Text>
        <Icon name="chevron" color={colors.tertiaryLabel} size={15} />
      </Pressable>

      <Modal
        visible={aberto}
        animationType="slide"
        transparent
        onRequestClose={() => setAberto(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.scrim as string, justifyContent: 'flex-end' }}>
          <View
            style={{
              maxHeight: '80%',
              backgroundColor: colors.groupedBackground,
              borderTopLeftRadius: radius.sheetTop,
              borderTopRightRadius: radius.sheetTop,
              paddingBottom: insets.bottom,
            }}
          >
            <View
              style={{
                height: size.sheetHeader,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.xs,
              }}
            >
              <View style={{ flex: 1, alignItems: 'flex-start' }}>
                <TextLink label="Cancelar" onPress={() => setAberto(false)} />
              </View>
              <Text variant="headline">{tituloDaFolha ?? label}</Text>
              <View style={{ flex: 1 }} />
            </View>

            {comBusca ? (
              <View style={{ paddingBottom: spacing.md }}>
                <SearchField value={busca} onChangeText={setBusca} onCancel={() => setBusca('')} />
              </View>
            ) : null}

            <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
              <ListGroup first>
                {visiveis.map((opcao, i) => (
                  <View key={opcao.id}>
                    {i > 0 ? <RowSeparator /> : null}
                    <Pressable
                      onPress={() => {
                        onSelecionar(opcao.id);
                        setBusca('');
                        setAberto(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={opcao.rotulo}
                      accessibilityState={{ selected: opcao.id === valorSelecionado }}
                      style={({ pressed }) => ({
                        minHeight: size.listRow,
                        paddingHorizontal: screenMargin,
                        paddingVertical: spacing.sm,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.md,
                        backgroundColor: pressed ? colors.controlFill : 'transparent',
                      })}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={listBody}>{opcao.rotulo}</Text>
                        {opcao.detalhe ? (
                          <Text variant="subheadline" color="secondaryLabel">
                            {opcao.detalhe}
                          </Text>
                        ) : null}
                      </View>
                      {opcao.id === valorSelecionado ? (
                        <Icon name="check" color={colors.accent} size={20} />
                      ) : null}
                    </Pressable>
                  </View>
                ))}
              </ListGroup>

              {visiveis.length === 0 ? (
                <Text color="secondaryLabel" style={{ textAlign: 'center', marginTop: spacing.xxl }}>
                  Nada encontrado.
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
