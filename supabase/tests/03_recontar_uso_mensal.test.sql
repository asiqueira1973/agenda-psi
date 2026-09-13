-- =============================================================================
-- Teste — recontar_uso_mensal
--
-- Caso da seção 22: a recontagem bate com o count direto do log.
-- Regra verificada: 7.3 (rede de segurança do contador) e risco 23.10.
-- =============================================================================
begin;
select plan(4);

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','cccc1001-0000-4000-8000-000000000001','authenticated','authenticated','recont@teste.local', now(), now());

insert into public.profissionais (id, usuario_id, nome, email) values
  ('dddd1001-0000-4000-8000-000000000001','cccc1001-0000-4000-8000-000000000001','Dona recontagem','recont@teste.local');

insert into public.pacientes (id, usuario_id, nome_completo, telefone, receber_sms) values
  ('eeee1001-0000-4000-8000-000000000001','cccc1001-0000-4000-8000-000000000001','Paciente recontagem','+5521999991001', true);

insert into public.agenda_semana_padrao (id, usuario_id, paciente_id, dia_semana, hora_inicio, hora_fim) values
  ('ffff1001-0000-4000-8000-000000000001','cccc1001-0000-4000-8000-000000000001','eeee1001-0000-4000-8000-000000000001', 2, '09:00', '09:50');

insert into public.sms_lembretes_enviados (agenda_id, ocorrencia_inicio, ocorrencia_data, enviado_em)
select 'ffff1001-0000-4000-8000-000000000001',
       ('2026-09-01'::date + d)::timestamptz,
       ('2026-09-01'::date + d),
       ('2026-09-01'::date + d)::timestamptz + interval '13 hours'
  from generate_series(0, 6) d;

-- Simula a divergência do risco 23.10: alguém mexeu no contador.
update public.uso_mensal set sms_enviados = 99
 where profissional_id = 'dddd1001-0000-4000-8000-000000000001' and mes = '2026-09-01';

select is(
  (select sms_enviados from public.uso_mensal
    where profissional_id = 'dddd1001-0000-4000-8000-000000000001' and mes = '2026-09-01'),
  99, 'o contador esta divergente antes da recontagem');

select is(public.recontar_uso_mensal('2026-09-15'::date), 1,
  'a recontagem reescreve uma linha e aceita qualquer data dentro do mes');

select is(
  (select sms_enviados from public.uso_mensal
    where profissional_id = 'dddd1001-0000-4000-8000-000000000001' and mes = '2026-09-01'),
  7, 'depois da recontagem o contador bate com o log');

select is(
  (select u.sms_enviados from public.uso_mensal u
    where u.profissional_id = 'dddd1001-0000-4000-8000-000000000001' and u.mes = '2026-09-01'),
  (select count(*)::integer from public.sms_lembretes_enviados l
     join public.agenda_semana_padrao a on a.id = l.agenda_id
    where a.usuario_id = 'cccc1001-0000-4000-8000-000000000001'
      and date_trunc('month', (l.enviado_em at time zone 'America/Sao_Paulo'))::date = '2026-09-01'),
  'recontagem e count direto do log dao o mesmo numero (secao 22)');

select * from finish();
rollback;
