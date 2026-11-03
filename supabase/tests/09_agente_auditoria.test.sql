-- Teste — agente_auditoria: tabela de sistema, ninguém da API lê nem escreve.
begin;
select plan(4);

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','abab0002-0000-4000-8000-000000000002',
   'authenticated','authenticated','aud@teste.local', now(), now());

-- A função grava como service_role (aqui, como dono da tabela).
insert into public.agente_auditoria (usuario_id, pergunta, resultado)
values ('abab0002-0000-4000-8000-000000000002', 'quem não pagou?', 'ok');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"abab0002-0000-4000-8000-000000000002"}', true);

select is((select count(*)::int from public.agente_auditoria), 0,
  'nem o dono das perguntas le a auditoria pela API');

select throws_ok(
  $$insert into public.agente_auditoria (usuario_id, pergunta, resultado)
    values ('abab0002-0000-4000-8000-000000000002', 'falsa', 'ok')$$,
  '42501', null, 'usuario autenticado nao escreve na auditoria');

reset role;
select is((select count(*)::int from public.agente_auditoria), 1,
  'a linha gravada pela funcao continua la');

select has_column('public', 'agente_auditoria', 'resposta', 'a auditoria guarda a resposta');

select * from finish();
rollback;
