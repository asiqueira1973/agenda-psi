import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import {
  Screen,
  ScreenFooter,
  ListGroup,
  RowSeparator,
  FormRow,
  FilledButton,
  IconButton,
  Text,
} from '@/components/ui';
import { useColors, spacing, screenMargin, typography } from '@/theme';
import { copyAuth } from '@/features/auth/copy';
import { entrar, enviarEmailDeRecuperacao } from '@/features/auth/auth-service';
import { urlDeRetornoDaSenha } from '@/features/auth/use-deep-link-recovery';

/**
 * Tela 1 — Login.
 *
 * Implementa: 6.1, 6.3, 8.2, inventário 10.1 e a copy literal de 15.2.
 *
 * O que muda em relação ao app atual, e por quê:
 * - existe "Esqueci minha senha" (6.4). O app atual não tem, e sem isso todo
 *   esquecimento vira suporte manual — ainda mais agora, que a atualização
 *   desloga a base inteira;
 * - o botão desabilita durante a chamada e o erro aparece em português, no
 *   rodapé do grupo, como o handoff desenha (princípio P3);
 * - tocar no fundo não apaga mais o que foi digitado (defeito 11.9.24).
 */
export default function LoginScreen() {
  const colors = useColors();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeEntrar = email.trim().length > 0 && senha.length > 0 && !entrando;

  async function aoEntrar() {
    setErro(null);
    setEntrando(true);
    try {
      await entrar(email, senha);
      // A partir daqui quem decide o destino é o guardião da rota raiz, que
      // aplica a regra 6.3 consultando v_profissional_atual.
      router.replace('/');
    } catch (e) {
      setErro(e instanceof Error ? e.message : copyAuth.erros.falhaGenerica);
    } finally {
      setEntrando(false);
    }
  }

  async function aoEsquecerSenha() {
    if (email.trim().length === 0) {
      setErro(copyAuth.erros.emailObrigatorio);
      return;
    }
    setErro(null);
    try {
      await enviarEmailDeRecuperacao(email, urlDeRetornoDaSenha());
      Alert.alert(copyAuth.erros.emailDeSenhaEnviado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : copyAuth.erros.falhaGenerica);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <View style={{ paddingHorizontal: screenMargin, marginBottom: spacing.xxl }}>
          <Text variant="largeTitle">{copyAuth.login.titulo}</Text>
          <Text color="secondaryLabel" style={{ marginTop: spacing.xs }}>
            {copyAuth.login.subtitulo}
          </Text>
        </View>

        {/* Explica por que a pessoa está aqui depois de atualizar o app. Sem
            isto, quem usava o app e foi deslogado conclui que perdeu a conta. */}
        <ListGroup first footer={copyAuth.avisoDaAtualizacao} />

        <ListGroup
          footer={erro ?? undefined}
          footerIsError={!!erro}
          style={{ opacity: entrando ? 0.5 : 1 }}
        >
          <FormRow
            label={copyAuth.login.email}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            editable={!entrando}
            placeholder="voce@exemplo.com"
          />
          <RowSeparator />
          <FormRow
            label={copyAuth.login.senha}
            value={senha}
            onChangeText={setSenha}
            secureTextEntry={!senhaVisivel}
            autoCapitalize="none"
            autoComplete="current-password"
            editable={!entrando}
            accessory={
              <IconButton
                name={senhaVisivel ? 'eyeOff' : 'eye'}
                color={colors.accent}
                onPress={() => setSenhaVisivel((v) => !v)}
                accessibilityLabel={senhaVisivel ? 'Ocultar a senha' : 'Mostrar a senha'}
              />
            }
          />
        </ListGroup>

        <View style={{ marginTop: spacing.xxl }}>
          <FilledButton
            label={copyAuth.login.entrar}
            loadingLabel={copyAuth.login.entrando}
            loading={entrando}
            disabled={!podeEntrar}
            onPress={aoEntrar}
          />
        </View>

        <View style={{ alignItems: 'center', gap: spacing.lg, marginTop: spacing.xxl }}>
          <Pressable onPress={aoEsquecerSenha} accessibilityRole="link">
            <Text style={{ color: colors.accent }}>{copyAuth.login.esqueciSenha}</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(auth)/nova-conta')}
            accessibilityRole="link"
          >
            <Text style={{ color: colors.accent }}>{copyAuth.login.criarConta}</Text>
          </Pressable>
        </View>
      </Screen>

      <ScreenFooter>
        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <Pressable
            onPress={() => router.push('/politica-de-privacidade')}
            accessibilityRole="link"
          >
            <Text variant="footnote" style={{ color: colors.accent }}>
              {copyAuth.login.politica}
            </Text>
          </Pressable>
          <Text variant="footnote" color="secondaryLabel">
            {copyAuth.login.assinatura}
          </Text>
        </View>
      </ScreenFooter>
    </KeyboardAvoidingView>
  );
}
