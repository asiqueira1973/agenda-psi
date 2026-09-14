import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Screen,
  ListGroup,
  RowSeparator,
  ValueRow,
  FormRow,
  MultilineRow,
  FilledButton,
  Text,
} from '@/components/ui';
import { useColors, screenMargin, spacing } from '@/theme';
import { formatarDinheiro } from '@/lib/format';
import { usePaciente, useAtualizarPreco } from '@/features/patients/use-patients';
import { copyPacientes } from '@/features/patients/copy';
import { copyAuth } from '@/features/auth/copy';
import { validarValorEmReais, valorEmReaisParaInteiro } from '@/lib/validation';

/**
 * Tela 13 — Atualizar o preço. Sempre folha modal.
 *
 * No app atual este mesmo componente abre como DIÁLOGO quando chamado pelo
 * cartão e como FOLHA quando chamado pelo botão — duas aparências para a mesma
 * coisa. Aqui é sempre folha (spec 8.4).
 *
 * Não existe update de preço: cada atualização é uma linha NOVA em
 * `precos_paciente`, com vigência de hoje (regra 11.2). O preço atual em
 * leitura vem da view, para a pessoa ver de onde está saindo.
 *
 * Implementa: 8.4, inventário 10.13 e a copy de 15.3.
 */
export default function AtualizarPrecoScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const paciente = usePaciente(id);
  const atualizar = useAtualizarPreco(id);

  const [novoPreco, setNovoPreco] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [erroDeEscrita, setErroDeEscrita] = useState<string | null>(null);

  const validacao = validarValorEmReais(novoPreco);

  function aoSalvar() {
    setTentouSalvar(true);
    setErroDeEscrita(null);
    if (!validacao.valido) return;

    const valor = valorEmReaisParaInteiro(novoPreco);
    atualizar.mutate(
      { preco: valor, observacoes: observacoes.trim() || null },
      {
        onSuccess: () => {
          Alert.alert(copyPacientes.sucessoPreco(formatarDinheiro(valor)));
          router.back();
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
          <Text variant="largeTitle">{copyPacientes.atualizarPreco.titulo}</Text>
        </View>

        <ListGroup
          first
          footer={
            tentouSalvar && !validacao.valido
              ? validacao.mensagem
              : copyPacientes.novo.rodapePreco
          }
          footerIsError={tentouSalvar && !validacao.valido}
        >
          <ValueRow
            label={copyPacientes.atualizarPreco.precoAtual}
            value={formatarDinheiro(paciente.data?.preco_vigente)}
          />
          <RowSeparator />
          <FormRow
            label={copyPacientes.atualizarPreco.novoPreco}
            value={novoPreco}
            onChangeText={setNovoPreco}
            keyboardType="number-pad"
            placeholder={copyPacientes.atualizarPreco.placeholder}
            hasError={tentouSalvar && !validacao.valido}
            editable={!atualizar.isPending}
            labelWidth={110}
          />
        </ListGroup>

        <ListGroup title={copyPacientes.atualizarPreco.observacoes}>
          <MultilineRow
            value={observacoes}
            onChangeText={setObservacoes}
            editable={!atualizar.isPending}
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
            label={copyPacientes.atualizarPreco.salvar}
            loadingLabel={copyPacientes.atualizarPreco.salvando}
            loading={atualizar.isPending}
            onPress={aoSalvar}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
