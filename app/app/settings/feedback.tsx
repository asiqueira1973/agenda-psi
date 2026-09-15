import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { router } from 'expo-router';
import {
  BackLink,
  Screen,
  ListGroup,
  MultilineRow,
  FilledButton,
  Text,
} from '@/components/ui';
import { useColors, screenMargin, spacing } from '@/theme';
import { useEnviarFeedback } from '@/features/settings/use-settings';
import { copyConfiguracoes } from '@/features/settings/copy';
import { copyAuth } from '@/features/auth/copy';

/**
 * Tela 26 — Feedback.
 *
 * A mensagem é obrigatória, e o botão fica desabilitado enquanto o campo está
 * vazio. O app atual aceita em branco e dispara um e-mail vazio ao
 * administrador (spec 8.10) — o que, além de inútil, esconde os feedbacks reais
 * no meio do ruído.
 *
 * Implementa: 8.10 e o inventário 10.26.
 */
export default function FeedbackScreen() {
  const colors = useColors();
  const enviar = useEnviarFeedback();
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const podeEnviar = mensagem.trim().length > 0 && !enviar.isPending;

  function aoEnviar() {
    setErro(null);
    enviar.mutate(mensagem, {
      onSuccess: () => {
        Alert.alert(copyConfiguracoes.feedbackTela.sucesso);
        router.back();
      },
      onError: () => setErro(copyAuth.erros.falhaGenerica),
    });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <View style={{ paddingHorizontal: screenMargin, marginBottom: spacing.xxl }}>
          <BackLink label="‹ Ajustes" />
          <Text variant="largeTitle">{copyConfiguracoes.feedbackTela.titulo}</Text>
        </View>

        <ListGroup
          first
          footer={erro ?? copyConfiguracoes.feedbackTela.rodape}
          footerIsError={!!erro}
        >
          <MultilineRow
            value={mensagem}
            onChangeText={setMensagem}
            placeholder={copyConfiguracoes.feedbackTela.placeholder}
            minHeight={160}
            editable={!enviar.isPending}
          />
        </ListGroup>

        <View style={{ marginTop: spacing.xxl }}>
          <FilledButton
            label={copyConfiguracoes.feedbackTela.enviar}
            loadingLabel={copyConfiguracoes.feedbackTela.enviando}
            loading={enviar.isPending}
            disabled={!podeEnviar}
            onPress={aoEnviar}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
