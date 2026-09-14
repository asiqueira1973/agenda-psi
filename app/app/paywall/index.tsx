import { useEffect } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import {
  Screen,
  ListGroup,
  ValueRow,
  FilledButton,
  TextLink,
  Icon,
  Text,
} from '@/components/ui';
import { useColors, screenMargin, spacing } from '@/theme';
import { copyPlano } from '@/features/settings/copy-plano';
import { usePurchases, LOJA } from '@/features/purchases/use-purchases';
import { track, eventos, telas } from '@/lib/analytics';
import { useSession } from '@/features/auth/session-provider';
import { useMeuPlano } from '@/features/home/use-dashboard';

/**
 * Tela 25 — Paywall.
 *
 * Uma opção só: R$ 9,90 por mês, sem teste gratuito (resposta da 25.1, em
 * 14/09/2026). O handoff desenha duas linhas, mensal e anual; com plano único, a
 * segunda linha viraria uma escolha falsa.
 *
 * O preço exibido vem da LOJA, não deste código. É ela que sabe a moeda, o
 * locale e o valor vigente da conta de quem está comprando.
 *
 * **O app não concede Pro.** Comprar no StoreKit não libera nada: o que libera é
 * `assinaturas` virar `pro`, e quem escreve lá é o servidor, depois de validar a
 * assinatura da notificação da loja. Enquanto isso, a tela mostra "Estamos
 * confirmando sua assinatura" — e, se demorar demais, orienta a restaurar em vez
 * de deixar um spinner girando (spec 12.3).
 *
 * Implementa: 8.11, inventário 10.25 e a copy de 15.7.
 */
export default function PaywallScreen() {
  const colors = useColors();
  const { session } = useSession();
  const plano = useMeuPlano();
  const compra = usePurchases();

  useEffect(() => {
    track({
      nome: eventos.paywallVisto,
      distinctId: session?.user.email ?? null,
      tela: telas.paywall,
      descricao: 'paywall visto',
      propriedades: {
        plano: plano.data?.plano ?? 'free',
        origem: 'meu-plano',
        sms_usados: plano.data?.sms_usados ?? 0,
      },
    });
    // Uma vez por abertura da tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (compra.estado.tipo === 'confirmada') {
      track({
        nome: eventos.paywallComprou,
        distinctId: session?.user.email ?? null,
        tela: telas.paywall,
        descricao: 'assinatura confirmada pelo servidor',
        propriedades: { plano: 'pro' },
      });
    }
  }, [compra.estado.tipo, session]);

  function aoAssinar() {
    if (!compra.conectado) {
      Alert.alert(copyPlano.paywall.indisponivel);
      return;
    }
    track({
      nome: eventos.paywallIniciouCompra,
      distinctId: session?.user.email ?? null,
      tela: telas.paywall,
      descricao: 'iniciou a compra',
      propriedades: { plano: 'free' },
    });
    void compra.comprar();
  }

  async function aoRestaurar() {
    track({
      nome: eventos.paywallRestaurou,
      distinctId: session?.user.email ?? null,
      tela: telas.paywall,
      descricao: 'tentou restaurar compras',
    });
    const resultado = await compra.restaurar();
    // 'demorou' não leva alerta: a própria tela já está mostrando o aviso de
    // espera. Dois avisos ao mesmo tempo, um deles dizendo que não há compra
    // nenhuma, assustaria quem acabou de pagar.
    if (resultado === 'nada') Alert.alert(copyPlano.paywall.nadaARestaurar(LOJA));
  }

  // Confirmada: a tela vira só a confirmação, com o check verde do handoff.
  if (compra.estado.tipo === 'confirmada') {
    return (
      <Screen scroll={false}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: screenMargin * 2,
            gap: spacing.xl,
          }}
        >
          <Icon name="check" color={colors.positive} size={52} />
          <Text variant="title2" style={{ textAlign: 'center' }}>
            {copyPlano.paywall.confirmado}
          </Text>
          <FilledButton
            label={copyPlano.paywall.continuar}
            onPress={() => router.dismissAll()}
          />
        </View>
      </Screen>
    );
  }

  const emAndamento =
    compra.estado.tipo === 'comprando' || compra.estado.tipo === 'confirmando';

  const rodape = (() => {
    if (compra.estado.tipo === 'erro') return compra.estado.mensagem;
    if (compra.estado.tipo === 'demorou') return copyPlano.paywall.demorou;
    if (compra.estado.tipo === 'confirmando') return copyPlano.paywall.processando;
    return undefined;
  })();

  return (
    <Screen>
      <View style={{ paddingHorizontal: screenMargin, marginBottom: spacing.xl }}>
        <TextLink label="‹ Voltar" align="start" onPress={() => router.back()} />
        <Text variant="largeTitle" style={{ marginTop: spacing.sm }}>
          {copyPlano.proTitulo}
        </Text>
        <Text color="secondaryLabel" style={{ marginTop: spacing.sm }}>
          {copyPlano.proCorpo(LOJA)}
        </Text>
      </View>

      <ListGroup
        first
        title={copyPlano.paywall.grupoEscolha}
        footer={rodape}
        footerIsError={compra.estado.tipo === 'erro'}
      >
        <ValueRow
          label={copyPlano.paywall.mensal}
          value={compra.precoExibido}
          valueColor="label"
        />
      </ListGroup>

      <View style={{ marginTop: spacing.xxl }}>
        <FilledButton
          label={copyPlano.paywall.assinar}
          loadingLabel={copyPlano.paywall.processando}
          loading={emAndamento}
          onPress={aoAssinar}
        />
      </View>

      <View style={{ alignItems: 'center', marginTop: spacing.md }}>
        <TextLink
          label={copyPlano.paywall.restaurar}
          disabled={emAndamento}
          onPress={() => void aoRestaurar()}
        />
      </View>

      {/* O aviso que evita a reclamação do dia seguinte (fluxo 9.3). */}
      <Text
        variant="caption"
        color="secondaryLabel"
        style={{
          marginHorizontal: screenMargin,
          marginTop: spacing.lg,
          textAlign: 'center',
        }}
      >
        {copyPlano.paywall.aviso}
      </Text>
    </Screen>
  );
}
