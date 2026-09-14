import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Screen,
  ListGroup,
  RowSeparator,
  ValueRow,
  ActionRow,
  MultilineRow,
  FilledButton,
  SkeletonGroup,
  Text,
} from '@/components/ui';
import { useColors, screenMargin, spacing } from '@/theme';
import { formatarHora, nomeDoDiaDaSemana } from '@/lib/format';
import {
  useAgendamento,
  useEditarObservacoesDoAgendamento,
  useExcluirAgendamento,
} from '@/features/schedule/use-schedule';
import { copyAgenda } from '@/features/schedule/copy';
import { copyComum } from '@/features/sessions/copy';
import { copyAuth } from '@/features/auth/copy';

/**
 * Tela 8 — Detalhe do agendamento.
 *
 * ⚠️ É a tela do defeito 11.9.4, e ele é dos piores do app atual: salvar as
 * NOTAS aqui grava `dia_semana = 1` junto, então um horário de quinta vira
 * segunda porque alguém corrigiu uma observação. E como o lembrete por SMS sai
 * do horário fixo, o paciente passa a ser avisado no dia errado — sem que
 * ninguém perceba de onde veio.
 *
 * A correção é estrutural: paciente, dia e horário são LEITURA, e o hook de
 * edição aceita um único parâmetro, `observacoes`. Para mudar dia ou hora,
 * exclui-se e cria-se de novo — e o rodapé diz isso.
 *
 * A exclusão ganha confirmação, e o texto dela avisa a consequência real: o
 * lembrete daquele dia deixa de ser enviado.
 *
 * Implementa: 8.8, inventário 10.8 e os estados 8 e 8a do handoff.
 */
export default function DetalheDoAgendamentoScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const agendamento = useAgendamento(id);
  const salvarNotas = useEditarObservacoesDoAgendamento(id);
  const excluir = useExcluirAgendamento();

  const [notas, setNotas] = useState('');
  const [carregou, setCarregou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (carregou || !agendamento.data) return;
    setNotas(agendamento.data.observacoes ?? '');
    setCarregou(true);
  }, [agendamento.data, carregou]);

  if (agendamento.isPending || !agendamento.data) {
    return (
      <Screen>
        <SkeletonGroup rows={3} />
      </Screen>
    );
  }

  const a = agendamento.data;
  const nomeDoPaciente =
    (a.pacientes as { nome_completo: string | null } | null)?.nome_completo ?? '—';
  const diaPorExtenso = nomeDoDiaDaSemana(a.dia_semana);
  const horario = `${formatarHora(a.hora_inicio)} às ${formatarHora(a.hora_fim)}`;

  function aoSalvar() {
    setErro(null);
    salvarNotas.mutate(notas.trim() || null, {
      onSuccess: () => {
        Alert.alert(copyAgenda.sucessoAtualizado);
        router.back();
      },
      onError: () => setErro(copyAuth.erros.falhaGenerica),
    });
  }

  function confirmarExclusao() {
    Alert.alert(
      copyAgenda.confirmarExclusaoTitulo,
      copyAgenda.confirmarExclusaoCorpo(diaPorExtenso, formatarHora(a.hora_inicio)),
      [
        { text: copyComum.cancelar, style: 'cancel' },
        {
          text: copyComum.excluir,
          style: 'destructive',
          onPress: () =>
            excluir.mutate(id, {
              onSuccess: () => {
                Alert.alert(copyAgenda.sucessoExcluido);
                router.back();
              },
              onError: () => Alert.alert(copyAuth.erros.falhaGenerica),
            }),
        },
      ],
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <View style={{ paddingHorizontal: screenMargin, marginBottom: spacing.xxl }}>
          <Text variant="largeTitle">{copyAgenda.detalhe.titulo}</Text>
        </View>

        {/* Tudo em LEITURA. É o que impede o defeito 11.9.4 de voltar. */}
        <ListGroup first footer={copyAgenda.detalhe.rodape}>
          <ValueRow label={copyAgenda.detalhe.paciente} value={nomeDoPaciente} />
          <RowSeparator />
          <ValueRow label={copyAgenda.detalhe.dia} value={diaPorExtenso} />
          <RowSeparator />
          <ValueRow label={copyAgenda.detalhe.horario} value={horario} />
        </ListGroup>

        <ListGroup
          title={copyAgenda.detalhe.grupoNotas}
          footer={erro ?? undefined}
          footerIsError={!!erro}
        >
          <MultilineRow
            value={notas}
            onChangeText={setNotas}
            editable={!salvarNotas.isPending}
          />
        </ListGroup>

        <View style={{ marginTop: spacing.xxl }}>
          <FilledButton
            label={copyAgenda.detalhe.salvar}
            loadingLabel={copyAgenda.detalhe.salvando}
            loading={salvarNotas.isPending}
            onPress={aoSalvar}
          />
        </View>

        <ListGroup>
          <ActionRow
            label={copyAgenda.detalhe.excluir}
            icon="delete"
            destructive
            onPress={confirmarExclusao}
          />
        </ListGroup>
      </Screen>
    </KeyboardAvoidingView>
  );
}
