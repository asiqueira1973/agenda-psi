import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { router } from 'expo-router';
import {
  Screen,
  ListGroup,
  RowSeparator,
  FilledButton,
  TextLink,
  Icon,
  Text,
} from '@/components/ui';
import { useColors, screenMargin, size, spacing, typography } from '@/theme';
import { copyPlano, nomeDaLoja } from '@/features/settings/copy-plano';
import { track, eventos, telas } from '@/lib/analytics';
import { useSession } from '@/features/auth/session-provider';
import { useMeuPlano } from '@/features/home/use-dashboard';

/**
 * Tela 25 — Paywall.
 *
 * ⚠️ ESTADO DESTA TELA: a interface está pronta, a compra NÃO está ligada.
 *
 * Faltam duas coisas, e nenhuma delas é código:
 *
 * 1. a resposta da pergunta aberta 25.1 — preço, periodicidade e se há teste
 *    gratuito. Sem ela não há produto para criar no App Store Connect nem no
 *    Play Console, e por isso os preços aqui são o placeholder que o próprio
 *    handoff especifica;
 * 2. as chaves de cliente do RevenueCat (`EXPO_PUBLIC_RC_IOS_KEY` e
 *    `EXPO_PUBLIC_RC_ANDROID_KEY`) e o projeto configurado lá.
 *
 * Enquanto faltarem, o botão de assinar avisa que a assinatura ainda não está
 * disponível, em vez de abrir um fluxo quebrado.
 *
 * O que JÁ está garantido, e é o que mais importa: o app não concede Pro
 * sozinho em hipótese nenhuma. Quem grava plano é a Edge Function `rc-webhook`,
 * e `assinaturas` não tem policy de escrita para ninguém (migration 0002 e
 * máquina 12.1). Um cliente comprometido não vira Pro.
 *
 * O corte de SMS depende ainda da migration 0008, retida até este épico ficar
 * pronto — ver supabase/migrations-pendentes/README.md.
 *
 * Implementa: 8.11, inventário 10.25 e a copy de 15.7.
 */
export default function PaywallScreen() {
  const colors = useColors();
  const { session } = useSession();
  const plano = useMeuPlano();
  const loja = nomeDaLoja(Platform.OS);

  const [periodicidade, setPeriodicidade] = useState<'mensal' | 'anual'>('mensal');

  // Evento de 21: só propriedades não sensíveis.
  useState(() => {
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
    return null;
  });

  function aoAssinar() {
    // Sem produto criado na loja e sem chave do RevenueCat, não há o que abrir.
    Alert.alert(copyPlano.paywall.indisponivel);
  }

  function aoRestaurar() {
    Alert.alert(copyPlano.paywall.nadaARestaurar(loja));
  }

  return (
    <Screen footerSpace>
      <View style={{ paddingHorizontal: screenMargin, marginBottom: spacing.xl }}>
        <TextLink label="‹ Voltar" onPress={() => router.back()} />
        <Text variant="largeTitle" style={{ marginTop: spacing.sm }}>
          {copyPlano.proTitulo}
        </Text>
        <Text color="secondaryLabel" style={{ marginTop: spacing.sm }}>
          {copyPlano.proCorpo(loja)}
        </Text>
      </View>

      <ListGroup first title={copyPlano.paywall.grupoEscolha}>
        <LinhaDePlano
          rotulo={copyPlano.paywall.mensal}
          preco={copyPlano.paywall.precoMensalPlaceholder}
          selecionado={periodicidade === 'mensal'}
          onPress={() => setPeriodicidade('mensal')}
        />
        <RowSeparator />
        <LinhaDePlano
          rotulo={copyPlano.paywall.anual}
          preco={copyPlano.paywall.precoAnualPlaceholder}
          selecionado={periodicidade === 'anual'}
          onPress={() => setPeriodicidade('anual')}
        />
      </ListGroup>

      <View style={{ marginTop: spacing.xxl }}>
        <FilledButton label={copyPlano.paywall.assinar} onPress={aoAssinar} />
      </View>

      <View style={{ alignItems: 'center', marginTop: spacing.md }}>
        <TextLink label={copyPlano.paywall.restaurar} onPress={aoRestaurar} />
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

/** Linha de 56pt com o preço à direita e o check azul na selecionada. */
function LinhaDePlano({
  rotulo,
  preco,
  selecionado,
  onPress,
}: {
  rotulo: string;
  preco: string;
  selecionado: boolean;
  onPress: () => void;
}) {
  const colors = useColors();

  return (
    <View
      onTouchEnd={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: selecionado }}
      accessibilityLabel={`${rotulo}, ${preco}`}
      style={{
        minHeight: size.listRowTwoLines,
        paddingHorizontal: screenMargin,
        paddingVertical: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      <Text style={[typography.body, { flex: 1 }]}>{rotulo}</Text>
      <Text color="secondaryLabel" tabular>
        {preco}
      </Text>
      {selecionado ? <Icon name="check" color={colors.accent} size={20} /> : null}
    </View>
  );
}
