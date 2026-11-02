-- Teste — as funções agentpsi_* não são mais endpoint para anon nem authenticated.
begin;
select plan(4);

select ok(not has_function_privilege('anon',
  'public.agentpsi_registrar_pagamento(uuid, text, integer, date, text, text, text)', 'execute'),
  'anon nao registra pagamento na conta de ninguem');

select ok(not has_function_privilege('authenticated',
  'public.agentpsi_consultar_paciente(uuid, text)', 'execute'),
  'authenticated nao le paciente de outro uuid');

select ok(not has_function_privilege('anon', 'public.agentpsi_dashboard(uuid)', 'execute'),
  'anon nao le dashboard de ninguem');

-- demo_uid fica: as policies de DELETE dependem dela.
select ok(has_function_privilege('authenticated', 'public.demo_uid()', 'execute'),
  'demo_uid continua executavel, senao excluir quebra no app');

select * from finish();
rollback;
