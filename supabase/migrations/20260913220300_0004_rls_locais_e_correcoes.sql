-- =============================================================================
-- Agenda Psi — Migration 0004 — RLS de locais e correções de dados
--
-- O que faz: fecha as quatro policies permissivas das duas tabelas do módulo de
-- Locais de atendimento, protege a mensagem do SMS contra profissional_nome
-- nulo, e tenta preencher o profissional_id dos pacientes que estão sem ele.
--
-- Regras do spec: 6.5 (autorização no banco), 7.5 (migration 0004),
-- 7.2 (os 2 pacientes com profissional_id nulo), 11.9 item 13 (RLS permissiva),
-- 8.10 (critério de aceite de isolamento sem tela), 26 (Definition of Done).
--
-- Por que corrigir uma tabela sem tela: o módulo de Locais saiu do MVP (spec 3),
-- mas as tabelas continuam no banco, com dados, e as policies continuam valendo
-- para qualquer usuário autenticado. Um buraco de RLS não some porque a tela
-- sumiu. Quando o módulo voltar (spec 28.8), volta com a RLS já certa.
--
-- Decisão registrada (pergunta 25.3/25.9, respondida em 13/09/2026): corrigir a
-- RLS e deixar os dados parados. As tabelas não são desativadas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- locais_atendimento — escrita só do autor
--
-- Antes: locais_atendimento_update_auth e _delete_auth tinham using (true), ou
-- seja, qualquer autenticado editava e apagava qualquer local (defeito 11.9.13).
-- Depois: leitura segue aberta ao autenticado — o filtro de aprovado vive na
-- view view_locais_atendimento_cards, não na policy (spec 6.5) — e update e
-- delete exigem ser o autor.
-- -----------------------------------------------------------------------------
drop policy if exists locais_atendimento_update_auth on public.locais_atendimento;
drop policy if exists locais_atendimento_delete_auth on public.locais_atendimento;
drop policy if exists locais_atendimento_insert_auth on public.locais_atendimento;

create policy locais_atendimento_insert_proprio
  on public.locais_atendimento for insert to authenticated
  with check (criado_por_usuario_id = auth.uid());

comment on policy locais_atendimento_insert_proprio on public.locais_atendimento is
  'Só deixa criar local em nome de si mesmo (spec 6.5). Nenhuma tela da v1 usa; a policy existe porque a tabela existe.';

create policy locais_atendimento_update_proprio
  on public.locais_atendimento for update to authenticated
  using (criado_por_usuario_id = auth.uid())
  with check (criado_por_usuario_id = auth.uid());

comment on policy locais_atendimento_update_proprio on public.locais_atendimento is
  'Corrige o using (true) que deixava qualquer autenticado editar qualquer local (spec 6.5 e defeito 11.9.13).';

create policy locais_atendimento_delete_proprio
  on public.locais_atendimento for delete to authenticated
  using (criado_por_usuario_id = auth.uid());

comment on policy locais_atendimento_delete_proprio on public.locais_atendimento is
  'Corrige o using (true) que deixava qualquer autenticado apagar qualquer local (spec 6.5 e defeito 11.9.13).';

-- -----------------------------------------------------------------------------
-- comentarios_locais_atendimento — leitura só do aprovado, escrita só do autor
-- -----------------------------------------------------------------------------
drop policy if exists comentarios_locais_select_auth on public.comentarios_locais_atendimento;
drop policy if exists comentarios_locais_insert_auth on public.comentarios_locais_atendimento;
drop policy if exists comentarios_locais_update_auth on public.comentarios_locais_atendimento;
drop policy if exists comentarios_locais_delete_auth on public.comentarios_locais_atendimento;

create policy comentarios_locais_select_aprovado
  on public.comentarios_locais_atendimento for select to authenticated
  using (status = 'aprovado');

comment on policy comentarios_locais_select_aprovado on public.comentarios_locais_atendimento is
  'Leitura só de comentário aprovado (spec 6.5). Fecha a divergência entre a tela, que mostrava todos os status, e o cartão, que contava só os aprovados (defeito 11.9.9).';

create policy comentarios_locais_insert_proprio
  on public.comentarios_locais_atendimento for insert to authenticated
  with check (criado_por_usuario_id = auth.uid());

comment on policy comentarios_locais_insert_proprio on public.comentarios_locais_atendimento is
  'Só deixa comentar em nome de si mesmo (spec 6.5).';

create policy comentarios_locais_update_proprio
  on public.comentarios_locais_atendimento for update to authenticated
  using (criado_por_usuario_id = auth.uid())
  with check (criado_por_usuario_id = auth.uid());

comment on policy comentarios_locais_update_proprio on public.comentarios_locais_atendimento is
  'Corrige o using (true) que deixava qualquer autenticado editar qualquer comentário (spec 6.5 e defeito 11.9.13).';

create policy comentarios_locais_delete_proprio
  on public.comentarios_locais_atendimento for delete to authenticated
  using (criado_por_usuario_id = auth.uid());

comment on policy comentarios_locais_delete_proprio on public.comentarios_locais_atendimento is
  'Corrige o using (true) que deixava qualquer autenticado apagar qualquer comentário (spec 6.5 e defeito 11.9.13).';

-- -----------------------------------------------------------------------------
-- Pacientes sem profissional_id (spec 7.2)
--
-- Preenche o profissional_id a partir do usuario_id, do mesmo jeito que o
-- trigger trg_pacientes_sync_ids faz no insert. É idempotente e não toca em
-- quem já está preenchido.
--
-- Verificado em 13/09/2026: os 2 pacientes nesta situação pertencem a um
-- usuario_id que NÃO tem ficha em profissionais — é uma das 3 contas órfãs de
-- 3.1 e do defeito 11.9.10. Para eles este update não tem o que preencher e não
-- muda nada; a linha só se resolve quando a conta órfã completar o cadastro no
-- primeiro login (spec 6.2). Por isso a proteção da mensagem do SMS, abaixo,
-- é a correção que de fato fecha o problema.
-- -----------------------------------------------------------------------------
update public.pacientes p
   set profissional_id = pr.id
  from public.profissionais pr
 where p.profissional_id is null
   and pr.usuario_id = p.usuario_id;

