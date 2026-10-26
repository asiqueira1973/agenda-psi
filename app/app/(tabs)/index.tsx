import { useEffect } from 'react';
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
import { track, eventos, telas } from '@/lib/analytics';
import { useSession } from '@/features/auth/session-provider';

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
 * - "Sair do app" saiu daqui e foi para Configurações (assunção 24.7).
 *
 * O Agente Psi e a Análise com IA foram REMOVIDOS do produto em 14/09/2026, por
 * decisão do Alexandre depois do primeiro teste em aparelho. Some com eles o
 * defeito 11.9.16 do spec — a tela órfã do agente deixou de existir em vez de
 * ganhar entrada.
 */
export default function InicioScreen() {
  const colors = useColors();
  const resumo = useDashboardResumo();
  const plano = useMeuPlano();
  const temPacientes = useTemPacientes();

  const carregando = resumo.isPending || temPacientes.isPending;

  return (
    <Screen>
      <View style={{ paddingHorizontal: screenMargin, marginBottom: spacing.xxl }}>
        <Text variant="largeTitle">Agenda Psi</Text>
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
  const { session, usuarioId } = useSession();

  // Os cálculos vêm ANTES de qualquer return: há um hook abaixo, e hook não
  // pode ficar depois de saída condicional.
  const limitado = !!plano && plano.limite_sms !== null;
  const usados = plano?.sms_usados ?? 0;
  const limite = plano?.limite_sms ?? 0;
  const restantes = plano?.sms_restantes ?? Math.max(limite - usados, 0);
  const atingido = limitado && plano?.limite_atingido === true;

  // O aviso aparece a partir de 80% do limite. Este é o número da pergunta
  // aberta 25.7, ainda sem resposta do Alexandre: o spec assume 80%, e é o que
  // está aqui até ele decidir.
  const chegandoNoLimite = limitado && !atingido && usados >= Math.ceil(limite * 0.8);
  const visivel = limitado && (atingido || chegandoNoLimite);

  /**
   * Registra que a pessoa VIU o aviso — não que o limite foi atingido.
   *
   * A diferença decide o negócio. Em 26/10/2026, sete profissionais foram
   * cortados no mês e seis nunca abriram a tela de plano; sem este evento não
   * havia como saber se o aviso apareceu e foi ignorado, ou se elas sequer
   * abriram o app depois do corte. Os dois eventos existiam no catálogo da
   * seção 21 e nunca eram disparados.
   *
   * O id é estável por pessoa, mês e tipo de aviso. O Visão do Produto deduplica
   * por id, então abrir a Home dez vezes conta como uma pessoa que viu — que é
   * a pergunta real. Sem isso, o número mediria renderização de tela.
   */
  useEffect(() => {
    if (!visivel || !usuarioId) return;
    const mes = new Date().toISOString().slice(0, 7);
    track({
      id: `${usuarioId}-${mes}-${atingido ? 'atingido' : 'aviso'}`,
      nome: atingido ? eventos.limiteSmsAtingido : eventos.limiteSmsAviso,
      distinctId: session?.user.email ?? null,
      tela: telas.inicio,
      descricao: atingido
        ? 'viu o aviso de que os lembretes pausaram'
        : 'viu o aviso de que o limite está perto',
      propriedades: { plano: 'free', sms_usados: usados },
    });
  }, [visivel, atingido, usuarioId, session?.user.email, usados]);

  if (!visivel) return null;

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
