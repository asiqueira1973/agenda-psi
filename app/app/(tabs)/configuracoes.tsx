import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import {
  Screen,
  ListGroup,
  RowSeparator,
  NavigationRow,
  ActionRow,
  Text,
} from '@/components/ui';
import { screenMargin, spacing } from '@/theme';
import { sair } from '@/features/auth/auth-service';
import { useMeuPlano } from '@/features/home/use-dashboard';
import { copyConfiguracoes } from '@/features/settings/copy';
import { copyAuth } from '@/features/auth/copy';

/**
 * Tela 21 — Configurações.
 *
 * Lista agrupada, igual ao Ajustes do iOS: ícone cinza à esquerda de cada linha
 * navegável, chevron à direita, e o grupo destrutivo por último, em vermelho.
 *
 * Duas coisas mudaram de lugar em relação ao app atual, e as duas por bons
 * motivos:
 * - "Sair do app" saiu do CABEÇALHO DA HOME e veio para cá, com confirmação. Um
 *   botão de sair na tela principal é atípico e fácil de tocar por engano
 *   (assunção 24.7);
 * - a política de privacidade ganhou entrada aqui. Hoje ela só é alcançável
 *   pela tela de Login, ou seja: quem já está dentro do app não consegue mais
 *   ler a política que aceitou.
 *
 * Implementa: 8.10, inventário 10.21 e a copy de 15.4.
 */
export default function ConfiguracoesScreen() {
  const plano = useMeuPlano();

  const rotuloDoPlano = plano.data?.usuario_fundador
    ? copyConfiguracoes.planoFundador
    : plano.data?.plano === 'pro'
      ? copyConfiguracoes.planoPro
      : copyConfiguracoes.planoGratuito;

  // A versão vem do app.json, não de uma constante escrita à mão. O rodapé do
  // handoff diz "Agenda Psi 1.0", mas o app publicado está na 4.0.0 — um número
  // fixo aqui envelheceria na primeira release.
  const versao = Constants.expoConfig?.version ?? '—';

  function confirmarSaida() {
    Alert.alert(copyConfiguracoes.confirmarSaida, undefined, [
      { text: copyConfiguracoes.cancelar, style: 'cancel' },
      {
        text: copyConfiguracoes.sair,
        style: 'destructive',
        onPress: () =>
          void sair()
            .then(() => router.replace('/'))
            .catch(() => Alert.alert(copyAuth.erros.falhaGenerica)),
      },
    ]);
  }

  return (
    <Screen>
      <View style={{ paddingHorizontal: screenMargin, marginBottom: spacing.xxl }}>
        <Text variant="largeTitle">{copyConfiguracoes.titulo}</Text>
      </View>

      <ListGroup first title={copyConfiguracoes.grupoConta}>
        <NavigationRow
          label={copyConfiguracoes.meuPerfil}
          icon="profile"
          onPress={() => router.push('/settings/perfil')}
        />
        <RowSeparator hasIcon />
        <NavigationRow
          label={copyConfiguracoes.trocarSenha}
          icon="password"
          onPress={() => router.push('/settings/senha')}
        />
      </ListGroup>

      <ListGroup title={copyConfiguracoes.grupoPlano}>
        <NavigationRow
          label={copyConfiguracoes.meuPlano}
          icon="plan"
          value={rotuloDoPlano}
          onPress={() => router.push('/settings/plano')}
        />
      </ListGroup>

      <ListGroup title={copyConfiguracoes.grupoSobre}>
        <NavigationRow
          label={copyConfiguracoes.feedback}
          icon="feedback"
          onPress={() => router.push('/settings/feedback')}
        />
        <RowSeparator hasIcon />
        <NavigationRow
          label={copyConfiguracoes.politica}
          icon="privacy"
          onPress={() => router.push('/politica-de-privacidade')}
        />
      </ListGroup>

      <ListGroup footer={`Agenda Psi ${versao} · Dab Lab`}>
        <ActionRow
          label={copyConfiguracoes.sair}
          icon="logout"
          destructive
          onPress={confirmarSaida}
        />
        <RowSeparator hasIcon />
        <ActionRow
          label={copyConfiguracoes.apagarConta}
          icon="delete"
          destructive
          onPress={() => router.push('/settings/apagar-conta')}
        />
      </ListGroup>
    </Screen>
  );
}
