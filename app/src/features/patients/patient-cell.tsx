import { Pressable, View } from 'react-native';
import { Icon, Text } from '@/components/ui';
import { useColors, screenMargin, size, spacing, typography } from '@/theme';
import { formatarDinheiro, formatarData } from '@/lib/format';
import type { PacienteCartao } from './use-patients';

/**
 * Célula de paciente.
 *
 * Três linhas no máximo, como o handoff desenha:
 *   Fernanda Souza
 *   R$ 200 · 12 sessões · última 05/03/2026
 *   2 sessões não pagas
 *
 * A terceira só aparece quando há sessão não paga. A célula inteira é tocável.
 *
 * Status NÃO é pílula colorida: paciente ativo não recebe marcação nenhuma,
 * porque ativo é o normal; inativo aparece num grupo separado com a palavra
 * "Inativo" em cinza à direita (handoff, "Cor").
 *
 * Implementa: "Célula de paciente" do handoff e a tela 9.
 */
export function PatientCell({
  paciente,
  onPress,
}: {
  paciente: PacienteCartao;
  onPress: () => void;
}) {
  const colors = useColors();

  const naoPagas = paciente.sessoes_nao_pagas ?? 0;
  const inativo = paciente.status === 'inativo';

  // Metadados separados por ponto médio, só os que existem. Sem isto, um
  // paciente novo exibiria "R$ 200 ·  · última —", com buracos no meio.
  const metadados = [
    paciente.preco_vigente !== null ? formatarDinheiro(paciente.preco_vigente) : null,
    paciente.total_sessoes_ate_hoje
      ? `${paciente.total_sessoes_ate_hoje} ${paciente.total_sessoes_ate_hoje === 1 ? 'sessão' : 'sessões'}`
      : null,
    paciente.ultima_sessao ? `última ${formatarData(paciente.ultima_sessao)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={paciente.nome_completo ?? 'Paciente'}
      style={({ pressed }) => ({
        minHeight: naoPagas > 0 ? size.patientRowThreeLines : size.patientRowTwoLines,
        paddingHorizontal: screenMargin,
        paddingVertical: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: pressed ? colors.controlFill : colors.listSurface,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline" numberOfLines={1}>
          {paciente.nome_completo}
        </Text>
        {metadados.length > 0 ? (
          <Text variant="subheadline" color="secondaryLabel" numberOfLines={1} tabular>
            {metadados}
          </Text>
        ) : null}
        {naoPagas > 0 ? (
          <Text variant="subheadline" color="secondaryLabel" numberOfLines={1}>
            {naoPagas === 1 ? '1 sessão não paga' : `${naoPagas} sessões não pagas`}
          </Text>
        ) : null}
      </View>

      {inativo ? (
        <Text style={typography.body} color="secondaryLabel">
          Inativo
        </Text>
      ) : null}
      <Icon name="chevron" color={colors.tertiaryLabel} size={15} />
    </Pressable>
  );
}
