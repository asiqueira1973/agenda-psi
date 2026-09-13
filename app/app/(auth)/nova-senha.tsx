import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { router } from 'expo-router';
import {
  Screen,
  ListGroup,
  RowSeparator,
  FormRow,
  FilledButton,
  Text,
} from '@/components/ui';
import { spacing, screenMargin } from '@/theme';
import { copyAuth } from '@/features/auth/copy';
import { definirNovaSenha } from '@/features/auth/auth-service';
import { track, eventos, telas } from '@/lib/analytics';
import { useSession } from '@/features/auth/session-provider';

/**
 * Tela 4 — Nova senha, aberta pelo link do e-mail.
 *
 * Só se chega aqui com a sessão de recuperação já estabelecida — quem faz essa
 * troca é `use-deep-link-recovery`, a partir do `code` que vem na URL.
 *
 * Esta é a tela mais importante da virada de versão. Como a atualização desloga
 * toda a base (a sessão do app Flutter vive em SharedPreferences e a do Expo no
 * chaveiro), e como o app atual nunca teve "esqueci minha senha", quem não
 * lembra a senha passa obrigatoriamente por aqui.
 *
 * Implementa: 6.4, 8.2, inventário 10.4 e a copy de 15.2.
 */
export default function NovaSenhaScreen() {
  const { session } = useSession();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const senhasDiferem = confirmacao.length > 0 && senha !== confirmacao;
  const podeSalvar = senha.length > 0 && senha === confirmacao && !salvando;

  async function aoSalvar() {
    setErro(null);
    if (senha !== confirmacao) {
      setErro(copyAuth.erros.senhasDiferentes);
      return;
    }

    setSalvando(true);
    try {
      await definirNovaSenha(senha);
      track({
        nome: eventos.senhaRecuperada,
        distinctId: session?.user.email ?? null,
        tela: telas.login,
        descricao: 'senha redefinida pelo link do e-mail',
        propriedades: { sucesso: true },
      });
      // Com a senha trocada, a sessão de recuperação vira sessão normal: dá
      // para entrar direto, sem pedir o login que a pessoa acabou de recuperar.
      router.replace('/');
    } catch (e) {
      setErro(e instanceof Error ? e.message : copyAuth.erros.falhaGenerica);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <View style={{ paddingHorizontal: screenMargin, marginBottom: spacing.xxl }}>
          <Text variant="largeTitle">{copyAuth.novaSenha.titulo}</Text>
          <Text color="secondaryLabel" style={{ marginTop: spacing.xs }}>
            {copyAuth.novaSenha.subtitulo}
          </Text>
        </View>

        <ListGroup
          first
          footer={erro ?? (senhasDiferem ? copyAuth.erros.senhasDiferentes : undefined)}
          footerIsError={!!erro || senhasDiferem}
          style={{ opacity: salvando ? 0.5 : 1 }}
        >
          <FormRow
            label={copyAuth.novaSenha.senha}
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            editable={!salvando}
            labelWidth={120}
          />
          <RowSeparator />
          <FormRow
            label={copyAuth.novaSenha.confirmacao}
            value={confirmacao}
            onChangeText={setConfirmacao}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            editable={!salvando}
            hasError={senhasDiferem}
            labelWidth={120}
          />
        </ListGroup>

        <View style={{ marginTop: spacing.xxl }}>
          <FilledButton
            label={copyAuth.novaSenha.salvar}
            loadingLabel={copyAuth.novaSenha.salvando}
            loading={salvando}
            disabled={!podeSalvar}
            onPress={aoSalvar}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
