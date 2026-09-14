import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Screen,
  ListGroup,
  RowSeparator,
  FormRow,
  ToggleRow,
  MultilineRow,
  DateRow,
  hojeNoFormatoDoBanco,
  SegmentedControl,
  SegmentedGroupContent,
  FilledButton,
  Text,
} from '@/components/ui';
import { useColors, screenMargin, spacing } from '@/theme';
import { useCriarSessao } from '@/features/sessions/use-sessions';
import { copySessoes } from '@/features/sessions/copy';
import { copyAuth } from '@/features/auth/copy';
import { modalidadeDaSessao, pagamentoDaSessao } from '@/features/patients/valores-do-banco';

/**
 * Tela 14 — Registrar sessão.
 *
 * Tudo já vem preenchido: data de hoje, Presencial, Mensal, cobrada, 50 minutos.
 * No app atual a data e a modalidade começam VAZIAS, e a pessoa precisa abrir o
 * seletor só para a data existir (spec 8.5). Esta tela é o quinto dos sete
 * toques do fluxo 9.2 — cada campo que já vem certo é um toque a menos.
 *
 * Implementa: 8.5, inventário 10.14, valores literais de 11.4 e a copy de 15.3.
 */
export default function NovaSessaoScreen() {
  const colors = useColors();
  const { pacienteId } = useLocalSearchParams<{ pacienteId: string }>();
  const criar = useCriarSessao();

  const [data, setData] = useState(hojeNoFormatoDoBanco());
  const [duracao, setDuracao] = useState('50');
  const [seraCobrada, setSeraCobrada] = useState(true);
  const [modalidade, setModalidade] = useState('presencial');
  const [pagamento, setPagamento] = useState('pagamento mensal');
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  function aoSalvar() {
    setErro(null);
    criar.mutate(
      {
        pacienteId,
        ocorreuEmDia: data,
        modalidade,
        // Campo opcional: vazio vira nulo, não zero. Zero minutos é um dado
        // errado; ausência de dado é um dado ausente.
        duracaoMinutos: duracao.trim() ? Number.parseInt(duracao, 10) : null,
        pagamento,
        deveSerCobrada: seraCobrada,
        observacoes: observacoes.trim() || null,
      },
      {
        onSuccess: () => {
          Alert.alert(copySessoes.sucessoCriada);
          // Volta para o detalhe do paciente, onde o histórico já recarregou
          // sozinho pela invalidação — critério de aceite de 8.4.
          router.back();
        },
        // Nunca "Sessão registrada" quando a escrita falhou (princípio P3 e
        // defeito 11.9.12).
        onError: () => setErro(copyAuth.erros.falhaGenerica),
      },
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <View style={{ paddingHorizontal: screenMargin, marginBottom: spacing.xxl }}>
          <Text variant="largeTitle">{copySessoes.nova}</Text>
        </View>

        <ListGroup first footer={erro ?? undefined} footerIsError={!!erro}>
          <DateRow label={copySessoes.data} value={data} onChange={setData} />
          <RowSeparator />
          <FormRow
            label={copySessoes.duracao}
            value={duracao}
            onChangeText={setDuracao}
            keyboardType="number-pad"
            placeholder={copySessoes.duracaoPlaceholder}
            editable={!criar.isPending}
          />
          <RowSeparator />
          <ToggleRow
            label={copySessoes.seraCobrada}
            value={seraCobrada}
            onValueChange={setSeraCobrada}
          />
        </ListGroup>

        <ListGroup title={copySessoes.grupoModalidade}>
          <SegmentedGroupContent>
            <SegmentedControl
              opcoes={modalidadeDaSessao}
              valor={modalidade}
              onChange={setModalidade}
              accessibilityLabel={copySessoes.grupoModalidade}
            />
          </SegmentedGroupContent>
        </ListGroup>

        <ListGroup title={copySessoes.grupoPagamento}>
          <SegmentedGroupContent>
            <SegmentedControl
              opcoes={pagamentoDaSessao}
              valor={pagamento}
              onChange={setPagamento}
              accessibilityLabel={copySessoes.grupoPagamento}
            />
          </SegmentedGroupContent>
        </ListGroup>

        <ListGroup title={copySessoes.observacoes}>
          <MultilineRow
            value={observacoes}
            onChangeText={setObservacoes}
            editable={!criar.isPending}
          />
        </ListGroup>

        <View style={{ marginTop: spacing.xxl }}>
          <FilledButton
            label={copySessoes.salvar}
            loadingLabel={copySessoes.salvando}
            loading={criar.isPending}
            onPress={aoSalvar}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
