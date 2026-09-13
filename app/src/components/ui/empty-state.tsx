import { View } from 'react-native';
import { Text } from './text';
import { Icon, type IconName } from './icon';
import { FilledButton } from './filled-button';
import { useColors, spacing, screenMargin, typography } from '@/theme';

/**
 * Estado vazio.
 *
 * "Nunca uma área em branco" é a regra do handoff, e vale para TODA lista do
 * app. Símbolo grande em cinza, título, uma frase e — quando houver ação — um
 * botão preenchido no rodapé.
 *
 * A variante `strong` usa título de 22pt e existe para um caso só: a tela de
 * despesas, que o handoff chama de "o estado vazio mais importante do app". São
 * 98 despesas contra 451 pagamentos em toda a base: a feature não é descoberta,
 * e é esta tela que tem que convencer (spec 8.7 e persona da seção 2).
 *
 * Implementa: "Estado vazio" do handoff, 15.5 e 15.6 do spec, princípio P3.
 */
type Props = {
  icon: IconName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Título em 22pt. Só a tela de despesas usa. */
  strong?: boolean;
};

export function EmptyState({ icon, title, body, actionLabel, onAction, strong = false }: Props) {
  const colors = useColors();

  return (
    <View style={{ flex: 1, justifyContent: 'center', paddingVertical: spacing.xxxl }}>
      <View style={{ alignItems: 'center', paddingHorizontal: screenMargin * 2 }}>
        <Icon name={icon} color={colors.systemGray} size={strong ? 60 : 52} />
        <Text
          style={[
            strong ? typography.title2 : typography.headline,
            { textAlign: 'center', marginTop: spacing.xl },
          ]}
        >
          {title}
        </Text>
        {body ? (
          <Text
            color="secondaryLabel"
            style={{ textAlign: 'center', marginTop: spacing.sm }}
          >
            {body}
          </Text>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.xxxl }}>
          <FilledButton label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}
