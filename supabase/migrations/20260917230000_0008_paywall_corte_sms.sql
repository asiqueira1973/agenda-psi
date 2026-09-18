-- =============================================================================
-- Agenda Psi — Migration 0008 — Corte do paywall na fila de SMS
--
-- O que faz: acrescenta a condição da regra 11.5 à v_sms_lembretes_pendentes.
-- Quem estourou o limite do mês deixa de aparecer na fila.
--
-- Regras do spec: 11.5 (limite de SMS), 8.11 (épico do paywall), 9.3 (do limite
-- ao pagamento), 12.1 (máquina de estado da assinatura).
--
-- ATENÇÃO — QUANDO APLICAR: só junto com o épico 8.11, com o app publicado
-- mostrando consumo, avisando na Home e vendendo o Pro. Esta é a migration que
-- de fato corta o SMS de gente real.
--
-- Por que ela existe separada da 0003: a seção 7.5 põe esta alteração junto com
-- as funções do paywall. Verificado no banco em 13/09/2026, aplicar as duas ao
-- mesmo tempo cortaria na hora os lembretes de 2 profissionais não-fundadores
-- que já passaram de 10 SMS no mês, sem nenhuma tela que explicasse o corte.
-- Alexandre decidiu separar. Registrado em Divergências.
--
-- Depende de: 0002 (uso_mensal), 0003 (limite_sms_do_plano e o trigger do
-- contador) e 0004 (esta mesma view, com a mensagem protegida). A view abaixo é
-- exatamente a da 0004 mais a condição do limite.
--
-- Como conferir depois de aplicar (critérios de aceite de 8.11):
--   1. free com 10 SMS no mês não aparece, mesmo com receber_sms verdadeiro;
--   2. o mesmo profissional, virando pro, volta a aparecer;
--   3. usuario_fundador nunca é bloqueado, em nenhum volume.
-- =============================================================================

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
            -- Profissional dono do agendamento: é por ele que o limite do
            -- plano é apurado, e não por pacientes.profissional_id, que é nulo
            -- em 2 dos 1.065 pacientes (spec 7.2). Nulo ali não pode virar SMS
            -- liberado por engano.
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
            to_char(c.ocorrencia_inicio_sp, 'HH24:MI'::text) as horario_sessao,
            -- Limite do plano e consumo do mês corrente, ambos em Brasília
            -- (regra 11.5 e 11.8). NULL em limite_sms significa ilimitado.
            public.limite_sms_do_plano(c.profissional_id_agenda) as limite_sms,
            coalesce((
              select u.sms_enviados
                from public.uso_mensal u
               where u.profissional_id = c.profissional_id_agenda
                 and u.mes = date_trunc('month', c.slot_sp)::date
            ), 0) as sms_usados_no_mes
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
  where (l.id is null)
    -- O paywall (regra 11.5): ilimitado passa; limitado só passa abaixo do teto.
    -- Quem estourou não entra na fila, nada é enviado e nada fica enfileirado
    -- para depois — não há reenvio retroativo após assinar (fluxo 9.3).
    and (f.limite_sms is null or f.sms_usados_no_mes < f.limite_sms);

comment on view public.v_sms_lembretes_pendentes is
  'Fila de lembretes por SMS do próximo slot de 30 minutos. Ponto único de enforcement do paywall: quem estourou o limite do mês não aparece aqui (spec 11.5 e 8.11). Mensagem protegida contra profissional_nome nulo (spec 7.2).';
