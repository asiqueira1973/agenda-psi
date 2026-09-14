import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text } from './text';
import { useColors, listBody, screenMargin, size, spacing } from '@/theme';
import { formatarHora } from '@/lib/format';

/**
 * Linha com seletor de hora nativo.
 *
 * O valor trafega como `HH:MM`, que é o formato do tipo `time` do Postgres. Não
 * há data nem fuso envolvidos: `agenda_semana_padrao.hora_inicio` é uma hora do
 * dia, não um instante.
 *
 * Implementa: tela 7 do handoff e o tipo `time` de 7.2.
 */
export function TimeRow({
  label,
  value,
  onChange,
  editable = true,
  labelWidth = 110,
}: {
  label: string;
  /** Hora no formato `HH:MM`. */
  value: string;
  onChange: (hora: string) => void;
  editable?: boolean;
  labelWidth?: number;
}) {
  const colors = useColors();
  const [aberto, setAberto] = useState(false);

  const [h, m] = value.split(':').map(Number);
  const comoData = new Date(2026, 0, 1, h ?? 8, m ?? 0);

  function aoEscolher(nova: Date | undefined) {
    if (Platform.OS !== 'ios') setAberto(false);
    if (!nova) return;
    const hh = String(nova.getHours()).padStart(2, '0');
    const mm = String(nova.getMinutes()).padStart(2, '0');
    onChange(`${hh}:${mm}`);
  }

  return (
    <View>
      <Pressable
        onPress={() => editable && setAberto((v) => !v)}
        disabled={!editable}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatarHora(value)}`}
        style={{
          minHeight: size.listRow,
          paddingHorizontal: screenMargin,
          paddingVertical: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          opacity: editable ? 1 : 0.5,
        }}
      >
        <Text style={[listBody, { width: labelWidth }]}>{label}</Text>
        <Text style={[listBody, { flex: 1, color: colors.accent }]} tabular>
          {formatarHora(value)}
        </Text>
      </Pressable>

      {aberto && editable ? (
        <View style={{ alignItems: 'center', paddingBottom: spacing.sm }}>
          <DateTimePicker
            value={comoData}
            mode="time"
            display="spinner"
            locale="pt-BR"
            is24Hour
            minuteInterval={5}
            onChange={(_, d) => aoEscolher(d)}
          />
        </View>
      ) : null}
    </View>
  );
}
