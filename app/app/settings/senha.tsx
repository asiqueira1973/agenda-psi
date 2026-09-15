import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import {
  BackLink,
  Screen,
  ListGroup,
  ValueRow,
  FilledButton,
  Text,
} from '@/components/ui';
import { screenMargin, spacing } from '@/theme';
import { useSession } from '@/features/auth/session-provider';
import { enviarEmailDeRecuperacao } from '@/features/auth/auth-service';
import { urlDeRetornoDaSenha } from '@/features/auth/use-deep-link-recovery';
import { copyConfiguracoes } from '@/features/settings/copy';
import { copyAuth } from '@/features/auth/copy';

/**
 * Tela 23 — Trocar senha.
 *
 * Mantém o fluxo do app atual: dispara `resetPasswordForEmail` para o e-mail da
 * conta (regra 6.4). O e-mail aparece em leitura, para a pessoa conferir para
 * onde o link vai antes de pedir.
 *
 * Some daqui a guarda `currentUserEmail != 'demo@agendapsi.com'` do app atual: o
 * login de convidado foi descartado (seção 3), e com ele a credencial fixa que
 * vivia no estado global.
 *
 * Implementa: 8.10, inventário 10.23 e a copy de 15.2.
 */
export default function TrocarSenhaScreen() {
  const { session } = useSession();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const email = session?.user.email ?? '—';

  async function aoEnviar() {
    setEnviando(true);
    setErro(null);
    try {
      await enviarEmailDeRecuperacao(email, urlDeRetornoDaSenha());
      Alert.alert(copyAuth.erros.emailDeSenhaEnviado);
      router.back();
    } catch (e) {
      setErro(e instanceof Error ? e.message : copyAuth.erros.falhaGenerica);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Screen>
      <View style={{ paddingHorizontal: screenMargin, marginBottom: spacing.xxl }}>
        <BackLink label="‹ Ajustes" />
        <Text variant="largeTitle">{copyConfiguracoes.senha.titulo}</Text>
      </View>

      <ListGroup
        first
        footer={erro ?? copyConfiguracoes.senha.rodape}
        footerIsError={!!erro}
      >
        <ValueRow label={copyConfiguracoes.senha.email} value={email} />
      </ListGroup>

      <View style={{ marginTop: spacing.xxl }}>
        <FilledButton
          label={copyConfiguracoes.senha.enviar}
          loadingLabel={copyConfiguracoes.senha.enviando}
          loading={enviando}
          onPress={aoEnviar}
        />
      </View>
    </Screen>
  );
}
