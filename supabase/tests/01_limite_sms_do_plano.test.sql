-- =============================================================================
-- Teste — limite_sms_do_plano
--
-- Cobre os casos da seção 22 do spec para a função de limite, mais os estados
-- da máquina 12.1 que decidem se o acesso Pro ainda vale.
--
-- Regras verificadas: 11.5 (limite do free é 10, pro e fundador são ilimitados,
-- ausência de linha em assinaturas é free), 11.6 (cancelado mantém acesso até
-- expira_em; expirado volta a free) e 12.1.
-- =============================================================================
begin;
select plan(9);

-- Fixture: um profissional por cenário. Nenhum deles toca em dado real.
insert into public.profissionais (id, usuario_id, nome, email, usuario_fundador) values
  ('aaaa0001-0000-4000-8000-000000000001','bbbb0001-0000-4000-8000-000000000001','Free sem assinatura','free.sem@teste.local', false),
  ('aaaa0002-0000-4000-8000-000000000002','bbbb0002-0000-4000-8000-000000000002','Free com linha',     'free.com@teste.local', false),
  ('aaaa0003-0000-4000-8000-000000000003','bbbb0003-0000-4000-8000-000000000003','Pro ativo',          'pro.ativo@teste.local', false),
  ('aaaa0004-0000-4000-8000-000000000004','bbbb0004-0000-4000-8000-000000000004','Pro em atraso',      'pro.atraso@teste.local', false),
  ('aaaa0005-0000-4000-8000-000000000005','bbbb0005-0000-4000-8000-000000000005','Pro cancelado vigente','pro.canc.ok@teste.local', false),
  ('aaaa0006-0000-4000-8000-000000000006','bbbb0006-0000-4000-8000-000000000006','Pro cancelado vencido','pro.canc.fim@teste.local', false),
  ('aaaa0007-0000-4000-8000-000000000007','bbbb0007-0000-4000-8000-000000000007','Pro expirado',       'pro.exp@teste.local', false),
  ('aaaa0008-0000-4000-8000-000000000008','bbbb0008-0000-4000-8000-000000000008','Fundador sem assinatura','fund.sem@teste.local', true),
  ('aaaa0009-0000-4000-8000-000000000009','bbbb0009-0000-4000-8000-000000000009','Fundador marcado free','fund.free@teste.local', true);

insert into public.assinaturas (profissional_id, plano, status, store, expira_em) values
  ('aaaa0002-0000-4000-8000-000000000002','free','ativo',    null,          null),
  ('aaaa0003-0000-4000-8000-000000000003','pro', 'ativo',    'app_store',   now() + interval '30 days'),
  ('aaaa0004-0000-4000-8000-000000000004','pro', 'em_atraso','play_store',  now() + interval '5 days'),
  ('aaaa0005-0000-4000-8000-000000000005','pro', 'cancelado','app_store',   now() + interval '10 days'),
  ('aaaa0006-0000-4000-8000-000000000006','pro', 'cancelado','app_store',   now() - interval '1 day'),
  ('aaaa0007-0000-4000-8000-000000000007','pro', 'expirado', 'app_store',   now() - interval '20 days'),
  ('aaaa0009-0000-4000-8000-000000000009','free','ativo',    null,          null);

select is(public.limite_sms_do_plano('aaaa0001-0000-4000-8000-000000000001'), 10,
  'sem linha em assinaturas o profissional e free, limite 10 (regra 11.5)');

select is(public.limite_sms_do_plano('aaaa0002-0000-4000-8000-000000000002'), 10,
  'plano free explicito tem limite 10 (regra 11.5)');

select is(public.limite_sms_do_plano('aaaa0003-0000-4000-8000-000000000003'), null,
  'pro ativo e ilimitado (regra 11.5)');

select is(public.limite_sms_do_plano('aaaa0004-0000-4000-8000-000000000004'), null,
  'pro em atraso mantem acesso durante o periodo de graca (regra 11.6)');

select is(public.limite_sms_do_plano('aaaa0005-0000-4000-8000-000000000005'), null,
  'pro cancelado mantem acesso ate expira_em (regra 11.6)');

select is(public.limite_sms_do_plano('aaaa0006-0000-4000-8000-000000000006'), 10,
  'pro cancelado depois de expira_em volta a free (regra 11.6 e maquina 12.1)');

select is(public.limite_sms_do_plano('aaaa0007-0000-4000-8000-000000000007'), 10,
  'pro expirado volta a free (maquina 12.1)');

select is(public.limite_sms_do_plano('aaaa0008-0000-4000-8000-000000000008'), null,
  'fundador e ilimitado mesmo sem linha em assinaturas (regra 11.5 e 11.6)');

select is(public.limite_sms_do_plano('aaaa0009-0000-4000-8000-000000000009'), null,
  'fundador e ilimitado mesmo marcado como free (regra 11.5)');

select * from finish();
rollback;
