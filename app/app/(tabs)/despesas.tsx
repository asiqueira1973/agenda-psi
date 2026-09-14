import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import {
  Screen,
  ListGroup,
  RowSeparator,
  ActionRow,
  EmptyState,
  ErrorState,
  SkeletonGroup,
  Icon,
  Text,
} from '@/components/ui';
import { useColors, screenMargin, size, spacing } from '@/theme';
import { formatarDinheiro, formatarData } from '@/lib/format';
import { useDespesasRecentes } from '@/features/expenses/use-expenses';
import { copyDespesas } from '@/features/expenses/copy';

/**
 * Tela 18 — Despesas.
 *
 * O estado vazio desta tela é, nas palavras do handoff, "o mais importante do
 * app". Não é enfeite: são 98 despesas em toda a base contra 451 pagamentos, e
 * a métrica 2 da seção 21 quer levar a adesão de 15% para 40%. A tela não tem
 * problema de usabilidade — tem problema de descoberta, e o texto é o que
 * resolve isso.
 *
 * Correções em relação ao app atual:
 * - a lista vem da mais nova para a mais antiga, e não o contrário;
 * - despesa sem descrição mostra o nome do tipo, em vez de quebrar.
 *
 * Implementa: 8.7, inventário 10.18 e a copy de 15.6.
 */
export default function DespesasScreen() {
  const colors = useColors();
  const consulta = useDespesasRecentes();
  const despesas = consulta.data ?? [];
  const vazia = !consulta.isPending && despesas.length === 0;

  return (
    <Screen>
      <View
        style={{
          paddingHorizontal: screenMargin,
          marginBottom: spacing.xxl,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text variant="largeTitle">{copyDespesas.titulo}</Text>
        <Pressable
          onPress={() => router.push('/expenses/nova')}
          accessibilityRole="button"
          accessibilityLabel={copyDespesas.registrar}
          hitSlop={12}
        >
          <Icon name="add" color={colors.accent} size={24} />
        </Pressable>
      </View>

      {consulta.isPending ? <SkeletonGroup rows={5} /> : null}

      {consulta.isError ? <ErrorState onRetry={() => void consulta.refetch()} /> : null}

      {vazia && !consulta.isError ? (
        <EmptyState
          strong
          icon="receipt"
          title={copyDespesas.vazioTitulo}
          body={copyDespesas.vazioCorpo}
          actionLabel={copyDespesas.vazioBotao}
          onAction={() => router.push('/expenses/nova')}
        />
      ) : null}

      {!vazia && !consulta.isPending && !consulta.isError ? (
        <>
          <ListGroup first>
            <ActionRow
              label={copyDespesas.registrar}
              icon="add"
              onPress={() => router.push('/expenses/nova')}
            />
          </ListGroup>

          <ListGroup title={copyDespesas.cabecalhoDaLista}>
            {despesas.map((despesa, i) => (
              <View key={despesa.id}>
                {i > 0 ? <RowSeparator /> : null}
                <Pressable
                  onPress={() => router.push(`/expenses/${despesa.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={despesa.descricao ?? despesa.tipo_despesa_nome ?? 'Despesa'}
                  style={({ pressed }) => ({
                    minHeight: size.listRowTwoLines,
                    paddingHorizontal: screenMargin,
                    paddingVertical: spacing.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    backgroundColor: pressed ? colors.controlFill : 'transparent',
                  })}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    {/* Descrição nula mostra o tipo. O app atual quebra aqui. */}
                    <Text numberOfLines={1}>
                      {despesa.descricao?.trim() || despesa.tipo_despesa_nome || 'Despesa'}
                    </Text>
                    <Text variant="footnote" color="secondaryLabel" numberOfLines={1} tabular>
                      {[despesa.tipo_despesa_nome, formatarData(despesa.data_referencia)]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  {/* Despesa é sempre vermelha: é um dos quatro usos da cor. */}
                  <Text color="destructive" tabular>
                    {formatarDinheiro(despesa.valor_despesa)}
                  </Text>
                </Pressable>
              </View>
            ))}
          </ListGroup>
        </>
      ) : null}
    </Screen>
  );
}
