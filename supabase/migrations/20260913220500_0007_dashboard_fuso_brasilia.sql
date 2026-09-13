-- =============================================================================
-- Agenda Psi — Migration 0007 — Dashboard no fuso de Brasília
--
-- O que faz: troca as janelas de mês de v_dashboard_resumo de UTC para
-- America/Sao_Paulo.
--
-- Regras do spec: 11.8 (fusos e virada de dia), 11.1 (indicadores), 8.3 (Home).
--
-- Origem: pergunta aberta 25.5, respondida por Alexandre em 13/09/2026 —
-- corrigir para Brasília. Como a 25.5 não estava resolvida quando o spec foi
-- escrito, esta correção não cabia em nenhuma das migrations de 7.5; por isso
-- ela é a 0007 e está registrada em "Divergências" da documentação técnica.
--
-- O que muda na prática: hoje, nas últimas 3 horas de cada mês, o dashboard já
-- mostra o mês seguinte. Depois desta migration ele vira o mês junto com o
-- calendário de quem usa o app. Em compensação, os números de meses passados
-- mudam para quem tiver lançamento nessa faixa de 3 horas.
--
-- Os nomes das colunas de período continuam com sufixo _utc, agora impreciso.
-- Renomear exigiria DROP CASCADE em v_dashboard_payload_json, que depende desta
-- view; o ganho não paga o risco. Fica registrado na documentação técnica.
-- =============================================================================

