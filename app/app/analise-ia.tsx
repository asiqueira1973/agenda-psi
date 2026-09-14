import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import {
  Screen,
  ListGroup,
  RowSeparator,
  MarkdownText,
  FilledButton,
  TextLink,
  Text,
} from '@/components/ui';
import { useColors, radius, screenMargin, spacing } from '@/theme';
import { useAnaliseFinanceira, type Analise } from '@/features/home/use-analise';

/**
 * Tela 5h — Análise com IA.
 *
 * Quatro grupos: RESUMO, RISCOS, OPORTUNIDADES e AÇÕES PRIORITÁRIAS.
 *
 * Duas correções em relação ao app atual (spec 8.3):
 *
 * - `riscos` e `oportunidades` são EXIBIDOS. Hoje o app extrai os dois campos da
 *   resposta e não mostra nenhum dos dois — o trabalho é feito e jogado fora;
 * - a análise anterior é PRESERVADA em caso de falha. Hoje o resultado é zerado
 *   antes da chamada, então uma falha de rede apaga a análise que estava na
 *   tela e a pessoa fica sem nada.
 *
 * Implementa: 8.3 e os estados 5f, 5g e 5h do handoff.
 */
export default function AnaliseComIaScreen() {
  const colors = useColors();
  const analise = useAnaliseFinanceira();
  // A última análise boa vive aqui, e não no estado da mutação: é isso que a
  // preserva quando a próxima tentativa falha.
  const [ultima, setUltima] = useState<Analise | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    pedirAnalise();
    // Só na montagem: a tela é aberta por uma ação explícita do usuário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pedirAnalise() {
    setErro(null);
    analise.mutate(undefined, {
      onSuccess: (resultado) => setUltima(resultado),
      onError: (e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'),
    });
  }

  const acoes = (ultima?.acoes_prioritarias ?? '')
    .split('\n')
    .map((linha) => linha.replace(/^[-*•]\s*/, '').trim())
    .filter((linha) => linha.length > 0);

  return (
    <Screen>
      <View style={{ paddingHorizontal: screenMargin, marginBottom: spacing.xxl }}>
        <TextLink label="‹ Início" align="start" onPress={() => router.back()} />
        <Text variant="largeTitle" style={{ marginTop: spacing.sm }}>
          Análise com IA
        </Text>
      </View>

      {analise.isPending ? (
        <ListGroup
          first
          footer="Lendo as sessões, os pagamentos e as despesas dos últimos dois meses."
        >
          <View style={{ paddingHorizontal: screenMargin, paddingVertical: spacing.lg, gap: spacing.md }}>
            <Text color="tertiaryLabel">Analisando...</Text>
            {/* Barra de progresso de 4pt, como o estado 5f do handoff. */}
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.controlFill,
                overflow: 'hidden',
              }}
            >
              <View style={{ width: '42%', height: 4, backgroundColor: colors.accent }} />
            </View>
          </View>
        </ListGroup>
      ) : null}

      {erro ? (
        <ListGroup first footer={erro} footerIsError>
          <View style={{ paddingHorizontal: screenMargin, paddingVertical: spacing.lg }}>
            <FilledButton label="Tentar de novo" onPress={pedirAnalise} />
          </View>
        </ListGroup>
      ) : null}

      {ultima ? (
        <>
          <BlocoDeTexto titulo="Resumo" conteudo={ultima.resumo} />
          <BlocoDeTexto titulo="Riscos" conteudo={ultima.riscos} />
          <BlocoDeTexto titulo="Oportunidades" conteudo={ultima.oportunidades} />

          {acoes.length > 0 ? (
            <ListGroup title="Ações prioritárias">
              {acoes.map((acao, i) => (
                <View key={i}>
                  {i > 0 ? <RowSeparator /> : null}
                  <View style={{ paddingHorizontal: screenMargin, paddingVertical: spacing.md }}>
                    <Text>{acao}</Text>
                  </View>
                </View>
              ))}
            </ListGroup>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

/** Um grupo com um bloco de texto em Markdown. */
function BlocoDeTexto({ titulo, conteudo }: { titulo: string; conteudo: string }) {
  if (!conteudo?.trim()) return null;
  return (
    <ListGroup title={titulo}>
      <View style={{ paddingHorizontal: screenMargin, paddingVertical: spacing.md }}>
        <MarkdownText conteudo={conteudo} />
      </View>
    </ListGroup>
  );
}
