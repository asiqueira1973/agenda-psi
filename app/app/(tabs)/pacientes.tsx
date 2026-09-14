import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import {
  Screen,
  ListGroup,
  RowSeparator,
  SearchField,
  SwipeToDelete,
  EmptyState,
  ErrorState,
  SkeletonGroup,
  Icon,
  Text,
} from '@/components/ui';
import { useColors, screenMargin, spacing } from '@/theme';
import {
  usePacientes,
  useExcluirPaciente,
  filtrarPacientes,
  type PacienteCartao,
} from '@/features/patients/use-patients';
import { PatientCell } from '@/features/patients/patient-cell';
import { copyPacientes } from '@/features/patients/copy';
import { copyAuth } from '@/features/auth/copy';

/**
 * Tela 9 — Pacientes.
 *
 * O módulo mais usado do app, e o começo do caminho crítico dos sete toques do
 * fluxo 9.2: Pacientes → busca → detalhe → registrar sessão → registrar
 * pagamento.
 *
 * Correções em relação ao app atual:
 * - exclusão por deslize com confirmação nominal, em vez de um botão "Excluir"
 *   permanente em cima de cada cartão;
 * - estado de carregamento e estado de erro, que hoje não existem (11.9.14);
 * - estado vazio com chamada para ação e estado de busca sem resultado.
 *
 * Implementa: 8.4, inventário 10.9 e os estados 9a, 9b, 9d, 9e e 9f do handoff.
 */
export default function PacientesScreen() {
  const colors = useColors();
  const [busca, setBusca] = useState('');
  const consulta = usePacientes();
  const excluir = useExcluirPaciente();

  const { ativos, inativos, houveBusca, nenhumResultado } = useMemo(() => {
    const todos = consulta.data ?? [];
    const filtrados = filtrarPacientes(todos, busca);
    return {
      ativos: filtrados.filter((p) => p.status !== 'inativo'),
      inativos: filtrados.filter((p) => p.status === 'inativo'),
      houveBusca: busca.trim().length > 0,
      nenhumResultado: filtrados.length === 0,
    };
  }, [consulta.data, busca]);

  function confirmarExclusao(paciente: PacienteCartao) {
    const nome = paciente.nome_completo ?? 'este paciente';
    Alert.alert(copyPacientes.excluirTitulo(nome), copyPacientes.excluirCorpo, [
      { text: copyPacientes.excluirCancelar, style: 'cancel' },
      {
        text: copyPacientes.excluirConfirmar,
        style: 'destructive',
        onPress: () => {
          excluir.mutate(paciente.paciente_id!, {
            // Falha de escrita mostra erro. Nunca sucesso silencioso (P3).
            onError: () => Alert.alert(copyAuth.erros.falhaGenerica),
          });
        },
      },
    ]);
  }

  const semNenhumPaciente = !consulta.isPending && (consulta.data ?? []).length === 0;

  return (
    <Screen>
      <View
        style={{
          paddingHorizontal: screenMargin,
          marginBottom: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text variant="largeTitle">{copyPacientes.titulo}</Text>
        <Pressable
          onPress={() => router.push('/patients/novo')}
          accessibilityRole="button"
          accessibilityLabel="Cadastrar paciente"
          hitSlop={12}
        >
          <Icon name="add" color={colors.accent} size={24} />
        </Pressable>
      </View>

      {!semNenhumPaciente ? (
        <SearchField
          value={busca}
          onChangeText={setBusca}
          placeholder={copyPacientes.buscar}
          onCancel={() => setBusca('')}
        />
      ) : null}

      {consulta.isPending ? <SkeletonGroup rows={5} /> : null}

      {consulta.isError ? <ErrorState onRetry={() => void consulta.refetch()} /> : null}

      {semNenhumPaciente && !consulta.isError ? (
        <EmptyState
          icon="patients"
          title={copyPacientes.vazioTitulo}
          body={copyPacientes.vazioCorpo}
          actionLabel={copyPacientes.vazioBotao}
          onAction={() => router.push('/patients/novo')}
        />
      ) : null}

      {!consulta.isPending && !consulta.isError && !semNenhumPaciente && nenhumResultado ? (
        <EmptyState
          icon="search"
          title={copyPacientes.buscaSemResultado(busca.trim())}
          body={copyPacientes.buscaSemResultadoCorpo}
          actionLabel={copyPacientes.vazioBotao}
          onAction={() => router.push('/patients/novo')}
        />
      ) : null}

      {ativos.length > 0 ? (
        <ListGroup title={copyPacientes.grupoAtivos(ativos.length)}>
          {ativos.map((paciente, i) => (
            <View key={paciente.paciente_id}>
              {i > 0 ? <RowSeparator /> : null}
              <SwipeToDelete
                onDelete={() => confirmarExclusao(paciente)}
                accessibilityLabel={`Excluir ${paciente.nome_completo}`}
              >
                <PatientCell
                  paciente={paciente}
                  onPress={() => router.push(`/patients/${paciente.paciente_id}`)}
                />
              </SwipeToDelete>
            </View>
          ))}
        </ListGroup>
      ) : null}

      {inativos.length > 0 ? (
        <ListGroup title={copyPacientes.grupoInativos}>
          {inativos.map((paciente, i) => (
            <View key={paciente.paciente_id}>
              {i > 0 ? <RowSeparator /> : null}
              <SwipeToDelete
                onDelete={() => confirmarExclusao(paciente)}
                accessibilityLabel={`Excluir ${paciente.nome_completo}`}
              >
                <PatientCell
                  paciente={paciente}
                  onPress={() => router.push(`/patients/${paciente.paciente_id}`)}
                />
              </SwipeToDelete>
            </View>
          ))}
        </ListGroup>
      ) : null}
    </Screen>
  );
}