create or replace view public.v_dashboard_resumo as
 with limites as (
         -- Início do mês apurado em Brasília e devolvido como timestamptz, para
         -- continuar comparável com as colunas timestamptz das tabelas (11.8).
         select (date_trunc('month'::text, (now() at time zone 'America/Sao_Paulo'::text)) at time zone 'America/Sao_Paulo'::text) as inicio_mes_corrente_utc,
            ((date_trunc('month'::text, (now() at time zone 'America/Sao_Paulo'::text)) - '1 mon'::interval) at time zone 'America/Sao_Paulo'::text) as inicio_mes_anterior_utc
        ), base as (
         select l.inicio_mes_corrente_utc,
            l.inicio_mes_anterior_utc,
            (l.inicio_mes_corrente_utc + '1 mon'::interval) as fim_mes_corrente_utc,
            (l.inicio_mes_anterior_utc + '1 mon'::interval) as fim_mes_anterior_utc
           from limites l
        ), pac as (
         select (count(*))::integer as pacientes_ativos
           from pacientes p
          where ((p.usuario_id = auth.uid()) and (p.status = 'ativo'::text))
        ), ses_prev as (
         select (count(*))::integer as sessoes_mes_anterior
           from (sessoes s
             join base b on (true))
          where ((s.usuario_id = auth.uid()) and (s.status = 'realizada'::text) and (s.ocorreu_em >= b.inicio_mes_anterior_utc) and (s.ocorreu_em < b.fim_mes_anterior_utc))
        ), ses_curr as (
         select (count(*))::integer as sessoes_mes_corrente
           from (sessoes s
             join base b on (true))
          where ((s.usuario_id = auth.uid()) and (s.status = 'realizada'::text) and (s.ocorreu_em >= b.inicio_mes_corrente_utc) and (s.ocorreu_em < b.fim_mes_corrente_utc))
        ), pag_prev as (
         select coalesce(sum(pg.valor_pagamento), (0)::bigint) as pagamentos_mes_anterior
           from (pagamentos pg
             join base b on (true))
          where ((pg.usuario_id = auth.uid()) and (pg.criado_em >= b.inicio_mes_anterior_utc) and (pg.criado_em < b.fim_mes_anterior_utc))
        ), pag_curr as (
         select coalesce(sum(pg.valor_pagamento), (0)::bigint) as pagamentos_mes_corrente
           from (pagamentos pg
             join base b on (true))
          where ((pg.usuario_id = auth.uid()) and (pg.criado_em >= b.inicio_mes_corrente_utc) and (pg.criado_em < b.fim_mes_corrente_utc))
        ), des_prev as (
         select coalesce(sum(d.valor_despesa), (0)::bigint) as despesas_mes_anterior
           from (despesas d
             join base b on (true))
          where ((d.usuario_id = auth.uid()) and (d.criado_em >= b.inicio_mes_anterior_utc) and (d.criado_em < b.fim_mes_anterior_utc))
        ), des_curr as (
         select coalesce(sum(d.valor_despesa), (0)::bigint) as despesas_mes_corrente
           from (despesas d
             join base b on (true))
          where ((d.usuario_id = auth.uid()) and (d.criado_em >= b.inicio_mes_corrente_utc) and (d.criado_em < b.fim_mes_corrente_utc))
        )
 select pac.pacientes_ativos,
    ses_prev.sessoes_mes_anterior,
    ses_curr.sessoes_mes_corrente,
    pag_prev.pagamentos_mes_anterior,
    pag_curr.pagamentos_mes_corrente,
    des_prev.despesas_mes_anterior,
    des_curr.despesas_mes_corrente,
    (pag_prev.pagamentos_mes_anterior - des_prev.despesas_mes_anterior) as rentabilidade_mes_anterior,
    (pag_curr.pagamentos_mes_corrente - des_curr.despesas_mes_corrente) as rentabilidade_mes_corrente,
        case
            when (pac.pacientes_ativos > 0) then (((des_curr.despesas_mes_corrente)::numeric / (pac.pacientes_ativos)::numeric))::bigint
            else (0)::bigint
        end as custo_medio_por_paciente_mes_corrente,
        case
            when (pac.pacientes_ativos > 0) then (((pag_curr.pagamentos_mes_corrente)::numeric / (pac.pacientes_ativos)::numeric))::bigint
            else (0)::bigint
        end as receita_media_por_paciente_mes_corrente,
        case
            when (pag_curr.pagamentos_mes_corrente > 0) then round(((((pag_curr.pagamentos_mes_corrente - des_curr.despesas_mes_corrente))::numeric / (pag_curr.pagamentos_mes_corrente)::numeric) * (100)::numeric), 1)
            else (0)::numeric
        end as margem_mes_corrente_pct,
        case
            when (pag_prev.pagamentos_mes_anterior > 0) then round(((((pag_prev.pagamentos_mes_anterior - des_prev.despesas_mes_anterior))::numeric / (pag_prev.pagamentos_mes_anterior)::numeric) * (100)::numeric), 1)
            else (0)::numeric
        end as margem_mes_anterior_pct,
        case
            when (ses_curr.sessoes_mes_corrente > 0) then round(((pag_curr.pagamentos_mes_corrente)::numeric / (ses_curr.sessoes_mes_corrente)::numeric), 2)
            else (0)::numeric
        end as receita_media_por_sessao_corrente,
        case
            when ((ses_curr.sessoes_mes_corrente > 0) and (((pag_curr.pagamentos_mes_corrente)::numeric / (ses_curr.sessoes_mes_corrente)::numeric) > (0)::numeric)) then (ceil(((des_curr.despesas_mes_corrente)::numeric / ((pag_curr.pagamentos_mes_corrente)::numeric / (ses_curr.sessoes_mes_corrente)::numeric))))::integer
            else 0
        end as break_even_sessoes_mes_corrente,
        case
            when (ses_prev.sessoes_mes_anterior > 0) then round(((((ses_curr.sessoes_mes_corrente - ses_prev.sessoes_mes_anterior))::numeric / (ses_prev.sessoes_mes_anterior)::numeric) * (100)::numeric), 1)
            else null::numeric
        end as variacao_sessoes_pct,
        case
            when (pag_prev.pagamentos_mes_anterior > 0) then round(((((pag_curr.pagamentos_mes_corrente - pag_prev.pagamentos_mes_anterior))::numeric / (pag_prev.pagamentos_mes_anterior)::numeric) * (100)::numeric), 1)
            else null::numeric
        end as variacao_receita_pct,
        case
            when (des_prev.despesas_mes_anterior > 0) then round(((((des_curr.despesas_mes_corrente - des_prev.despesas_mes_anterior))::numeric / (des_prev.despesas_mes_anterior)::numeric) * (100)::numeric), 1)
            else null::numeric
        end as variacao_despesas_pct,
        case
            when ((pag_prev.pagamentos_mes_anterior - des_prev.despesas_mes_anterior) <> 0) then round((((((pag_curr.pagamentos_mes_corrente - des_curr.despesas_mes_corrente) - (pag_prev.pagamentos_mes_anterior - des_prev.despesas_mes_anterior)))::numeric / (abs((pag_prev.pagamentos_mes_anterior - des_prev.despesas_mes_anterior)))::numeric) * (100)::numeric), 1)
            else null::numeric
        end as variacao_rentabilidade_pct,
    base.inicio_mes_anterior_utc as periodo_mes_anterior_inicio_utc,
    base.fim_mes_anterior_utc as periodo_mes_anterior_fim_utc,
    base.inicio_mes_corrente_utc as periodo_mes_corrente_inicio_utc,
    base.fim_mes_corrente_utc as periodo_mes_corrente_fim_utc
   from (((((((base
     cross join pac)
     cross join ses_prev)
     cross join ses_curr)
     cross join pag_prev)
     cross join pag_curr)
     cross join des_prev)
     cross join des_curr);

comment on view public.v_dashboard_resumo is
  'Os 13 indicadores do mês do usuário autenticado, com janelas de mês em America/Sao_Paulo (spec 11.1 e 11.8; pergunta 25.5 respondida em 13/09/2026).';
