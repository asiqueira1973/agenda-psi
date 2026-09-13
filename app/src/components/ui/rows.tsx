import { Platform, Pressable, TextInput, View, Switch } from 'react-native';
import type { TextInputProps } from 'react-native';
import { Text } from './text';
import { Icon, type IconName } from './icon';
import { useColors, size, spacing, screenMargin, typography, listBody } from '@/theme';

/**
 * As linhas do app. Tudo que no web seria botão, cartão ou campo vira uma
 * destas — é o que o handoff quer dizer com "iOS é lista, não cartão".
 *
 * Altura mínima de 44pt no iOS e 56pt no Android, inset de 16pt, texto de 17pt
 * (16pt no Android). Mínima, não fixa: com Dynamic Type a linha cresce.
 *
 * Implementa: "Componentes-chave" do handoff e seção 16.5 do spec.
 */

const rowMinHeight = Platform.OS === 'ios' ? size.listRow : size.listRowTwoLines;

type BaseProps = {
  onPress?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  /** Altura mínima maior, para linha de duas ou três linhas de texto. */
  minHeight?: number;
  accessibilityLabel?: string;
};

function RowContainer({
  onPress,
  disabled,
  children,
  minHeight = rowMinHeight,
  accessibilityLabel,
}: BaseProps) {
  const colors = useColors();

  const content = (
    <View
      style={{
        minHeight,
        paddingHorizontal: screenMargin,
        paddingVertical: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      {children}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.controlFill : 'transparent',
        opacity: disabled ? 0.5 : 1,
      })}
    >
      {content}
    </Pressable>
  );
}

/**
 * Chevron da linha que navega. 9×15pt, traço de 2pt, cor terciária (handoff).
 * Só aparece em linha que leva a outro lugar — linha que executa não tem.
 */
function Chevron() {
  const colors = useColors();
  return <Icon name="chevron" color={colors.tertiaryLabel} size={15} />;
}

/**
 * Linha de ação: executa ali mesmo, não navega.
 * Ícone tintado de azul à esquerda e texto azul. Sem chevron.
 * É o "Adicionar conta" do Ajustes do iOS — e o lugar onde este app põe
 * "Registrar sessão", "Registrar pagamento" e "Atualizar o preço".
 */
export function ActionRow({
  label,
  icon,
  onPress,
  disabled,
  destructive = false,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  disabled?: boolean;
  /** Ação que apaga. Vermelha, como manda o handoff em "Cor". */
  destructive?: boolean;
}) {
  const colors = useColors();
  const tint = destructive ? colors.destructive : colors.accent;

  return (
    <RowContainer onPress={onPress} disabled={disabled} accessibilityLabel={label}>
      {icon ? <Icon name={icon} color={tint} /> : null}
      <Text style={[listBody, { color: tint, flex: 1 }]}>{label}</Text>
    </RowContainer>
  );
}

/**
 * Linha de navegação: rótulo à esquerda, valor opcional à direita, chevron.
 */
export function NavigationRow({
  label,
  value,
  icon,
  onPress,
  minHeight,
}: {
  label: string;
  value?: string;
  icon?: IconName;
  onPress: () => void;
  minHeight?: number;
}) {
  const colors = useColors();

  return (
    <RowContainer onPress={onPress} minHeight={minHeight} accessibilityLabel={label}>
      {icon ? <Icon name={icon} color={colors.systemGray} /> : null}
      <Text style={[listBody, { flex: 1 }]} color="label">
        {label}
      </Text>
      {value ? (
        <Text style={listBody} color="secondaryLabel" tabular>
          {value}
        </Text>
      ) : null}
      <Chevron />
    </RowContainer>
  );
}

/**
 * Linha de valor: rótulo à esquerda, valor à direita, sem chevron. Não navega.
 * É a linha dos indicadores da Home e dos dados de leitura das folhas.
 *
 * `valueColor` existe para os três lugares onde o valor tem cor semântica:
 * dinheiro positivo em verde, despesa e lucro negativo em vermelho. Fora disso
 * o valor é secundário e cinza — status não é semáforo (handoff, "Cor").
 */
export function ValueRow({
  label,
  value,
  valueColor = 'secondaryLabel',
  icon,
}: {
  label: string;
  value: string;
  valueColor?: 'secondaryLabel' | 'positive' | 'destructive' | 'label';
  icon?: IconName;
}) {
  const colors = useColors();

  return (
    <RowContainer>
      {icon ? <Icon name={icon} color={colors.systemGray} /> : null}
      <Text style={[listBody, { flex: 1 }]} color="label">
        {label}
      </Text>
      <Text style={listBody} color={valueColor} tabular>
        {value}
      </Text>
    </RowContainer>
  );
}

/**
 * Linha de formulário: rótulo de largura fixa à esquerda, campo à direita.
 *
 * Erro de validação NÃO pinta borda no campo: o rótulo vira vermelho e a
 * mensagem aparece como rodapé do grupo (handoff, "Linha de formulário"). Por
 * isso este componente só recebe `hasError` — a mensagem é do ListGroup.
 */
export function FormRow({
  label,
  hasError = false,
  labelWidth = 96,
  ...inputProps
}: TextInputProps & {
  label: string;
  hasError?: boolean;
  /** 76 a 96pt, alinhado dentro do grupo (handoff). */
  labelWidth?: number;
}) {
  const colors = useColors();

  return (
    <RowContainer>
      <Text
        style={[listBody, { width: labelWidth }]}
        color={hasError ? 'destructive' : 'label'}
      >
        {label}
      </Text>
      <TextInput
        {...inputProps}
        style={[
          typography.body,
          { flex: 1, color: colors.label as string, paddingVertical: spacing.sm },
        ]}
        placeholderTextColor={colors.tertiaryLabel}
        accessibilityLabel={label}
      />
    </RowContainer>
  );
}

/**
 * Linha com interruptor. Ligado é verde — é um dos três usos de verde do app
 * (handoff, "Cor").
 */
export function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  const colors = useColors();

  return (
    <RowContainer>
      <Text style={[listBody, { flex: 1 }]} color="label">
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.positive as string }}
        accessibilityLabel={label}
      />
    </RowContainer>
  );
}
