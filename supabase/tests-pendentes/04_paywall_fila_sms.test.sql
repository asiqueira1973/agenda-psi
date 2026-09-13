-- =============================================================================
-- Teste — v_sms_lembretes_pendentes com o corte do paywall
--
-- REQUER A MIGRATION 0008. Enquanto ela estiver em supabase/migrations-pendentes,
-- este arquivo fica aqui junto. Os dois entram no mesmo movimento, no épico 8.11.
--
-- Cobre os casos da seção 22: antes e depois de estourar, e fundador com volume
-- alto. Regras verificadas: 11.5 (limite 10 no free, ilimitado no pro e no
-- fundador) e os critérios de aceite de 8.11.
--
-- Nota sobre o relógio: a view monta a fila do próximo bloco de 30 minutos a
-- partir de now(). O fixture calcula essa mesma janela e cria os agendamentos
-- exatamente dentro dela, para o teste não depender da hora em que roda.
-- =============================================================================
begin;
select plan(5);

create temporary table janela_teste as
with params as (
  select date_trunc('minute', (now() at time zone 'America/Sao_Paulo')) as now_min_sp
), slot as (
  select case
           when extract(minute from now_min_sp) = 0  then date_trunc('hour', now_min_sp)
           when extract(minute from now_min_sp) = 30 then date_trunc('hour', now_min_sp) + interval '30 minutes'
           when extract(minute from now_min_sp) < 30 then date_trunc('hour', now_min_sp) + interval '30 minutes'
           else date_trunc('hour', now_min_sp) + interval '1 hour'
         end as slot_sp
    from params
)
select slot_sp,
       (slot_sp + interval '30 minutes')::time as hora_alvo,
       case when extract(dow from slot_sp) = 0 then 7 else extract(dow from slot_sp)::integer end as dia_alvo,
       date_trunc('month', slot_sp)::date as mes_corrente
  from slot;

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','a0000001-0000-4000-8000-000000000001','authenticated','authenticated','free9@teste.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000','a0000002-0000-4000-8000-000000000002','authenticated','authenticated','free10@teste.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000','a0000003-0000-4000-8000-000000000003','authenticated','authenticated','pro@teste.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000','a0000004-0000-4000-8000-000000000004','authenticated','authenticated','fundador@teste.local', now(), now());

insert into public.profissionais (id, usuario_id, nome, email, usuario_fundador) values
  ('b0000001-0000-4000-8000-000000000001','a0000001-0000-4000-8000-000000000001','Free com nove','free9@teste.local', false),
  ('b0000002-0000-4000-8000-000000000002','a0000002-0000-4000-8000-000000000002','Free com dez','free10@teste.local', false),
  ('b0000003-0000-4000-8000-000000000003','a0000003-0000-4000-8000-000000000003','Assinante pro','pro@teste.local', false),
  ('b0000004-0000-4000-8000-000000000004','a0000004-0000-4000-8000-000000000004','Fundadora','fundador@teste.local', true);

insert into public.assinaturas (profissional_id, plano, status, store, expira_em) values
  ('b0000003-0000-4000-8000-000000000003','pro','ativo','app_store', now() + interval '30 days');

insert into public.pacientes (id, usuario_id, nome_completo, telefone, receber_sms) values
  ('c0000001-0000-4000-8000-000000000001','a0000001-0000-4000-8000-000000000001','Paciente Free Nove','+5521999990011', true),
  ('c0000002-0000-4000-8000-000000000002','a0000002-0000-4000-8000-000000000002','Paciente Free Dez','+5521999990012', true),
  ('c0000003-0000-4000-8000-000000000003','a0000003-0000-4000-8000-000000000003','Paciente Pro','+5521999990013', true),
  ('c0000004-0000-4000-8000-000000000004','a0000004-0000-4000-8000-000000000004','Paciente Fundadora','+5521999990014', true);

insert into public.agenda_semana_padrao (id, usuario_id, paciente_id, dia_semana, hora_inicio, hora_fim)
select v.id, v.usuario_id, v.paciente_id, j.dia_alvo, j.hora_alvo, j.hora_alvo + interval '50 minutes'
  from janela_teste j,
       (values
         ('d0000001-0000-4000-8000-000000000001'::uuid,'a0000001-0000-4000-8000-000000000001'::uuid,'c0000001-0000-4000-8000-000000000001'::uuid),
         ('d0000002-0000-4000-8000-000000000002'::uuid,'a0000002-0000-4000-8000-000000000002'::uuid,'c0000002-0000-4000-8000-000000000002'::uuid),
         ('d0000003-0000-4000-8000-000000000003'::uuid,'a0000003-0000-4000-8000-000000000003'::uuid,'c0000003-0000-4000-8000-000000000003'::uuid),
         ('d0000004-0000-4000-8000-000000000004'::uuid,'a0000004-0000-4000-8000-000000000004'::uuid,'c0000004-0000-4000-8000-000000000004'::uuid)
       ) as v(id, usuario_id, paciente_id);

-- Consumo do mês, escrito direto no contador para não depender do trigger aqui:
-- 9 para o primeiro, 10 para o segundo, 40 para o pro e 50 para a fundadora.
insert into public.uso_mensal (profissional_id, mes, sms_enviados)
select p.id, j.mes_corrente, p.qtd
  from janela_teste j,
       (values
         ('b0000001-0000-4000-8000-000000000001'::uuid,  9),
         ('b0000002-0000-4000-8000-000000000002'::uuid, 10),
         ('b0000003-0000-4000-8000-000000000003'::uuid, 40),
         ('b0000004-0000-4000-8000-000000000004'::uuid, 50)
       ) as p(id, qtd);

select isnt_empty(
  $$ select 1 from public.v_sms_lembretes_pendentes where agenda_id = 'd0000001-0000-4000-8000-000000000001' $$,
  'free com 9 de 10 continua na fila (regra 11.5)');

select is_empty(
  $$ select 1 from public.v_sms_lembretes_pendentes where agenda_id = 'd0000002-0000-4000-8000-000000000002' $$,
  'free com 10 de 10 sai da fila, mesmo com receber_sms verdadeiro (criterio de 8.11)');

select isnt_empty(
  $$ select 1 from public.v_sms_lembretes_pendentes where agenda_id = 'd0000003-0000-4000-8000-000000000003' $$,
  'pro com 40 SMS no mes continua na fila (criterio de 8.11)');

select isnt_empty(
  $$ select 1 from public.v_sms_lembretes_pendentes where agenda_id = 'd0000004-0000-4000-8000-000000000004' $$,
  'fundadora com 50 SMS no mes nunca e bloqueada (regra 11.5 e criterio de 8.11)');

-- O mesmo profissional do caso 2, virando pro, volta a aparecer (criterio 8.11).
insert into public.assinaturas (profissional_id, plano, status, store, expira_em)
values ('b0000002-0000-4000-8000-000000000002','pro','ativo','play_store', now() + interval '30 days');

select isnt_empty(
  $$ select 1 from public.v_sms_lembretes_pendentes where agenda_id = 'd0000002-0000-4000-8000-000000000002' $$,
  'o bloqueado volta a fila assim que vira pro (criterio de 8.11)');

select * from finish();
rollback;
