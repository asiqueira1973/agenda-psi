-- =============================================================================
-- 0012 — O Início passa a somar por competência, não por data de gravação
-- =============================================================================
--
-- PROBLEMA
--
-- A v_dashboard_resumo somava `pagamentos` e `despesas` por `criado_em`, que é o
-- instante em que a LINHA FOI GRAVADA. O spec é explícito (seção 7.5): quem diz
-- a que mês o dinheiro pertence é `data_competencia`; `criado_em` e `pago_em`
-- são "o instante do registro, não a data escolhida".
--
-- Na prática, um pagamento de agosto registrado em setembro entrava no
-- faturamento de setembro. Num app cuja promessa é saber quanto se ganhou no
-- mês, isso é erro de contabilidade — e silencioso, porque o número parece
-- plausível.
--
-- Medido na base em 14/09/2026, antes da correção:
--   pagamentos: 52 de 441 em mês diferente da competência (11,8%)
--   despesas:    8 de  93 (8,6%)
--
-- Herdado do FlutterFlow; não veio da reescrita.
--
-- A CORREÇÃO
--
-- Pagamentos e despesas passam a ser somados por `data_competencia`.
--
-- SESSÕES NÃO MUDAM: elas já eram contadas por `ocorreu_em`, a data em que a
-- sessão aconteceu, que é o correto e é outra coluna.
--
-- A REDE PARA OS NULOS
--
-- 27 pagamentos e 13 despesas têm `data_competencia` nula — linhas antigas,
-- anteriores ao default. Para essas, cai-se de volta em `criado_em`. Sem isso
-- elas sumiriam do Início, e dinheiro que some da tela é pior do que dinheiro
-- no mês errado: o primeiro parece perda de dado, o segundo parece engano.
--
-- O QUE NÃO MUDA
--
-- A semântica de segurança da view. Ela continua sem `security_invoker` e
-- continua se filtrando por `auth.uid()`, exatamente como estava. Mexer nisso
-- aqui misturaria duas mudanças de natureza diferente na mesma migration.
--
-- Implementa: a correção da regra de competência da seção 7.5 do spec.
-- =============================================================================

