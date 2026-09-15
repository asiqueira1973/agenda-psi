import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { router } from 'expo-router';
import {
  BackLink,
  Screen,
  ListGroup,
  RowSeparator,
  FormRow,
  MultilineRow,
  DateRow,
  hojeNoFormatoDoBanco,
  PickerRow,
  FilledButton,
  Text,
} from '@/components/ui';
import { useColors, screenMargin, spacing } from '@/theme';
import { useCriarDespesa, useTiposDeDespesa } from '@/features/expenses/use-expenses';
import { copyDespesas } from '@/features/expenses/copy';
import { copyAuth } from '@/features/auth/copy';
import { mensagens, validarValorEmReais, valorEmReaisParaInteiro } from '@/lib/validation';

/**
 * Tela 19 — Registrar despesa.
 *
 * ⚠️ A tela do defeito 11.9.5. No app atual o tipo começa com a string literal
 * `Option 1`, placeholder do FlutterFlow; sem seleção, o insert falha contra
 * uma coluna `uuid NOT NULL` e a tela mostra "Despesa cadastrada" assim mesmo.
 * O evento de analytics dessa tela nunca disparou uma vez sequer — é o que o
 * catálogo do Visão do Produto mostra.
 *
 * Aqui o tipo começa NULO, o botão fica desabilitado enquanto for nulo, e o
 * rodapé do grupo diz por quê. Não há estado em que o formulário pareça
 * completo e não esteja.
 *
 * Implementa: 8.7, inventário 10.19 e a copy de 15.3 e 15.6.
 */
export default function NovaDespesaScreen() {
  const colors = useColors();
  const tipos = useTiposDeDespesa();
  const criar = useCriarDespesa();

  const [data, setData] = useState(hojeNoFormatoDoBanco());
  // Começa NULO. Nunca "Option 1", nunca o primeiro da lista por acaso.
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const validacaoDoValor = validarValorEmReais(valor);
  const podeSalvar = !!tipoId && validacaoDoValor.valido && !criar.isPending;

  const opcoes = (tipos.data ?? []).map((t) => ({ id: t.id, rotulo: t.nome }));

  const rodape = (() => {
    if (tentouSalvar && !tipoId) return mensagens.tipoDeDespesaNaoEscolhido;
    if (tentouSalvar && !validacaoDoValor.valido) return validacaoDoValor.mensagem;
    if (!tipoId) return copyDespesas.nova.rodapeTipoObrigatorio;
    return undefined;
  })();

  function aoSalvar() {
    setTentouSalvar(true);
    setErro(null);
    if (!tipoId || !validacaoDoValor.valido) return;

    criar.mutate(
      {
        tipoDespesaId: tipoId,
        valorDespesa: valorEmReaisParaInteiro(valor),
        dataCompetencia: data,
        descricao: descricao.trim() || null,
        observacoes: observacoes.trim() || null,
      },
      {
        onSuccess: () => {
          Alert.alert(copyDespesas.sucessoCriada);
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
          <BackLink label="‹ Despesas" />
          <Text variant="largeTitle">{copyDespesas.nova.titulo}</Text>
        </View>

        <ListGroup
          first
          footer={erro ?? rodape}
          footerIsError={!!erro || (tentouSalvar && (!tipoId || !validacaoDoValor.valido))}
        >
          <DateRow label={copyDespesas.nova.data} value={data} onChange={setData} />
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
            editable={!criar.isPending}
          />
          <RowSeparator />
          <FormRow
            label={copyDespesas.nova.valor}
            value={valor}
            onChangeText={setValor}
            keyboardType="number-pad"
            placeholder="Ex: 80"
            hasError={tentouSalvar && !validacaoDoValor.valido}
            editable={!criar.isPending}
          />
        </ListGroup>

        <ListGroup title={copyDespesas.nova.observacoes}>
          <MultilineRow
            value={observacoes}
            onChangeText={setObservacoes}
            editable={!criar.isPending}
          />
        </ListGroup>

        <View style={{ marginTop: spacing.xxl }}>
          <FilledButton
            label={copyDespesas.nova.salvar}
            loadingLabel={copyDespesas.nova.salvando}
            loading={criar.isPending}
            disabled={!podeSalvar}
            onPress={aoSalvar}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
