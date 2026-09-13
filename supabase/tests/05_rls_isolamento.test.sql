-- =============================================================================
-- Teste — isolamento entre dois psicólogos (RLS)
--
-- É o teste que protege dado de saúde: o psicólogo A não lê nem escreve nada do
-- psicólogo B, em nenhuma tabela. Roda sempre (seção 22).
--
-- Regras verificadas: 5 (tabela de permissões), 6.5 (RLS), 11.9 item 13 (as
-- policies permissivas de locais e comentários) e o Definition of Done da 26,
-- que exige o teste inclusive nas duas tabelas de Locais, que não têm tela mas
-- continuam expostas.
-- =============================================================================
begin;
select plan(14);

-- --------------------------------------------------------------------------
-- Fixture criado como postgres, antes de assumir a identidade de A.
-- --------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','aaaa000a-0000-4000-8000-00000000000a','authenticated','authenticated','psi.a@teste.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000','bbbb000b-0000-4000-8000-00000000000b','authenticated','authenticated','psi.b@teste.local', now(), now());

insert into public.profissionais (id, usuario_id, nome, email) values
  ('1111000a-0000-4000-8000-00000000000a','aaaa000a-0000-4000-8000-00000000000a','Psi A','psi.a@teste.local'),
  ('1111000b-0000-4000-8000-00000000000b','bbbb000b-0000-4000-8000-00000000000b','Psi B','psi.b@teste.local');

insert into public.tipos_despesa (id, nome, ativo) values
  ('9999000e-0000-4000-8000-00000000000e','Aluguel de sala', true);

-- Tudo abaixo pertence ao psicólogo B.
insert into public.pacientes (id, usuario_id, nome_completo, telefone) values
  ('2222000b-0000-4000-8000-00000000000b','bbbb000b-0000-4000-8000-00000000000b','Paciente do B','+5521999990099');

insert into public.precos_paciente (usuario_id, paciente_id, preco) values
  ('bbbb000b-0000-4000-8000-00000000000b','2222000b-0000-4000-8000-00000000000b', 200);

insert into public.sessoes (usuario_id, paciente_id, ocorreu_em_dia, modalidade) values
  ('bbbb000b-0000-4000-8000-00000000000b','2222000b-0000-4000-8000-00000000000b', current_date, 'presencial');

insert into public.pagamentos (usuario_id, paciente_id, valor_pagamento, status) values
  ('bbbb000b-0000-4000-8000-00000000000b','2222000b-0000-4000-8000-00000000000b', 200, 'pago');

insert into public.despesas (usuario_id, tipo_despesa_id, valor_despesa, status) values
  ('bbbb000b-0000-4000-8000-00000000000b','9999000e-0000-4000-8000-00000000000e', 80, 'pago');

insert into public.agenda_semana_padrao (usuario_id, paciente_id, dia_semana, hora_inicio, hora_fim) values
  ('bbbb000b-0000-4000-8000-00000000000b','2222000b-0000-4000-8000-00000000000b', 3, '10:00', '10:50');

insert into public.assinaturas (profissional_id, plano, status, store) values
  ('1111000b-0000-4000-8000-00000000000b','pro','ativo','app_store');

insert into public.uso_mensal (profissional_id, mes, sms_enviados) values
  ('1111000b-0000-4000-8000-00000000000b', date_trunc('month', current_date)::date, 5);

-- Um local e dois comentários do B, um aprovado e um pendente.
insert into public.locais_atendimento (id, nome, cidade, estado, tipo_local, origem, status, criado_por_usuario_id) values
  ('3333000b-0000-4000-8000-00000000000b','Sala do B','Rio de Janeiro','RJ','consultorio','comunidade','aprovado','bbbb000b-0000-4000-8000-00000000000b');

insert into public.comentarios_locais_atendimento (id, local_atendimento_id, comentario, status, criado_por_usuario_id) values
  ('4444000b-0000-4000-8000-00000000000b','3333000b-0000-4000-8000-00000000000b','Comentario aprovado do B','aprovado','bbbb000b-0000-4000-8000-00000000000b'),
  ('5555000b-0000-4000-8000-00000000000b','3333000b-0000-4000-8000-00000000000b','Comentario pendente do B','pendente','bbbb000b-0000-4000-8000-00000000000b');

-- --------------------------------------------------------------------------
-- A partir daqui somos o psicólogo A, autenticado.
-- --------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaa000a-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(auth.uid(), 'aaaa000a-0000-4000-8000-00000000000a'::uuid,
  'o teste esta rodando como o psicologo A');

select is_empty($$ select 1 from public.pacientes where usuario_id = 'bbbb000b-0000-4000-8000-00000000000b' $$,
  'A nao le paciente de B (spec 5)');
select is_empty($$ select 1 from public.sessoes where usuario_id = 'bbbb000b-0000-4000-8000-00000000000b' $$,
  'A nao le sessao de B (spec 5)');
select is_empty($$ select 1 from public.pagamentos where usuario_id = 'bbbb000b-0000-4000-8000-00000000000b' $$,
  'A nao le pagamento de B (spec 5)');
select is_empty($$ select 1 from public.despesas where usuario_id = 'bbbb000b-0000-4000-8000-00000000000b' $$,
  'A nao le despesa de B (spec 5)');
select is_empty($$ select 1 from public.precos_paciente where usuario_id = 'bbbb000b-0000-4000-8000-00000000000b' $$,
  'A nao le preco de paciente de B (spec 5)');
select is_empty($$ select 1 from public.agenda_semana_padrao where usuario_id = 'bbbb000b-0000-4000-8000-00000000000b' $$,
  'A nao le agenda de B (spec 5)');
select is_empty($$ select 1 from public.profissionais where usuario_id = 'bbbb000b-0000-4000-8000-00000000000b' $$,
  'A nao le a ficha de B (spec 5)');
select is_empty($$ select 1 from public.assinaturas where profissional_id = '1111000b-0000-4000-8000-00000000000b' $$,
  'A nao le a assinatura de B (spec 6.5)');
select is_empty($$ select 1 from public.uso_mensal where profissional_id = '1111000b-0000-4000-8000-00000000000b' $$,
  'A nao le o consumo de SMS de B (spec 6.5)');

-- Comentário pendente não aparece nem para quem está autenticado (spec 6.5).
select is_empty($$ select 1 from public.comentarios_locais_atendimento where status <> 'aprovado' $$,
  'comentario pendente nao aparece para ninguem pelo app (spec 6.5)');

-- Escrita em assinaturas é proibida pelo app, para todo mundo (spec 5 e 12.1).
select throws_ok(
  $$ insert into public.assinaturas (profissional_id, plano) values ('1111000a-0000-4000-8000-00000000000a','pro') $$,
  '42501',
  null,
  'nenhum usuario do app grava em assinaturas (spec 5 e 12.1)');

-- As duas correções da migration 0004: A tenta editar e apagar o que e do B.
update public.locais_atendimento set nome = 'Invadido por A'
 where id = '3333000b-0000-4000-8000-00000000000b';
delete from public.comentarios_locais_atendimento
 where id = '4444000b-0000-4000-8000-00000000000b';

reset role;

select is(
  (select nome from public.locais_atendimento where id = '3333000b-0000-4000-8000-00000000000b'),
  'Sala do B',
  'A nao consegue editar local de B (defeito 11.9.13 corrigido na 0004)');

select is(
  (select count(*)::integer from public.comentarios_locais_atendimento where id = '4444000b-0000-4000-8000-00000000000b'),
  1,
  'A nao consegue apagar comentario de B (defeito 11.9.13 corrigido na 0004)');

select * from finish();
rollback;
