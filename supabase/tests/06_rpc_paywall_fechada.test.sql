-- =============================================================================
-- Teste — as funções do paywall não são endpoint público
--
-- Toda função em public vira /rest/v1/rpc/<nome> no PostgREST. Sendo SECURITY
-- DEFINER, roda ignorando as 68 policies. Este teste é o que impede alguém de,
-- no futuro, criar uma função de manutenção do paywall e deixá-la exposta à
-- chave anônima, que está no bundle do app publicado.
--
-- Regras verificadas: P2, P4, migration 0009 e a exigência de 26 de não deixar
-- alerta crítico de get_advisors em aberto.
-- =============================================================================
begin;
select plan(5);

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','7e000001-0000-4000-8000-000000000001','authenticated','authenticated','rpc@teste.local', now(), now());

insert into public.profissionais (id, usuario_id, nome, email) values
  ('7e000002-0000-4000-8000-000000000002','7e000001-0000-4000-8000-000000000001','Checagem RPC','rpc@teste.local');

set local role authenticated;
set local request.jwt.claims = '{"sub":"7e000001-0000-4000-8000-000000000001","role":"authenticated"}';

-- O que precisa continuar funcionando: a tela do plano lê v_meu_plano, que é
-- security_invoker e por isso executa limite_sms_do_plano como o proprio usuario.
select is(
  (select limite_sms from public.v_meu_plano),
  10, 'v_meu_plano continua respondendo para o usuario autenticado (regra 11.5)');

select is(
  (select plano from public.v_meu_plano),
  'free', 'sem linha em assinaturas o app ve plano free (regra 11.5)');

select throws_ok(
  $$ select public.recontar_uso_mensal('2026-09-01'::date) $$,
  '42501', null,
  'authenticated nao executa recontar_uso_mensal por RPC (migration 0009)');

select throws_ok(
  $$ select public.fn_uso_mensal_incrementa() $$,
  '42501', null,
  'authenticated nao executa a funcao de trigger por RPC (migration 0009)');

reset role;
set local role anon;

select throws_ok(
  $$ select public.limite_sms_do_plano('7e000002-0000-4000-8000-000000000002'::uuid) $$,
  '42501', null,
  'anon nao consulta o limite de ninguem (migration 0009)');

reset role;
select * from finish();
rollback;
