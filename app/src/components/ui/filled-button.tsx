import { ActivityIndicator, Pressable, View } from 'react-native';
import { Text } from './text';
import { useColors, radius, size, screenMargin, spacing, typography } from '@/theme';

/**
 * Botão preenchido.
 *
 * Regra do handoff, em "Botões": no máximo UM por tela, e ele vive no rodapé,
 * largura total — ou não existe. Qualquer outra coisa que no web seria botão
 * vira linha de lista com texto azul (ActionRow).
 *
 * Ele também carrega dois dos quatro estados do princípio P3: enquanto a
 * operação corre, o botão desabilita e mostra o próprio texto de progresso, em
 * vez de deixar o usuário tocar duas vezes e gravar duas sessões.
 *
 * Implementa: "Botões" e "Estado vazio" do handoff, 16.5 e o princípio P3.
 */
type Props = {
  label: string;
  onPress: () => void;
  /** Desabilita por validação: o formulário ainda não está válido. */
  disabled?: boolean;
  /** Em andamento: desabilita e troca o rótulo por este texto. */
  loading?: boolean;
  loadingLabel?: string;
  /** Ação destrutiva confirmada dentro de folha modal. */
  destructive?: boolean;
};

export function FilledButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  loadingLabel,
  destructive = false,
}: Props) {
  const colors = useColors();
  const inativo = disabled || loading;
  const fundo = destructive ? colors.destructive : colors.accent;

  return (
    <Pressable
      onPress={onPress}
      disabled={inativo}
      accessibilityRole="button"
      accessibilityLabel={loading ? (loadingLabel ?? label) : label}
      accessibilityState={{ disabled: inativo, busy: loading }}
      style={({ pressed }) => ({
        height: size.filledButton,
        marginHorizontal: screenMargin,
        borderRadius: radius.filledButton,
        backgroundColor: fundo,
        alignItems: 'center',
        justifyContent: 'center',
        // 40% é o que o handoff mostra nos estados "carregando" e "inválido".
        opacity: inativo ? 0.4 : pressed ? 0.8 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {loading ? <ActivityIndicator color={colors.onAccent as string} /> : null}
        <Text style={[typography.headline, { color: colors.onAccent }]}>
          {loading ? (loadingLabel ?? label) : label}
        </Text>
      </View>
    </Pressable>
  );
}
