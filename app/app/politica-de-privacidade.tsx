import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen, TextLink, Text } from '@/components/ui';
import { screenMargin, spacing, typography } from '@/theme';
import { POLITICA_DE_PRIVACIDADE } from '@/features/legal/politica-de-privacidade';

/**
 * Tela 28 — Política de privacidade.
 *
 * Texto longo rolável, com o conteúdo literal do app atual.
 *
 * Correção: ela passa a ter entrada em Configurações, além da tela de Login. No
 * app atual só dá para lê-la ANTES de entrar — quem já está dentro não consegue
 * mais consultar a política que aceitou.
 *
 * O título das seções numeradas vira headline; o resto é corpo. O parsing é por
 * forma, não por marcação: o texto original não tem Markdown, são parágrafos
 * separados por linha em branco, e as seções começam com "N. ".
 *
 * Implementa: 8.10, inventário 10.28 e o item 13 da seção 3.
 */
export default function PoliticaDePrivacidadeScreen() {
  const paragrafos = POLITICA_DE_PRIVACIDADE.split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0);

  return (
    <Screen>
      <View style={{ paddingHorizontal: screenMargin, marginBottom: spacing.xl }}>
        <TextLink label="‹ Voltar" onPress={() => router.back()} />
        <Text variant="largeTitle" style={{ marginTop: spacing.sm }}>
          Política de privacidade
        </Text>
      </View>

      <View style={{ paddingHorizontal: screenMargin, gap: spacing.md }}>
        {paragrafos.map((paragrafo, i) => {
          const ehTituloDeSecao = /^\d{1,2}\.\s/.test(paragrafo);
          return (
            <Text
              key={i}
              style={ehTituloDeSecao ? typography.headline : undefined}
              color={ehTituloDeSecao ? 'label' : 'secondaryLabel'}
            >
              {paragrafo}
            </Text>
          );
        })}
      </View>
    </Screen>
  );
}
