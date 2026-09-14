import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ListGroup,
  RowSeparator,
  ActionRow,
  Icon,
  MarkdownText,
  TextLink,
  Text,
} from '@/components/ui';
import { useColors, radius, screenMargin, size, spacing, typography } from '@/theme';
import { usePerguntarAoAgente, type Mensagem } from '@/features/agent/use-agent';
import { copyAgente } from '@/features/agent/copy';

/**
 * Tela 29 — Agente Psi.
 *
 * No app atual esta tela é ÓRFÃ: existe em `/Agente`, nenhuma outra tela navega
 * para ela, e ela não tem nem botão de voltar (defeito 11.9.16). Aqui ela tem
 * entrada no cabeçalho da Home e saída de volta para o Início.
 *
 * Vira conversa com histórico da sessão. Hoje é pergunta única, e a resposta
 * anterior some ao enviar a próxima — o que torna impossível conferir o que foi
 * registrado.
 *
 * A resposta é renderizada como Markdown; hoje sai com os asteriscos crus.
 *
 * As bolhas seguem o padrão do Messages: a da usuária à direita em azul com
 * texto branco, a do agente à esquerda na cor de preenchimento. É a única
 * exceção, junto do botão preenchido, à regra de nunca usar azul como fundo de
 * bloco grande (handoff, "Cor").
 *
 * Implementa: 8.9, inventário 10.29 e a copy de 15.8.
 */
export default function AgentePsiScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const perguntar = usePerguntarAoAgente();
  const rolagem = useRef<ScrollView>(null);

  const [entrada, setEntrada] = useState('');
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const conversaVazia = mensagens.length === 0;

  function enviar(texto: string) {
    const conteudo = texto.trim();
    if (conteudo.length === 0 || perguntar.isPending) return;

    setErro(null);
    // O campo é limpo ao enviar, que o app atual não faz.
    setEntrada('');
    setMensagens((anteriores) => [
      ...anteriores,
      { id: `u-${Date.now()}`, autor: 'usuaria', texto: conteudo },
    ]);

    perguntar.mutate(conteudo, {
      onSuccess: (resposta) => {
        setMensagens((anteriores) => [
          ...anteriores,
          { id: `a-${Date.now()}`, autor: 'agente', texto: resposta },
        ]);
      },
      // Falha de rede mantém a conversa anterior na tela (critério de 8.9).
      onError: (e) => setErro(e instanceof Error ? e.message : copyAgente.erro),
    });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: screenMargin }}>
        <TextLink label={copyAgente.voltar} align="start" onPress={() => router.back()} />
        <Text variant="largeTitle" style={{ marginTop: spacing.sm }}>
          {copyAgente.titulo}
        </Text>
        <Text variant="footnote" color="secondaryLabel" style={{ marginTop: spacing.xs }}>
          {copyAgente.instrucao}
        </Text>
      </View>

      <ScrollView
        ref={rolagem}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: spacing.lg, gap: spacing.md }}
        onContentSizeChange={() => rolagem.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {conversaVazia ? (
          <ListGroup first title={copyAgente.grupoExemplos}>
            {copyAgente.exemplos.map((exemplo, i) => (
              <View key={exemplo}>
                {i > 0 ? <RowSeparator /> : null}
                <ActionRow label={exemplo} onPress={() => enviar(exemplo)} />
              </View>
            ))}
          </ListGroup>
        ) : null}

        {mensagens.map((mensagem) => {
          const daUsuaria = mensagem.autor === 'usuaria';
          return (
            <View
              key={mensagem.id}
              style={{
                marginHorizontal: screenMargin,
                alignSelf: daUsuaria ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                backgroundColor: daUsuaria ? colors.accent : colors.controlFill,
                borderRadius: radius.chatBubble,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}
            >
              {daUsuaria ? (
                <Text style={{ color: colors.onAccent }}>{mensagem.texto}</Text>
              ) : (
                <MarkdownText conteudo={mensagem.texto} />
              )}
            </View>
          );
        })}

        {perguntar.isPending ? (
          <View
            style={{
              marginHorizontal: screenMargin,
              alignSelf: 'flex-start',
              backgroundColor: colors.controlFill,
              borderRadius: radius.chatBubble,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            }}
          >
            <Text color="secondaryLabel">{copyAgente.pensando}</Text>
          </View>
        ) : null}

        {erro ? (
          <Text
            variant="footnote"
            color="destructive"
            style={{ marginHorizontal: screenMargin }}
          >
            {erro}
          </Text>
        ) : null}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: spacing.sm,
          paddingHorizontal: screenMargin,
          paddingBottom: insets.bottom + spacing.md,
          paddingTop: spacing.sm,
        }}
      >
        <View
          style={{
            flex: 1,
            minHeight: size.searchField,
            maxHeight: 120,
            borderRadius: radius.chatBubble,
            backgroundColor: colors.controlFill,
            paddingHorizontal: spacing.md,
            justifyContent: 'center',
          }}
        >
          <TextInput
            value={entrada}
            onChangeText={setEntrada}
            placeholder={copyAgente.placeholder}
            placeholderTextColor={colors.secondaryLabel}
            multiline
            editable={!perguntar.isPending}
            accessibilityLabel={copyAgente.placeholder}
            style={[
              typography.body,
              { color: colors.label as string, paddingVertical: spacing.sm },
            ]}
          />
        </View>

        <Pressable
          onPress={() => enviar(entrada)}
          disabled={entrada.trim().length === 0 || perguntar.isPending}
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          style={{
            width: size.minTouchTarget,
            height: size.minTouchTarget,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: entrada.trim().length === 0 || perguntar.isPending ? 0.4 : 1,
          }}
        >
          <Icon name="send" color={colors.accent} size={28} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
