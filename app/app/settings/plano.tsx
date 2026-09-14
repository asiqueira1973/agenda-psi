import { Platform, View } from 'react-native';
import { router } from 'expo-router';
import {
  Screen,
  ListGroup,
  RowSeparator,
  ValueRow,
  ActionRow,
  FilledButton,
  ErrorState,
  SkeletonGroup,
  Text,
} from '@/components/ui';
import { useColors, radius, screenMargin, spacing, typography } from '@/theme';
import { formatarData, formatarInteiro } from '@/lib/format';
import { useMeuPlano } from '@/features/home/use-dashboard';
import { copyPlano, nomeDaLoja } from '@/features/settings/copy-plano';

/**
 * Tela 24 — Meu plano, nas quatro versões do handoff: gratuito com consumo,
 * limite atingido, Pro ativo e fundador.
 *
 * Tudo o que esta tela mostra vem de `v_meu_plano`. O app não conta SMS, não
 * calcula limite e não decide plano (princípio P2 e regra 11.5) — se um número
 * estiver errado aqui, o lugar de consertar é a view.
 *
 * Implementa: 8.11, inventário 10.24 e a copy de 15.7.
 */
export default function MeuPlanoScreen() {
  const colors = useColors();
  const plano = useMeuPlano();
  const loja = nomeDaLoja(Platform.OS);

  if (plano.isPending) {
    return (
      <Screen>
        <SkeletonGroup rows={3} />
      </Screen>
    );
  }

  if (plano.isError || !plano.data) {
    return (
      <Screen scroll={false}>
        <ErrorState onRetry={() => void plano.refetch()} />
      </Screen>
    );
  }

  const p = plano.data;
  const fundador = p.usuario_fundador === true;
  const ilimitado = p.limite_sms === null;
  const limite = p.limite_sms ?? 0;
  const usados = p.sms_usados ?? 0;
  const atingido = p.limite_atingido === true;
  const proporcao = limite > 0 ? Math.min(usados / limite, 1) : 0;

  return (
    <Screen>
      <View style={{ paddingHorizontal: screenMargin, marginBottom: spacing.xxl }}>
        <Text variant="largeTitle">{copyPlano.titulo}</Text>
      </View>

      {/* Fundador: cortesia vitalícia, sem mensalidade e sem venda (regra 11.6). */}
      {fundador ? (
        <ListGroup first footer={copyPlano.fundador.rodape}>
          <ValueRow label={copyPlano.fundador.plano} value={copyPlano.fundador.rotulo} />
          <RowSeparator />
          <ValueRow
            label={copyPlano.fundador.lembretes}
            value={copyPlano.fundador.ilimitados}
          />
          <RowSeparator />
          <ValueRow
            label={copyPlano.fundador.mensalidade}
            value={copyPlano.fundador.valor}
          />
        </ListGroup>
      ) : null}

      {/* Pro pagante: nada a vender, só o que está contratado. */}
      {!fundador && ilimitado ? (
        <ListGroup first footer={copyPlano.proAtivo.rodape(loja)}>
          <ValueRow label={copyPlano.proAtivo.plano} value={copyPlano.proTitulo} />
          <RowSeparator />
          <ValueRow
            label={copyPlano.proAtivo.lembretes}
            value={copyPlano.proAtivo.ilimitados}
          />
          {p.expira_em ? (
            <>
              <RowSeparator />
              <ValueRow
                label={copyPlano.proAtivo.proximaCobranca}
                value={formatarData(p.expira_em)}
              />
            </>
          ) : null}
        </ListGroup>
      ) : null}

      {/* Gratuito: consumo, barra e caminho para o Pro. */}
      {!fundador && !ilimitado ? (
        <>
          <View
            style={{
              marginHorizontal: screenMargin,
              backgroundColor: colors.listSurface,
              borderRadius: radius.card,
              padding: screenMargin,
              gap: spacing.md,
            }}
          >
            <Text variant="headline">
              {atingido
                ? copyPlano.limiteAtingidoTitulo(primeiroDiaDoProximoMes())
                : copyPlano.planoFreeSemConsumo(limite)}
            </Text>

            {/* Barra de 4pt: azul enquanto há folga, vermelha quando estourou. */}
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.controlFill,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${Math.round(proporcao * 100)}%`,
                  height: 4,
                  backgroundColor: atingido ? colors.destructive : colors.accent,
                }}
              />
            </View>

            <Text color="secondaryLabel" tabular>
              {atingido
                ? copyPlano.limiteAtingidoCorpo(limite)
                : copyPlano.consumo(usados, limite)}
            </Text>
          </View>

          <ListGroup title={copyPlano.grupoBeneficios}>
            {copyPlano.beneficios.map((beneficio, i) => (
              <View key={beneficio}>
                {i > 0 ? <RowSeparator /> : null}
                <View
                  style={{ paddingHorizontal: screenMargin, paddingVertical: spacing.md }}
                >
                  <Text>{beneficio}</Text>
                </View>
              </View>
            ))}
          </ListGroup>

          <View style={{ marginTop: spacing.xxl }}>
            <FilledButton
              label={copyPlano.verPro}
              onPress={() => router.push('/paywall')}
            />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

/**
 * Data em que os lembretes voltam: o primeiro dia do mês que vem.
 * O contador zera na virada, em Brasília (regra 11.5 e fluxo 9.4).
 */
function primeiroDiaDoProximoMes(): string {
  const agora = new Date();
  const proximo = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  const dia = String(proximo.getDate()).padStart(2, '0');
  const mes = String(proximo.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${proximo.getFullYear()}`;
}
