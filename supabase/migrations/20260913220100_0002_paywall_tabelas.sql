-- =============================================================================
-- Agenda Psi — Migration 0002 — Tabelas do paywall por SMS
--
-- O que faz: cria as duas tabelas novas do paywall, com as constraints e os
-- índices que o spec lista, liga RLS nas duas e cria as duas policies de
-- leitura. Não altera nenhuma tabela existente.
--
-- Regras do spec: 7.3 (tabelas novas), 7.5 (migration 0002), 6.5 (RLS),
-- 5 (tabela de permissões), 11.6 (plano e cortesia).
--
-- Princípio P2 — o banco é a fonte da verdade: nenhuma destas duas tabelas é
-- escrita pelo app. Em assinaturas só grava a Edge Function rc-webhook, com
-- service_role; em uso_mensal só grava o trigger criado na migration 0003.
-- Por isso nenhuma das duas ganha policy de insert, update ou delete.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- assinaturas — plano vigente de cada profissional (spec 7.3)
-- -----------------------------------------------------------------------------
create table public.assinaturas (
  profissional_id  uuid primary key references public.profissionais(id) on delete cascade,
  plano            text        not null default 'free',   -- free | pro
  status           text        not null default 'ativo',  -- ativo | em_atraso | cancelado | expirado
  store            text,                                  -- app_store | play_store | cortesia
  rc_customer_id   text,                                  -- id do cliente no RevenueCat
  rc_entitlement   text,                                  -- entitlement que concedeu o acesso
  inicio_em        timestamptz not null default now(),
  expira_em        timestamptz,                           -- nulo = sem expiração (cortesia)
  atualizado_em    timestamptz not null default now()
);

comment on table public.assinaturas is
  'Plano vigente de cada profissional. Fonte da verdade do paywall (spec 11.6). Escrita somente pela Edge Function rc-webhook com service_role; o app nunca grava aqui (spec 5 e 12.1).';
comment on column public.assinaturas.store is
  'Loja que originou a assinatura. Nulo em assinatura de cortesia concedida manualmente (spec 7.3).';
comment on column public.assinaturas.rc_customer_id is
  'Id do cliente no RevenueCat. Nulo em cortesia ou antes da primeira compra (spec 7.3).';
comment on column public.assinaturas.expira_em is
  'Fim do acesso. Nulo no plano free e na cortesia vitalícia dos fundadores (spec 7.3 e 11.6).';

alter table public.assinaturas add constraint assinaturas_plano_valido
  check (plano in ('free','pro'));
alter table public.assinaturas add constraint assinaturas_status_valido
  check (status in ('ativo','em_atraso','cancelado','expirado'));
alter table public.assinaturas add constraint assinaturas_store_valida
  check (store is null or store in ('app_store','play_store','cortesia'));

-- Busca pelo id do cliente no RevenueCat, usada pelo rc-webhook (spec 13.3).
create index idx_assinaturas_rc_customer on public.assinaturas (rc_customer_id);

-- -----------------------------------------------------------------------------
-- uso_mensal — consumo de SMS do mês por profissional (spec 7.3)
-- -----------------------------------------------------------------------------
create table public.uso_mensal (
  profissional_id  uuid        not null references public.profissionais(id) on delete cascade,
  mes              date        not null,                  -- sempre o dia 1 do mês
  sms_enviados     integer     not null default 0,
  atualizado_em    timestamptz not null default now(),
  primary key (profissional_id, mes)
);

comment on table public.uso_mensal is
  'Contador materializado de SMS por profissional e mês. Alimentado pelo trigger fn_uso_mensal_incrementa (spec 7.4), nunca pelo app. Reconstruível a partir de sms_lembretes_enviados pela função recontar_uso_mensal (spec 7.3).';
comment on column public.uso_mensal.mes is
  'Primeiro dia do mês de referência, apurado no fuso America/Sao_Paulo, não em UTC (spec 11.5 e 11.8).';

-- Consultas por mês fechado, usadas na conferência contra a fatura do Bird (spec 23.10).
create index idx_uso_mensal_mes on public.uso_mensal (mes);

-- ATENÇÃO (spec 7.3): não criar índice sobre sms_lembretes_enviados(agenda_id).
-- A constraint sms_lembretes_enviados_un (agenda_id, ocorrencia_data) já indexa
-- a FK. O índice idx_sms_lembretes_enviados_agenda_data é redundante com ela —
-- candidato a DROP, não a CREATE.

-- -----------------------------------------------------------------------------
-- RLS — leitura do próprio registro, escrita por ninguém (spec 5 e 6.5)
-- -----------------------------------------------------------------------------
alter table public.assinaturas enable row level security;
alter table public.uso_mensal  enable row level security;

-- Deixa o profissional autenticado ler a própria assinatura, e só ela.
-- current_profissional_id() traduz auth.uid() em profissionais.id (spec 7.4).
create policy assinaturas_select_proprio
  on public.assinaturas for select to authenticated
  using (profissional_id = public.current_profissional_id());

comment on policy assinaturas_select_proprio on public.assinaturas is
  'Leitura da própria assinatura (spec 6.5). Não existe policy de escrita: quem grava é o rc-webhook com service_role, que ignora RLS (spec 5 e 12.1).';

-- Deixa o profissional autenticado ler o próprio consumo de SMS, e só ele.
create policy uso_mensal_select_proprio
  on public.uso_mensal for select to authenticated
  using (profissional_id = public.current_profissional_id());

comment on policy uso_mensal_select_proprio on public.uso_mensal is
  'Leitura do próprio consumo mensal (spec 6.5). Escrita só pelo trigger fn_uso_mensal_incrementa, que roda como security definer (spec 7.4).';
