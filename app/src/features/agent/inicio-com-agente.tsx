import { useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionRow, Icon, ListGroup, RowSeparator, Text, TextLink } from '@/components/ui';
import {
  useColors,
  larguraMaximaDeConteudo,
  radius,
  screenMargin,
  size,
  spacing,
  typography,
} from '@/theme';
import { useAgente } from './use-agente';
import { copyAgente } from './copy';

/**
 * Início com o agente — a interface decidida em 02/11/2026
 * (docs/agente-plano.md, "Interface").
 *
 * O agente É o Início. Dois estados:
 * - ao abrir: o campo no topo, as sugestões tocáveis e o aviso de SMS;
 * - depois da primeira pergunta: o Início vira a conversa, e o campo desce
 *   para o rodapé, como em qualquer app de mensagens.
 *
 * Só aparece com o sinalizador `agente` ligado; desligado, o Início mostra o
 * resumo de sempre. Quem decide é a tela `(tabs)/index.tsx`.
 *
 * Teclado: no iOS o KeyboardAvoidingView empurra o campo para cima. No Android
 * não precisa — a janela já se redimensiona sozinha com o teclado (modo
 * `resize`, o padrão do Expo), e somar os dois faria o campo pular em dobro.
 *
 * Recebe: `aviso`, o aviso de limite de SMS que a tela já monta.
 */
export function InicioComAgente({ aviso }: { aviso: ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { mensagens, enviar, novaConversa, pensando, erro } = useAgente();
  const [entrada, setEntrada] = useState('');
  const rolagem = useRef<ScrollView>(null);

  const conversaVazia = mensagens.length === 0;

  function mandar(texto: string) {
    if (texto.trim().length === 0 || pensando) return;
    // O campo esvazia ao enviar; a pergunta aparece na conversa.
    setEntrada('');
    enviar(texto);
  }

  const campo = (
    <CampoDePergunta
      valor={entrada}
      aoMudar={setEntrada}
      aoEnviar={() => mandar(entrada)}
      placeholder={conversaVazia ? copyAgente.placeholder : copyAgente.placeholderContinuar}
      pensando={pensando}
    />
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[colunaCentral, { flex: 1 }]}>
        <View
          style={{
            paddingTop: insets.top + spacing.lg,
            paddingHorizontal: screenMargin,
            marginBottom: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text variant="largeTitle">Agenda Psi</Text>
          {!conversaVazia ? (
            <TextLink label={copyAgente.novaConversa} onPress={novaConversa} />
          ) : null}
        </View>

        {conversaVazia ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.lg }}
            keyboardShouldPersistTaps="handled"
          >
            {campo}
            {aviso}
            <ListGroup first title={copyAgente.grupoSugestoes}>
              {copyAgente.sugestoes.map((sugestao, i) => (
                <View key={sugestao}>
                  {i > 0 ? <RowSeparator /> : null}
                  <ActionRow label={sugestao} onPress={() => mandar(sugestao)} />
                </View>
              ))}
            </ListGroup>
          </ScrollView>
        ) : (
          <>
            <ScrollView
              ref={rolagem}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: spacing.lg, gap: spacing.md }}
              // Cada mensagem nova empurra a conversa para o fim, como no
              // Mensagens.
              onContentSizeChange={() => rolagem.current?.scrollToEnd({ animated: true })}
              keyboardShouldPersistTaps="handled"
            >
              {mensagens.map((m) => (
                <Balao key={m.id} daPessoa={m.papel === 'usuario'} texto={m.texto} />
              ))}
              {pensando ? <Balao daPessoa={false} texto={copyAgente.pensando} discreto /> : null}
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
            <View style={{ paddingVertical: spacing.sm }}>{campo}</View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * Balão de mensagem, no padrão do Mensagens: o da pessoa à direita em azul com
 * texto branco, o do agente à esquerda na cor de preenchimento. Junto do botão
 * preenchido, é a única exceção à regra de não usar azul como fundo de bloco
 * (handoff, "Cor").
 *
 * `discreto` deixa o texto em cinza — usado no "Consultando…".
 */
function Balao({
  daPessoa,
  texto,
  discreto = false,
}: {
  daPessoa: boolean;
  texto: string;
  discreto?: boolean;
}) {
  const colors = useColors();

  return (
    <View
      style={{
        marginHorizontal: screenMargin,
        alignSelf: daPessoa ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        backgroundColor: daPessoa ? colors.accent : colors.controlFill,
        borderRadius: radius.chatBubble,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      <Text
        // A resposta pode ser copiada — um valor, um nome — para colar em
        // outro lugar.
        selectable
        color={discreto ? 'secondaryLabel' : 'label'}
        style={daPessoa ? { color: colors.onAccent } : undefined}
      >
        {texto}
      </Text>
    </View>
  );
}

/**
 * O campo de pergunta com o botão de enviar.
 *
 * Desabilita enquanto o agente pensa: duas perguntas cruzadas trocariam a
 * ordem das respostas. O botão tem área de toque de 44pt (regra do CLAUDE.md).
 */
function CampoDePergunta({
  valor,
  aoMudar,
  aoEnviar,
  placeholder,
  pensando,
}: {
  valor: string;
  aoMudar: (texto: string) => void;
  aoEnviar: () => void;
  placeholder: string;
  pensando: boolean;
}) {
  const colors = useColors();
  const podeEnviar = valor.trim().length > 0 && !pensando;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: spacing.xs,
        paddingLeft: screenMargin,
        paddingRight: screenMargin - spacing.sm,
      }}
    >
      <View
        style={{
          flex: 1,
          minHeight: size.minTouchTarget,
          maxHeight: 120,
          borderRadius: radius.chatBubble,
          backgroundColor: colors.listSurface,
          paddingHorizontal: spacing.md,
          justifyContent: 'center',
        }}
      >
        <TextInput
          value={valor}
          onChangeText={aoMudar}
          placeholder={placeholder}
          placeholderTextColor={colors.secondaryLabel}
          multiline
          editable={!pensando}
          // Sem autocorreção: ela troca nome de paciente por palavra do
          // dicionário ("Erasmo" vira outra coisa) no meio da digitação, e o
          // agente busca pelo nome que chegou.
          autoCorrect={false}
          spellCheck={false}
          // Enter envia no teclado de hardware e no "enviar" do teclado do
          // Android; o multiline continua quebrando linha sozinho no texto longo.
          submitBehavior="submit"
          returnKeyType="send"
          onSubmitEditing={aoEnviar}
          accessibilityLabel={placeholder}
          style={[typography.body, { color: colors.label as string, paddingVertical: spacing.sm }]}
        />
      </View>

      <Pressable
        onPress={aoEnviar}
        disabled={!podeEnviar}
        accessibilityRole="button"
        accessibilityLabel={copyAgente.enviar}
        accessibilityState={{ disabled: !podeEnviar }}
        style={{
          width: size.minTouchTarget,
          height: size.minTouchTarget,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: podeEnviar ? 1 : 0.4,
        }}
      >
        <Icon name="send" color={colors.accent} size={30} />
      </Pressable>
    </View>
  );
}

/** Mesma coluna central do `Screen`: no iPad o conteúdo para em 700pt. */
const colunaCentral = {
  width: '100%',
  maxWidth: larguraMaximaDeConteudo,
  alignSelf: 'center',
} as const;
