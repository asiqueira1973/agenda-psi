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
  SegmentedControl,
  SegmentedGroupContent,
  FilledButton,
  SkeletonGroup,
  Text,
} from '@/components/ui';
import { useColors, screenMargin, spacing } from '@/theme';
import { usePaciente, useEditarPaciente } from '@/features/patients/use-patients';
import { statusDoPaciente } from '@/features/patients/valores-do-banco';
import { copyPacientes } from '@/features/patients/copy';
import { copyAuth } from '@/features/auth/copy';
import { validarNome, validarTelefone, validarEmailOpcional } from '@/lib/validation';

/**
 * Tela 12 — Editar paciente.
 *
 * Mesmos campos do cadastro, mais o grupo STATUS. SEM campo de preço: preço se
 * altera criando linha nova em `precos_paciente`, pela tela 13 (regra 11.2).
 *
 * Nome e telefone são obrigatórios AQUI TAMBÉM. O app atual valida no cadastro
 * e não na edição, então dá para esvaziar o nome de um paciente já cadastrado
 * (defeito 11.9.23).
 *
 * Implementa: 8.4, inventário 10.12.
 */
export default function EditarPacienteScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const paciente = usePaciente(id);
  const editar = useEditarPaciente(id);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [status, setStatus] = useState('ativo');
  const [receberSms, setReceberSms] = useState(false);
  const [carregou, setCarregou] = useState(false);
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [erroDeEscrita, setErroDeEscrita] = useState<string | null>(null);

  // Preenche o formulário uma vez, quando a consulta chega. Sem a trava, cada
  // refetch sobrescreveria o que a pessoa está digitando.
  useEffect(() => {
    if (carregou || !paciente.data) return;
    setNome(paciente.data.nome_completo ?? '');
    setTelefone(paciente.data.telefone ?? '');
    setEmail(paciente.data.email ?? '');
    setObservacoes(paciente.data.observacoes ?? '');
    setStatus(paciente.data.status ?? 'ativo');
    setReceberSms(paciente.data.receber_sms ?? false);
    setCarregou(true);
  }, [paciente.data, carregou]);

  const vNome = validarNome(nome);
  const vTelefone = validarTelefone(telefone);
  const vEmail = validarEmailOpcional(email);
  const tudoValido = vNome.valido && vTelefone.valido && vEmail.valido;

  const rodape = tentouSalvar
    ? [
        !vNome.valido ? vNome.mensagem : null,
        !vTelefone.valido ? vTelefone.mensagem : null,
        !vEmail.valido ? vEmail.mensagem : null,
      ]
        .filter(Boolean)
        .join('\n') || undefined
    : undefined;

  function aoSalvar() {
    setTentouSalvar(true);
    setErroDeEscrita(null);
    if (!tudoValido) return;

    editar.mutate(
      {
        nomeCompleto: nome,
        telefone,
        email: email.trim() || null,
        observacoes: observacoes.trim() || null,
        status,
        receberSms,
      },
      {
        onSuccess: () => {
          Alert.alert(copyPacientes.sucessoAtualizado(nome.trim()));
          router.back();
        },
        onError: () => setErroDeEscrita(copyAuth.erros.falhaGenerica),
      },
    );
  }

  if (paciente.isPending) {
    return (
      <Screen>
        <SkeletonGroup rows={4} />
      </Screen>
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
          <Text variant="largeTitle">{copyPacientes.editar.titulo}</Text>
        </View>

        <ListGroup first footer={rodape} footerIsError={!!rodape}>
          <FormRow
            label={copyPacientes.novo.nome}
            value={nome}
            onChangeText={setNome}
            autoCapitalize="words"
            hasError={tentouSalvar && !vNome.valido}
            editable={!editar.isPending}
          />
          <RowSeparator />
          <FormRow
            label={copyPacientes.novo.telefone}
            value={telefone}
            onChangeText={setTelefone}
            keyboardType="phone-pad"
            hasError={tentouSalvar && !vTelefone.valido}
            editable={!editar.isPending}
          />
          <RowSeparator />
          <FormRow
            label={copyPacientes.novo.email}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            hasError={tentouSalvar && !vEmail.valido}
            editable={!editar.isPending}
          />
        </ListGroup>

        <ListGroup title={copyPacientes.editar.status}>
          <SegmentedGroupContent>
            <SegmentedControl
              opcoes={statusDoPaciente}
              valor={status}
              onChange={setStatus}
              accessibilityLabel={copyPacientes.editar.status}
            />
          </SegmentedGroupContent>
        </ListGroup>

        <ListGroup>
          <ToggleRow
            label={copyPacientes.novo.receberSms}
            value={receberSms}
            onValueChange={setReceberSms}
          />
        </ListGroup>

        <ListGroup title={copyPacientes.novo.observacoes}>
          <MultilineRow
            value={observacoes}
            onChangeText={setObservacoes}
            editable={!editar.isPending}
          />
        </ListGroup>

        {erroDeEscrita ? (
          <Text
            variant="footnote"
            color="destructive"
            style={{ marginHorizontal: screenMargin, marginTop: spacing.md }}
          >
            {erroDeEscrita}
          </Text>
        ) : null}

        <View style={{ marginTop: spacing.xxl }}>
          <FilledButton
            label={copyPacientes.editar.salvar}
            loadingLabel={copyPacientes.editar.salvando}
            loading={editar.isPending}
            onPress={aoSalvar}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
