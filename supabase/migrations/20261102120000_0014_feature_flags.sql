-- =============================================================================
-- 0014 — Sinalizadores de funcionalidade (feature flags)
-- =============================================================================
--
-- POR QUE
--
-- O agente (docs/agente-plano.md) é a primeira funcionalidade do app que
-- grava no banco a partir de linguagem natural. Se ele começar a errar em
-- produção, desligá-lo não pode depender de build novo e de revisão de loja —
-- isso leva dias. Esta tabela permite desligar na hora, pelo painel do Supabase.
--
-- Por que não reaproveitar `config_app`: a coluna `valor` dela é uuid, e ela
-- guarda o usuário de demonstração da época do FlutterFlow. Outro propósito,
-- outro tipo.
--
-- REGRA DE OURO: FALHA FECHADA
--
-- Quem lê um sinalizador trata "linha ausente" e "não consegui ler" como
-- DESLIGADO. Um sinalizador que liga sozinho quando a rede cai não é
-- interruptor de emergência.
--
-- O SINALIZADOR PRECISA SER CONFERIDO EM DOIS LUGARES
--
--   1. no app, para esconder a entrada da funcionalidade;
--   2. no servidor (Edge Function), para recusar a chamada.
--
-- Só o primeiro não basta: um build antigo no aparelho de alguém, ou uma
-- chamada direta à função, continuaria funcionando com o sinalizador desligado.
--
-- COMO DESLIGAR EM PRODUÇÃO
--
--   update feature_flags set ativo = false where chave = 'agente';
--
-- O app relê ao voltar para primeiro plano; a Edge Function lê a cada chamada.
-- =============================================================================

create table if not exists public.feature_flags (
  chave         text primary key
                check (chave ~ '^[a-z][a-z0-9_]*$'),
  ativo         boolean     not null default false,
  descricao     text        not null,
  atualizado_em timestamptz not null default now()
);

comment on table public.feature_flags is
  'Interruptores de funcionalidade, mudados pelo painel sem build novo. Falha fechada: linha ausente ou leitura com erro = desligado. Conferir no app E na Edge Function.';

alter table public.feature_flags enable row level security;

-- Leitura para qualquer usuário autenticado: o app precisa saber o estado.
-- Escrita para NINGUÉM via API — só pelo painel ou SQL com service_role. Um
-- cliente não pode ligar para si uma funcionalidade desligada.
drop policy if exists feature_flags_leitura on public.feature_flags;
create policy feature_flags_leitura on public.feature_flags
  for select to authenticated using (true);

-- Mantém `atualizado_em` honesto, para saber QUANDO alguém desligou.
create or replace function public.feature_flags_toca_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists trg_feature_flags_atualizado_em on public.feature_flags;
create trigger trg_feature_flags_atualizado_em
  before update on public.feature_flags
  for each row execute function public.feature_flags_toca_atualizado_em();

-- O primeiro sinalizador nasce DESLIGADO: liga-se quando a fase 1 estiver
-- publicada e testada, não antes.
insert into public.feature_flags (chave, ativo, descricao) values
  ('agente', false, 'Agente de consultas e registros por linguagem natural (docs/agente-plano.md).')
on conflict (chave) do nothing;