-- -----------------------------------------------------------------------------
-- v_sms_lembretes_pendentes — mensagem protegida contra nome nulo
--
-- Antes: a mensagem era uma concatenação direta com unaccent(profissional_nome).
-- Com profissional_id nulo no paciente, o LEFT JOIN devolve nulo, a concatenação
-- inteira vira nulo e o lembrete sai vazio (spec 7.2).
-- Depois: o nome do profissional é procurado primeiro pelo paciente e, na falta,
-- pelo dono do agendamento; e se mesmo assim não houver nome, a mensagem sai sem
-- a parte do profissional em vez de sair nula.
--
-- Nenhuma mensagem que hoje sai muda de texto — o caminho novo só é usado onde
-- hoje o resultado é nulo, isto é, onde nada é enviado.
--
-- Esta versão da view NÃO bloqueia ninguém: o corte do paywall é a migration
-- 0008, aplicada junto com o épico 8.11.
-- -----------------------------------------------------------------------------
create or replace view public.v_sms_lembretes_pendentes as
 with params as (
         select (now() at time zone 'America/Sao_Paulo'::text) as now_sp,
            date_trunc('minute'::text, (now() at time zone 'America/Sao_Paulo'::text)) as now_min_sp
        ), slot as (
         select params.now_sp,
                case
                    when (extract(minute from params.now_min_sp) = (0)::numeric) then date_trunc('hour'::text, params.now_min_sp)
                    when (extract(minute from params.now_min_sp) = (30)::numeric) then (date_trunc('hour'::text, params.now_min_sp) + '00:30:00'::interval)
                    when (extract(minute from params.now_min_sp) < (30)::numeric) then (date_trunc('hour'::text, params.now_min_sp) + '00:30:00'::interval)
                    else (date_trunc('hour'::text, params.now_min_sp) + '01:00:00'::interval)
                end as slot_sp
           from params
        ), janela as (
         select slot.slot_sp,
            (slot.slot_sp + '00:30:00'::interval) as win_start_sp,
            (slot.slot_sp + '01:00:00'::interval) as win_end_sp,
                case
                    when (extract(dow from slot.slot_sp) = (0)::numeric) then 7
                    else (extract(dow from slot.slot_sp))::integer
                end as dow_1_7,
            (slot.slot_sp)::date as hoje_sp
           from slot
        ), candidatos as (
         select a.id as agenda_id,
            a.usuario_id,
            a.paciente_id,
            p.nome_completo as paciente_nome,
            p.telefone,
            p.profissional_id,
            -- Nome do profissional: pelo paciente e, na falta dele, pelo dono do
            -- agendamento. Sem isso a mensagem inteira vira nula (spec 7.2).
            coalesce(pr.nome, pr_ag.nome) as profissional_nome,
            -- Profissional dono do agendamento. Não é usado aqui; é por ele que
            -- a migration 0008 aplica o limite do plano (regra 11.5).
            pr_ag.id as profissional_id_agenda,
            a.dia_semana,
            a.hora_inicio,
            j.slot_sp,
            j.win_start_sp,
            j.win_end_sp,
            j.dow_1_7,
            j.hoje_sp,
            (date_trunc('day'::text, j.slot_sp) + (a.hora_inicio)::interval) as ocorrencia_inicio_sp
           from ((((agenda_semana_padrao a
             join pacientes p on ((p.id = a.paciente_id)))
             left join profissionais pr on ((pr.id = p.profissional_id)))
             left join profissionais pr_ag on ((pr_ag.usuario_id = a.usuario_id)))
             cross join janela j)
          where ((p.receber_sms = true) and (p.telefone is not null) and (a.dia_semana = j.dow_1_7))
        ), filtrados as (
         select c.*,
            to_char(c.ocorrencia_inicio_sp, 'HH24:MI'::text) as horario_sessao
           from candidatos c
          where ((c.ocorrencia_inicio_sp >= c.win_start_sp) and (c.ocorrencia_inicio_sp < c.win_end_sp))
        )
 select f.agenda_id,
    f.usuario_id,
    f.profissional_id,
    f.profissional_nome,
    f.paciente_id,
    f.paciente_nome,
    f.telefone,
    (f.ocorrencia_inicio_sp at time zone 'America/Sao_Paulo'::text) as ocorrencia_inicio,
    f.hoje_sp as ocorrencia_data,
    f.horario_sessao,
    case
      when f.profissional_nome is null
        then (('Ola '::text || unaccent(f.paciente_nome)) || '. Sua consulta vai comecar em alguns minutos.'::text)
      else (((('Ola '::text || unaccent(f.paciente_nome)) || '. Sua consulta com o(a) '::text) || unaccent(f.profissional_nome)) || ' vai comecar em alguns minutos.'::text)
    end as mensagem_sms
   from (filtrados f
     left join sms_lembretes_enviados l on (((l.agenda_id = f.agenda_id) and (l.ocorrencia_data = f.hoje_sp))))
  where (l.id is null);

comment on view public.v_sms_lembretes_pendentes is
  'Fila de lembretes por SMS do próximo slot de 30 minutos, com a mensagem protegida contra profissional_nome nulo (spec 7.2). Ainda sem o corte do paywall, que entra na migration 0008 (spec 11.5 e 8.11).';
