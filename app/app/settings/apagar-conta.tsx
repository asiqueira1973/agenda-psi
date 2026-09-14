import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { router } from 'expo-router';
import {
  Screen,
  ListGroup,
  FormRow,
  ActionRow,
  Text,
} from '@/components/ui';
import { useColors, screenMargin, spacing, typography } from '@/theme';
import {
  useDesativarConta,
  CONFIRMACAO_DE_EXCLUSAO,
} from '@/features/settings/use-settings';
import { copyConfiguracoes } from '@/features/settings/copy';
import { copyAuth } from '@/features/auth/copy';

/**
 * Tela 27 — Apagar minha conta.
 *
 * ⚠️ É a tela do defeito 11.9.7, e é um caso raro: a feature NUNCA FUNCIONOU. No
 * app atual o campo de confirmação é read-only, então não há como digitar
 * QUERO DELETAR, logo não há como concluir a operação. A Política de
 * Privacidade promete exclusão a pedido, e o caminho que o app oferece é um
 * beco sem saída.
 *
 * Aqui o campo é editável, o botão só habilita quando o texto bate exatamente,
 * e o app desloga imediatamente depois — hoje ele não desloga, e a pessoa
 * continua navegando numa conta que acabou de desativar.
 *
 * É soft delete: `ativo = false`. Nenhum dado é apagado — o rodapé diz que os
 * dados vão junto, o que hoje ainda não é literalmente verdade. Ver risco 23.6
 * e a pergunta aberta 25.4, que decide o que "apagar" vai significar na v2.
 *
 * Implementa: 8.10, inventário 10.27, regra 6.4 e a copy de 15.4.
 */
export default function ApagarContaScreen() {
  const colors = useColors();
  const desativar = useDesativarConta();
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const podeApagar =
    confirmacao.trim() === CONFIRMACAO_DE_EXCLUSAO && !desativar.isPending;

  function aoApagar() {
    setErro(null);
    desativar.mutate(undefined, {
      onSuccess: () => {
        Alert.alert(copyConfiguracoes.apagar.sucesso);
        // O signOut já aconteceu dentro da mutação; a raiz redireciona sozinha.
        router.replace('/');
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
        <View style={{ paddingHorizontal: screenMargin, marginBottom: spacing.xl }}>
          <Text variant="largeTitle">{copyConfiguracoes.apagar.titulo}</Text>
        </View>

        <View style={{ paddingHorizontal: screenMargin, marginBottom: spacing.xl }}>
          <Text style={[typography.body, { color: colors.destructive }]}>
            {copyConfiguracoes.apagar.aviso}
          </Text>
        </View>

        <ListGroup
          first
          footer={erro ?? copyConfiguracoes.apagar.rodape}
          footerIsError={!!erro}
        >
          {/* EDITÁVEL. É o que faz a feature existir. */}
          <FormRow
            label={copyConfiguracoes.apagar.campo}
            value={confirmacao}
            onChangeText={setConfirmacao}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={CONFIRMACAO_DE_EXCLUSAO}
            editable={!desativar.isPending}
            labelWidth={116}
          />
        </ListGroup>

        <ListGroup>
          <ActionRow
            label={
              desativar.isPending
                ? copyConfiguracoes.apagar.apagando
                : copyConfiguracoes.apagar.botao
            }
            destructive
            disabled={!podeApagar}
            onPress={aoApagar}
          />
        </ListGroup>
      </Screen>
    </KeyboardAvoidingView>
  );
}
