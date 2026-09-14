import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import {
  Screen,
  SegmentedControl,
  EmptyState,
  ErrorState,
  SkeletonGroup,
  Icon,
  Text,
} from '@/components/ui';
import { useColors, radius, screenMargin, size, spacing } from '@/theme';
import { formatarHora, nomeDoDiaDaSemana, diaDaSemanaDoBanco } from '@/lib/format';
import { useAgenda } from '@/features/schedule/use-schedule';
import { useMeuPlano } from '@/features/home/use-dashboard';
import {
  copyAgenda,
  diasDoSegmented,
  HORA_INICIAL_DA_GRADE,
  HORA_FINAL_DA_GRADE,
} from '@/features/schedule/copy';

/**
 * Tela 6 — Agenda semanal.
 *
 * Grade de 08:00 a 21:00 para o dia escolhido. Hora vazia é uma faixa baixa com
 * hairline; hora ocupada é o cartão do agendamento (handoff, "Grade da agenda").
 *
 * Correção: o seletor abre no dia de HOJE. O app atual abre sempre em segunda,
 * o que obriga a psicóloga a trocar de dia toda vez que abre a aba — e o dia
 * que ela quer ver é, quase sempre, o de hoje.
 *
 * Quando o limite de SMS do mês estourou, os agendamentos ganham a marca
 * "SMS pausado" em laranja. Quem decide isso é `v_meu_plano`, não esta tela
 * (princípio P2 e regra 11.5).
 *
 * Implementa: 8.8, inventário 10.6 e os estados 6 e 6a do handoff.
 */
export default function AgendaScreen() {
  const colors = useColors();
  // Abre no dia de hoje, na numeração do banco (1 = segunda, 7 = domingo).
  const [dia, setDia] = useState(() => diaDaSemanaDoBanco(new Date()));
  const consulta = useAgenda();
  const plano = useMeuPlano();

  const smsPausado = plano.data?.limite_atingido === true;
  const doDia = (consulta.data ?? []).filter((a) => a.dia_semana === dia);

  const horas = Array.from(
    { length: HORA_FINAL_DA_GRADE - HORA_INICIAL_DA_GRADE + 1 },
    (_, i) => HORA_INICIAL_DA_GRADE + i,
  );

  return (
    <Screen>
      <View
        style={{
          paddingHorizontal: screenMargin,
          marginBottom: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text variant="largeTitle">{copyAgenda.titulo}</Text>
        <Pressable
          onPress={() => router.push(`/schedule/novo?dia=${String(dia)}`)}
          accessibilityRole="button"
          accessibilityLabel={copyAgenda.adicionar}
          hitSlop={12}
        >
          <Icon name="add" color={colors.accent} size={24} />
        </Pressable>
      </View>

      <View style={{ marginHorizontal: screenMargin, marginBottom: spacing.lg }}>
        <SegmentedControl
          opcoes={diasDoSegmented}
          valor={dia}
          onChange={setDia}
          accessibilityLabel="Dia da semana"
        />
      </View>

      {consulta.isPending ? <SkeletonGroup rows={6} /> : null}
      {consulta.isError ? <ErrorState onRetry={() => void consulta.refetch()} /> : null}

      {!consulta.isPending && !consulta.isError && doDia.length === 0 ? (
        <EmptyState
          icon="schedule"
          title={copyAgenda.diaVazio(nomeDoDiaDaSemana(dia))}
          body={copyAgenda.diaVazioCorpo}
          actionLabel={copyAgenda.adicionar}
          onAction={() => router.push(`/schedule/novo?dia=${String(dia)}`)}
        />
      ) : null}

      {!consulta.isPending && doDia.length > 0 ? (
        <View style={{ marginHorizontal: screenMargin }}>
          {horas.map((hora) => {
            const daHora = doDia.filter((a) => a.hora_bloco === hora);
            const rotuloDaHora = `${String(hora).padStart(2, '0')}:00`;

            return (
              <View key={hora} style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ width: size.scheduleHourColumn, paddingTop: spacing.xs }}>
                  <Text variant="footnote" color="secondaryLabel" tabular>
                    {rotuloDaHora}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  {daHora.length === 0 ? (
                    // Hora vazia: faixa baixa, só com o hairline no topo.
                    <View
                      style={{
                        height: size.scheduleEmptyHour,
                        borderTopWidth: size.hairline,
                        borderTopColor: colors.separator,
                      }}
                    />
                  ) : (
                    daHora.map((agendamento) => (
                      <Pressable
                        key={agendamento.id}
                        onPress={() => router.push(`/schedule/${String(agendamento.id)}`)}
                        accessibilityRole="button"
                        accessibilityLabel={`${formatarHora(agendamento.hora_inicio)} com ${agendamento.paciente_nome}`}
                        style={({ pressed }) => ({
                          backgroundColor: pressed ? colors.controlFill : colors.listSurface,
                          borderRadius: radius.listGroup,
                          paddingHorizontal: spacing.md,
                          paddingVertical: spacing.md,
                          marginBottom: spacing.sm,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.sm,
                        })}
                      >
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} tabular>
                            {formatarHora(agendamento.hora_inicio)} - {agendamento.paciente_nome}
                          </Text>
                          <Text variant="footnote" color="secondaryLabel" numberOfLines={1}>
                            {copyAgenda.ate(formatarHora(agendamento.hora_fim))}
                            {smsPausado ? (
                              <Text variant="footnote" style={{ color: colors.warning }}>
                                {` · ${copyAgenda.smsPausado}`}
                              </Text>
                            ) : null}
                          </Text>
                        </View>
                        <Icon name="chevron" color={colors.tertiaryLabel} size={15} />
                      </Pressable>
                    ))
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}
