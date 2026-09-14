import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { router } from 'expo-router';
import {
  Screen,
  ListGroup,
  RowSeparator,
  FormRow,
  ToggleRow,
  MultilineRow,
  FilledButton,
  Text,
} from '@/components/ui';
import { useColors, screenMargin, spacing } from '@/theme';
import { useCriarPaciente } from '@/features/patients/use-patients';
import { copyPacientes } from '@/features/patients/copy';
import { copyAuth } from '@/features/auth/copy';
import {
  validarNome,
  validarTelefone,
  validarEmailOpcional,
  validarValorEmReais,
  valorEmReaisParaInteiro,
} from '@/lib/validation';

/**
 * Tela 10 — Novo paciente.
 *
 * O preço é OBRIGATÓRIO e só aceita inteiro. É a correção do defeito 11.9.6: no
 * app atual, campo vazio ou com vírgula grava `NULL` numa coluna `NOT NULL`, o
 * insert falha e a tela mostra "Paciente cadastrado" assim mesmo.
 *
 * O erro não pinta borda vermelha no campo: o rótulo vira vermelho e a mensagem
 * aparece como rodapé do grupo (handoff, "Linha de formulário").
 *
 * Implementa: 8.4, inventário 10.10, regra 11.2 e a copy de 15.3.
 */
export default function NovoPacienteScreen() {
  const colors = useColors();
  const criar = useCriarPaciente();

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [preco, setPreco] = useState('');
  const [receberSms, setReceberSms] = useState(true);
  const [observacoes, setObservacoes] = useState('');
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [erroDeEscrita, setErroDeEscrita] = useState<string | null>(null);

  const vNome = validarNome(nome);
  const vTelefone = validarTelefone(telefone);
  const vEmail = validarEmailOpcional(email);
  const vPreco = validarValorEmReais(preco);

  const tudoValido = vNome.valido && vTelefone.valido && vEmail.valido && vPreco.valido;

  // Só mostra erro depois da primeira tentativa: pintar o formulário de vermelho
  // antes de a pessoa digitar qualquer coisa é hostil.
  const mostrarErros = tentouSalvar;

  const rodapeDoGrupo = mostrarErros
    ? [
        !vNome.valido ? vNome.mensagem : null,
        !vTelefone.valido ? vTelefone.mensagem : null,
        !vEmail.valido ? vEmail.mensagem : null,
        !vPreco.valido ? vPreco.mensagem : null,
      ]
        .filter(Boolean)
        .join('\n') || undefined
    : undefined;

  function aoSalvar() {
    setTentouSalvar(true);
    setErroDeEscrita(null);
    if (!tudoValido) return;

    criar.mutate(
      {
        nomeCompleto: nome,
        telefone,
        email: email.trim() || null,
        observacoes: observacoes.trim() || null,
        preco: valorEmReaisParaInteiro(preco),
        receberSms,
      },
      {
        onSuccess: (pacienteId) => {
          Alert.alert(copyPacientes.sucessoCriado(nome.trim()));
          // Vai para o detalhe, e não empilha a lista de volta (spec 8.4).
          router.replace(`/patients/${pacienteId}`);
        },
        onError: () => setErroDeEscrita(copyAuth.erros.falhaGenerica),
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
          <Text variant="largeTitle">{copyPacientes.novo.titulo}</Text>
        </View>

        <ListGroup
          first
          footer={rodapeDoGrupo ?? copyPacientes.novo.rodapePreco}
          footerIsError={!!rodapeDoGrupo}
        >
          <FormRow
            label={copyPacientes.novo.nome}
            value={nome}
            onChangeText={setNome}
            autoCapitalize="words"
            hasError={mostrarErros && !vNome.valido}
            editable={!criar.isPending}
          />
          <RowSeparator />
          <FormRow
            label={copyPacientes.novo.telefone}
            value={telefone}
            onChangeText={setTelefone}
            keyboardType="phone-pad"
            placeholder="+55 21 99999-9999"
            hasError={mostrarErros && !vTelefone.valido}
            editable={!criar.isPending}
          />
          <RowSeparator />
          <FormRow
            label={copyPacientes.novo.email}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            hasError={mostrarErros && !vEmail.valido}
            editable={!criar.isPending}
          />
          <RowSeparator />
          <FormRow
            label={copyPacientes.novo.preco}
            value={preco}
            onChangeText={setPreco}
            keyboardType="number-pad"
            placeholder="Ex: 200"
            hasError={mostrarErros && !vPreco.valido}
            editable={!criar.isPending}
          />
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
            editable={!criar.isPending}
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
            label={copyPacientes.novo.salvar}
            loadingLabel={copyPacientes.novo.salvando}
            loading={criar.isPending}
            onPress={aoSalvar}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
