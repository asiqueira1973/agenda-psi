import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text } from './text';
import { useColors, screenMargin, size, spacing, listBody } from '@/theme';
import { formatarData } from '@/lib/format';

/**
 * Linha com seletor de data nativo.
 *
 * O handoff pede o picker nativo de cada plataforma. No iOS ele aparece embutido
 * na própria linha; no Android abre o diálogo do Material ao tocar.
 *
 * A data é tratada como DATA PURA: o que vai para o banco é `YYYY-MM-DD`, sem
 * hora e sem fuso (regra 11.8). Converter para ISO com `toISOString()` aqui
 * seria o caminho mais curto para gravar a sessão de hoje como a de ontem, para
 * quem registra à noite.
 */
export function DateRow({
  label,
  value,
  onChange,
  editable = true,
  labelWidth = 96,
}: {
  label: string;
  /** Data no formato do banco: `YYYY-MM-DD`. */
  value: string;
  onChange: (dataIso: string) => void;
  editable?: boolean;
  labelWidth?: number;
}) {
  const colors = useColors();
  const [aberto, setAberto] = useState(false);

  // Meio-dia local de propósito: constrói o Date sem risco de o fuso empurrar a
  // data para o dia anterior ou seguinte.
  const [ano, mes, dia] = value.split('-').map(Number);
  const comoData = new Date(ano, (mes ?? 1) - 1, dia ?? 1, 12);

  function aoEscolher(novaData: Date | undefined) {
    if (Platform.OS !== 'ios') setAberto(false);
    if (!novaData) return;
    const a = novaData.getFullYear();
    const m = String(novaData.getMonth() + 1).padStart(2, '0');
    const d = String(novaData.getDate()).padStart(2, '0');
    onChange(`${a}-${m}-${d}`);
  }

  return (
    <View>
      <Pressable
        onPress={() => editable && setAberto((v) => !v)}
        disabled={!editable}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatarData(value)}`}
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
          {formatarData(value)}
        </Text>
      </Pressable>

      {aberto && editable ? (
        <View style={{ alignItems: 'center', paddingBottom: spacing.sm }}>
          <DateTimePicker
            value={comoData}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            locale="pt-BR"
            onChange={(_, d) => aoEscolher(d)}
          />
        </View>
      ) : null}
    </View>
  );
}

/** Data de hoje no formato do banco, no fuso do aparelho. */
export function hojeNoFormatoDoBanco(): string {
  const agora = new Date();
  const m = String(agora.getMonth() + 1).padStart(2, '0');
  const d = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${m}-${d}`;
}
