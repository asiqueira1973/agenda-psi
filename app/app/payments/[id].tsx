import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Screen,
  ListGroup,
  RowSeparator,
  FormRow,
  MultilineRow,
  ValueRow,
  ActionRow,
  SegmentedControl,
  SegmentedGroupContent,
  FilledButton,
  SkeletonGroup,
  Text,
} from '@/components/ui';
import { useColors, screenMargin, spacing } from '@/theme';
import { formatarData } from '@/lib/format';
import {
  usePagamento,
  useEditarPagamento,
  useExcluirPagamento,
} from '@/features/payments/use-payments';
import { copyPagamentos, copyComum } from '@/features/sessions/copy';
import { copyAuth } from '@/features/auth/copy';
import { tipoDoPagamento } from '@/features/patients/valores-do-banco';
import { validarValorEmReais, valorEmReaisParaInteiro } from '@/lib/validation';

/**
 * Tela 17 — Detalhe do pagamento.
 *
 * ⚠️ Dois defeitos do app atual morrem nesta tela:
 *
 * - 11.9.2: salvar gravava `valor_pagamento` a partir do campo de DATA, zerando
 *   o valor. Aqui a competência é LEITURA e o hook de edição não aceita data;
 * - 11.9.3: o tipo era editável mas nunca era salvo. Aqui ele está na lista de
 *   campos do update, e o critério de aceite de 8.6 é exatamente esse.
 *
 * Implementa: 8.6, inventário 10.17 e a copy de 15.3 e 15.4.
 */
export default function DetalheDoPagamentoScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pagamento = usePagamento(id);
  const editar = useEditarPagamento(id);
  const excluir = useExcluirPagamento();

  const [tipo, setTipo] = useState('mensal');
  const [valor, setValor] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [carregou, setCarregou] = useState(false);
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (carregou || !pagamento.data) return;
    setTipo(pagamento.data.tipo ?? 'mensal');
    setValor(String(pagamento.data.valor_pagamento ?? ''));
    setObservacoes(pagamento.data.observacoes ?? '');
    setCarregou(true);
  }, [pagamento.data, carregou]);

  if (pagamento.isPending || !pagamento.data) {
    return (
      <Screen>
        <SkeletonGroup rows={3} />
      </Screen>
    );
  }

  const pacienteId = pagamento.data.paciente_id;
  const validacao = validarValorEmReais(valor);

  function aoSalvar() {
    setTentouSalvar(true);
    setErro(null);
    if (!validacao.valido) return;

    editar.mutate(
      {
        pacienteId,
        valorPagamento: valorEmReaisParaInteiro(valor),
        tipo,
        observacoes: observacoes.trim() || null,
      },
      {
        onSuccess: () => {
          Alert.alert(copyPagamentos.sucessoAtualizado);
          router.back();
        },
        onError: () => setErro(copyAuth.erros.falhaGenerica),
      },
    );
  }

  function confirmarExclusao() {
    Alert.alert(copyPagamentos.confirmarExclusao, undefined, [
      { text: copyComum.cancelar, style: 'cancel' },
      {
        text: copyComum.excluir,
        style: 'destructive',
        onPress: () =>
          excluir.mutate(
            { pagamentoId: id, pacienteId },
            {
              onSuccess: () => {
                Alert.alert(copyPagamentos.sucessoExcluido);
                router.back();
              },
              onError: () => Alert.alert(copyAuth.erros.falhaGenerica),
            },
          ),
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <View style={{ paddingHorizontal: screenMargin, marginBottom: spacing.xxl }}>
          <Text variant="largeTitle">{copyPagamentos.detalhe}</Text>
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
              : copyPagamentos.rodapeCompetencia
          }
          footerIsError={tentouSalvar && !validacao.valido}
        >
          {/* Competência em LEITURA: é o que impede o defeito 11.9.2. */}
          <ValueRow
            label={copyPagamentos.competencia}
            value={formatarData(pagamento.data.data_competencia)}
          />
          <RowSeparator />
          <FormRow
            label={copyPagamentos.valor}
            value={valor}
            onChangeText={setValor}
            keyboardType="number-pad"
            hasError={tentouSalvar && !validacao.valido}
            editable={!editar.isPending}
            labelWidth={150}
          />
        </ListGroup>

        <ListGroup title={copyPagamentos.observacoes} footer={erro ?? undefined} footerIsError={!!erro}>
          <MultilineRow
            value={observacoes}
            onChangeText={setObservacoes}
            editable={!editar.isPending}
          />
        </ListGroup>

        <View style={{ marginTop: spacing.xxl }}>
          <FilledButton
            label={copyPagamentos.salvar}
            loadingLabel={copyPagamentos.salvando}
            loading={editar.isPending}
            onPress={aoSalvar}
          />
        </View>

        <ListGroup>
          <ActionRow
            label={copyPagamentos.excluir}
            icon="delete"
            destructive
            onPress={confirmarExclusao}
          />
        </ListGroup>
      </Screen>
    </KeyboardAvoidingView>
  );
}
