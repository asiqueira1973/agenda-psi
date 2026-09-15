-- =============================================================================
-- Teste — v_dashboard_resumo soma por competência
--
-- Guarda a correção da migration 0012. Antes dela, `pagamentos` e `despesas`
-- eram somados por `criado_em` — o instante em que a linha foi gravada — em vez
-- de `data_competencia`, que é o mês a que o dinheiro pertence (spec 7.5).
--
-- O caso que prova a diferença é o do pagamento atrasado: competência no mês
-- passado, registrado hoje. Pelo critério antigo ele entrava no mês corrente e
-- inflava o faturamento; pelo certo, fica no mês a que pertence.
--
-- Na base real de 14/09/2026 isso afetava 52 dos 441 pagamentos (11,8%).
--
-- Também cobre a rede para `data_competencia` nula, que existe em 27 pagamentos
-- e 13 despesas antigos: eles caem de volta em `criado_em` em vez de sumirem do
-- Início.
-- =============================================================================
begin;
select plan(6);

-- A view se filtra por auth.uid(); o teste finge ser esse usuário.
create or replace function pg_temp.finge_usuario(p uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p::text)::text, true);
end $$;

-- pacientes.usuario_id tem FK para auth.users; o usuário precisa existir.
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','dddd0001-0000-4000-8000-000000000001',
   'authenticated','authenticated','comp@teste.local', now(), now());

insert into public.profissionais (id, usuario_id, nome, email) values
  ('cccc0001-0000-4000-8000-000000000001','dddd0001-0000-4000-8000-000000000001','Competencia','comp@teste.local');

-- tipos_despesa é catálogo global; o banco local nasce vazio.
insert into public.tipos_despesa (id, nome, ativo) values
  ('ffff0001-0000-4000-8000-000000000001','Aluguel da sala', true);

insert into public.pacientes (id, usuario_id, profissional_id, nome_completo, status) values
  ('eeee0001-0000-4000-8000-000000000001','dddd0001-0000-4000-8000-000000000001',
   'cccc0001-0000-4000-8000-000000000001','Paciente de teste','ativo');

-- Todos gravados AGORA, de propósito: é criado_em que o código antigo usava.
insert into public.pagamentos
  (usuario_id, profissional_id, paciente_id, valor_pagamento, data_competencia, status, criado_em)
values
  -- pertence ao mês corrente
  ('dddd0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001',
   'eeee0001-0000-4000-8000-000000000001', 100,
   date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date, 'pago', now()),
  -- ATRASADO: competência no mês passado, registrado hoje
  ('dddd0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001',
   'eeee0001-0000-4000-8000-000000000001', 700,
   (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - interval '1 mon')::date, 'pago', now()),
  -- sem competência: a rede cai em criado_em, que é hoje
  ('dddd0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001',
   'eeee0001-0000-4000-8000-000000000001', 25,
   null, 'pago', now());

insert into public.despesas
  (usuario_id, tipo_despesa_id, descricao, valor_despesa, data_competencia, status, criado_em)
values
  ('dddd0001-0000-4000-8000-000000000001', 'ffff0001-0000-4000-8000-000000000001',
   'Do mês', 40, date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date, 'pago', now()),
  ('dddd0001-0000-4000-8000-000000000001', 'ffff0001-0000-4000-8000-000000000001',
   'Atrasada', 300, (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - interval '1 mon')::date, 'pago', now()),
  ('dddd0001-0000-4000-8000-000000000001', 'ffff0001-0000-4000-8000-000000000001',
   'Sem competência', 7, null, 'pago', now());

select pg_temp.finge_usuario('dddd0001-0000-4000-8000-000000000001');

-- 100 do mês + 25 sem competência. Os 700 do atrasado NÃO entram aqui.
select is((select pagamentos_mes_corrente from public.v_dashboard_resumo), 125::bigint,
  'pagamento atrasado nao infla o mes corrente (spec 7.5)');

select is((select pagamentos_mes_anterior from public.v_dashboard_resumo), 700::bigint,
  'pagamento atrasado conta no mes da competencia');

select is((select despesas_mes_corrente from public.v_dashboard_resumo), 47::bigint,
  'despesa atrasada nao infla o mes corrente');

select is((select despesas_mes_anterior from public.v_dashboard_resumo), 300::bigint,
  'despesa atrasada conta no mes da competencia');

-- A rede: sem ela, os 25 e os 7 sumiriam da tela.
select ok((select pagamentos_mes_corrente from public.v_dashboard_resumo) >= 25,
  'pagamento sem competencia nao some do Inicio');

-- Lucro = 125 - 47.
select is((select rentabilidade_mes_corrente from public.v_dashboard_resumo), 78::bigint,
  'lucro do mes usa as somas ja corrigidas');

select * from finish();
rollback;
