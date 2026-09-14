import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Screen,
  ListGroup,
  RowSeparator,
  ActionRow,
  NavigationRow,
  ValueRow,
  ErrorState,
  SkeletonGroup,
  TextLink,
  Text,
} from '@/components/ui';
import { screenMargin, spacing } from '@/theme';
import { formatarDinheiro, formatarData, formatarInteiro, formatarTelefone } from '@/lib/format';
import {
  usePaciente,
  useExcluirPaciente,
  useHistoricoDeSessoes,
  useHistoricoDePagamentos,
  useHistoricoDePrecos,
} from '@/features/patients/use-patients';
import { copyPacientes } from '@/features/patients/copy';
import { copyAuth } from '@/features/auth/copy';

/**
 * Tela 11 — Detalhe do paciente.
 *
 * As duas primeiras linhas da tela são "Registrar sessão" e "Registrar
 * pagamento". Isso não é escolha estética: é o caminho crítico do fluxo 9.2, o
 * momento em que a psicóloga está de pé, com cinco minutos entre um paciente e
 * o outro. Qualquer coisa acima dessas duas linhas custa um toque a mais na
 * ação mais frequente do app.
 *
 * Correções em relação ao app atual:
 * - preço e totais vêm de QUERY, não do parâmetro de rota. No app atual eles
 *   chegam pela navegação e nunca recarregam, de modo que atualizar o preço não
 *   muda nada na tela (defeito 11.9.11);
 * - atualizar preço abre sempre como folha modal — hoje o cartão abre diálogo e
 *   o botão abre folha, para o mesmo componente;
 * - os históricos são ordenados pela mesma coluna que exibem.
 *
 * Nenhum número acima de 17pt aqui: o 34pt existe só no cartão da Home
 * (handoff, "iOS é lista, não cartão").
 *
 * Implementa: 8.4, inventário 10.11 e os estados 11 e 11a do handoff.
 */
export default function DetalheDoPacienteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const paciente = usePaciente(id);
  const sessoes = useHistoricoDeSessoes(id);
  const pagamentos = useHistoricoDePagamentos(id);
  const precos = useHistoricoDePrecos(id);
  const excluir = useExcluirPaciente();

  if (paciente.isPending) {
    return (
      <Screen>
        <SkeletonGroup rows={2} />
        <SkeletonGroup rows={4} title={copyPacientes.detalhe.grupoDados} />
        <SkeletonGroup rows={5} title={copyPacientes.detalhe.grupoAtendimento} />
      </Screen>
    );
  }

  if (paciente.isError || !paciente.data) {
    return (
      <Screen scroll={false}>
        <ErrorState onRetry={() => void paciente.refetch()} />
      </Screen>
    );
  }

  const p = paciente.data;
  const nome = p.nome_completo ?? 'Paciente';
  const totalDeSessoes = sessoes.data?.length ?? 0;
  const totalDePagamentos = pagamentos.data?.length ?? 0;
  const totalDePrecos = precos.data?.length ?? 0;

  function confirmarExclusao() {
    Alert.alert(copyPacientes.excluirTitulo(nome), copyPacientes.excluirCorpo, [
      { text: copyPacientes.excluirCancelar, style: 'cancel' },
      {
        text: copyPacientes.excluirConfirmar,
        style: 'destructive',
        onPress: () =>
          excluir.mutate(id, {
            onSuccess: () => router.replace('/(tabs)/pacientes'),
            onError: () => Alert.alert(copyAuth.erros.falhaGenerica),
          }),
      },
    ]);
  }

  return (
    <Screen>
      <View style={{ paddingHorizontal: screenMargin, marginBottom: spacing.xxl }}>
        <TextLink label="‹ Pacientes" variant="body" align="start" onPress={() => router.back()} />
        <Text variant="largeTitle" style={{ marginTop: spacing.sm }}>
          {nome}
        </Text>
      </View>

      {/* As duas ações do caminho crítico, antes de qualquer informação. */}
      <ListGroup first>
        <ActionRow
          label={copyPacientes.detalhe.registrarSessao}
          icon="session"
          onPress={() => router.push(`/sessions/nova?pacienteId=${id}`)}
        />
        <RowSeparator hasIcon />
        <ActionRow
          label={copyPacientes.detalhe.registrarPagamento}
          icon="payment"
          onPress={() => router.push(`/payments/novo?pacienteId=${id}`)}
        />
      </ListGroup>

      <ListGroup title={copyPacientes.detalhe.grupoDados}>
        <ValueRow
          label={copyPacientes.detalhe.telefone}
          value={formatarTelefone(p.telefone)}
        />
        <RowSeparator />
        <ValueRow label={copyPacientes.detalhe.email} value={p.email ?? '—'} />
        <RowSeparator />
        <ValueRow
          label={copyPacientes.detalhe.primeiraConsulta}
          value={formatarData(p.primeira_consulta)}
        />
        <RowSeparator />
        <NavigationRow
          label={copyPacientes.detalhe.editar}
          onPress={() => router.push(`/patients/${id}/editar`)}
        />
      </ListGroup>

      <ListGroup title={copyPacientes.detalhe.grupoAtendimento}>
        <ValueRow
          label={copyPacientes.detalhe.precoAtual}
          value={formatarDinheiro(p.preco_vigente)}
        />
        <RowSeparator />
        <ValueRow
          label={copyPacientes.detalhe.totalDeSessoes}
          value={formatarInteiro(p.total_sessoes_ate_hoje)}
        />
        <RowSeparator />
        <ValueRow
          label={copyPacientes.detalhe.valorTotalPago}
          value={formatarDinheiro(p.valor_total_pago_ate_hoje)}
        />
        <RowSeparator />
        <ValueRow
          label={copyPacientes.detalhe.sessoesNaoPagas}
          value={formatarInteiro(p.sessoes_nao_pagas)}
        />
        <RowSeparator />
        <ActionRow
          label={copyPacientes.detalhe.atualizarPreco}
          icon="price"
          onPress={() => router.push(`/patients/${id}/preco`)}
        />
      </ListGroup>

      <ListGroup
        title={copyPacientes.detalhe.grupoHistorico}
        // Estado 11a: sem histórico, o grupo vira rodapé explicativo em vez de
        // linhas com zero, que pareceriam erro de carregamento.
        footer={
          totalDeSessoes === 0 && totalDePagamentos === 0
            ? `${copyPacientes.detalhe.semSessoes} ${copyPacientes.detalhe.semPagamentos}`
            : undefined
        }
      >
        <NavigationRow
          label={copyPacientes.detalhe.sessoes}
          value={formatarInteiro(totalDeSessoes)}
          onPress={() => router.push(`/patients/${id}/historico?tipo=sessoes`)}
        />
        <RowSeparator />
        <NavigationRow
          label={copyPacientes.detalhe.pagamentos}
          value={formatarInteiro(totalDePagamentos)}
          onPress={() => router.push(`/patients/${id}/historico?tipo=pagamentos`)}
        />
        <RowSeparator />
        <NavigationRow
          label={copyPacientes.detalhe.precos}
          value={formatarInteiro(totalDePrecos)}
          onPress={() => router.push(`/patients/${id}/historico?tipo=precos`)}
        />
      </ListGroup>

      <ListGroup>
        <ActionRow
          label={copyPacientes.detalhe.excluir}
          icon="delete"
          destructive
          onPress={confirmarExclusao}
        />
      </ListGroup>
    </Screen>
  );
}
