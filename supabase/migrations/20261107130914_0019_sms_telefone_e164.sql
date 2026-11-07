-- =============================================================================
-- 0019 — Telefone no formato internacional (+55…) para o envio de SMS
-- =============================================================================
--
-- POR QUE (investigação de 07/11/2026, a partir do feedback de
-- mmspeixoto@outlook.com: "o SMS não chegou")
--
-- O fluxo do n8n manda à Bird o telefone EXATAMENTE como foi digitado no
-- cadastro. A Bird só aceita o formato internacional (+ e código do país) e
-- devolve 422 para o resto. Como o fluxo processa os pacientes em sequência, o
-- primeiro número recusado derrubava a rodada inteira — inclusive quem estava
-- certo. Na sexta 06/11, as rodadas das 18:00, 18:30 e 20:30 caíram assim.
--
-- Dos 117 pacientes com SMS ligado e horário na agenda, 53 nunca tinham
-- recebido um lembrete. Pior: "+47 9…" (DDD de Santa Catarina digitado com + e
-- sem o 55) era lido pela Bird como Noruega.
--
-- O QUE MUDA
--
-- 1. `telefone_e164(text)`: normaliza para +55…, sem tocar no cadastro:
--      55 + DDD + número (12–13 dígitos)  → +55…
--      55 + 0 + DDD + número              → tira o zero de discagem
--      [0]DDD + número (10–11 dígitos)    → acrescenta +55
--      + estrangeiro (não começa por 55)  → mantém
--      qualquer outra coisa               → NULL
--    Limitação conhecida: um número dos EUA com 11 dígitos (+1 DDD…) seria lido
--    como brasileiro. O app é para consultórios no Brasil; aceitamos.
-- 2. `v_sms_lembretes_pendentes` entrega o telefone já normalizado (mesmo nome
--    de coluna: o n8n não muda) e deixa de fora quem não dá para normalizar —
--    fica sem SMS, como já ficava, mas não derruba a rodada dos outros.
--
-- Em 07/11/2026, sobre os 206 pacientes ativos com SMS ligado: 107 já estavam
-- certos, 81 foram corrigidos, 1 estrangeiro, 17 ficam de fora (9 dígitos sem
-- DDD, ou dígitos a mais).
--
-- Complemento no n8n (feito pelo Alexandre): nó "Envia SMS" com On Error =
-- Continue, para um número recusado não parar os outros.
-- =============================================================================

create or replace function public.telefone_e164(bruto text)
returns text
language sql
immutable
set search_path = ''
as $$
  with d as (
    select regexp_replace(coalesce(bruto, ''), '\D', '', 'g') as dig,
           btrim(coalesce(bruto, '')) like '+%' as mais
  )
  select case
    when dig ~ '^55[1-9][1-9][0-9]{8,9}$' then '+' || dig
    when dig ~ '^550[1-9][1-9][0-9]{8,9}$' then '+55' || substr(dig, 4)
    when dig ~ '^0?[1-9][1-9][0-9]{8,9}$' then '+55' || regexp_replace(dig, '^0', '')
    when mais and dig !~ '^55' and length(dig) between 8 and 15 then '+' || dig
  end
  from d
$$;

comment on function public.telefone_e164(text) is
  'Telefone digitado no cadastro para o formato E.164 (+55…) que a Bird exige. NULL quando não dá para normalizar com segurança. 0019.';

-- Só o banco usa (a view). Não é endpoint.
revoke all on function public.telefone_e164(text) from public, anon, authenticated;

