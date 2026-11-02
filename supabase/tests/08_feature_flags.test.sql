-- Teste — feature_flags: leitura para autenticado, escrita para ninguém.
begin;
select plan(4);

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','abab0001-0000-4000-8000-000000000001',
   'authenticated','authenticated','ff@teste.local', now(), now());

select is((select ativo from public.feature_flags where chave = 'agente'), false,
  'o agente nasce desligado');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"abab0001-0000-4000-8000-000000000001"}', true);

select is((select count(*)::int from public.feature_flags where chave = 'agente'), 1,
  'usuario autenticado consegue ler o sinalizador');

update public.feature_flags set ativo = true where chave = 'agente';
reset role;
select is((select ativo from public.feature_flags where chave = 'agente'), false,
  'usuario autenticado NAO consegue ligar o sinalizador para si');

update public.feature_flags set ativo = true where chave = 'agente';
select isnt((select atualizado_em from public.feature_flags where chave = 'agente'), null,
  'atualizado_em registra a mudanca');

select * from finish();
rollback;
