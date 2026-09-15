import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  BackLink,
  Screen,
  ListGroup,
  RowSeparator,
  FormRow,
  ToggleRow,
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
  useSessao,
  useEditarSessao,
  useExcluirSessao,
} from '@/features/sessions/use-sessions';
import { copySessoes, copyComum } from '@/features/sessions/copy';
import { copyAuth } from '@/features/auth/copy';
import { modalidadeDaSessao, pagamentoDaSessao } from '@/features/patients/valores-do-banco';

/**
 * Tela 15 — Detalhe da sessão.
 *
 * ⚠️ É a tela do defeito 11.9.1. No app atual, salvar aqui grava
 * `duracao_minutos` a partir do campo de DATA, e toda edição zera a duração no
 * banco. Quem abre a sessão só para corrigir a observação perde a duração e
 * nunca fica sabendo.
 *
 * A correção não é "tomar cuidado": a data é LEITURA nesta tela, e o hook de
 * edição nem aceita data como parâmetro. Para mudar a data, exclui-se e cria-se
 * de novo — e o rodapé do grupo diz isso, em vez de deixar a pessoa procurando
 * um campo que não existe.
 *
 * A exclusão ganha confirmação, que o app atual não tem (spec 8.5).
 *
 * Implementa: 8.5, inventário 10.15 e a copy de 15.3 e 15.4.
 */
export default function DetalheDaSessaoScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessao = useSessao(id);
  const editar = useEditarSessao(id);
  const excluir = useExcluirSessao();

  const [duracao, setDuracao] = useState('');
  const [seraCobrada, setSeraCobrada] = useState(true);
  const [modalidade, setModalidade] = useState('presencial');
  const [pagamento, setPagamento] = useState('pagamento mensal');
  const [observacoes, setObservacoes] = useState('');
  const [carregou, setCarregou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (carregou || !sessao.data) return;
    setDuracao(sessao.data.duracao_minutos ? String(sessao.data.duracao_minutos) : '');
    setSeraCobrada(sessao.data.devesercobrada ?? true);
    setModalidade(sessao.data.modalidade ?? 'presencial');
    setPagamento(sessao.data.pagamento ?? 'pagamento mensal');
    setObservacoes(sessao.data.observacoes ?? '');
    setCarregou(true);
  }, [sessao.data, carregou]);

  if (sessao.isPending || !sessao.data) {
    return (
      <Screen>
        <SkeletonGroup rows={3} />
      </Screen>
    );
  }

  const pacienteId = sessao.data.paciente_id;

  function aoSalvar() {
    setErro(null);
    editar.mutate(
      {
        pacienteId,
        modalidade,
        duracaoMinutos: duracao.trim() ? Number.parseInt(duracao, 10) : null,
        pagamento,
        deveSerCobrada: seraCobrada,
        observacoes: observacoes.trim() || null,
      },
      {
        onSuccess: () => {
          Alert.alert(copySessoes.sucessoAtualizada);
          router.back();
        },
        onError: () => setErro(copyAuth.erros.falhaGenerica),
      },
    );
  }

  function confirmarExclusao() {
    Alert.alert(copySessoes.confirmarExclusao, undefined, [
      { text: copyComum.cancelar, style: 'cancel' },
      {
        text: copyComum.excluir,
        style: 'destructive',
        onPress: () =>
          excluir.mutate(
            { sessaoId: id, pacienteId },
            {
              onSuccess: () => {
                Alert.alert(copySessoes.sucessoExcluida);
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
          <BackLink />
          <Text variant="largeTitle">{copySessoes.detalhe}</Text>
        </View>

        <ListGroup first footer={copySessoes.rodapeData}>
          {/* Data em LEITURA. É o que impede o defeito 11.9.1 de voltar. */}
          <ValueRow
            label={copySessoes.data}
            value={formatarData(sessao.data.ocorreu_em_dia)}
          />
          <RowSeparator />
          <FormRow
            label={copySessoes.duracao}
            value={duracao}
            onChangeText={setDuracao}
            keyboardType="number-pad"
            placeholder={copySessoes.duracaoPlaceholder}
            editable={!editar.isPending}
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

        <ListGroup title={copySessoes.observacoes} footer={erro ?? undefined} footerIsError={!!erro}>
          <MultilineRow
            value={observacoes}
            onChangeText={setObservacoes}
            editable={!editar.isPending}
          />
        </ListGroup>

        <View style={{ marginTop: spacing.xxl }}>
          <FilledButton
            label={copySessoes.salvar}
            loadingLabel={copySessoes.salvando}
            loading={editar.isPending}
            onPress={aoSalvar}
          />
        </View>

        <ListGroup>
          <ActionRow
            label={copySessoes.excluir}
            icon="delete"
            destructive
            onPress={confirmarExclusao}
          />
        </ListGroup>
      </Screen>
    </KeyboardAvoidingView>
  );
}