create or replace view public.v_sms_lembretes_pendentes as
WITH params AS (
         SELECT (now() AT TIME ZONE 'America/Sao_Paulo'::text) AS now_sp,
            date_trunc('minute'::text, (now() AT TIME ZONE 'America/Sao_Paulo'::text)) AS now_min_sp
        ), slot AS (
         SELECT params.now_sp,
                CASE
                    WHEN (EXTRACT(minute FROM params.now_min_sp) = (0)::numeric) THEN date_trunc('hour'::text, params.now_min_sp)
                    WHEN (EXTRACT(minute FROM params.now_min_sp) = (30)::numeric) THEN (date_trunc('hour'::text, params.now_min_sp) + '00:30:00'::interval)
                    WHEN (EXTRACT(minute FROM params.now_min_sp) < (30)::numeric) THEN (date_trunc('hour'::text, params.now_min_sp) + '00:30:00'::interval)
                    ELSE (date_trunc('hour'::text, params.now_min_sp) + '01:00:00'::interval)
                END AS slot_sp
           FROM params
        ), janela AS (
         SELECT slot.slot_sp,
            (slot.slot_sp + '00:30:00'::interval) AS win_start_sp,
            (slot.slot_sp + '01:00:00'::interval) AS win_end_sp,
                CASE
                    WHEN (EXTRACT(dow FROM slot.slot_sp) = (0)::numeric) THEN 7
                    ELSE (EXTRACT(dow FROM slot.slot_sp))::integer
                END AS dow_1_7,
            (slot.slot_sp)::date AS hoje_sp
           FROM slot
        ), candidatos AS (
         SELECT a.id AS agenda_id,
            a.usuario_id,
            a.paciente_id,
            p.nome_completo AS paciente_nome,
            public.telefone_e164(p.telefone) AS telefone,
            p.profissional_id,
            COALESCE(pr.nome, pr_ag.nome) AS profissional_nome,
            pr_ag.id AS profissional_id_agenda,
            a.dia_semana,
            a.hora_inicio,
            j.slot_sp,
            j.win_start_sp,
            j.win_end_sp,
            j.dow_1_7,
            j.hoje_sp,
            (date_trunc('day'::text, j.slot_sp) + (a.hora_inicio)::interval) AS ocorrencia_inicio_sp
           FROM ((((agenda_semana_padrao a
             JOIN pacientes p ON ((p.id = a.paciente_id)))
             LEFT JOIN profissionais pr ON ((pr.id = p.profissional_id)))
             LEFT JOIN profissionais pr_ag ON ((pr_ag.usuario_id = a.usuario_id)))
             CROSS JOIN janela j)
          WHERE ((p.receber_sms = true) AND (public.telefone_e164(p.telefone) IS NOT NULL) AND (a.dia_semana = j.dow_1_7))
        ), filtrados AS (
         SELECT c.agenda_id,
            c.usuario_id,
            c.paciente_id,
            c.paciente_nome,
            c.telefone,
            c.profissional_id,
            c.profissional_nome,
            c.profissional_id_agenda,
            c.dia_semana,
            c.hora_inicio,
            c.slot_sp,
            c.win_start_sp,
            c.win_end_sp,
            c.dow_1_7,
            c.hoje_sp,
            c.ocorrencia_inicio_sp,
            to_char(c.ocorrencia_inicio_sp, 'HH24:MI'::text) AS horario_sessao,
            limite_sms_do_plano(c.profissional_id_agenda) AS limite_sms,
            COALESCE(( SELECT u.sms_enviados
                   FROM uso_mensal u
                  WHERE ((u.profissional_id = c.profissional_id_agenda) AND (u.mes = (date_trunc('month'::text, c.slot_sp))::date))), 0) AS sms_usados_no_mes
           FROM candidatos c
          WHERE ((c.ocorrencia_inicio_sp >= c.win_start_sp) AND (c.ocorrencia_inicio_sp < c.win_end_sp))
        )
 SELECT f.agenda_id,
    f.usuario_id,
    f.profissional_id,
    f.profissional_nome,
    f.paciente_id,
    f.paciente_nome,
    f.telefone,
    (f.ocorrencia_inicio_sp AT TIME ZONE 'America/Sao_Paulo'::text) AS ocorrencia_inicio,
    f.hoje_sp AS ocorrencia_data,
    f.horario_sessao,
        CASE
            WHEN (f.profissional_nome IS NULL) THEN (('Ola '::text || unaccent(f.paciente_nome)) || '. Sua consulta vai comecar em alguns minutos.'::text)
            ELSE (((('Ola '::text || unaccent(f.paciente_nome)) || '. Sua consulta com o(a) '::text) || unaccent(f.profissional_nome)) || ' vai comecar em alguns minutos.'::text)
        END AS mensagem_sms
   FROM (filtrados f
     LEFT JOIN sms_lembretes_enviados l ON (((l.agenda_id = f.agenda_id) AND (l.ocorrencia_data = f.hoje_sp))))
  WHERE ((l.id IS NULL) AND ((f.limite_sms IS NULL) OR (f.sms_usados_no_mes < f.limite_sms)));
