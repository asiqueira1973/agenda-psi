import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  BackLink,
  Screen,
  ListGroup,
  RowSeparator,
  FormRow,
  MultilineRow,
  DateRow,
  hojeNoFormatoDoBanco,
  SegmentedControl,
  SegmentedGroupContent,
  FilledButton,
  Text,
} from '@/components/ui';
import { useColors, screenMargin, spacing } from '@/theme';
import { usePaciente } from '@/features/patients/use-patients';
import { useCriarPagamento } from '@/features/payments/use-payments';
import { copyPagamentos } from '@/features/sessions/copy';
import { copyAuth } from '@/features/auth/copy';
import { tipoDoPagamento } from '@/features/patients/valores-do-banco';
import { validarValorEmReais, valorEmReaisParaInteiro } from '@/lib/validation';

/**
 * Tela 16 — Registrar pagamento.
 *
 * O valor já vem PREENCHIDO com o preço vigente do paciente, lido de
 * `v_pacientes_cartao.preco_vigente` — nunca calculado aqui (princípio P2 e
 * regra 11.2). É a melhoria de fluxo mais óbvia da tela mais usada entre
 * sessões (assunção 24.8): na maioria das vezes o valor pago É o preço, e o
 * campo já pronto economiza o último toque do fluxo 9.2.
 *
 * O rótulo da data diz "Mês de competência", que é o que o campo de fato é
 * (spec 8.6) — `data_competencia` é o mês a que o pagamento pertence, enquanto
 * `pago_em` é o instante do registro.
 *
 * Implementa: 8.6, inventário 10.16, valores literais de 11.4 e a copy de 15.3.
 */
export default function NovoPagamentoScreen() {
  const colors = useColors();
  const { pacienteId } = useLocalSearchParams<{ pacienteId: string }>();
  const paciente = usePaciente(pacienteId);
  const criar = useCriarPagamento();

  const [tipo, setTipo] = useState('mensal');
  const [competencia, setCompetencia] = useState(hojeNoFormatoDoBanco());
  const [valor, setValor] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [preencheu, setPreencheu] = useState(false);
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Pré-preenche uma vez, quando o preço vigente chega. A trava impede que um
  // refetch sobrescreva um valor que a pessoa já ajustou à mão.
  useEffect(() => {
    if (preencheu || paciente.data?.preco_vigente == null) return;
    setValor(String(paciente.data.preco_vigente));
    setPreencheu(true);
  }, [paciente.data, preencheu]);

  const validacao = validarValorEmReais(valor);

  function aoSalvar() {
    setTentouSalvar(true);
    setErro(null);
    if (!validacao.valido) return;

    criar.mutate(
      {
        pacienteId,
        valorPagamento: valorEmReaisParaInteiro(valor),
        dataCompetencia: competencia,
        tipo,
        observacoes: observacoes.trim() || null,
      },
      {
        onSuccess: () => {
          Alert.alert(copyPagamentos.sucessoCriado);
          router.back();
        },
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
          <BackLink />
          <Text variant="largeTitle">{copyPagamentos.novo}</Text>
        </View>

        <ListGroup first title={copyPagamentos.grupoTipo}>
          <SegmentedGroupContent>
            <SegmentedControl
              opcoes={tipoDoPagamento}
              valor={tipo}
              onChange={setTipo}
              accessibilityLabel={copyPagamentos.grupoTipo}
            />
          </SegmentedGroupContent>
        </ListGroup>

        <ListGroup
          footer={
            tentouSalvar && !validacao.valido
              ? validacao.mensagem
              : copyPagamentos.rodapeValor
          }
          footerIsError={tentouSalvar && !validacao.valido}
        >
          <DateRow
            label={copyPagamentos.competencia}
            value={competencia}
            onChange={setCompetencia}
            labelWidth={150}
          />
          <RowSeparator />
          <FormRow
            label={copyPagamentos.valor}
            value={valor}
            onChangeText={setValor}
            keyboardType="number-pad"
            placeholder="Ex: 200"
            hasError={tentouSalvar && !validacao.valido}
            editable={!criar.isPending}
            labelWidth={150}
          />
        </ListGroup>

        <ListGroup title={copyPagamentos.observacoes} footer={erro ?? undefined} footerIsError={!!erro}>
          <MultilineRow
            value={observacoes}
            onChangeText={setObservacoes}
            editable={!criar.isPending}
          />
        </ListGroup>

        <View style={{ marginTop: spacing.xxl }}>
          <FilledButton
            label={copyPagamentos.salvar}
            loadingLabel={copyPagamentos.salvando}
            loading={criar.isPending}
            onPress={aoSalvar}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
