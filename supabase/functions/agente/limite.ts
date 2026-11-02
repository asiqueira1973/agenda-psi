import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Teto de perguntas ao agente, por dia e por semana, por plano.
 *
 * DECISÃO de 02/11/2026 (Alexandre): uma pergunta custa em média US$ 0,044
 * (auditoria, 50 perguntas), e o Pro custa R$ 9,90/mês (~US$ 1,80). Sem teto,
 * 40 perguntas no mês já comem a assinatura de uma pessoa.
 *
 * O dia é o do calendário em Brasília — "volta amanhã" é fácil de explicar. A
 * semana são os últimos 7 dias corridos. Conta como pergunta só o que chegou à
 * IA (`resultado` ok ou erro na auditoria); recusas e o Confirmar do cartão,
 * que não passa pela IA, não contam.
 *
 * Substitui o limite de 20 por hora que vivia na memória da função: aquele se
 * perdia a cada reinício e não valia entre instâncias. Este lê a auditoria.
 */
export const TETOS = {
  free: { dia: 10, semana: 30 },
  pro: { dia: 20, semana: 60 },
} as const;

export type Plano = keyof typeof TETOS;

export type Estouro = { tipo: 'dia' | 'semana'; limite: number; plano: Plano; voltaEm: string | null };

/**
 * Decide se a pessoa estourou um teto. Puro, para teste.
 * Recebe o plano, quantas perguntas hoje e nos últimos 7 dias, e quando foi a
 * mais antiga da janela de 7 dias (para dizer quando volta).
 */
export function estourou(
  plano: Plano,
  hoje: number,
  semana: number,
  maisAntigaDaSemana: Date | null,
): Estouro | null {
  const t = TETOS[plano];
  if (hoje >= t.dia) return { tipo: 'dia', limite: t.dia, plano, voltaEm: null };
  if (semana >= t.semana) {
    const volta = maisAntigaDaSemana ? new Date(maisAntigaDaSemana.getTime() + 7 * 24 * 3600 * 1000) : null;
    return {
      tipo: 'semana',
      limite: t.semana,
      plano,
      voltaEm: volta
        ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(volta)
        : null,
    };
  }
  return null;
}

/** A frase que a pessoa lê. Vai como resposta normal do agente (vale até na 5.0.2). */
export function mensagemDoTeto(e: Estouro): string {
  const doPlano = e.plano === 'pro' ? 'do plano Pro' : 'do plano gratuito';
  const convite = e.plano === 'free'
    ? ` No plano Pro são ${TETOS.pro.dia} por dia e ${TETOS.pro.semana} por semana: veja em Ajustes › Meu plano.`
    : '';
  if (e.tipo === 'dia') {
    return `Você chegou ao limite de ${e.limite} perguntas por dia ${doPlano}. O assistente volta amanhã.${convite}`;
  }
  const quando = e.voltaEm ? ` em ${e.voltaEm}` : ' em alguns dias';
  return `Você chegou ao limite de ${e.limite} perguntas por semana ${doPlano}. O assistente volta${quando}.${convite}`;
}

/** Meia-noite de hoje em Brasília, em UTC. Brasil sem horário de verão desde 2019: -03:00. */
function inicioDoDiaEmBrasilia(): string {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  return new Date(`${hoje}T00:00:00-03:00`).toISOString();
}

/**
 * Confere o teto da pessoa. Recebe o cliente DELA (para ler o plano pela view,
 * com RLS) e o id. A contagem lê a auditoria com service_role, porque a tabela
 * de sistema não tem policy.
 *
 * Na dúvida, plano gratuito: erro ao ler o plano não pode dar teto maior.
 * Erro ao CONTAR deixa passar — o agente fora do ar por falha de contagem é
 * pior que algumas perguntas a mais, e a auditoria continua registrando.
 */
export async function conferirTeto(cliente: SupabaseClient, usuarioId: string): Promise<Estouro | null> {
  const { data: meuPlano } = await cliente.from('v_meu_plano').select('plano').maybeSingle();
  const plano: Plano = meuPlano?.plano === 'pro' ? 'pro' : 'free';

  const url = Deno.env.get('SUPABASE_URL');
  const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !chave) return null;
  const admin = createClient(url, chave, { auth: { persistSession: false } });

  const seteDias = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const base = () =>
    admin.from('agente_auditoria').select('criado_em', { count: 'exact' })
      .eq('usuario_id', usuarioId).in('resultado', ['ok', 'erro']);
  const [hoje, semana] = await Promise.all([
    base().gte('criado_em', inicioDoDiaEmBrasilia()).limit(1),
    base().gte('criado_em', seteDias).order('criado_em', { ascending: true }).limit(1),
  ]);
  if (hoje.error || semana.error) {
    console.error('agente: falha ao contar perguntas para o teto');
    return null;
  }
  const maisAntiga = semana.data?.[0]?.criado_em ? new Date(semana.data[0].criado_em) : null;
  return estourou(plano, hoje.count ?? 0, semana.count ?? 0, maisAntiga);
}
