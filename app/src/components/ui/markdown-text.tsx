import { Fragment } from 'react';
import { View } from 'react-native';
import { Text } from './text';
import { spacing } from '@/theme';
import type { ColorRole } from '@/theme';

/**
 * Renderizador mínimo de Markdown.
 *
 * O app atual mostra a resposta do Agente Psi com os asteriscos crus na tela —
 * `**Despesa registrada**` em vez de negrito (spec 8.9). Isto resolve isso.
 *
 * Cobre o que o agente de fato devolve: parágrafos, negrito, itálico e lista
 * com marcador. Não cobre tabela, link nem imagem, e não deve: uma biblioteca
 * completa de Markdown, num app que exibe quatro tipos de frase, é dependência
 * cara para resolver problema pequeno — e mais uma superfície para manter viva
 * a cada versão do React.
 *
 * O que não for reconhecido aparece como texto normal. Nunca como asterisco.
 */

type Pedaco = { texto: string; negrito?: boolean; italico?: boolean };

/** Quebra uma linha em pedaços com e sem ênfase. */
function pedacosDaLinha(linha: string): Pedaco[] {
  const pedacos: Pedaco[] = [];
  // Captura **negrito** e *itálico*, nessa ordem — a dupla precisa vir antes.
  const padrao = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let ultimo = 0;

  for (const encontrado of linha.matchAll(padrao)) {
    const inicio = encontrado.index!;
    if (inicio > ultimo) pedacos.push({ texto: linha.slice(ultimo, inicio) });

    const bruto = encontrado[0];
    if (bruto.startsWith('**')) {
      pedacos.push({ texto: bruto.slice(2, -2), negrito: true });
    } else {
      pedacos.push({ texto: bruto.slice(1, -1), italico: true });
    }
    ultimo = inicio + bruto.length;
  }

  if (ultimo < linha.length) pedacos.push({ texto: linha.slice(ultimo) });
  return pedacos.length > 0 ? pedacos : [{ texto: linha }];
}

export function MarkdownText({
  conteudo,
  color = 'label',
}: {
  conteudo: string;
  color?: ColorRole;
}) {
  const linhas = conteudo.split('\n');

  return (
    <View style={{ gap: spacing.sm }}>
      {linhas.map((linha, i) => {
        const aparada = linha.trim();
        if (aparada.length === 0) return null;

        const ehItemDeLista = /^[-*•]\s+/.test(aparada);
        const conteudoDaLinha = ehItemDeLista ? aparada.replace(/^[-*•]\s+/, '') : aparada;

        return (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              gap: ehItemDeLista ? spacing.sm : 0,
              paddingLeft: ehItemDeLista ? spacing.sm : 0,
            }}
          >
            {ehItemDeLista ? <Text color={color}>•</Text> : null}
            <Text color={color} style={{ flex: 1 }}>
              {pedacosDaLinha(conteudoDaLinha).map((pedaco, j) => (
                <Fragment key={j}>
                  <Text
                    color={color}
                    style={{
                      fontWeight: pedaco.negrito ? '600' : '400',
                      fontStyle: pedaco.italico ? 'italic' : 'normal',
                    }}
                  >
                    {pedaco.texto}
                  </Text>
                </Fragment>
              ))}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
