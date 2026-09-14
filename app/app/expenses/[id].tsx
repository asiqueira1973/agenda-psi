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
  PickerRow,
  FilledButton,
  SkeletonGroup,
  Text,
} from '@/components/ui';
import { useColors, screenMargin, spacing } from '@/theme';
import { formatarData } from '@/lib/format';
import {
  useDespesa,
  useEditarDespesa,
  useExcluirDespesa,
  useTiposDeDespesa,
} from '@/features/expenses/use-expenses';
import { copyDespesas } from '@/features/expenses/copy';
import { copyComum } from '@/features/sessions/copy';
import { copyAuth } from '@/features/auth/copy';
import { mensagens, validarValorEmReais, valorEmReaisParaInteiro } from '@/lib/validation';

/**
 * Tela 20 — Detalhe da despesa.
 *
 * Mesmos campos do cadastro, com a competência em leitura — mesma regra das
 * telas 15 e 17: data não se edita, exclui-se e cria-se de novo.
 *
 * O catálogo de tipos vem ordenado por nome, igual ao da tela de cadastro. No
 * app atual a ordem difere entre as duas telas, então o mesmo tipo aparece em
 * posições diferentes conforme de onde se chega (spec 7.2).
 *
 * Implementa: 8.7, inventário 10.20 e a copy de 15.3 e 15.4.
 */
export default function DetalheDaDespesaScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const despesa = useDespesa(id);
  const tipos = useTiposDeDespesa();
  const editar = useEditarDespesa(id);
  const excluir = useExcluirDespesa();

  const [tipoId, setTipoId] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [carregou, setCarregou] = useState(false);
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (carregou || !despesa.data) return;
    setTipoId(despesa.data.tipo_despesa_id);
    setDescricao(despesa.data.descricao ?? '');
    setValor(String(despesa.data.valor_despesa ?? ''));
    setObservacoes(despesa.data.observacoes ?? '');
    setCarregou(true);
  }, [despesa.data, carregou]);

  if (despesa.isPending || !despesa.data) {
    return (
      <Screen>
        <SkeletonGroup rows={4} />
      </Screen>
    );
  }

  const validacao = validarValorEmReais(valor);
  const podeSalvar = !!tipoId && validacao.valido && !editar.isPending;
  const opcoes = (tipos.data ?? []).map((t) => ({ id: t.id, rotulo: t.nome }));

  function aoSalvar() {
    setTentouSalvar(true);
    setErro(null);
    if (!tipoId || !validacao.valido) return;

    editar.mutate(
      {
        tipoDespesaId: tipoId,
        valorDespesa: valorEmReaisParaInteiro(valor),
        descricao: descricao.trim() || null,
        observacoes: observacoes.trim() || null,
      },
      {
        onSuccess: () => {
          Alert.alert(copyDespesas.sucessoAtualizada);
          router.back();
        },
        onError: () => setErro(copyAuth.erros.falhaGenerica),
      },
    );
  }

  function confirmarExclusao() {
    Alert.alert(copyDespesas.confirmarExclusao, undefined, [
      { text: copyComum.cancelar, style: 'cancel' },
      {
        text: copyComum.excluir,
        style: 'destructive',
        onPress: () =>
          excluir.mutate(id, {
            onSuccess: () => {
              Alert.alert(copyDespesas.sucessoExcluida);
              router.back();
            },
            onError: () => Alert.alert(copyAuth.erros.falhaGenerica),
          }),
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
          <Text variant="largeTitle">{copyDespesas.detalhe.titulo}</Text>
        </View>

        <ListGroup
          first
          footer={
            erro ??
            (tentouSalvar && !tipoId
              ? mensagens.tipoDeDespesaNaoEscolhido
              : tentouSalvar && !validacao.valido
                ? validacao.mensagem
                : copyDespesas.detalhe.rodapeCompetencia)
          }
          footerIsError={!!erro || (tentouSalvar && (!tipoId || !validacao.valido))}
        >
          <ValueRow
            label={copyDespesas.detalhe.competencia}
            value={formatarData(despesa.data.data_competencia)}
          />
          <RowSeparator />
          <PickerRow
            label={copyDespesas.nova.tipo}
            opcoes={opcoes}
            valorSelecionado={tipoId}
            onSelecionar={setTipoId}
            placeholder={copyDespesas.nova.tipoPlaceholder}
            tituloDaFolha={copyDespesas.nova.tipoFolha}
            hasError={tentouSalvar && !tipoId}
          />
          <RowSeparator />
          <FormRow
            label={copyDespesas.nova.descricao}
            value={descricao}
            onChangeText={setDescricao}
            placeholder={copyDespesas.nova.descricaoPlaceholder}
            editable={!editar.isPending}
          />
          <RowSeparator />
          <FormRow
            label={copyDespesas.nova.valor}
            value={valor}
            onChangeText={setValor}
            keyboardType="number-pad"
            hasError={tentouSalvar && !validacao.valido}
            editable={!editar.isPending}
          />
        </ListGroup>

        <ListGroup title={copyDespesas.nova.observacoes}>
          <MultilineRow
            value={observacoes}
            onChangeText={setObservacoes}
            editable={!editar.isPending}
          />
        </ListGroup>

        <View style={{ marginTop: spacing.xxl }}>
          <FilledButton
            label={copyDespesas.nova.salvar}
            loadingLabel={copyDespesas.nova.salvando}
            loading={editar.isPending}
            disabled={!podeSalvar}
            onPress={aoSalvar}
          />
        </View>

        <ListGroup>
          <ActionRow
            label={copyDespesas.detalhe.excluir}
            icon="delete"
            destructive
            onPress={confirmarExclusao}
          />
        </ListGroup>
      </Screen>
    </KeyboardAvoidingView>
  );
}
