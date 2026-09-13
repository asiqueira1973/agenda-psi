import { Platform, View, type ViewProps } from 'react-native';
import { Text } from './text';
import {
  useColors,
  radius,
  screenMargin,
  groupSpacing,
  size,
  separatorInset,
  groupTitle,
} from '@/theme';

/**
 * Grupo de lista — o tijolo do app inteiro.
 *
 * No iOS é a *inset grouped list*: um container arredondado por grupo, com
 * margem lateral de 16, o título FORA dele, acima, em footnote maiúsculo na cor
 * secundária, e o rodapé fora, abaixo. Sem borda e sem sombra.
 *
 * No Android o mesmo grupo perde o container: largura total, sem raio, e o
 * título vira 14pt medium na cor de destaque, sem maiúsculas (handoff,
 * "Android"). A hierarquia e o espaçamento de 4pt são os mesmos nas duas.
 *
 * O erro que este componente existe para evitar está escrito no handoff: montar
 * tudo como cartão branco flutuando sobre cinza, com título em negrito dentro e
 * padding generoso. Isso é vocabulário de dashboard web, não de iOS.
 *
 * Implementa: "Inset grouped list" do handoff e seção 16.5 do spec.
 */

type Props = ViewProps & {
  /** Título do grupo. Vai acima do container, fora dele. */
  title?: string;
  /** Rodapé do grupo. Explicação ou mensagem de erro, abaixo do container. */
  footer?: string;
  /** Pinta o rodapé de vermelho. É assim que erro de validação aparece. */
  footerIsError?: boolean;
  /** Remove o espaço acima. Usado no primeiro grupo logo abaixo do título. */
  first?: boolean;
};

export function ListGroup({
  title,
  footer,
  footerIsError = false,
  first = false,
  children,
  style,
  ...rest
}: Props) {
  const colors = useColors();
  const isIOS = Platform.OS === 'ios';

  return (
    <View style={[{ marginTop: first ? 0 : groupSpacing.betweenGroups }, style]} {...rest}>
      {title ? (
        <Text
          style={[
            groupTitle,
            {
              marginHorizontal: screenMargin,
              marginBottom: groupSpacing.titleToContainer,
              color: isIOS ? colors.secondaryLabel : colors.accent,
            },
          ]}
        >
          {/* Maiúsculas são do iOS; no Android o título fica como foi escrito. */}
          {isIOS ? title.toLocaleUpperCase('pt-BR') : title}
        </Text>
      ) : null}

      <View
        style={{
          backgroundColor: colors.listSurface,
          borderRadius: isIOS ? radius.listGroup : 0,
          marginHorizontal: isIOS ? screenMargin : 0,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>

      {footer ? (
        <Text
          variant="footnote"
          color={footerIsError ? 'destructive' : 'secondaryLabel'}
          style={{
            marginHorizontal: screenMargin,
            marginTop: groupSpacing.titleToContainer,
          }}
        >
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Hairline entre duas linhas do grupo.
 *
 * O inset começa onde o texto começa, não na borda do container — 16pt na linha
 * comum e 49pt quando há ícone à esquerda. É esse detalhe que faz a lista
 * parecer nativa; sangrar o separador até a borda é o erro mais comum.
 */
export function RowSeparator({ hasIcon = false }: { hasIcon?: boolean }) {
  const colors = useColors();
  const isIOS = Platform.OS === 'ios';

  return (
    <View
      style={{
        height: isIOS ? size.hairline : 1,
        backgroundColor: colors.separator,
        marginLeft: hasIcon
          ? isIOS
            ? separatorInset.withIcon
            : 56
          : separatorInset.withoutIcon,
      }}
    />
  );
}
