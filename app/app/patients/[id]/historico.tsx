import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Screen,
  ListGroup,
  RowSeparator,
  NavigationRow,
  EmptyState,
  SkeletonGroup,
  TextLink,
  Text,
} from '@/components/ui';
import { screenMargin, spacing } from '@/theme';
import { formatarDinheiro, formatarData } from '@/lib/format';
import {
  useHistoricoDeSessoes,
  useHistoricoDePagamentos,
  useHistoricoDePrecos,
} from '@/features/patients/use-patients';
import { copyPacientes } from '@/features/patients/copy';

/**
 * Histórico do paciente — sessões, pagamentos ou preços.
 *
 * Uma tela para os três, escolhida pelo parâmetro `tipo`. São três listas com a
 * mesma forma: data à esquerda, valor ou estado à direita, e toque abrindo o
 * detalhe. Três telas idênticas seriam três lugares para a mesma correção.
 *
 * Cada lista é ordenada pela MESMA coluna que exibe — ver os comentários em
 * use-patients. O app atual ordena por `criado_em` e exibe `data_competencia`,
 * o que embaralha a ordem de qualquer lançamento feito com atraso.
 *
 * Implementa: 8.4 e o grupo HISTÓRICO da tela 11.
 */
type Tipo = 'sessoes' | 'pagamentos' | 'precos';

export default function HistoricoScreen() {
  const { id, tipo } = useLocalSearchParams<{ id: string; tipo: Tipo }>();

  const sessoes = useHistoricoDeSessoes(tipo === 'sessoes' ? id : '');
  const pagamentos = useHistoricoDePagamentos(tipo === 'pagamentos' ? id : '');
  const precos = useHistoricoDePrecos(tipo === 'precos' ? id : '');

  const consulta =
    tipo === 'sessoes' ? sessoes : tipo === 'pagamentos' ? pagamentos : precos;

  const titulo =
    tipo === 'sessoes'
      ? copyPacientes.detalhe.sessoes
      : tipo === 'pagamentos'
        ? copyPacientes.detalhe.pagamentos
        : copyPacientes.detalhe.precos;

  return (
    <Screen>
      <View style={{ paddingHorizontal: screenMargin, marginBottom: spacing.xxl }}>
        <TextLink label="‹ Voltar" variant="body" onPress={() => router.back()} />
        <Text variant="largeTitle" style={{ marginTop: spacing.sm }}>
          {titulo}
        </Text>
      </View>

      {consulta.isPending ? <SkeletonGroup rows={5} /> : null}

      {!consulta.isPending && (consulta.data ?? []).length === 0 ? (
        <EmptyState
          icon={tipo === 'precos' ? 'price' : tipo === 'pagamentos' ? 'payment' : 'session'}
          title={
            tipo === 'sessoes'
              ? copyPacientes.detalhe.semSessoes
              : tipo === 'pagamentos'
                ? copyPacientes.detalhe.semPagamentos
                : 'Nenhum preço registrado ainda.'
          }
        />
      ) : null}

      {tipo === 'sessoes' && (sessoes.data ?? []).length > 0 ? (
        <ListGroup first>
          {sessoes.data!.map((s, i) => (
            <View key={s.id}>
              {i > 0 ? <RowSeparator /> : null}
              <NavigationRow
                label={formatarData(s.ocorreu_em_dia)}
                value={s.pagamento ?? '—'}
                onPress={() => router.push(`/sessions/${s.id}`)}
              />
            </View>
          ))}
        </ListGroup>
      ) : null}

      {tipo === 'pagamentos' && (pagamentos.data ?? []).length > 0 ? (
        <ListGroup first>
          {pagamentos.data!.map((p, i) => (
            <View key={p.id}>
              {i > 0 ? <RowSeparator /> : null}
              <NavigationRow
                label={formatarData(p.data_competencia)}
                value={formatarDinheiro(p.valor_pagamento)}
                onPress={() => router.push(`/payments/${p.id}`)}
              />
            </View>
          ))}
        </ListGroup>
      ) : null}

      {tipo === 'precos' && (precos.data ?? []).length > 0 ? (
        <ListGroup
          first
          // Preço é append-only e não tem tela de detalhe: a linha não navega.
          footer="O preço não é editado: cada atualização cria um registro novo, vigente a partir da data em que foi feita."
        >
          {precos.data!.map((p, i) => (
            <View key={p.id}>
              {i > 0 ? <RowSeparator /> : null}
              <View style={{ paddingHorizontal: screenMargin, paddingVertical: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text tabular>{formatarData(p.vigencia_desde)}</Text>
                  <Text color="secondaryLabel" tabular>
                    {formatarDinheiro(p.preco)}
                  </Text>
                </View>
                {p.observacoes ? (
                  <Text variant="subheadline" color="secondaryLabel" style={{ marginTop: 2 }}>
                    {p.observacoes}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </ListGroup>
      ) : null}
    </Screen>
  );
}
