-- =============================================================================
-- Teste — fn_uso_mensal_incrementa
--
-- Cobre os casos da seção 22: insert simples, insert de mês diferente e
-- agendamento órfão.
--
-- Regras verificadas: 11.5 (uma linha em sms_lembretes_enviados conta 1; mês de
-- referência em America/Sao_Paulo) e 7.4 (o profissional é derivado em dois
-- saltos, porque o log de SMS não tem usuario_id).
-- =============================================================================
begin;
select plan(7);

-- Fixture: dois donos de agenda. O segundo existe em auth.users mas não tem
-- ficha em profissionais — é o caso órfão, igual às 3 contas de 3.1 do spec.
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','cccc0001-0000-4000-8000-000000000001','authenticated','authenticated','dona@teste.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000','cccc0002-0000-4000-8000-000000000002','authenticated','authenticated','orfa@teste.local', now(), now());

insert into public.profissionais (id, usuario_id, nome, email, usuario_fundador) values
  ('dddd0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','Dona da agenda','dona@teste.local', false);

insert into public.pacientes (id, usuario_id, nome_completo, telefone, receber_sms) values
  ('eeee0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','Paciente da dona','+5521999990001', true),
  ('eeee0002-0000-4000-8000-000000000002','cccc0002-0000-4000-8000-000000000002','Paciente da orfa','+5521999990002', true);

insert into public.agenda_semana_padrao (id, usuario_id, paciente_id, dia_semana, hora_inicio, hora_fim) values
  ('ffff0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','eeee0001-0000-4000-8000-000000000001', 4, '14:00', '14:50'),
  ('ffff0002-0000-4000-8000-000000000002','cccc0002-0000-4000-8000-000000000002','eeee0002-0000-4000-8000-000000000002', 4, '15:00', '15:50');

-- ---------------------------------------------------------------------------
-- Caso 1 — insert simples: o contador do mês nasce em 1.
-- ---------------------------------------------------------------------------
insert into public.sms_lembretes_enviados (agenda_id, ocorrencia_inicio, ocorrencia_data, enviado_em)
values ('ffff0001-0000-4000-8000-000000000001', '2026-09-10 17:00:00+00', '2026-09-10', '2026-09-10 17:00:00+00');

select is(
  (select sms_enviados from public.uso_mensal
    where profissional_id = 'dddd0001-0000-4000-8000-000000000001' and mes = '2026-09-01'),
  1, 'o primeiro SMS do mes cria a linha do contador com 1 (regra 11.5)');

-- ---------------------------------------------------------------------------
-- Caso 2 — segundo SMS do mesmo mês soma no lugar de criar linha nova.
-- ---------------------------------------------------------------------------
insert into public.sms_lembretes_enviados (agenda_id, ocorrencia_inicio, ocorrencia_data, enviado_em)
values ('ffff0001-0000-4000-8000-000000000001', '2026-09-17 17:00:00+00', '2026-09-17', '2026-09-17 17:00:00+00');

select is(
  (select sms_enviados from public.uso_mensal
    where profissional_id = 'dddd0001-0000-4000-8000-000000000001' and mes = '2026-09-01'),
  2, 'o segundo SMS do mes soma no mesmo contador (regra 11.5)');

select is(
  (select count(*)::integer from public.uso_mensal
    where profissional_id = 'dddd0001-0000-4000-8000-000000000001'),
  1, 'dois SMS no mesmo mes nao criam duas linhas de uso_mensal');

-- ---------------------------------------------------------------------------
-- Caso 3 — mês diferente abre linha nova e não mexe na anterior.
-- ---------------------------------------------------------------------------
insert into public.sms_lembretes_enviados (agenda_id, ocorrencia_inicio, ocorrencia_data, enviado_em)
values ('ffff0001-0000-4000-8000-000000000001', '2026-10-01 17:00:00+00', '2026-10-01', '2026-10-01 17:00:00+00');

select is(
  (select sms_enviados from public.uso_mensal
    where profissional_id = 'dddd0001-0000-4000-8000-000000000001' and mes = '2026-10-01'),
  1, 'SMS de outubro abre contador proprio (virada de mes, fluxo 9.4)');

select is(
  (select sms_enviados from public.uso_mensal
    where profissional_id = 'dddd0001-0000-4000-8000-000000000001' and mes = '2026-09-01'),
  2, 'o contador de setembro nao muda quando outubro comeca');

-- ---------------------------------------------------------------------------
-- Caso 4 — fuso: 1º de outubro às 00:30 de Brasília é 03:30 UTC e conta em
-- outubro; 30 de setembro às 23:30 de Brasília é 1º de outubro 02:30 UTC e
-- precisa continuar contando em setembro (regra 11.5 e 11.8).
-- ---------------------------------------------------------------------------
insert into public.sms_lembretes_enviados (agenda_id, ocorrencia_inicio, ocorrencia_data, enviado_em)
values ('ffff0001-0000-4000-8000-000000000001', '2026-10-01 02:30:00+00', '2026-09-30', '2026-10-01 02:30:00+00');

select is(
  (select sms_enviados from public.uso_mensal
    where profissional_id = 'dddd0001-0000-4000-8000-000000000001' and mes = '2026-09-01'),
  3, '23:30 de 30/09 em Brasilia conta em setembro, nao em outubro (regra 11.8)');

-- ---------------------------------------------------------------------------
-- Caso 5 — agendamento de dono sem ficha em profissionais: o SMS é registrado
-- e nada é debitado. O insert não pode falhar por causa disso (seção 22).
-- ---------------------------------------------------------------------------
insert into public.sms_lembretes_enviados (agenda_id, ocorrencia_inicio, ocorrencia_data, enviado_em)
values ('ffff0002-0000-4000-8000-000000000002', '2026-09-10 18:00:00+00', '2026-09-10', '2026-09-10 18:00:00+00');

select is(
  (select count(*)::integer from public.sms_lembretes_enviados
    where agenda_id = 'ffff0002-0000-4000-8000-000000000002'),
  1, 'agendamento orfao registra o SMS sem quebrar o insert (secao 22)');

select * from finish();
rollback;
