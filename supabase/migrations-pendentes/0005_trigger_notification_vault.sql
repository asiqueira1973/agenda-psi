-- =============================================================================
-- Agenda Psi — Migration 0005 — service_role do trigger de push para o Vault
--
-- O que faz: troca o trigger "trigger-notification" da tabela notifications por
-- uma função que lê a chave service_role do Vault em tempo de execução, em vez
-- de carregá-la em texto puro na própria definição do trigger.
--
-- Regras do spec: 6.5 (correção de segurança fora do escopo do app),
-- 7.5 (migration 0005), 20.1 a 20.3 (segredos), risco 23.2.
--
-- O problema: a definição do trigger antigo contém o JWT de service_role em
-- texto puro, legível por qualquer um com acesso ao catálogo do Postgres. Essa
-- chave ignora as 68 policies. Verificado no banco em 13/09/2026 — está lá.
--
-- Esta migration tira a chave do catálogo. Ela NÃO rotaciona a chave: rotacionar
-- é ação no painel do Supabase e invalida a chave antiga em todo lugar que a use.
--
-- ---------------------------------------------------------------------------
-- RUNBOOK — a ordem importa, e os passos 1 e 3 são seus, não desta migration
--
-- 1. No painel do Supabase, guardar a chave service_role ATUAL no Vault com o
--    nome service_role_key:
--        select vault.create_secret('<chave atual>', 'service_role_key',
--          'Chave service_role usada pelo trigger de push (spec 6.5, risco 23.2)');
--    Guardar antes de rotacionar mantém o trigger funcionando o tempo todo.
--
-- 2. Aplicar esta migration.
--
-- 3. Rotacionar a service_role no painel e atualizar o segredo do Vault:
--        select vault.update_secret(
--          (select id from vault.secrets where name = 'service_role_key'),
--          '<chave nova>');
--    Antes de rotacionar, conferir quem mais usa a chave antiga — os fluxos do
--    n8n são o suspeito principal. Rotacionar quebra todos eles de uma vez.
--
-- Risco de aplicar fora de ordem: baixo hoje. A tabela notifications tem 0
-- linhas e o push nunca foi implementado (spec 28.2), então este trigger nunca
-- disparou. Se o segredo faltar, a função avisa no log e não quebra o insert.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- fn_notifica_push — chama a Edge Function de push lendo a chave do Vault
--
-- Dispara: after insert em notifications.
-- Implementa: spec 6.5 e risco 23.2.
-- -----------------------------------------------------------------------------
create or replace function public.fn_notifica_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chave text;
  v_url   constant text := 'https://tocytpjtupbbxwgamtxq.supabase.co/functions/v1/sendpushnotification';
begin
  -- A chave vive no Vault, não na definição do trigger (spec 6.5, risco 23.2).
  select s.decrypted_secret
    into v_chave
    from vault.decrypted_secrets s
   where s.name = 'service_role_key'
   limit 1;

  -- Sem segredo configurado o push não sai, mas a notificação continua gravada.
  -- Falhar aqui derrubaria o insert de quem nem sabe que existe push.
  if v_chave is null then
    raise warning 'fn_notifica_push: segredo service_role_key ausente no Vault; push nao enviado';
    return new;
  end if;

  perform net.http_post(
    url                  := v_url,
    body                 := to_jsonb(new),
    params               := '{}'::jsonb,
    headers              := jsonb_build_object(
                              'Content-Type', 'application/json',
                              'Authorization', 'Bearer ' || v_chave
                            ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

comment on function public.fn_notifica_push() is
  'Chama a Edge Function de push a cada notificação nova, lendo a service_role do Vault em vez de carregá-la na definição do trigger (spec 6.5 e risco 23.2).';

-- Remove o trigger antigo: é a definição dele que contém a chave em texto puro.
drop trigger if exists "trigger-notification" on public.notifications;

create trigger trg_notifica_push
after insert on public.notifications
for each row execute function public.fn_notifica_push();

comment on trigger trg_notifica_push on public.notifications is
  'Dispara o push da notificação recém-criada. Substitui o trigger-notification, que trazia a service_role em texto puro (spec 6.5 e risco 23.2).';