create or replace view public.v_dashboard_resumo as
with limites as (
  select
    (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo') as inicio_mes_corrente_utc,
    ((date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - interval '1 mon') at time zone 'America/Sao_Paulo') as inicio_mes_anterior_utc,
    -- Limites em DATA, para comparar com data_competencia, que é date e não
    -- tem fuso. Comparar date com timestamptz faria o Postgres converter em
    -- UTC e jogar o dia 1º para o mês anterior.
    date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date as inicio_mes_corrente_dia,
    (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - interval '1 mon')::date as inicio_mes_anterior_dia
),
base as (
  select
    l.inicio_mes_corrente_utc,
    l.inicio_mes_anterior_utc,
    l.inicio_mes_corrente_utc + interval '1 mon' as fim_mes_corrente_utc,
    l.inicio_mes_anterior_utc + interval '1 mon' as fim_mes_anterior_utc,
    l.inicio_mes_corrente_dia,
    l.inicio_mes_anterior_dia,
    (l.inicio_mes_corrente_dia + interval '1 mon')::date as fim_mes_corrente_dia,
    (l.inicio_mes_anterior_dia + interval '1 mon')::date as fim_mes_anterior_dia
  from limites l
),
pac as (
  select count(*)::integer as pacientes_ativos
    from pacientes p
   where p.usuario_id = auth.uid() and p.status = 'ativo'
),
-- Sessões: por ocorreu_em, como já era. Não é o que esta migration corrige.
ses_prev as (
  select count(*)::integer as sessoes_mes_anterior
    from sessoes s join base b on true
   where s.usuario_id = auth.uid() and s.status = 'realizada'
     and s.ocorreu_em >= b.inicio_mes_anterior_utc
     and s.ocorreu_em <  b.fim_mes_anterior_utc
),
ses_curr as (
  select count(*)::integer as sessoes_mes_corrente
    from sessoes s join base b on true
   where s.usuario_id = auth.uid() and s.status = 'realizada'
     and s.ocorreu_em >= b.inicio_mes_corrente_utc
     and s.ocorreu_em <  b.fim_mes_corrente_utc
),
-- Pagamentos e despesas: por COMPETÊNCIA. É a correção.
pag_prev as (
  select coalesce(sum(pg.valor_pagamento), 0)::bigint as pagamentos_mes_anterior
    from pagamentos pg join base b on true
   where pg.usuario_id = auth.uid()
     and coalesce(pg.data_competencia, (pg.criado_em at time zone 'America/Sao_Paulo')::date) >= b.inicio_mes_anterior_dia
     and coalesce(pg.data_competencia, (pg.criado_em at time zone 'America/Sao_Paulo')::date) <  b.fim_mes_anterior_dia
),
pag_curr as (
  select coalesce(sum(pg.valor_pagamento), 0)::bigint as pagamentos_mes_corrente
    from pagamentos pg join base b on true
   where pg.usuario_id = auth.uid()
     and coalesce(pg.data_competencia, (pg.criado_em at time zone 'America/Sao_Paulo')::date) >= b.inicio_mes_corrente_dia
     and coalesce(pg.data_competencia, (pg.criado_em at time zone 'America/Sao_Paulo')::date) <  b.fim_mes_corrente_dia
),
des_prev as (
  select coalesce(sum(d.valor_despesa), 0)::bigint as despesas_mes_anterior
    from despesas d join base b on true
   where d.usuario_id = auth.uid()
     and coalesce(d.data_competencia, (d.criado_em at time zone 'America/Sao_Paulo')::date) >= b.inicio_mes_anterior_dia
     and coalesce(d.data_competencia, (d.criado_em at time zone 'America/Sao_Paulo')::date) <  b.fim_mes_anterior_dia
),
des_curr as (
  select coalesce(sum(d.valor_despesa), 0)::bigint as despesas_mes_corrente
    from despesas d join base b on true
   where d.usuario_id = auth.uid()
     and coalesce(d.data_competencia, (d.criado_em at time zone 'America/Sao_Paulo')::date) >= b.inicio_mes_corrente_dia
     and coalesce(d.data_competencia, (d.criado_em at time zone 'America/Sao_Paulo')::date) <  b.fim_mes_corrente_dia
)
select
  pac.pacientes_ativos,
  ses_prev.sessoes_mes_anterior,
  ses_curr.sessoes_mes_corrente,
  pag_prev.pagamentos_mes_anterior,
  pag_curr.pagamentos_mes_corrente,
  des_prev.despesas_mes_anterior,
  des_curr.despesas_mes_corrente,
  pag_prev.pagamentos_mes_anterior - des_prev.despesas_mes_anterior as rentabilidade_mes_anterior,
  pag_curr.pagamentos_mes_corrente - des_curr.despesas_mes_corrente as rentabilidade_mes_corrente,
  case when pac.pacientes_ativos > 0
       then (des_curr.despesas_mes_corrente::numeric / pac.pacientes_ativos::numeric)::bigint
       else 0::bigint end as custo_medio_por_paciente_mes_corrente,
  case when pac.pacientes_ativos > 0
       then (pag_curr.pagamentos_mes_corrente::numeric / pac.pacientes_ativos::numeric)::bigint
       else 0::bigint end as receita_media_por_paciente_mes_corrente,
  case when pag_curr.pagamentos_mes_corrente > 0
       then round((pag_curr.pagamentos_mes_corrente - des_curr.despesas_mes_corrente)::numeric
                  / pag_curr.pagamentos_mes_corrente::numeric * 100, 1)
       else 0::numeric end as margem_mes_corrente_pct,
  case when pag_prev.pagamentos_mes_anterior > 0
       then round((pag_prev.pagamentos_mes_anterior - des_prev.despesas_mes_anterior)::numeric
                  / pag_prev.pagamentos_mes_anterior::numeric * 100, 1)
       else 0::numeric end as margem_mes_anterior_pct,
  case when ses_curr.sessoes_mes_corrente > 0
       then round(pag_curr.pagamentos_mes_corrente::numeric / ses_curr.sessoes_mes_corrente::numeric, 2)
       else 0::numeric end as receita_media_por_sessao_corrente,
  case when ses_curr.sessoes_mes_corrente > 0
        and (pag_curr.pagamentos_mes_corrente::numeric / ses_curr.sessoes_mes_corrente::numeric) > 0
       then ceil(des_curr.despesas_mes_corrente::numeric
                 / (pag_curr.pagamentos_mes_corrente::numeric / ses_curr.sessoes_mes_corrente::numeric))::integer
       else 0 end as break_even_sessoes_mes_corrente,
  case when ses_prev.sessoes_mes_anterior > 0
       then round((ses_curr.sessoes_mes_corrente - ses_prev.sessoes_mes_anterior)::numeric
                  / ses_prev.sessoes_mes_anterior::numeric * 100, 1)
       else null::numeric end as variacao_sessoes_pct,
  case when pag_prev.pagamentos_mes_anterior > 0
       then round((pag_curr.pagamentos_mes_corrente - pag_prev.pagamentos_mes_anterior)::numeric
                  / pag_prev.pagamentos_mes_anterior::numeric * 100, 1)
       else null::numeric end as variacao_receita_pct,
  case when des_prev.despesas_mes_anterior > 0
       then round((des_curr.despesas_mes_corrente - des_prev.despesas_mes_anterior)::numeric
                  / des_prev.despesas_mes_anterior::numeric * 100, 1)
       else null::numeric end as variacao_despesas_pct,
  case when (pag_prev.pagamentos_mes_anterior - des_prev.despesas_mes_anterior) <> 0
       then round((pag_curr.pagamentos_mes_corrente - des_curr.despesas_mes_corrente
                   - (pag_prev.pagamentos_mes_anterior - des_prev.despesas_mes_anterior))::numeric
                  / abs(pag_prev.pagamentos_mes_anterior - des_prev.despesas_mes_anterior)::numeric * 100, 1)
       else null::numeric end as variacao_rentabilidade_pct,
  base.inicio_mes_anterior_utc as periodo_mes_anterior_inicio_utc,
  base.fim_mes_anterior_utc    as periodo_mes_anterior_fim_utc,
  base.inicio_mes_corrente_utc as periodo_mes_corrente_inicio_utc,
  base.fim_mes_corrente_utc    as periodo_mes_corrente_fim_utc
from base
cross join pac
cross join ses_prev cross join ses_curr
cross join pag_prev cross join pag_curr
cross join des_prev cross join des_curr;

comment on view public.v_dashboard_resumo is
  'Resumo do mês para a tela Início. Pagamentos e despesas somam por data_competencia (o mês a que o dinheiro pertence), com queda para criado_em quando a competência é nula; sessões contam por ocorreu_em. Corrigido na migration 0012 — antes somava tudo por criado_em, e 11,8% dos pagamentos caíam no mês errado.';
