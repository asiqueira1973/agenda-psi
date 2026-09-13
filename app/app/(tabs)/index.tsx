import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import {
  Screen,
  StatCard,
  ListGroup,
  RowSeparator,
  ValueRow,
  ActionRow,
  NavigationRow,
  EmptyState,
  ErrorState,
  SkeletonBar,
  SkeletonGroup,
  Icon,
  Text,
} from '@/components/ui';
import { useColors, spacing, screenMargin, radius, size } from '@/theme';
import { formatarInteiro } from '@/lib/format';
import {
  useDashboardResumo,
  useMeuPlano,
  useTemPacientes,
} from '@/features/home/use-dashboard';
import { gruposDoDashboard } from '@/features/home/indicadores';

/**
 * Tela 5 — Início, o dashboard.
 *
 * Os 13 indicadores saem inteiros de `v_dashboard_resumo`. O app não recalcula
 * nenhum (princípio P2 e regra 11.1).
 *
 * Correções em relação ao app atual (8.3):
 * - dinheiro em BRL e percentual com uma casa, em vez do inteiro cru (11.3);
 * - esqueleto enquanto carrega, nunca cartão zerado — quem vê `R$ 0` de lucro
 *   acredita, fecha o app e não volta;
 * - estado vazio de boas-vindas para quem não tem paciente, em vez de 13
 *   cartões zerados (fluxo 9.1);
 * - "Sair do app" saiu daqui e foi para Configurações (assunção 24.7);
 * - o Agente Psi ganhou entrada: o ícone no cabeçalho. Hoje a tela é órfã,
 *   alcançável só por deep link (defeito 11.9.16).
 */
export default function InicioScreen() {
  const colors = useColors();
  const resumo = useDashboardResumo();
  const plano = useMeuPlano();
  const temPacientes = useTemPacientes();

  const carregando = resumo.isPending || temPacientes.isPending;

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
        <Text variant="largeTitle">Agenda Psi</Text>
        {/* A entrada do Agente Psi. É o que tira a tela da orfandade. */}
        <Pressable
          onPress={() => router.push('/agent')}
          accessibilityRole="button"
          accessibilityLabel="Abrir o Agente Psi"
          hitSlop={12}
        >
          <Icon name="agent" color={colors.accent} size={23} />
        </Pressable>
      </View>

      {carregando ? <EsqueletoDaHome /> : null}

      {!carregando && resumo.isError ? (
        <ErrorState onRetry={() => void resumo.refetch()} />
      ) : null}

      {!carregando && !resumo.isError && temPacientes.data === false ? (
        <EmptyState
          icon="patients"
          title="Comece cadastrando seu primeiro paciente."
          body="Os números do mês aparecem aqui assim que houver sessões e pagamentos registrados."
          actionLabel="Cadastrar paciente"
          onAction={() => router.push('/patients/novo')}
        />
      ) : null}

      {!carregando && !resumo.isError && temPacientes.data === true && resumo.data ? (
        <>
          <AvisoDeLimiteDeSms plano={plano.data} />

          <StatCard
            rotulo="Pacientes Ativos"
            valor={formatarInteiro(resumo.data.pacientes_ativos)}
          />

          {gruposDoDashboard.map((grupo) => (
            <ListGroup key={grupo.titulo} title={grupo.titulo}>
              {grupo.indicadores.map((indicador, i) => (
                <View key={indicador.rotulo}>
                  {i > 0 ? <RowSeparator /> : null}
                  <ValueRow
                    label={indicador.rotulo}
                    value={indicador.valor(resumo.data!)}
                    valueColor={indicador.cor?.(resumo.data!) ?? 'secondaryLabel'}
                  />
                </View>
              ))}
            </ListGroup>
          ))}

          <ListGroup>
            <ActionRow
              label="Análise com IA"
              onPress={() => router.push('/analise-ia')}
            />
          </ListGroup>
        </>
      ) : null}
    </Screen>
  );
}

/**
 * Esqueleto na forma do conteúdo: um cartão e três grupos com o número de
 * linhas que os de verdade terão. Nunca zeros (handoff, estado 5a).
 */
function EsqueletoDaHome() {
  const colors = useColors();

  return (
    <>
      <View
        style={{
          marginHorizontal: screenMargin,
          backgroundColor: colors.listSurface,
          borderRadius: radius.card,
          paddingTop: spacing.md,
          paddingHorizontal: screenMargin,
          paddingBottom: 14,
          gap: spacing.sm,
        }}
      >
        <SkeletonBar width={110} height={13} />
        <SkeletonBar width={72} height={34} />
      </View>
      {gruposDoDashboard.map((grupo) => (
        <SkeletonGroup
          key={grupo.titulo}
          title={grupo.titulo}
          rows={grupo.indicadores.length}
        />
      ))}
    </>
  );
}

/**
 * Data em que os lembretes voltam: o primeiro dia do mês que vem.
 *
 * O contador zera na virada do mês em Brasília (regra 11.5 e fluxo 9.4), então
 * a data de retomada é sempre o dia 1. Não há job nenhum por trás disso — a
 * virada é consequência do `date_trunc` da regra 11.5.
 */
function primeiroDiaDoProximoMes(): string {
  const agora = new Date();
  const proximo = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  const dia = String(proximo.getDate()).padStart(2, '0');
  const mes = String(proximo.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${proximo.getFullYear()}`;
}

/**
 * Aviso de limite de SMS — os estados 5d e 5e do handoff.
 *
 * Laranja quando está chegando, vermelho quando estourou. É o único uso de
 * laranja no app inteiro (handoff, "Cor").
 *
 * Quem decide os números é `v_meu_plano`, nunca esta tela (princípio P2 e regra
 * 11.5). Aqui só se escolhe a cor e a frase.
 *
 * A copy é literal da seção 15.7.
 */
function AvisoDeLimiteDeSms({
  plano,
}: {
  plano: { limite_sms: number | null; sms_usados: number | null; sms_restantes: number | null; limite_atingido: boolean | null } | null | undefined;
}) {
  const colors = useColors();

  // Ilimitado — pro ou fundador — não vê aviso nenhum.
  if (!plano || plano.limite_sms === null) return null;

  const usados = plano.sms_usados ?? 0;
  const limite = plano.limite_sms;
  const restantes = plano.sms_restantes ?? Math.max(limite - usados, 0);
  const atingido = plano.limite_atingido === true;

  // O aviso aparece a partir de 80% do limite. Este é o número da pergunta
  // aberta 25.7, ainda sem resposta do Alexandre: o spec assume 80%, e é o que
  // está aqui até ele decidir.
  const chegandoNoLimite = !atingido && usados >= Math.ceil(limite * 0.8);
  if (!atingido && !chegandoNoLimite) return null;

  const cor = atingido ? colors.destructive : colors.warning;

  return (
    <ListGroup first footer="Configurações › Meu plano">
      <Pressable
        onPress={() => router.push('/settings/plano')}
        accessibilityRole="button"
        style={{
          minHeight: size.listRow,
          paddingHorizontal: screenMargin,
          paddingVertical: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <Icon name="warning" color={cor} />
        <Text style={{ flex: 1, color: cor }}>
          {atingido
            ? `Seus lembretes por SMS pausaram até ${primeiroDiaDoProximoMes()}`
            : `Faltam ${restantes} lembretes no seu plano gratuito deste mês.`}
        </Text>
        <Icon name="chevron" color={colors.tertiaryLabel} size={15} />
      </Pressable>
    </ListGroup>
  );
}
