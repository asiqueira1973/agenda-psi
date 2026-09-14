import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Screen,
  ListGroup,
  RowSeparator,
  PickerRow,
  TimeRow,
  MultilineRow,
  SegmentedControl,
  SegmentedGroupContent,
  FilledButton,
  Text,
} from '@/components/ui';
import { useColors, screenMargin, spacing } from '@/theme';
import { usePacientes } from '@/features/patients/use-patients';
import { useAgenda, useCriarAgendamento } from '@/features/schedule/use-schedule';
import { copyAgenda, diasDoSegmented } from '@/features/schedule/copy';
import { copyAuth } from '@/features/auth/copy';
import { mensagens, validarIntervaloDeHoras } from '@/lib/validation';

/**
 * Tela 7 — Novo agendamento.
 *
 * Correções em relação ao app atual:
 * - salvar com campo faltando MOSTRA erro. Hoje aborta em silêncio, e a pessoa
 *   conclui que o botão está quebrado (defeito 11.9.15);
 * - valida que a hora fim é depois da hora início, o que hoje não é validado;
 * - avisa quando já existe agendamento no mesmo dia e hora — aviso, não
 *   bloqueio: dois pacientes no mesmo horário é raro, mas é decisão de quem
 *   atende, não do app.
 *
 * Criar o horário é o que LIGA o lembrete por SMS daquele paciente (regra 11.5).
 *
 * Implementa: 8.8, inventário 10.7 e os estados 7 e 7a do handoff.
 */
export default function NovoAgendamentoScreen() {
  const colors = useColors();
  const { dia: diaInicial } = useLocalSearchParams<{ dia?: string }>();
  const pacientes = usePacientes();
  const agenda = useAgenda();
  const criar = useCriarAgendamento();

  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [dia, setDia] = useState(Number(diaInicial) || 1);
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaFim, setHoraFim] = useState('08:50');
  const [notas, setNotas] = useState('');
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const validacaoDeHoras = validarIntervaloDeHoras(horaInicio, horaFim);
  const podeSalvar = !!pacienteId && validacaoDeHoras.valido && !criar.isPending;

  const opcoes = (pacientes.data ?? [])
    .filter((p) => p.status !== 'inativo')
    .map((p) => ({ id: p.paciente_id!, rotulo: p.nome_completo ?? '' }));

  // Aviso de conflito: mesmo dia e mesma hora de início.
  const jaExiste = (agenda.data ?? []).some(
    (a) => a.dia_semana === dia && (a.hora_inicio ?? '').startsWith(horaInicio),
  );

  const rodape = (() => {
    if (erro) return erro;
    if (tentouSalvar && !pacienteId) return mensagens.pacienteNaoEscolhido;
    if (tentouSalvar && !validacaoDeHoras.valido) return validacaoDeHoras.mensagem;
    if (jaExiste) return copyAgenda.novo.jaExisteNesseHorario;
    return undefined;
  })();

  const rodapeEhErro = !!erro || (tentouSalvar && (!pacienteId || !validacaoDeHoras.valido));

  function aoSalvar() {
    setTentouSalvar(true);
    setErro(null);
    // Erro visível, nunca aborto silencioso (defeito 11.9.15).
    if (!pacienteId || !validacaoDeHoras.valido) return;

    criar.mutate(
      {
        pacienteId,
        diaSemana: dia,
        horaInicio,
        horaFim,
        observacoes: notas.trim() || null,
      },
      {
        onSuccess: () => {
          Alert.alert(copyAgenda.sucessoCriado);
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
          <Text variant="largeTitle">{copyAgenda.novo.titulo}</Text>
        </View>

        <ListGroup first footer={rodape} footerIsError={rodapeEhErro}>
          <PickerRow
            label={copyAgenda.novo.paciente}
            opcoes={opcoes}
            valorSelecionado={pacienteId}
            onSelecionar={setPacienteId}
            tituloDaFolha={copyAgenda.novo.pacienteFolha}
            comBusca
            hasError={tentouSalvar && !pacienteId}
            labelWidth={110}
          />
          <RowSeparator />
          <TimeRow
            label={copyAgenda.novo.horaInicio}
            value={horaInicio}
            onChange={setHoraInicio}
            editable={!criar.isPending}
          />
          <RowSeparator />
          <TimeRow
            label={copyAgenda.novo.horaFim}
            value={horaFim}
            onChange={setHoraFim}
            editable={!criar.isPending}
          />
        </ListGroup>

        <ListGroup title={copyAgenda.novo.grupoDia}>
          <SegmentedGroupContent>
            <SegmentedControl
              opcoes={diasDoSegmented}
              valor={dia}
              onChange={setDia}
              accessibilityLabel={copyAgenda.novo.grupoDia}
            />
          </SegmentedGroupContent>
        </ListGroup>

        <ListGroup title={copyAgenda.novo.grupoNotas}>
          <MultilineRow value={notas} onChangeText={setNotas} editable={!criar.isPending} />
        </ListGroup>

        <View style={{ marginTop: spacing.xxl }}>
          <FilledButton
            label={copyAgenda.novo.salvar}
            loadingLabel={copyAgenda.novo.salvando}
            loading={criar.isPending}
            disabled={!podeSalvar}
            onPress={aoSalvar}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
