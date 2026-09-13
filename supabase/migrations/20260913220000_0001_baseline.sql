

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';


-- -----------------------------------------------------------------------------
-- ACRESCENTADO AO DUMP — extensões
--
-- supabase db dump --schema public não versiona extensão nenhuma, e a view
-- v_sms_lembretes_pendentes chama unaccent() para montar a mensagem do SMS. Sem
-- esta linha o baseline não reconstrói o banco do zero: a criação da view falha
-- com "function unaccent(text) does not exist".
--
-- unaccent mora no schema public neste projeto, e não em extensions — é o que a
-- migration remota enable_unaccent_and_fix_sms_view deixou. Mantido igual para
-- não mudar a resolução de nome dentro da view.
--
-- pg_net e supabase_vault, usados pela migration 0005, já vêm instalados na
-- imagem do Supabase e por isso não são criados aqui.
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";



CREATE OR REPLACE FUNCTION "public"."agentpsi_consultar_paciente"("p_usuario_id" "uuid", "p_nome_paciente" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$declare
  v_paciente record;
  v_total_sessoes int;
  v_ultima_sessao date;
  v_sessoes_nao_pagas int;
  v_valor_atual int;
  v_sessoes json;
  v_pagamentos json;
  v_precos json;
begin
  -- paciente (ignora acento e aceita parcial)
  select *
  into v_paciente
  from public.pacientes
  where usuario_id = p_usuario_id
    and (
      lower(translate(nome_completo,
                      'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇáàâãéèêíìîóòôõúùûç',
                      'AAAAEEEIIIOOOOUUUCaaaaeeeiioooouuuc'))
      like '%' || lower(translate(p_nome_paciente,
                      'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇáàâãéèêíìîóòôõúùûç',
                      'AAAAEEEIIIOOOOUUUCaaaaeeeiioooouuuc')) || '%'
    )
  limit 1;

  if not found then
    return json_build_object('status','nao_encontrado');
  end if;

  -- total de sessões
  select count(*) into v_total_sessoes
  from public.sessoes
  where usuario_id = p_usuario_id
    and paciente_id = v_paciente.id;

  -- última sessão
  select max(ocorreu_em_dia) into v_ultima_sessao
  from public.sessoes
  where usuario_id = p_usuario_id
    and paciente_id = v_paciente.id;

  -- sessões não pagas
  select count(*) into v_sessoes_nao_pagas
  from public.pagamentos
  where usuario_id = p_usuario_id
    and paciente_id = v_paciente.id
    and status <> 'pago';

  -- valor atual
  select preco
  into v_valor_atual
  from public.precos_paciente
  where usuario_id = p_usuario_id
    and paciente_id = v_paciente.id
  order by vigencia_desde desc, criado_em desc
  limit 1;

  -- histórico de sessões
  select coalesce(json_agg(row_to_json(s)),'[]'::json)
  into v_sessoes
  from (
    select id,
           ocorreu_em_dia as data,
           ocorreu_em,
           status,
           modalidade,
           duracao_minutos,
           observacoes
    from public.sessoes
    where usuario_id = p_usuario_id
      and paciente_id = v_paciente.id
    order by ocorreu_em desc
    limit 50
  ) s;

  -- histórico de pagamentos
  select coalesce(json_agg(row_to_json(p)),'[]'::json)
  into v_pagamentos
  from (
    select id,
           coalesce(pago_em::date, vencimento_em, data_competencia) as data,
           valor_pagamento,
           status,
           metodo,
           observacoes,
           tipo
    from public.pagamentos
    where usuario_id = p_usuario_id
      and paciente_id = v_paciente.id
    order by coalesce(pago_em, vencimento_em, data_competencia) desc
    limit 50
  ) p;

  -- histórico de preços
  select coalesce(json_agg(row_to_json(pp)),'[]'::json)
  into v_precos
  from (
    select vigencia_desde as data,
           preco,
           observacoes,
           criado_em
    from public.precos_paciente
    where usuario_id = p_usuario_id
      and paciente_id = v_paciente.id
    order by vigencia_desde desc, criado_em desc
    limit 50
  ) pp;

  return json_build_object(
    'status','ok',
    'paciente', json_build_object(
      'id', v_paciente.id,
      'nome_completo', v_paciente.nome_completo,
      'status', v_paciente.status,
      'telefone', v_paciente.telefone,
      'email', v_paciente.email,
      'primeira_consulta', v_paciente.primeira_consulta,
      'observacoes', v_paciente.observacoes
    ),
    'resumo', json_build_object(
      'total_sessoes', coalesce(v_total_sessoes,0),
      'ultima_sessao', v_ultima_sessao,
      'sessoes_nao_pagas', coalesce(v_sessoes_nao_pagas,0),
      'valor_atual', v_valor_atual
    ),
    'historico_sessoes', v_sessoes,
    'historico_pagamentos', v_pagamentos,
    'historico_precos', v_precos
  );
end;$$;


ALTER FUNCTION "public"."agentpsi_consultar_paciente"("p_usuario_id" "uuid", "p_nome_paciente" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."agentpsi_criar_paciente"("p_usuario_id" "uuid", "p_nome_completo" "text", "p_telefone" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_observacoes" "text" DEFAULT NULL::"text", "p_primeira_consulta" "date" DEFAULT NULL::"date") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_paciente_id uuid;
begin
  insert into public.pacientes (
    usuario_id,
    nome_completo,
    telefone,
    email,
    observacoes,
    primeira_consulta
  ) values (
    p_usuario_id,
    p_nome_completo,
    p_telefone,
    p_email,
    p_observacoes,
    p_primeira_consulta
  )
  returning id into v_paciente_id;

  return json_build_object(
    'status','ok',
    'paciente_id', v_paciente_id
  );
end;
$$;


ALTER FUNCTION "public"."agentpsi_criar_paciente"("p_usuario_id" "uuid", "p_nome_completo" "text", "p_telefone" "text", "p_email" "text", "p_observacoes" "text", "p_primeira_consulta" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."agentpsi_dashboard"("p_usuario_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_payload json;
begin
  with
  limites as (
    select
      date_trunc('month', now()) as inicio_mes_corrente_utc,
      date_trunc('month', now()) - interval '1 month' as inicio_mes_anterior_utc
  ),
  base as (
    select
      l.inicio_mes_corrente_utc,
      l.inicio_mes_anterior_utc,
      l.inicio_mes_corrente_utc + interval '1 month' as fim_mes_corrente_utc,
      l.inicio_mes_anterior_utc + interval '1 month' as fim_mes_anterior_utc
    from limites l
  ),
  pac as (
    select count(*)::int as pacientes_ativos
    from public.pacientes p
    where p.usuario_id = p_usuario_id
      and p.status = 'ativo'
  ),
  ses_prev as (
    select count(*)::int as sessoes_mes_anterior
    from public.sessoes s
    join base b on true
    where s.usuario_id = p_usuario_id
      and s.status = 'realizada'
      and s.ocorreu_em >= b.inicio_mes_anterior_utc
      and s.ocorreu_em <  b.fim_mes_anterior_utc
  ),
  ses_curr as (
    select count(*)::int as sessoes_mes_corrente
    from public.sessoes s
    join base b on true
    where s.usuario_id = p_usuario_id
      and s.status = 'realizada'
      and s.ocorreu_em >= b.inicio_mes_corrente_utc
      and s.ocorreu_em <  b.fim_mes_corrente_utc
  ),
  pag_prev as (
    select coalesce(sum(pg.valor_pagamento), 0)::bigint as pagamentos_mes_anterior
    from public.pagamentos pg
    join base b on true
    where pg.usuario_id = p_usuario_id
      and pg.criado_em >= b.inicio_mes_anterior_utc
      and pg.criado_em <  b.fim_mes_anterior_utc
  ),
  pag_curr as (
    select coalesce(sum(pg.valor_pagamento), 0)::bigint as pagamentos_mes_corrente
    from public.pagamentos pg
    join base b on true
    where pg.usuario_id = p_usuario_id
      and pg.criado_em >= b.inicio_mes_corrente_utc
      and pg.criado_em <  b.fim_mes_corrente_utc
  ),
  des_prev as (
    select coalesce(sum(d.valor_despesa), 0)::bigint as despesas_mes_anterior
    from public.despesas d
    join base b on true
    where d.usuario_id = p_usuario_id
      and d.criado_em >= b.inicio_mes_anterior_utc
      and d.criado_em <  b.fim_mes_anterior_utc
  ),
  des_curr as (
    select coalesce(sum(d.valor_despesa), 0)::bigint as despesas_mes_corrente
    from public.despesas d
    join base b on true
    where d.usuario_id = p_usuario_id
      and d.criado_em >= b.inicio_mes_corrente_utc
      and d.criado_em <  b.fim_mes_corrente_utc
  )
  select jsonb_build_object(
    'pacientes_ativos', pac.pacientes_ativos,
    'sessoes_mes_anterior', ses_prev.sessoes_mes_anterior,
    'sessoes_mes_corrente', ses_curr.sessoes_mes_corrente,
    'pagamentos_mes_anterior', pag_prev.pagamentos_mes_anterior,
    'pagamentos_mes_corrente', pag_curr.pagamentos_mes_corrente,
    'despesas_mes_anterior', des_prev.despesas_mes_anterior,
    'despesas_mes_corrente', des_curr.despesas_mes_corrente,
    'rentabilidade_mes_anterior', (pag_prev.pagamentos_mes_anterior - des_prev.despesas_mes_anterior),
    'rentabilidade_mes_corrente', (pag_curr.pagamentos_mes_corrente - des_curr.despesas_mes_corrente),
    'margem_mes_corrente_pct',
      case
        when pag_curr.pagamentos_mes_corrente > 0
        then round(
          ( (pag_curr.pagamentos_mes_corrente - des_curr.despesas_mes_corrente)::numeric
            / pag_curr.pagamentos_mes_corrente::numeric * 100
          ),
          1
        )
        else 0
      end,
    'break_even_sessoes_mes_corrente',
      case
        when ses_curr.sessoes_mes_corrente > 0
             and (pag_curr.pagamentos_mes_corrente::numeric / nullif(ses_curr.sessoes_mes_corrente,0)) > 0
        then ceil(
          des_curr.despesas_mes_corrente::numeric
          / (pag_curr.pagamentos_mes_corrente::numeric / ses_curr.sessoes_mes_corrente::numeric)
        )::int
        else 0
      end
  )
  into v_payload
  from base
  cross join pac
  cross join ses_prev
  cross join ses_curr
  cross join pag_prev
  cross join pag_curr
  cross join des_prev
  cross join des_curr;

  return coalesce(
    v_payload,
    json_build_object('status', 'vazio')
  );
end;
$$;


ALTER FUNCTION "public"."agentpsi_dashboard"("p_usuario_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."agentpsi_listar_despesas_ultimas_30"("p_usuario_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_result json;
begin
  select coalesce(json_agg(row_to_json(x)), '[]'::json)
  into v_result
  from (
    select
      d.id,
      d.usuario_id,
      d.tipo_despesa_id,
      td.nome as tipo_despesa_nome,
      d.descricao,
      d.valor_despesa,
      d.status,
      d.metodo,
      d.data_competencia,
      d.pago_em,
      d.criado_em,
      coalesce(
        d.pago_em,
        d.data_competencia::timestamp with time zone,
        d.criado_em
      ) as data_referencia,
      d.observacoes
    from public.despesas d
      left join public.tipos_despesa td on td.id = d.tipo_despesa_id
    where d.usuario_id = p_usuario_id
    order by coalesce(
      d.pago_em,
      d.data_competencia::timestamp with time zone,
      d.criado_em
    ) desc
    limit 30
  ) x;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."agentpsi_listar_despesas_ultimas_30"("p_usuario_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."agentpsi_listar_pacientes_ativos"("p_usuario_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_pacientes json;
begin
  -- busca todos os pacientes ativos do usuário informado
  select coalesce(json_agg(row_to_json(p)), '[]'::json)
  into v_pacientes
  from (
    select
      id,
      nome_completo,
      status,
      telefone,
      email,
      primeira_consulta,
      criado_em
    from public.pacientes
    where usuario_id = p_usuario_id
      and status = 'ativo'
    order by nome_completo
  ) p;

  -- retorna json padronizado
  return json_build_object(
    'status', 'ok',
    'pacientes', v_pacientes
  );
end;
$$;


ALTER FUNCTION "public"."agentpsi_listar_pacientes_ativos"("p_usuario_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."agentpsi_listar_pagamentos_ultimos_30"("p_usuario_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_result json;
begin
  select coalesce(json_agg(row_to_json(x)), '[]'::json)
  into v_result
  from (
    select
      p.id,
      p.usuario_id,
      p.paciente_id,
      pac.nome_completo as paciente_nome,
      p.valor_pagamento,
      p.status,
      p.metodo,
      p.data_competencia,
      p.vencimento_em,
      p.pago_em,
      p.criado_em,
      p.tipo,
      p.observacoes,
      coalesce(
        p.pago_em,
        p.vencimento_em::timestamptz,
        p.data_competencia::timestamptz,
        p.criado_em
      ) as data_referencia
    from public.pagamentos p
      left join public.pacientes pac
        on pac.id = p.paciente_id
    where p.usuario_id = p_usuario_id
    order by coalesce(
      p.pago_em,
      p.vencimento_em::timestamptz,
      p.data_competencia::timestamptz,
      p.criado_em
    ) desc
    limit 30
  ) x;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."agentpsi_listar_pagamentos_ultimos_30"("p_usuario_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."agentpsi_registrar_despesa"("p_usuario_id" "uuid", "p_nome_tipo_despesa" "text", "p_valor_despesa" numeric, "p_data_competencia" "date", "p_descricao" "text", "p_metodo" "text", "p_observacoes" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_tipo_id uuid;
  v_despesa_id uuid;
begin
  select id into v_tipo_id
  from public.tipos_despesa
  where nome ilike p_nome_tipo_despesa
  limit 1;

  if v_tipo_id is null then
    raise exception 'Tipo de despesa "%" não encontrado', p_nome_tipo_despesa;
  end if;

  insert into public.despesas (
    usuario_id,
    tipo_despesa_id,
    descricao,
    valor_despesa,
    data_competencia,
    pago_em,
    metodo,
    observacoes,
    status
  ) values (
    p_usuario_id,
    v_tipo_id,
    p_descricao,
    p_valor_despesa,
    p_data_competencia,
    now(),
    p_metodo,
    p_observacoes,
    'pago'
  )
  returning id into v_despesa_id;

  return json_build_object(
    'status','ok',
    'despesa_id', v_despesa_id
  );
end;
$$;


ALTER FUNCTION "public"."agentpsi_registrar_despesa"("p_usuario_id" "uuid", "p_nome_tipo_despesa" "text", "p_valor_despesa" numeric, "p_data_competencia" "date", "p_descricao" "text", "p_metodo" "text", "p_observacoes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."agentpsi_registrar_pagamento"("p_usuario_id" "uuid", "p_nome_paciente" "text", "p_valor_pagamento" integer, "p_data_pagamento" "date" DEFAULT CURRENT_DATE, "p_metodo" "text" DEFAULT NULL::"text", "p_observacoes" "text" DEFAULT NULL::"text", "p_tipo" "text" DEFAULT 'por sessão'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$declare
  v_paciente_id uuid;
  v_pagamento_id uuid;
begin
  -- procura o paciente do usuário, ignorando acentos e aceitando pedaços do nome
  select id into v_paciente_id
  from public.pacientes
  where usuario_id = p_usuario_id
    and (
      lower(translate(nome_completo,
                      'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇáàâãéèêíìîóòôõúùûç',
                      'AAAAEEEIIIOOOOUUUCaaaaeeeiioooouuuc'))
      like '%' || lower(translate(p_nome_paciente,
                      'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇáàâãéèêíìîóòôõúùûç',
                      'AAAAEEEIIIOOOOUUUCaaaaeeeiioooouuuc')) || '%'
    )
  limit 1;

  if v_paciente_id is null then
    return json_build_object(
      'status','paciente_nao_encontrado',
      'mensagem','Paciente não encontrado para este usuário'
    );
  end if;

  insert into public.pagamentos (
    usuario_id,
    paciente_id,
    valor_pagamento,
    vencimento_em,
    pago_em,
    status,
    metodo,
    observacoes,
    data_competencia,
    tipo
  ) values (
    p_usuario_id,
    v_paciente_id,
    p_valor_pagamento,
    null,
    coalesce(p_data_pagamento::timestamptz, current_date::timestamptz),
    'pago',
    p_metodo,
    coalesce(p_observacoes, '') || case when p_observacoes is null then '' else ' | ' end || 'registro gerado pelo agente Agenda PSI',
    coalesce(p_data_pagamento, current_date),
    p_tipo
  )
  returning id into v_pagamento_id;

  return json_build_object(
    'status','ok',
    'pagamento_id', v_pagamento_id,
    'paciente_id', v_paciente_id
  );
end;$$;


ALTER FUNCTION "public"."agentpsi_registrar_pagamento"("p_usuario_id" "uuid", "p_nome_paciente" "text", "p_valor_pagamento" integer, "p_data_pagamento" "date", "p_metodo" "text", "p_observacoes" "text", "p_tipo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."agentpsi_registrar_sessao"("p_usuario_id" "uuid", "p_nome_paciente" "text", "p_ocorreu_em" timestamp with time zone DEFAULT "now"(), "p_modalidade" "text" DEFAULT NULL::"text", "p_duracao_minutos" integer DEFAULT NULL::integer, "p_observacoes" "text" DEFAULT NULL::"text", "p_gerar_pagamento" boolean DEFAULT false, "p_valor_pagamento" integer DEFAULT NULL::integer, "p_metodo" "text" DEFAULT NULL::"text", "p_tipo" "text" DEFAULT 'sessao'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$declare
  v_paciente_id uuid;
  v_pagamento_id uuid;
  v_ocorreu_em timestamptz;
begin
  -- procura o paciente do usuário, ignorando acentos e aceitando pedaços do nome
  select id into v_paciente_id
  from public.pacientes
  where usuario_id = p_usuario_id
    and (
      lower(translate(nome_completo,
                      'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇáàâãéèêíìîóòôõúùûç',
                      'AAAAEEEIIIOOOOUUUCaaaaeeeiioooouuuc'))
      like '%' || lower(translate(p_nome_paciente,
                      'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇáàâãéèêíìîóòôõúùûç',
                      'AAAAEEEIIIOOOOUUUCaaaaeeeiioooouuuc')) || '%'
    )
  limit 1;

  if v_paciente_id is null then
    return json_build_object(
      'status','paciente_nao_encontrado',
      'mensagem','Paciente não encontrado para este usuário'
    );
  end if;

  -- se não vier data/hora da sessão, usa agora
  v_ocorreu_em := coalesce(p_ocorreu_em, current_timestamp);

  -- registra a sessão
  insert into public.sessoes (
    usuario_id,
    paciente_id,
    ocorreu_em,
    ocorreu_em_dia,
    status,
    modalidade,
    duracao_minutos,
    observacoes,
    devesercobrada
  ) values (
    p_usuario_id,
    v_paciente_id,
    v_ocorreu_em,
    v_ocorreu_em::date,
    'realizada',
    p_modalidade,
    p_duracao_minutos,
    'registro gerado pelo agente Agenda PSI',
    true
  );

  -- se quiser já gerar o pagamento da sessão
  if p_gerar_pagamento and p_valor_pagamento is not null then
    insert into public.pagamentos (
      usuario_id,
      paciente_id,
      valor_pagamento,
      vencimento_em,
      status,
      metodo,
      observacoes,
      data_competencia,
      tipo
    ) values (
      p_usuario_id,
      v_paciente_id,
      p_valor_pagamento,
      null,
      'pendente',
      p_metodo,
      'gerado a partir da sessão',
      v_ocorreu_em::date,
      p_tipo
    )
    returning id into v_pagamento_id;
  end if;

  return json_build_object(
    'status','ok',
    'paciente_id', v_paciente_id,
    'gerou_pagamento', p_gerar_pagamento,
    'pagamento_id', v_pagamento_id
  );
end;$$;


ALTER FUNCTION "public"."agentpsi_registrar_sessao"("p_usuario_id" "uuid", "p_nome_paciente" "text", "p_ocorreu_em" timestamp with time zone, "p_modalidade" "text", "p_duracao_minutos" integer, "p_observacoes" "text", "p_gerar_pagamento" boolean, "p_valor_pagamento" integer, "p_metodo" "text", "p_tipo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_profissional_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_prof uuid;
BEGIN
  SELECT id INTO v_prof
  FROM public.profissionais
  WHERE usuario_id = auth.uid()
  LIMIT 1;
  RETURN v_prof; -- pode ser NULL se o usuário não tiver ficha em profissionais
END;
$$;


ALTER FUNCTION "public"."current_profissional_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."demo_uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT valor FROM public.config_app
  WHERE chave = 'demo_user_id'
  LIMIT 1
$$;


ALTER FUNCTION "public"."demo_uid"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_pacientes_sync_ids"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE v_prof uuid;
DECLARE v_user uuid;
BEGIN
  -- Se veio usuario_id e não veio profissional_id, preenche profissional_id
  IF NEW.usuario_id IS NOT NULL AND NEW.profissional_id IS NULL THEN
    SELECT id INTO v_prof
    FROM public.profissionais
    WHERE usuario_id = NEW.usuario_id
    LIMIT 1;
    NEW.profissional_id := v_prof;
  END IF;

  -- Se veio profissional_id e não veio usuario_id, preenche usuario_id
  IF NEW.profissional_id IS NOT NULL AND NEW.usuario_id IS NULL THEN
    SELECT usuario_id INTO v_user
    FROM public.profissionais
    WHERE id = NEW.profissional_id
    LIMIT 1;
    NEW.usuario_id := v_user;
  END IF;

  -- Se vieram ambos, checa consistência
  IF NEW.usuario_id IS NOT NULL AND NEW.profissional_id IS NOT NULL THEN
    SELECT usuario_id INTO v_user
    FROM public.profissionais
    WHERE id = NEW.profissional_id
    LIMIT 1;

    IF v_user IS DISTINCT FROM NEW.usuario_id THEN
      RAISE EXCEPTION 'profissional_id (%) não pertence ao usuario_id (%)',
        NEW.profissional_id, NEW.usuario_id;
    END IF;
  END IF;

  -- Segurança: não aceite insert sem nenhum dos dois resolvidos
  IF NEW.usuario_id IS NULL THEN
    RAISE EXCEPTION 'usuario_id não pode ser nulo (preencha com auth.users.id)';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_pacientes_sync_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_precos_sync_ids"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_prof uuid;
  v_user uuid;
BEGIN
  -- Caso 1: veio usuario_id (preferido) -> força profissional_id correto
  IF NEW.usuario_id IS NOT NULL THEN
    SELECT id INTO v_prof
    FROM public.profissionais
    WHERE usuario_id = NEW.usuario_id
    LIMIT 1;

    IF v_prof IS NULL THEN
      RAISE EXCEPTION 'Não existe registro em public.profissionais para usuario_id=%', NEW.usuario_id;
    END IF;

    NEW.profissional_id := v_prof;  -- sobrescreve se veio errado
  ELSIF NEW.profissional_id IS NOT NULL THEN
  -- Caso 2: veio só profissional_id -> completa usuario_id
    SELECT usuario_id INTO v_user
    FROM public.profissionais
    WHERE id = NEW.profissional_id
    LIMIT 1;

    IF v_user IS NULL THEN
      RAISE EXCEPTION 'profissional_id=% não encontrado em public.profissionais', NEW.profissional_id;
    END IF;

    NEW.usuario_id := v_user;
  ELSE
    -- Nenhum dos dois foi informado
    NEW.usuario_id := auth.uid();
    IF NEW.usuario_id IS NULL THEN
      RAISE EXCEPTION 'usuario_id não pode ser nulo — autentique o usuário ou envie usuario_id no payload.';
    END IF;
    SELECT id INTO v_prof FROM public.profissionais WHERE usuario_id = NEW.usuario_id LIMIT 1;
    IF v_prof IS NULL THEN
      RAISE EXCEPTION 'Crie primeiro o perfil em public.profissionais para usuario_id=%', NEW.usuario_id;
    END IF;
    NEW.profissional_id := v_prof;
  END IF;

  -- Valida pertencimento do paciente ao mesmo usuário (evita cruzamento)
  IF NEW.paciente_id IS NOT NULL THEN
    PERFORM 1
    FROM public.pacientes pa
    WHERE pa.id = NEW.paciente_id
      AND pa.usuario_id = NEW.usuario_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'paciente_id=% não pertence ao usuario_id=%', NEW.paciente_id, NEW.usuario_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_precos_sync_ids"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agenda_semana_padrao" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "paciente_id" "uuid" NOT NULL,
    "dia_semana" smallint NOT NULL,
    "hora_inicio" time without time zone NOT NULL,
    "hora_fim" time without time zone NOT NULL,
    "observacoes" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agenda_semana_padrao" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comentarios_locais_atendimento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_atendimento_id" "uuid" NOT NULL,
    "comentario" "text" NOT NULL,
    "contexto_uso" "text",
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "criado_por_usuario_id" "uuid" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comentarios_locais_atendimento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."config_app" (
    "chave" "text" NOT NULL,
    "valor" "uuid"
);


ALTER TABLE "public"."config_app" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custos_sms_mensal" (
    "mes" "date" NOT NULL,
    "valor_eur" numeric(12,2) NOT NULL,
    "cambio_eur_brl" numeric(12,4) NOT NULL,
    "mensagens_bird" integer,
    "fatura_numero" "text",
    "fechado" boolean DEFAULT true NOT NULL,
    "observacao" "text",
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "custos_sms_mensal_cambio_eur_brl_check" CHECK (("cambio_eur_brl" > (0)::numeric)),
    CONSTRAINT "custos_sms_mensal_valor_eur_check" CHECK (("valor_eur" >= (0)::numeric))
);


ALTER TABLE "public"."custos_sms_mensal" OWNER TO "postgres";


COMMENT ON TABLE "public"."custos_sms_mensal" IS 'Custo real de SMS por mes, vindo da fatura do Bird. Fonte da verdade para as views de custo. Inserir uma linha por mes quando a fatura fechar.';



COMMENT ON COLUMN "public"."custos_sms_mensal"."mes" IS 'Primeiro dia do mes de referencia (competencia)';



COMMENT ON COLUMN "public"."custos_sms_mensal"."valor_eur" IS 'Total da fatura Bird em EUR';



COMMENT ON COLUMN "public"."custos_sms_mensal"."mensagens_bird" IS 'Mensagens contadas pelo Bird (pode diferir de sms_lembretes_enviados)';



COMMENT ON COLUMN "public"."custos_sms_mensal"."fechado" IS 'false = mes ainda aberto, valor_eur e estimativa';



CREATE TABLE IF NOT EXISTS "public"."despesas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "tipo_despesa_id" "uuid" NOT NULL,
    "descricao" "text",
    "valor_despesa" integer NOT NULL,
    "data_competencia" "date" DEFAULT CURRENT_DATE,
    "pago_em" timestamp with time zone,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "metodo" "text",
    "observacoes" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "despesas_valor_despesa_check" CHECK (("valor_despesa" >= 0))
);


ALTER TABLE "public"."despesas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "mensagem" "text",
    "handle_at" timestamp without time zone,
    "app_name" "text" DEFAULT 'agenda_psi'::"text"
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


ALTER TABLE "public"."feedback" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."feedback_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."locais_atendimento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "cidade" "text" NOT NULL,
    "bairro" "text",
    "estado" "text" NOT NULL,
    "tipo_local" "text" NOT NULL,
    "url_contato" "text",
    "origem" "text" NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "criado_por_usuario_id" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."locais_atendimento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "recipient_usuario_id" "uuid" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


ALTER TABLE "public"."notifications" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."notifications_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."pacientes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profissional_id" "uuid",
    "nome_completo" "text" NOT NULL,
    "telefone" "text",
    "email" "text",
    "status" "text" DEFAULT 'ativo'::"text" NOT NULL,
    "observacoes" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "primeira_consulta" "date",
    "usuario_id" "uuid" NOT NULL,
    "receber_sms" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."pacientes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pagamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profissional_id" "uuid",
    "paciente_id" "uuid" NOT NULL,
    "valor_pagamento" integer NOT NULL,
    "vencimento_em" "date",
    "pago_em" timestamp with time zone,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "metodo" "text",
    "observacoes" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "data_competencia" "date" DEFAULT CURRENT_DATE,
    "tipo" "text",
    CONSTRAINT "pagamentos_valor_pagamento_check" CHECK (("valor_pagamento" >= 0))
);


ALTER TABLE "public"."pagamentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."precos_paciente" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profissional_id" "uuid",
    "paciente_id" "uuid" NOT NULL,
    "preco" integer NOT NULL,
    "vigencia_desde" "date" DEFAULT CURRENT_DATE NOT NULL,
    "observacoes" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    CONSTRAINT "precos_paciente_preco_check" CHECK (("preco" >= 0))
);


ALTER TABLE "public"."precos_paciente" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profissionais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "email" "text" NOT NULL,
    "telefone" "text",
    "linkedin" "text",
    "instagram" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ativo" boolean DEFAULT true,
    "fcm_token" "text",
    "usuario_fundador" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."profissionais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profissional_id" "uuid",
    "paciente_id" "uuid" NOT NULL,
    "ocorreu_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'realizada'::"text" NOT NULL,
    "modalidade" "text",
    "duracao_minutos" integer,
    "observacoes" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "ocorreu_em_dia" "date" DEFAULT CURRENT_DATE NOT NULL,
    "pagamento" "text",
    "devesercobrada" boolean DEFAULT true
);


ALTER TABLE "public"."sessoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_lembretes_enviados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agenda_id" "uuid" NOT NULL,
    "ocorrencia_inicio" timestamp with time zone NOT NULL,
    "ocorrencia_data" "date" NOT NULL,
    "enviado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "provider_message_id" "text"
);


ALTER TABLE "public"."sms_lembretes_enviados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tipos_despesa" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tipos_despesa" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_adesao_usuarios" AS
 WITH "base" AS (
         SELECT DISTINCT "p"."usuario_id"
           FROM "public"."profissionais" "p"
          WHERE ("p"."usuario_id" IS NOT NULL)
        ), "prof" AS (
         SELECT DISTINCT ON ("p"."usuario_id") "p"."usuario_id",
            "p"."nome",
            "p"."email",
            "p"."ativo",
            "p"."criado_em"
           FROM "public"."profissionais" "p"
          WHERE ("p"."usuario_id" IS NOT NULL)
          ORDER BY "p"."usuario_id", "p"."ativo" DESC NULLS LAST, "p"."criado_em" DESC
        ), "pac" AS (
         SELECT "pacientes"."usuario_id",
            "count"(*) AS "pacientes"
           FROM "public"."pacientes"
          GROUP BY "pacientes"."usuario_id"
        ), "ses" AS (
         SELECT "sessoes"."usuario_id",
            "count"(*) AS "sessoes"
           FROM "public"."sessoes"
          GROUP BY "sessoes"."usuario_id"
        ), "pag" AS (
         SELECT "pagamentos"."usuario_id",
            "count"(*) AS "pagamentos"
           FROM "public"."pagamentos"
          GROUP BY "pagamentos"."usuario_id"
        ), "des" AS (
         SELECT "despesas"."usuario_id",
            "count"(*) AS "despesas"
           FROM "public"."despesas"
          GROUP BY "despesas"."usuario_id"
        ), "ses_val" AS (
         SELECT "s"."usuario_id",
            "sum"("ppv"."preco") AS "valor_sessoes"
           FROM ("public"."sessoes" "s"
             JOIN LATERAL ( SELECT "pp"."preco"
                   FROM "public"."precos_paciente" "pp"
                  WHERE (("pp"."paciente_id" = "s"."paciente_id") AND ("pp"."usuario_id" = "s"."usuario_id") AND ("pp"."vigencia_desde" <= "s"."ocorreu_em_dia"))
                  ORDER BY "pp"."vigencia_desde" DESC, "pp"."criado_em" DESC
                 LIMIT 1) "ppv" ON (true))
          WHERE ("s"."status" = 'realizada'::"text")
          GROUP BY "s"."usuario_id"
        ), "des_val" AS (
         SELECT "d"."usuario_id",
            "sum"("d"."valor_despesa") AS "valor_despesas"
           FROM "public"."despesas" "d"
          GROUP BY "d"."usuario_id"
        ), "pag_val" AS (
         SELECT "p"."usuario_id",
            "sum"("p"."valor_pagamento") AS "valor_pagamentos"
           FROM "public"."pagamentos" "p"
          WHERE ("p"."status" = 'pago'::"text")
          GROUP BY "p"."usuario_id"
        ), "ultima" AS (
         SELECT "x"."usuario_id",
            "max"("x"."ts") AS "ultima_atividade_em"
           FROM ( SELECT "pacientes"."usuario_id",
                    "max"("pacientes"."criado_em") AS "ts"
                   FROM "public"."pacientes"
                  GROUP BY "pacientes"."usuario_id"
                UNION ALL
                 SELECT "sessoes"."usuario_id",
                    "max"("sessoes"."criado_em") AS "ts"
                   FROM "public"."sessoes"
                  GROUP BY "sessoes"."usuario_id"
                UNION ALL
                 SELECT "pagamentos"."usuario_id",
                    "max"("pagamentos"."criado_em") AS "ts"
                   FROM "public"."pagamentos"
                  GROUP BY "pagamentos"."usuario_id"
                UNION ALL
                 SELECT "despesas"."usuario_id",
                    "max"("despesas"."criado_em") AS "ts"
                   FROM "public"."despesas"
                  GROUP BY "despesas"."usuario_id") "x"
          GROUP BY "x"."usuario_id"
        )
 SELECT "b"."usuario_id",
    COALESCE("prof"."nome", '(sem perfil)'::"text") AS "nome_profissional",
    COALESCE("prof"."email", ("au"."email")::"text") AS "email",
    COALESCE("pac"."pacientes", (0)::bigint) AS "qt_pacientes",
    COALESCE("ses"."sessoes", (0)::bigint) AS "qt_sessoes",
    COALESCE("pag"."pagamentos", (0)::bigint) AS "qt_pagamentos",
    COALESCE("des"."despesas", (0)::bigint) AS "qt_despesas",
    COALESCE("ses_val"."valor_sessoes", (0)::bigint) AS "valor_sessoes",
    COALESCE("des_val"."valor_despesas", (0)::bigint) AS "valor_despesas",
    COALESCE("pag_val"."valor_pagamentos", (0)::bigint) AS "valor_pagamentos",
    "ultima"."ultima_atividade_em"
   FROM (((((((((("base" "b"
     LEFT JOIN "prof" ON (("prof"."usuario_id" = "b"."usuario_id")))
     LEFT JOIN "pac" ON (("pac"."usuario_id" = "b"."usuario_id")))
     LEFT JOIN "ses" ON (("ses"."usuario_id" = "b"."usuario_id")))
     LEFT JOIN "pag" ON (("pag"."usuario_id" = "b"."usuario_id")))
     LEFT JOIN "des" ON (("des"."usuario_id" = "b"."usuario_id")))
     LEFT JOIN "ses_val" ON (("ses_val"."usuario_id" = "b"."usuario_id")))
     LEFT JOIN "des_val" ON (("des_val"."usuario_id" = "b"."usuario_id")))
     LEFT JOIN "pag_val" ON (("pag_val"."usuario_id" = "b"."usuario_id")))
     LEFT JOIN "ultima" ON (("ultima"."usuario_id" = "b"."usuario_id")))
     LEFT JOIN "auth"."users" "au" ON (("au"."id" = "b"."usuario_id")))
  ORDER BY COALESCE("prof"."nome", '(sem perfil)'::"text");


ALTER VIEW "public"."v_adesao_usuarios" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_admin_dashboard_usuarios" WITH ("security_invoker"='true') AS
 WITH "base" AS (
         SELECT "date_trunc"('month'::"text", "now"()) AS "inicio_mes_corrente_utc",
            ("date_trunc"('month'::"text", "now"()) - '1 mon'::interval) AS "inicio_mes_anterior_utc",
            ("date_trunc"('month'::"text", "now"()) + '1 mon'::interval) AS "fim_mes_corrente_utc",
            "date_trunc"('month'::"text", "now"()) AS "fim_mes_anterior_utc"
        ), "profissionais_base" AS (
         SELECT "profissionais"."usuario_id",
            "profissionais"."email"
           FROM "public"."profissionais"
          WHERE ("profissionais"."ativo" = true)
        )
 SELECT "pb"."usuario_id",
    "pb"."email",
    ( SELECT ("count"(*))::integer AS "count"
           FROM "public"."pacientes" "pa"
          WHERE (("pa"."usuario_id" = "pb"."usuario_id") AND ("pa"."status" = 'ativo'::"text"))) AS "pacientes_ativos",
    ( SELECT ("count"(*))::integer AS "count"
           FROM "public"."sessoes" "s"
          WHERE (("s"."usuario_id" = "pb"."usuario_id") AND ("s"."status" = 'realizada'::"text") AND ("s"."ocorreu_em" >= "b"."inicio_mes_anterior_utc") AND ("s"."ocorreu_em" < "b"."fim_mes_anterior_utc"))) AS "sessoes_mes_anterior",
    ( SELECT ("count"(*))::integer AS "count"
           FROM "public"."sessoes" "s"
          WHERE (("s"."usuario_id" = "pb"."usuario_id") AND ("s"."status" = 'realizada'::"text") AND ("s"."ocorreu_em" >= "b"."inicio_mes_corrente_utc") AND ("s"."ocorreu_em" < "b"."fim_mes_corrente_utc"))) AS "sessoes_mes_corrente",
    ( SELECT COALESCE("sum"("pg"."valor_pagamento"), (0)::bigint) AS "coalesce"
           FROM "public"."pagamentos" "pg"
          WHERE (("pg"."usuario_id" = "pb"."usuario_id") AND ("pg"."criado_em" >= "b"."inicio_mes_anterior_utc") AND ("pg"."criado_em" < "b"."fim_mes_anterior_utc"))) AS "pagamentos_mes_anterior",
    ( SELECT COALESCE("sum"("pg"."valor_pagamento"), (0)::bigint) AS "coalesce"
           FROM "public"."pagamentos" "pg"
          WHERE (("pg"."usuario_id" = "pb"."usuario_id") AND ("pg"."criado_em" >= "b"."inicio_mes_corrente_utc") AND ("pg"."criado_em" < "b"."fim_mes_corrente_utc"))) AS "pagamentos_mes_corrente",
    ( SELECT COALESCE("sum"("d"."valor_despesa"), (0)::bigint) AS "coalesce"
           FROM "public"."despesas" "d"
          WHERE (("d"."usuario_id" = "pb"."usuario_id") AND ("d"."criado_em" >= "b"."inicio_mes_anterior_utc") AND ("d"."criado_em" < "b"."fim_mes_anterior_utc"))) AS "despesas_mes_anterior",
    ( SELECT COALESCE("sum"("d"."valor_despesa"), (0)::bigint) AS "coalesce"
           FROM "public"."despesas" "d"
          WHERE (("d"."usuario_id" = "pb"."usuario_id") AND ("d"."criado_em" >= "b"."inicio_mes_corrente_utc") AND ("d"."criado_em" < "b"."fim_mes_corrente_utc"))) AS "despesas_mes_corrente",
    (( SELECT COALESCE("sum"("pg"."valor_pagamento"), (0)::bigint) AS "coalesce"
           FROM "public"."pagamentos" "pg"
          WHERE (("pg"."usuario_id" = "pb"."usuario_id") AND ("pg"."criado_em" >= "b"."inicio_mes_anterior_utc") AND ("pg"."criado_em" < "b"."fim_mes_anterior_utc"))) - ( SELECT COALESCE("sum"("d"."valor_despesa"), (0)::bigint) AS "coalesce"
           FROM "public"."despesas" "d"
          WHERE (("d"."usuario_id" = "pb"."usuario_id") AND ("d"."criado_em" >= "b"."inicio_mes_anterior_utc") AND ("d"."criado_em" < "b"."fim_mes_anterior_utc")))) AS "rentabilidade_mes_anterior",
    (( SELECT COALESCE("sum"("pg"."valor_pagamento"), (0)::bigint) AS "coalesce"
           FROM "public"."pagamentos" "pg"
          WHERE (("pg"."usuario_id" = "pb"."usuario_id") AND ("pg"."criado_em" >= "b"."inicio_mes_corrente_utc") AND ("pg"."criado_em" < "b"."fim_mes_corrente_utc"))) - ( SELECT COALESCE("sum"("d"."valor_despesa"), (0)::bigint) AS "coalesce"
           FROM "public"."despesas" "d"
          WHERE (("d"."usuario_id" = "pb"."usuario_id") AND ("d"."criado_em" >= "b"."inicio_mes_corrente_utc") AND ("d"."criado_em" < "b"."fim_mes_corrente_utc")))) AS "rentabilidade_mes_corrente",
    "b"."inicio_mes_anterior_utc" AS "periodo_mes_anterior_inicio_utc",
    "b"."fim_mes_anterior_utc" AS "periodo_mes_anterior_fim_utc",
    "b"."inicio_mes_corrente_utc" AS "periodo_mes_corrente_inicio_utc",
    "b"."fim_mes_corrente_utc" AS "periodo_mes_corrente_fim_utc"
   FROM ("profissionais_base" "pb"
     CROSS JOIN "base" "b")
  ORDER BY "pb"."email";


ALTER VIEW "public"."v_admin_dashboard_usuarios" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_campanha_despesas" AS
 SELECT "p"."nome",
    "p"."email",
    COALESCE("sum"("pg"."valor_pagamento") FILTER (WHERE (("pg"."status" = 'pago'::"text") AND ("pg"."pago_em" >= ("now"() - '3 mons'::interval)))), (0)::bigint) AS "receita_3m",
    "count"("pg"."id") FILTER (WHERE (("pg"."status" = 'pago'::"text") AND ("pg"."pago_em" >= ("now"() - '3 mons'::interval)))) AS "qt_pagamentos_3m",
    COALESCE("sum"("d"."valor_despesa") FILTER (WHERE ("d"."data_competencia" >= (CURRENT_DATE - '3 mons'::interval))), (0)::bigint) AS "despesas_3m",
    "count"("d"."id") FILTER (WHERE ("d"."data_competencia" >= (CURRENT_DATE - '3 mons'::interval))) AS "qt_despesas_3m",
    "array_agg"(DISTINCT "td"."nome") FILTER (WHERE ("td"."nome" IS NOT NULL)) AS "tipos_usados"
   FROM ((("public"."profissionais" "p"
     LEFT JOIN "public"."pagamentos" "pg" ON (("pg"."usuario_id" = "p"."usuario_id")))
     LEFT JOIN "public"."despesas" "d" ON (("d"."usuario_id" = "p"."usuario_id")))
     LEFT JOIN "public"."tipos_despesa" "td" ON (("td"."id" = "d"."tipo_despesa_id")))
  WHERE ("p"."ativo" = true)
  GROUP BY "p"."usuario_id", "p"."nome", "p"."email"
 HAVING (COALESCE("sum"("pg"."valor_pagamento") FILTER (WHERE (("pg"."status" = 'pago'::"text") AND ("pg"."pago_em" >= ("now"() - '3 mons'::interval)))), (0)::bigint) > 0)
  ORDER BY COALESCE("sum"("pg"."valor_pagamento") FILTER (WHERE (("pg"."status" = 'pago'::"text") AND ("pg"."pago_em" >= ("now"() - '3 mons'::interval)))), (0)::bigint) DESC;


ALTER VIEW "public"."v_campanha_despesas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_sms_base_mensal" AS
 SELECT "a"."usuario_id",
    ("date_trunc"('month'::"text", ("l"."enviado_em" AT TIME ZONE 'America/Sao_Paulo'::"text")))::"date" AS "mes",
    ("count"(*))::numeric AS "total_sms"
   FROM ("public"."sms_lembretes_enviados" "l"
     JOIN "public"."agenda_semana_padrao" "a" ON (("a"."id" = "l"."agenda_id")))
  GROUP BY "a"."usuario_id", (("date_trunc"('month'::"text", ("l"."enviado_em" AT TIME ZONE 'America/Sao_Paulo'::"text")))::"date");


ALTER VIEW "public"."v_sms_base_mensal" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_sms_base_mensal" IS 'Contagem crua de SMS por profissional e mes. Base para as views de custo.';



CREATE OR REPLACE VIEW "public"."v_custo_sms_mensal" AS
 WITH "mensal" AS (
         SELECT "v_sms_base_mensal"."mes",
            "sum"("v_sms_base_mensal"."total_sms") AS "total_sms"
           FROM "public"."v_sms_base_mensal"
          GROUP BY "v_sms_base_mensal"."mes"
        ), "preco_ref" AS (
         SELECT ("c_1"."valor_eur" / NULLIF("m_1"."total_sms", (0)::numeric)) AS "eur_por_sms"
           FROM ("public"."custos_sms_mensal" "c_1"
             JOIN "mensal" "m_1" ON (("m_1"."mes" = "c_1"."mes")))
          WHERE "c_1"."fechado"
          ORDER BY "c_1"."mes" DESC
         LIMIT 1
        )
 SELECT "to_char"(("m"."mes")::timestamp with time zone, 'YYYY-MM'::"text") AS "mes",
    "m"."total_sms",
    COALESCE("c"."valor_eur", "round"(("m"."total_sms" * "r"."eur_por_sms"), 2)) AS "custo_total_eur",
    "round"((COALESCE("c"."valor_eur", ("m"."total_sms" * "r"."eur_por_sms")) * COALESCE("c"."cambio_eur_brl", ( SELECT "custos_sms_mensal"."cambio_eur_brl"
           FROM "public"."custos_sms_mensal"
          ORDER BY "custos_sms_mensal"."mes" DESC
         LIMIT 1))), 2) AS "custo_total_brl",
    "round"((COALESCE("c"."valor_eur", ("m"."total_sms" * "r"."eur_por_sms")) / NULLIF("m"."total_sms", (0)::numeric)), 4) AS "eur_por_sms",
    "c"."mensagens_bird",
        CASE
            WHEN ("c"."mes" IS NULL) THEN 'projetado'::"text"
            WHEN ("c"."fechado" IS FALSE) THEN 'estimado'::"text"
            ELSE 'fatura'::"text"
        END AS "fonte",
    "c"."fatura_numero"
   FROM (("mensal" "m"
     LEFT JOIN "public"."custos_sms_mensal" "c" ON (("c"."mes" = "m"."mes")))
     CROSS JOIN "preco_ref" "r")
  ORDER BY ("to_char"(("m"."mes")::timestamp with time zone, 'YYYY-MM'::"text")) DESC;


ALTER VIEW "public"."v_custo_sms_mensal" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_custo_sms_mensal" IS 'Custo de SMS por mes. Usa a fatura real do Bird (custos_sms_mensal) quando existe; senao projeta pelo preco unitario do ultimo mes faturado. Coluna fonte indica qual.';



CREATE OR REPLACE VIEW "public"."v_custo_sms_mensal_por_profissional" AS
 WITH "mensal" AS (
         SELECT "v_sms_base_mensal"."mes",
            "sum"("v_sms_base_mensal"."total_sms") AS "total_sms"
           FROM "public"."v_sms_base_mensal"
          GROUP BY "v_sms_base_mensal"."mes"
        ), "preco_ref" AS (
         SELECT ("c"."valor_eur" / NULLIF("m"."total_sms", (0)::numeric)) AS "eur_por_sms"
           FROM ("public"."custos_sms_mensal" "c"
             JOIN "mensal" "m" ON (("m"."mes" = "c"."mes")))
          WHERE "c"."fechado"
          ORDER BY "c"."mes" DESC
         LIMIT 1
        ), "custo" AS (
         SELECT "m"."mes",
            "m"."total_sms" AS "sms_mes",
            COALESCE("c"."valor_eur", ("m"."total_sms" * "r"."eur_por_sms")) AS "eur_mes",
            COALESCE("c"."cambio_eur_brl", ( SELECT "custos_sms_mensal"."cambio_eur_brl"
                   FROM "public"."custos_sms_mensal"
                  ORDER BY "custos_sms_mensal"."mes" DESC
                 LIMIT 1)) AS "cambio",
                CASE
                    WHEN ("c"."mes" IS NULL) THEN 'projetado'::"text"
                    WHEN ("c"."fechado" IS FALSE) THEN 'estimado'::"text"
                    ELSE 'fatura'::"text"
                END AS "fonte"
           FROM (("mensal" "m"
             LEFT JOIN "public"."custos_sms_mensal" "c" ON (("c"."mes" = "m"."mes")))
             CROSS JOIN "preco_ref" "r")
        )
 SELECT "to_char"(("b"."mes")::timestamp with time zone, 'YYYY-MM'::"text") AS "mes",
    "p"."usuario_id",
    "p"."nome" AS "profissional_nome",
    "p"."email" AS "profissional_email",
    "b"."total_sms",
    "round"((((100)::numeric * "b"."total_sms") / NULLIF("k"."sms_mes", (0)::numeric)), 1) AS "participacao_pct",
    "round"((("b"."total_sms" / NULLIF("k"."sms_mes", (0)::numeric)) * "k"."eur_mes"), 2) AS "custo_total_eur",
    "round"(((("b"."total_sms" / NULLIF("k"."sms_mes", (0)::numeric)) * "k"."eur_mes") * "k"."cambio"), 2) AS "custo_total_brl",
    "k"."fonte"
   FROM (("public"."v_sms_base_mensal" "b"
     JOIN "custo" "k" ON (("k"."mes" = "b"."mes")))
     JOIN "public"."profissionais" "p" ON (("p"."usuario_id" = "b"."usuario_id")))
  ORDER BY ("to_char"(("b"."mes")::timestamp with time zone, 'YYYY-MM'::"text")) DESC, ("round"((("b"."total_sms" / NULLIF("k"."sms_mes", (0)::numeric)) * "k"."eur_mes"), 2)) DESC;


ALTER VIEW "public"."v_custo_sms_mensal_por_profissional" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_custo_sms_mensal_por_profissional" IS 'Rateia a fatura real do Bird entre os profissionais, proporcional ao volume de SMS de cada um no mes.';



CREATE OR REPLACE VIEW "public"."v_dashboard_resumo" WITH ("security_invoker"='true') AS
 WITH "limites" AS (
         SELECT "date_trunc"('month'::"text", "now"()) AS "inicio_mes_corrente_utc",
            ("date_trunc"('month'::"text", "now"()) - '1 mon'::interval) AS "inicio_mes_anterior_utc"
        ), "base" AS (
         SELECT "l"."inicio_mes_corrente_utc",
            "l"."inicio_mes_anterior_utc",
            ("l"."inicio_mes_corrente_utc" + '1 mon'::interval) AS "fim_mes_corrente_utc",
            ("l"."inicio_mes_anterior_utc" + '1 mon'::interval) AS "fim_mes_anterior_utc"
           FROM "limites" "l"
        ), "pac" AS (
         SELECT ("count"(*))::integer AS "pacientes_ativos"
           FROM "public"."pacientes" "p"
          WHERE (("p"."usuario_id" = "auth"."uid"()) AND ("p"."status" = 'ativo'::"text"))
        ), "ses_prev" AS (
         SELECT ("count"(*))::integer AS "sessoes_mes_anterior"
           FROM ("public"."sessoes" "s"
             JOIN "base" "b" ON (true))
          WHERE (("s"."usuario_id" = "auth"."uid"()) AND ("s"."status" = 'realizada'::"text") AND ("s"."ocorreu_em" >= "b"."inicio_mes_anterior_utc") AND ("s"."ocorreu_em" < "b"."fim_mes_anterior_utc"))
        ), "ses_curr" AS (
         SELECT ("count"(*))::integer AS "sessoes_mes_corrente"
           FROM ("public"."sessoes" "s"
             JOIN "base" "b" ON (true))
          WHERE (("s"."usuario_id" = "auth"."uid"()) AND ("s"."status" = 'realizada'::"text") AND ("s"."ocorreu_em" >= "b"."inicio_mes_corrente_utc") AND ("s"."ocorreu_em" < "b"."fim_mes_corrente_utc"))
        ), "pag_prev" AS (
         SELECT COALESCE("sum"("pg"."valor_pagamento"), (0)::bigint) AS "pagamentos_mes_anterior"
           FROM ("public"."pagamentos" "pg"
             JOIN "base" "b" ON (true))
          WHERE (("pg"."usuario_id" = "auth"."uid"()) AND ("pg"."criado_em" >= "b"."inicio_mes_anterior_utc") AND ("pg"."criado_em" < "b"."fim_mes_anterior_utc"))
        ), "pag_curr" AS (
         SELECT COALESCE("sum"("pg"."valor_pagamento"), (0)::bigint) AS "pagamentos_mes_corrente"
           FROM ("public"."pagamentos" "pg"
             JOIN "base" "b" ON (true))
          WHERE (("pg"."usuario_id" = "auth"."uid"()) AND ("pg"."criado_em" >= "b"."inicio_mes_corrente_utc") AND ("pg"."criado_em" < "b"."fim_mes_corrente_utc"))
        ), "des_prev" AS (
         SELECT COALESCE("sum"("d"."valor_despesa"), (0)::bigint) AS "despesas_mes_anterior"
           FROM ("public"."despesas" "d"
             JOIN "base" "b" ON (true))
          WHERE (("d"."usuario_id" = "auth"."uid"()) AND ("d"."criado_em" >= "b"."inicio_mes_anterior_utc") AND ("d"."criado_em" < "b"."fim_mes_anterior_utc"))
        ), "des_curr" AS (
         SELECT COALESCE("sum"("d"."valor_despesa"), (0)::bigint) AS "despesas_mes_corrente"
           FROM ("public"."despesas" "d"
             JOIN "base" "b" ON (true))
          WHERE (("d"."usuario_id" = "auth"."uid"()) AND ("d"."criado_em" >= "b"."inicio_mes_corrente_utc") AND ("d"."criado_em" < "b"."fim_mes_corrente_utc"))
        )
 SELECT "pac"."pacientes_ativos",
    "ses_prev"."sessoes_mes_anterior",
    "ses_curr"."sessoes_mes_corrente",
    "pag_prev"."pagamentos_mes_anterior",
    "pag_curr"."pagamentos_mes_corrente",
    "des_prev"."despesas_mes_anterior",
    "des_curr"."despesas_mes_corrente",
    ("pag_prev"."pagamentos_mes_anterior" - "des_prev"."despesas_mes_anterior") AS "rentabilidade_mes_anterior",
    ("pag_curr"."pagamentos_mes_corrente" - "des_curr"."despesas_mes_corrente") AS "rentabilidade_mes_corrente",
        CASE
            WHEN ("pac"."pacientes_ativos" > 0) THEN ((("des_curr"."despesas_mes_corrente")::numeric / ("pac"."pacientes_ativos")::numeric))::bigint
            ELSE (0)::bigint
        END AS "custo_medio_por_paciente_mes_corrente",
        CASE
            WHEN ("pac"."pacientes_ativos" > 0) THEN ((("pag_curr"."pagamentos_mes_corrente")::numeric / ("pac"."pacientes_ativos")::numeric))::bigint
            ELSE (0)::bigint
        END AS "receita_media_por_paciente_mes_corrente",
        CASE
            WHEN ("pag_curr"."pagamentos_mes_corrente" > 0) THEN "round"((((("pag_curr"."pagamentos_mes_corrente" - "des_curr"."despesas_mes_corrente"))::numeric / ("pag_curr"."pagamentos_mes_corrente")::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS "margem_mes_corrente_pct",
        CASE
            WHEN ("pag_prev"."pagamentos_mes_anterior" > 0) THEN "round"((((("pag_prev"."pagamentos_mes_anterior" - "des_prev"."despesas_mes_anterior"))::numeric / ("pag_prev"."pagamentos_mes_anterior")::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS "margem_mes_anterior_pct",
        CASE
            WHEN ("ses_curr"."sessoes_mes_corrente" > 0) THEN "round"((("pag_curr"."pagamentos_mes_corrente")::numeric / ("ses_curr"."sessoes_mes_corrente")::numeric), 2)
            ELSE (0)::numeric
        END AS "receita_media_por_sessao_corrente",
        CASE
            WHEN (("ses_curr"."sessoes_mes_corrente" > 0) AND ((("pag_curr"."pagamentos_mes_corrente")::numeric / ("ses_curr"."sessoes_mes_corrente")::numeric) > (0)::numeric)) THEN ("ceil"((("des_curr"."despesas_mes_corrente")::numeric / (("pag_curr"."pagamentos_mes_corrente")::numeric / ("ses_curr"."sessoes_mes_corrente")::numeric))))::integer
            ELSE 0
        END AS "break_even_sessoes_mes_corrente",
        CASE
            WHEN ("ses_prev"."sessoes_mes_anterior" > 0) THEN "round"((((("ses_curr"."sessoes_mes_corrente" - "ses_prev"."sessoes_mes_anterior"))::numeric / ("ses_prev"."sessoes_mes_anterior")::numeric) * (100)::numeric), 1)
            ELSE NULL::numeric
        END AS "variacao_sessoes_pct",
        CASE
            WHEN ("pag_prev"."pagamentos_mes_anterior" > 0) THEN "round"((((("pag_curr"."pagamentos_mes_corrente" - "pag_prev"."pagamentos_mes_anterior"))::numeric / ("pag_prev"."pagamentos_mes_anterior")::numeric) * (100)::numeric), 1)
            ELSE NULL::numeric
        END AS "variacao_receita_pct",
        CASE
            WHEN ("des_prev"."despesas_mes_anterior" > 0) THEN "round"((((("des_curr"."despesas_mes_corrente" - "des_prev"."despesas_mes_anterior"))::numeric / ("des_prev"."despesas_mes_anterior")::numeric) * (100)::numeric), 1)
            ELSE NULL::numeric
        END AS "variacao_despesas_pct",
        CASE
            WHEN (("pag_prev"."pagamentos_mes_anterior" - "des_prev"."despesas_mes_anterior") <> 0) THEN "round"(((((("pag_curr"."pagamentos_mes_corrente" - "des_curr"."despesas_mes_corrente") - ("pag_prev"."pagamentos_mes_anterior" - "des_prev"."despesas_mes_anterior")))::numeric / ("abs"(("pag_prev"."pagamentos_mes_anterior" - "des_prev"."despesas_mes_anterior")))::numeric) * (100)::numeric), 1)
            ELSE NULL::numeric
        END AS "variacao_rentabilidade_pct",
    "base"."inicio_mes_anterior_utc" AS "periodo_mes_anterior_inicio_utc",
    "base"."fim_mes_anterior_utc" AS "periodo_mes_anterior_fim_utc",
    "base"."inicio_mes_corrente_utc" AS "periodo_mes_corrente_inicio_utc",
    "base"."fim_mes_corrente_utc" AS "periodo_mes_corrente_fim_utc"
   FROM ((((((("base"
     CROSS JOIN "pac")
     CROSS JOIN "ses_prev")
     CROSS JOIN "ses_curr")
     CROSS JOIN "pag_prev")
     CROSS JOIN "pag_curr")
     CROSS JOIN "des_prev")
     CROSS JOIN "des_curr");


ALTER VIEW "public"."v_dashboard_resumo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_dashboard_payload_json" WITH ("security_invoker"='true') AS
 SELECT "jsonb_build_object"('pacientes_ativos', "pacientes_ativos", 'sessoes_mes_anterior', "sessoes_mes_anterior", 'sessoes_mes_corrente', "sessoes_mes_corrente", 'pagamentos_mes_anterior', "pagamentos_mes_anterior", 'pagamentos_mes_corrente', "pagamentos_mes_corrente", 'despesas_mes_anterior', "despesas_mes_anterior", 'despesas_mes_corrente', "despesas_mes_corrente", 'rentabilidade_mes_anterior', "rentabilidade_mes_anterior", 'rentabilidade_mes_corrente', "rentabilidade_mes_corrente", 'custo_medio_por_paciente_mes_corrente', "custo_medio_por_paciente_mes_corrente", 'receita_media_por_paciente_mes_corrente', "receita_media_por_paciente_mes_corrente", 'margem_mes_corrente_pct', "margem_mes_corrente_pct", 'margem_mes_anterior_pct', "margem_mes_anterior_pct", 'receita_media_por_sessao_corrente', "receita_media_por_sessao_corrente", 'break_even_sessoes_mes_corrente', "break_even_sessoes_mes_corrente", 'variacao_sessoes_pct', "variacao_sessoes_pct", 'variacao_receita_pct', "variacao_receita_pct", 'variacao_despesas_pct', "variacao_despesas_pct", 'variacao_rentabilidade_pct', "variacao_rentabilidade_pct", 'periodo_mes_anterior_inicio_utc', "periodo_mes_anterior_inicio_utc", 'periodo_mes_anterior_fim_utc', "periodo_mes_anterior_fim_utc", 'periodo_mes_corrente_inicio_utc', "periodo_mes_corrente_inicio_utc", 'periodo_mes_corrente_fim_utc', "periodo_mes_corrente_fim_utc") AS "payload"
   FROM "public"."v_dashboard_resumo";


ALTER VIEW "public"."v_dashboard_payload_json" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_despesas_ultimas_10" WITH ("security_invoker"='on') AS
 SELECT "d"."id",
    "d"."usuario_id",
    "d"."tipo_despesa_id",
    "td"."nome" AS "tipo_despesa_nome",
    "d"."descricao",
    "d"."valor_despesa",
    "d"."status",
    "d"."metodo",
    "d"."data_competencia",
    "d"."pago_em",
    "d"."criado_em",
    COALESCE("d"."pago_em", ("d"."data_competencia")::timestamp with time zone, "d"."criado_em") AS "data_referencia",
    "d"."observacoes"
   FROM ("public"."despesas" "d"
     LEFT JOIN "public"."tipos_despesa" "td" ON (("td"."id" = "d"."tipo_despesa_id")))
  WHERE ("d"."usuario_id" = "auth"."uid"())
  ORDER BY COALESCE("d"."pago_em", ("d"."data_competencia")::timestamp with time zone, "d"."criado_em") DESC
 LIMIT 10;


ALTER VIEW "public"."v_despesas_ultimas_10" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_despesas_ultimas_30" WITH ("security_invoker"='true') AS
 SELECT "d"."id",
    "d"."usuario_id",
    "d"."tipo_despesa_id",
    "td"."nome" AS "tipo_despesa_nome",
    "d"."descricao",
    "d"."valor_despesa",
    "d"."status",
    "d"."metodo",
    "d"."data_competencia",
    "d"."pago_em",
    "d"."criado_em",
    COALESCE("d"."pago_em", ("d"."data_competencia")::timestamp with time zone, "d"."criado_em") AS "data_referencia",
    "d"."observacoes"
   FROM ("public"."despesas" "d"
     LEFT JOIN "public"."tipos_despesa" "td" ON (("td"."id" = "d"."tipo_despesa_id")))
  WHERE ("d"."usuario_id" = "auth"."uid"())
  ORDER BY COALESCE("d"."pago_em", ("d"."data_competencia")::timestamp with time zone, "d"."criado_em") DESC
 LIMIT 30;


ALTER VIEW "public"."v_despesas_ultimas_30" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_feedback_email" WITH ("security_invoker"='true') AS
 SELECT "id",
    "created_at",
    "app_name",
    "email",
    "mensagem",
    "handle_at",
    "concat"('Novo feedback recebido', '

', 'App: ', "app_name", '
', 'Data: ', "to_char"("created_at", 'DD/MM/YYYY HH24:MI'::"text"), '
', 'Email: ', COALESCE("email", 'não informado'::"text"), '

', 'Mensagem:', '
', COALESCE("mensagem", ''::"text")) AS "email_body"
   FROM "public"."feedback"
  WHERE ("handle_at" IS NULL)
  ORDER BY "created_at";


ALTER VIEW "public"."v_feedback_email" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_feedback_email_aggregated" WITH ("security_invoker"='true') AS
 SELECT "app_name",
    "count"(*) AS "total_feedbacks",
    "string_agg"("concat"('- ', 'Data: ', "to_char"("created_at", 'DD/MM/YYYY HH24:MI'::"text"), ' | Email: ', COALESCE("email", 'não informado'::"text"), '
', "mensagem"), '

'::"text" ORDER BY "created_at") AS "email_body"
   FROM "public"."feedback"
  WHERE ("handle_at" IS NULL)
  GROUP BY "app_name";


ALTER VIEW "public"."v_feedback_email_aggregated" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_financeiro_mensal" WITH ("security_invoker"='on') AS
 WITH "base" AS (
         SELECT "pagamentos"."usuario_id",
            (
                CASE
                    WHEN (("pagamentos"."status" = 'pago'::"text") AND ("pagamentos"."pago_em" IS NOT NULL)) THEN "date_trunc"('month'::"text", "pagamentos"."pago_em")
                    WHEN (("pagamentos"."status" = ANY (ARRAY['pendente'::"text", 'vencido'::"text"])) AND ("pagamentos"."vencimento_em" IS NOT NULL)) THEN "date_trunc"('month'::"text", ("pagamentos"."vencimento_em")::timestamp with time zone)
                    ELSE "date_trunc"('month'::"text", "now"())
                END)::"date" AS "mes_referencia",
            "pagamentos"."status",
            "pagamentos"."valor_pagamento"
           FROM "public"."pagamentos"
        )
 SELECT "usuario_id",
    "mes_referencia",
    "sum"(
        CASE
            WHEN ("status" = 'pago'::"text") THEN "valor_pagamento"
            ELSE 0
        END) AS "recebido",
    "sum"(
        CASE
            WHEN ("status" = ANY (ARRAY['pendente'::"text", 'vencido'::"text"])) THEN "valor_pagamento"
            ELSE 0
        END) AS "pendente"
   FROM "base"
  GROUP BY "usuario_id", "mes_referencia"
  ORDER BY "mes_referencia";


ALTER VIEW "public"."v_financeiro_mensal" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_minha_adesao" WITH ("security_invoker"='true') AS
 WITH "prof" AS (
         SELECT COALESCE("max"("pr"."nome"), '(sem perfil)'::"text") AS "nome_profissional"
           FROM "public"."profissionais" "pr"
          WHERE ("pr"."usuario_id" = "auth"."uid"())
        ), "pac" AS (
         SELECT "count"(*) AS "pacientes"
           FROM "public"."pacientes"
          WHERE ("pacientes"."usuario_id" = "auth"."uid"())
        ), "ses" AS (
         SELECT "count"(*) AS "sessoes"
           FROM "public"."sessoes"
          WHERE ("sessoes"."usuario_id" = "auth"."uid"())
        ), "pag" AS (
         SELECT "count"(*) AS "pagamentos"
           FROM "public"."pagamentos"
          WHERE ("pagamentos"."usuario_id" = "auth"."uid"())
        ), "des" AS (
         SELECT "count"(*) AS "despesas"
           FROM "public"."despesas"
          WHERE ("despesas"."usuario_id" = "auth"."uid"())
        )
 SELECT "prof"."nome_profissional",
    "pac"."pacientes",
    "ses"."sessoes",
    "pag"."pagamentos",
    "des"."despesas"
   FROM "prof",
    "pac",
    "ses",
    "pag",
    "des";


ALTER VIEW "public"."v_minha_adesao" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_pacientes_cartao" WITH ("security_invoker"='true') AS
 SELECT "pa"."usuario_id",
    "pa"."id" AS "paciente_id",
    "pa"."nome_completo",
    "pa"."status",
    "pa"."telefone",
    "pa"."email",
    "pa"."receber_sms",
        CASE
            WHEN (("pa"."primeira_consulta" IS NOT NULL) AND ("sr"."primeira_consulta_calc" IS NOT NULL)) THEN LEAST("pa"."primeira_consulta", "sr"."primeira_consulta_calc")
            WHEN ("pa"."primeira_consulta" IS NOT NULL) THEN "pa"."primeira_consulta"
            ELSE "sr"."primeira_consulta_calc"
        END AS "primeira_consulta",
    COALESCE("sr"."sessoes_realizadas", (0)::bigint) AS "sessoes_realizadas",
    COALESCE("pv"."preco", 0) AS "preco_vigente",
    "pv"."vigencia_desde" AS "preco_vigente_desde",
    "sr"."ultima_sessao",
    "pa"."observacoes",
    COALESCE("sr"."sessoes_ate_hoje", (0)::bigint) AS "total_sessoes_ate_hoje",
    COALESCE("pg"."total_pago_ate_hoje", (0)::bigint) AS "valor_total_pago_ate_hoje",
    COALESCE("sr"."sessoes_nao_pagas", (0)::bigint) AS "sessoes_nao_pagas"
   FROM ((("public"."pacientes" "pa"
     LEFT JOIN LATERAL ( SELECT "pp"."preco",
            "pp"."vigencia_desde"
           FROM "public"."precos_paciente" "pp"
          WHERE (("pp"."paciente_id" = "pa"."id") AND ("pp"."usuario_id" = "pa"."usuario_id") AND ("pp"."vigencia_desde" <= CURRENT_DATE))
          ORDER BY "pp"."vigencia_desde" DESC, "pp"."criado_em" DESC
         LIMIT 1) "pv" ON (true))
     LEFT JOIN ( SELECT "s"."usuario_id",
            "s"."paciente_id",
            "count"(*) FILTER (WHERE ("s"."status" = 'realizada'::"text")) AS "sessoes_realizadas",
            "count"(*) FILTER (WHERE (("s"."status" = 'realizada'::"text") AND ("s"."ocorreu_em_dia" <= CURRENT_DATE))) AS "sessoes_ate_hoje",
            "min"("s"."ocorreu_em_dia") FILTER (WHERE ("s"."status" = 'realizada'::"text")) AS "primeira_consulta_calc",
            "max"("s"."ocorreu_em_dia") FILTER (WHERE ("s"."status" = 'realizada'::"text")) AS "ultima_sessao",
            "count"(*) FILTER (WHERE ("lower"(TRIM(BOTH FROM "s"."pagamento")) = ANY (ARRAY['nao pagou'::"text", 'não pagou'::"text"]))) AS "sessoes_nao_pagas"
           FROM "public"."sessoes" "s"
          GROUP BY "s"."usuario_id", "s"."paciente_id") "sr" ON ((("sr"."paciente_id" = "pa"."id") AND ("sr"."usuario_id" = "pa"."usuario_id"))))
     LEFT JOIN ( SELECT "pg_1"."usuario_id",
            "pg_1"."paciente_id",
            "sum"("pg_1"."valor_pagamento") FILTER (WHERE (("pg_1"."status" = 'pago'::"text") AND ("pg_1"."data_competencia" <= CURRENT_DATE))) AS "total_pago_ate_hoje"
           FROM "public"."pagamentos" "pg_1"
          GROUP BY "pg_1"."usuario_id", "pg_1"."paciente_id") "pg" ON ((("pg"."paciente_id" = "pa"."id") AND ("pg"."usuario_id" = "pa"."usuario_id"))));


ALTER VIEW "public"."v_pacientes_cartao" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_pacientes_sms_ativos_resumo" WITH ("security_invoker"='true') AS
 SELECT "p"."usuario_id",
    "pr"."email" AS "profissional_email",
    "p"."id" AS "paciente_id",
    "p"."nome_completo" AS "paciente_nome",
    "p"."telefone",
    "p"."email" AS "paciente_email",
    "p"."receber_sms",
    ("count"("a"."id"))::integer AS "consultas_na_agenda_planejada"
   FROM (("public"."pacientes" "p"
     JOIN "public"."profissionais" "pr" ON (("pr"."id" = "p"."profissional_id")))
     LEFT JOIN "public"."agenda_semana_padrao" "a" ON ((("a"."paciente_id" = "p"."id") AND ("a"."usuario_id" = "p"."usuario_id"))))
  WHERE (COALESCE("p"."receber_sms", false) = true)
  GROUP BY "p"."usuario_id", "pr"."email", "p"."id", "p"."nome_completo", "p"."telefone", "p"."email", "p"."receber_sms"
  ORDER BY "pr"."email", "p"."nome_completo";


ALTER VIEW "public"."v_pacientes_sms_ativos_resumo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_pendencias_por_paciente" WITH ("security_invoker"='on') AS
 SELECT "pa"."usuario_id",
    "pa"."id" AS "paciente_id",
    "pa"."nome_completo",
    "count"(*) FILTER (WHERE ("pg"."status" = ANY (ARRAY['pendente'::"text", 'vencido'::"text"]))) AS "qtde_pendencias",
    COALESCE("sum"("pg"."valor_pagamento") FILTER (WHERE ("pg"."status" = ANY (ARRAY['pendente'::"text", 'vencido'::"text"]))), (0)::bigint) AS "total_pendente",
    "min"("pg"."vencimento_em") FILTER (WHERE ("pg"."status" = ANY (ARRAY['pendente'::"text", 'vencido'::"text"]))) AS "proximo_vencimento"
   FROM ("public"."pacientes" "pa"
     LEFT JOIN "public"."pagamentos" "pg" ON ((("pg"."paciente_id" = "pa"."id") AND ("pg"."usuario_id" = "pa"."usuario_id"))))
  GROUP BY "pa"."usuario_id", "pa"."id", "pa"."nome_completo";


ALTER VIEW "public"."v_pendencias_por_paciente" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_preco_vigente_paciente" WITH ("security_invoker"='on') AS
 SELECT DISTINCT ON ("pa"."id") "pa"."usuario_id",
    "pa"."id" AS "paciente_id",
    "pa"."nome_completo",
    "pr"."preco",
    "pr"."vigencia_desde"
   FROM ("public"."pacientes" "pa"
     LEFT JOIN "public"."precos_paciente" "pr" ON ((("pr"."paciente_id" = "pa"."id") AND ("pr"."usuario_id" = "pa"."usuario_id"))))
  ORDER BY "pa"."id", "pr"."vigencia_desde" DESC;


ALTER VIEW "public"."v_preco_vigente_paciente" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_precos_paciente" WITH ("security_invoker"='on') AS
 SELECT DISTINCT ON ("paciente_id", "profissional_id") "id",
    "profissional_id",
    "paciente_id",
    "preco",
    "vigencia_desde",
    "observacoes",
    "criado_em",
    "usuario_id"
   FROM "public"."precos_paciente" "pp"
  WHERE (("usuario_id" = "auth"."uid"()) AND ("vigencia_desde" <= CURRENT_DATE))
  ORDER BY "paciente_id", "profissional_id", "vigencia_desde" DESC, "criado_em" DESC;


ALTER VIEW "public"."v_precos_paciente" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_profissional_atual" WITH ("security_invoker"='on') AS
 SELECT "usuario_id",
    COALESCE("nome", ''::"text") AS "nome",
    "email",
    COALESCE("telefone", ''::"text") AS "telefone",
    COALESCE("linkedin", ''::"text") AS "linkedin",
    COALESCE("instagram", ''::"text") AS "instagram",
    COALESCE("ativo", true) AS "ativo",
    "criado_em"
   FROM "public"."profissionais" "p"
  WHERE ("usuario_id" = "auth"."uid"());


ALTER VIEW "public"."v_profissional_atual" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_sms_lembretes_pendentes" AS
 WITH "params" AS (
         SELECT ("now"() AT TIME ZONE 'America/Sao_Paulo'::"text") AS "now_sp",
            "date_trunc"('minute'::"text", ("now"() AT TIME ZONE 'America/Sao_Paulo'::"text")) AS "now_min_sp"
        ), "slot" AS (
         SELECT "params"."now_sp",
                CASE
                    WHEN (EXTRACT(minute FROM "params"."now_min_sp") = (0)::numeric) THEN "date_trunc"('hour'::"text", "params"."now_min_sp")
                    WHEN (EXTRACT(minute FROM "params"."now_min_sp") = (30)::numeric) THEN ("date_trunc"('hour'::"text", "params"."now_min_sp") + '00:30:00'::interval)
                    WHEN (EXTRACT(minute FROM "params"."now_min_sp") < (30)::numeric) THEN ("date_trunc"('hour'::"text", "params"."now_min_sp") + '00:30:00'::interval)
                    ELSE ("date_trunc"('hour'::"text", "params"."now_min_sp") + '01:00:00'::interval)
                END AS "slot_sp"
           FROM "params"
        ), "janela" AS (
         SELECT "slot"."slot_sp",
            ("slot"."slot_sp" + '00:30:00'::interval) AS "win_start_sp",
            ("slot"."slot_sp" + '01:00:00'::interval) AS "win_end_sp",
                CASE
                    WHEN (EXTRACT(dow FROM "slot"."slot_sp") = (0)::numeric) THEN 7
                    ELSE (EXTRACT(dow FROM "slot"."slot_sp"))::integer
                END AS "dow_1_7",
            ("slot"."slot_sp")::"date" AS "hoje_sp"
           FROM "slot"
        ), "candidatos" AS (
         SELECT "a"."id" AS "agenda_id",
            "a"."usuario_id",
            "a"."paciente_id",
            "p"."nome_completo" AS "paciente_nome",
            "p"."telefone",
            "p"."profissional_id",
            "pr"."nome" AS "profissional_nome",
            "a"."dia_semana",
            "a"."hora_inicio",
            "j"."slot_sp",
            "j"."win_start_sp",
            "j"."win_end_sp",
            "j"."dow_1_7",
            "j"."hoje_sp",
            ("date_trunc"('day'::"text", "j"."slot_sp") + ("a"."hora_inicio")::interval) AS "ocorrencia_inicio_sp"
           FROM ((("public"."agenda_semana_padrao" "a"
             JOIN "public"."pacientes" "p" ON (("p"."id" = "a"."paciente_id")))
             LEFT JOIN "public"."profissionais" "pr" ON (("pr"."id" = "p"."profissional_id")))
             CROSS JOIN "janela" "j")
          WHERE (("p"."receber_sms" = true) AND ("p"."telefone" IS NOT NULL) AND ("a"."dia_semana" = "j"."dow_1_7"))
        ), "filtrados" AS (
         SELECT "c"."agenda_id",
            "c"."usuario_id",
            "c"."paciente_id",
            "c"."paciente_nome",
            "c"."telefone",
            "c"."profissional_id",
            "c"."profissional_nome",
            "c"."dia_semana",
            "c"."hora_inicio",
            "c"."slot_sp",
            "c"."win_start_sp",
            "c"."win_end_sp",
            "c"."dow_1_7",
            "c"."hoje_sp",
            "c"."ocorrencia_inicio_sp",
            "to_char"("c"."ocorrencia_inicio_sp", 'HH24:MI'::"text") AS "horario_sessao"
           FROM "candidatos" "c"
          WHERE (("c"."ocorrencia_inicio_sp" >= "c"."win_start_sp") AND ("c"."ocorrencia_inicio_sp" < "c"."win_end_sp"))
        )
 SELECT "f"."agenda_id",
    "f"."usuario_id",
    "f"."profissional_id",
    "f"."profissional_nome",
    "f"."paciente_id",
    "f"."paciente_nome",
    "f"."telefone",
    ("f"."ocorrencia_inicio_sp" AT TIME ZONE 'America/Sao_Paulo'::"text") AS "ocorrencia_inicio",
    "f"."hoje_sp" AS "ocorrencia_data",
    "f"."horario_sessao",
    (((('Ola '::"text" || "public"."unaccent"("f"."paciente_nome")) || '. Sua consulta com o(a) '::"text") || "public"."unaccent"("f"."profissional_nome")) || ' vai comecar em alguns minutos.'::"text") AS "mensagem_sms"
   FROM ("filtrados" "f"
     LEFT JOIN "public"."sms_lembretes_enviados" "l" ON ((("l"."agenda_id" = "f"."agenda_id") AND ("l"."ocorrencia_data" = "f"."hoje_sp"))))
  WHERE ("l"."id" IS NULL);


ALTER VIEW "public"."v_sms_lembretes_pendentes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_agenda_semana_padrao" WITH ("security_invoker"='true') AS
 SELECT "a"."id",
    "a"."usuario_id",
    "a"."paciente_id",
    "p"."nome_completo" AS "paciente_nome",
    "a"."dia_semana",
        CASE "a"."dia_semana"
            WHEN 1 THEN 'Segunda'::"text"
            WHEN 2 THEN 'Terça'::"text"
            WHEN 3 THEN 'Quarta'::"text"
            WHEN 4 THEN 'Quinta'::"text"
            WHEN 5 THEN 'Sexta'::"text"
            WHEN 6 THEN 'Sábado'::"text"
            WHEN 7 THEN 'Domingo'::"text"
            ELSE NULL::"text"
        END AS "dia_semana_label",
    (EXTRACT(hour FROM "a"."hora_inicio"))::integer AS "hora_bloco",
    "a"."hora_inicio",
    "a"."hora_fim",
    "a"."observacoes",
    "to_char"(("a"."hora_inicio")::interval, 'HH24:MI'::"text") AS "hora_label"
   FROM ("public"."agenda_semana_padrao" "a"
     JOIN "public"."pacientes" "p" ON (("p"."id" = "a"."paciente_id")));


ALTER VIEW "public"."view_agenda_semana_padrao" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_locais_atendimento_cards" WITH ("security_invoker"='true') AS
 SELECT "l"."id",
    "l"."nome",
    "l"."cidade",
    "l"."bairro",
    "l"."estado",
    "l"."tipo_local",
    "l"."url_contato",
    "l"."origem",
    "l"."status",
    "l"."criado_em",
    "count"("c"."id") FILTER (WHERE ("c"."status" = 'aprovado'::"text")) AS "total_comentarios_aprovados"
   FROM ("public"."locais_atendimento" "l"
     LEFT JOIN "public"."comentarios_locais_atendimento" "c" ON (("c"."local_atendimento_id" = "l"."id")))
  WHERE ("l"."status" = 'aprovado'::"text")
  GROUP BY "l"."id", "l"."nome", "l"."cidade", "l"."bairro", "l"."estado", "l"."tipo_local", "l"."url_contato", "l"."origem", "l"."status", "l"."criado_em";


ALTER VIEW "public"."view_locais_atendimento_cards" OWNER TO "postgres";


ALTER TABLE ONLY "public"."agenda_semana_padrao"
    ADD CONSTRAINT "agenda_semana_padrao_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comentarios_locais_atendimento"
    ADD CONSTRAINT "comentarios_locais_atendimento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."config_app"
    ADD CONSTRAINT "config_app_pkey" PRIMARY KEY ("chave");



ALTER TABLE ONLY "public"."custos_sms_mensal"
    ADD CONSTRAINT "custos_sms_mensal_pkey" PRIMARY KEY ("mes");



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locais_atendimento"
    ADD CONSTRAINT "locais_atendimento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pacientes"
    ADD CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pagamentos"
    ADD CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."precos_paciente"
    ADD CONSTRAINT "precos_paciente_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profissionais"
    ADD CONSTRAINT "profissionais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessoes"
    ADD CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_lembretes_enviados"
    ADD CONSTRAINT "sms_lembretes_enviados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_lembretes_enviados"
    ADD CONSTRAINT "sms_lembretes_enviados_un" UNIQUE ("agenda_id", "ocorrencia_data");



ALTER TABLE ONLY "public"."tipos_despesa"
    ADD CONSTRAINT "tipos_despesa_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_despesas_user_criado" ON "public"."despesas" USING "btree" ("usuario_id", "criado_em");



CREATE INDEX "idx_despesas_user_status" ON "public"."despesas" USING "btree" ("usuario_id", "status");



CREATE INDEX "idx_despesas_user_tipo" ON "public"."despesas" USING "btree" ("usuario_id", "tipo_despesa_id");



CREATE INDEX "idx_sms_lembretes_enviados_agenda_data" ON "public"."sms_lembretes_enviados" USING "btree" ("agenda_id", "ocorrencia_data");



CREATE INDEX "pacientes_profissional_id_status_nome_completo_idx" ON "public"."pacientes" USING "btree" ("profissional_id", "status", "nome_completo");



CREATE INDEX "pacientes_user_status_nome_idx" ON "public"."pacientes" USING "btree" ("usuario_id", "status", "nome_completo");



CREATE INDEX "pagamentos_profissional_id_paciente_id_idx" ON "public"."pagamentos" USING "btree" ("profissional_id", "paciente_id");



CREATE INDEX "pagamentos_profissional_id_pago_em_idx" ON "public"."pagamentos" USING "btree" ("profissional_id", "pago_em");



CREATE INDEX "pagamentos_profissional_id_status_vencimento_em_idx" ON "public"."pagamentos" USING "btree" ("profissional_id", "status", "vencimento_em");



CREATE INDEX "pagamentos_user_paciente_idx" ON "public"."pagamentos" USING "btree" ("usuario_id", "paciente_id");



CREATE INDEX "pagamentos_user_pagoem_idx" ON "public"."pagamentos" USING "btree" ("usuario_id", "pago_em");



CREATE INDEX "pagamentos_user_status_venc_idx" ON "public"."pagamentos" USING "btree" ("usuario_id", "status", "vencimento_em");



CREATE INDEX "precos_paciente_profissional_id_paciente_id_vigencia_desde_idx" ON "public"."precos_paciente" USING "btree" ("profissional_id", "paciente_id", "vigencia_desde" DESC);



CREATE INDEX "precos_user_paciente_vigencia_idx" ON "public"."precos_paciente" USING "btree" ("usuario_id", "paciente_id", "vigencia_desde" DESC);



CREATE UNIQUE INDEX "profissionais_usuario_id_idx" ON "public"."profissionais" USING "btree" ("usuario_id");



CREATE UNIQUE INDEX "profissionais_usuario_uidx" ON "public"."profissionais" USING "btree" ("usuario_id");



CREATE INDEX "sessoes_profissional_id_ocorreu_em_dia_idx" ON "public"."sessoes" USING "btree" ("profissional_id", "ocorreu_em_dia" DESC);



CREATE INDEX "sessoes_profissional_id_paciente_id_ocorreu_em_dia_idx" ON "public"."sessoes" USING "btree" ("profissional_id", "paciente_id", "ocorreu_em_dia" DESC);



CREATE INDEX "sessoes_profissional_id_status_idx" ON "public"."sessoes" USING "btree" ("profissional_id", "status");



CREATE INDEX "sessoes_user_paciente_data_dia_idx" ON "public"."sessoes" USING "btree" ("usuario_id", "paciente_id", "ocorreu_em_dia" DESC);



CREATE OR REPLACE TRIGGER "trg_pacientes_sync_ids" BEFORE INSERT OR UPDATE ON "public"."pacientes" FOR EACH ROW EXECUTE FUNCTION "public"."fn_pacientes_sync_ids"();



CREATE OR REPLACE TRIGGER "trg_precos_sync_ids" BEFORE INSERT OR UPDATE ON "public"."precos_paciente" FOR EACH ROW EXECUTE FUNCTION "public"."fn_precos_sync_ids"();



-- -----------------------------------------------------------------------------
-- REDIGIDO NESTE BASELINE — não é omissão, é decisão de segurança.
--
-- Aqui vinha a instrução CREATE OR REPLACE TRIGGER "trigger-notification", que o
-- pg_dump reproduz com o JWT de service_role em TEXTO PURO dentro dos próprios
-- argumentos do trigger. Essa chave ignora as 68 policies. Versionar o dump como
-- ele sai seria publicar a credencial no repositório — o risco 23.2 do spec, só
-- que agora em git, que não esquece.
--
-- O trigger continua existindo no banco. Ele é substituído pela migration 0005,
-- que cria fn_notifica_push lendo a chave do Vault e faz drop do trigger antigo.
-- Reconstruir o banco do zero a partir destas migrations chega ao mesmo estado
-- final: a 0005 faz drop trigger if exists e cria o novo.
--
-- A chave em si NÃO é reproduzida aqui nem em nenhum outro arquivo. Para ver a
-- definição original, consultar pg_get_triggerdef no banco — e, depois de rodar
-- o runbook da 0005, nem lá ela estará mais.
-- -----------------------------------------------------------------------------

ALTER TABLE ONLY "public"."agenda_semana_padrao"
    ADD CONSTRAINT "agenda_semana_padrao_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agenda_semana_padrao"
    ADD CONSTRAINT "agenda_semana_padrao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."comentarios_locais_atendimento"
    ADD CONSTRAINT "comentarios_locais_atendimento_criado_por_usuario_id_fkey" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."comentarios_locais_atendimento"
    ADD CONSTRAINT "comentarios_locais_atendimento_local_atendimento_id_fkey" FOREIGN KEY ("local_atendimento_id") REFERENCES "public"."locais_atendimento"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_tipo_despesa_id_fkey" FOREIGN KEY ("tipo_despesa_id") REFERENCES "public"."tipos_despesa"("id");



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."locais_atendimento"
    ADD CONSTRAINT "locais_atendimento_criado_por_usuario_id_fkey" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_usuario_fkey" FOREIGN KEY ("recipient_usuario_id") REFERENCES "public"."profissionais"("usuario_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pacientes"
    ADD CONSTRAINT "pacientes_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "public"."profissionais"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pacientes"
    ADD CONSTRAINT "pacientes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pagamentos"
    ADD CONSTRAINT "pagamentos_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pagamentos"
    ADD CONSTRAINT "pagamentos_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "public"."profissionais"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pagamentos"
    ADD CONSTRAINT "pagamentos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."precos_paciente"
    ADD CONSTRAINT "precos_paciente_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."precos_paciente"
    ADD CONSTRAINT "precos_paciente_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "public"."profissionais"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."precos_paciente"
    ADD CONSTRAINT "precos_paciente_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessoes"
    ADD CONSTRAINT "sessoes_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessoes"
    ADD CONSTRAINT "sessoes_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "public"."profissionais"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessoes"
    ADD CONSTRAINT "sessoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_lembretes_enviados"
    ADD CONSTRAINT "sms_lembretes_enviados_agenda_id_fkey" FOREIGN KEY ("agenda_id") REFERENCES "public"."agenda_semana_padrao"("id") ON DELETE CASCADE;



CREATE POLICY "Delete only own rows" ON "public"."agenda_semana_padrao" FOR DELETE USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "Insert only own rows" ON "public"."agenda_semana_padrao" FOR INSERT WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "Pacientes visíveis pelo dono" ON "public"."pacientes" FOR SELECT USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "Pagamentos visíveis pelo dono" ON "public"."pagamentos" FOR SELECT USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "Preços visíveis pelo dono" ON "public"."precos_paciente" FOR SELECT USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "Profissionais visíveis pelo dono" ON "public"."profissionais" FOR SELECT USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "Select only own rows" ON "public"."agenda_semana_padrao" FOR SELECT USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "Sessões visíveis pelo dono" ON "public"."sessoes" FOR SELECT USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "Update only own rows" ON "public"."agenda_semana_padrao" FOR UPDATE USING (("usuario_id" = "auth"."uid"())) WITH CHECK (("usuario_id" = "auth"."uid"()));



ALTER TABLE "public"."agenda_semana_padrao" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comentarios_locais_atendimento" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comentarios_locais_delete_auth" ON "public"."comentarios_locais_atendimento" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "comentarios_locais_insert_auth" ON "public"."comentarios_locais_atendimento" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "comentarios_locais_select_auth" ON "public"."comentarios_locais_atendimento" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "comentarios_locais_update_auth" ON "public"."comentarios_locais_atendimento" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."config_app" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custos_sms_mensal" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "custos_sms_mensal_admin_read" ON "public"."custos_sms_mensal" FOR SELECT TO "service_role" USING (true);



ALTER TABLE "public"."despesas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "despesas_delete" ON "public"."despesas" FOR DELETE TO "authenticated" USING ((("usuario_id" = "auth"."uid"()) AND (("public"."demo_uid"() IS NULL) OR ("auth"."uid"() <> "public"."demo_uid"()))));



CREATE POLICY "despesas_insert" ON "public"."despesas" FOR INSERT TO "authenticated" WITH CHECK ((("usuario_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."tipos_despesa" "td"
  WHERE (("td"."id" = "despesas"."tipo_despesa_id") AND ("td"."ativo" = true))))));



CREATE POLICY "despesas_select" ON "public"."despesas" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "despesas_update" ON "public"."despesas" FOR UPDATE TO "authenticated" USING (("usuario_id" = "auth"."uid"())) WITH CHECK ((("usuario_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."tipos_despesa" "td"
  WHERE (("td"."id" = "despesas"."tipo_despesa_id") AND ("td"."ativo" = true))))));



ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feedback_insert_public" ON "public"."feedback" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "feedback_select_authenticated" ON "public"."feedback" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."locais_atendimento" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "locais_atendimento_delete_auth" ON "public"."locais_atendimento" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "locais_atendimento_insert_auth" ON "public"."locais_atendimento" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "locais_atendimento_select_auth" ON "public"."locais_atendimento" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "locais_atendimento_update_auth" ON "public"."locais_atendimento" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_delete" ON "public"."notifications" FOR DELETE TO "authenticated" USING (("recipient_usuario_id" = "auth"."uid"()));



CREATE POLICY "notifications_insert" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (("recipient_usuario_id" = "auth"."uid"()));



CREATE POLICY "notifications_select" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("recipient_usuario_id" = "auth"."uid"()));



CREATE POLICY "notifications_update" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("recipient_usuario_id" = "auth"."uid"())) WITH CHECK (("recipient_usuario_id" = "auth"."uid"()));



ALTER TABLE "public"."pacientes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pacientes_delete_own" ON "public"."pacientes" FOR DELETE TO "authenticated" USING ((("usuario_id" = "auth"."uid"()) AND ("auth"."uid"() <> "public"."demo_uid"())));



CREATE POLICY "pacientes_insert_own" ON "public"."pacientes" FOR INSERT TO "authenticated" WITH CHECK ((("usuario_id" = "auth"."uid"()) AND (("profissional_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."profissionais" "pr"
  WHERE (("pr"."id" = "pacientes"."profissional_id") AND ("pr"."usuario_id" = "auth"."uid"())))))));



CREATE POLICY "pacientes_rls" ON "public"."pacientes" USING ((EXISTS ( SELECT 1
   FROM "public"."profissionais" "p"
  WHERE (("p"."id" = "pacientes"."profissional_id") AND ("p"."usuario_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profissionais" "p"
  WHERE (("p"."id" = "pacientes"."profissional_id") AND ("p"."usuario_id" = "auth"."uid"())))));



CREATE POLICY "pacientes_select_own" ON "public"."pacientes" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "pacientes_update_own" ON "public"."pacientes" FOR UPDATE TO "authenticated" USING (("usuario_id" = "auth"."uid"())) WITH CHECK ((("usuario_id" = "auth"."uid"()) AND (("profissional_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."profissionais" "pr"
  WHERE (("pr"."id" = "pacientes"."profissional_id") AND ("pr"."usuario_id" = "auth"."uid"())))))));



CREATE POLICY "pag_delete_own" ON "public"."pagamentos" FOR DELETE TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "pag_insert_own" ON "public"."pagamentos" FOR INSERT TO "authenticated" WITH CHECK ((("usuario_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."pacientes" "p"
  WHERE (("p"."id" = "pagamentos"."paciente_id") AND ("p"."usuario_id" = "auth"."uid"())))) AND (("profissional_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."profissionais" "pr"
  WHERE (("pr"."id" = "pagamentos"."profissional_id") AND ("pr"."usuario_id" = "auth"."uid"())))))));



CREATE POLICY "pag_select_own" ON "public"."pagamentos" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "pag_update_own" ON "public"."pagamentos" FOR UPDATE TO "authenticated" USING (("usuario_id" = "auth"."uid"())) WITH CHECK ((("usuario_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."pacientes" "p"
  WHERE (("p"."id" = "pagamentos"."paciente_id") AND ("p"."usuario_id" = "auth"."uid"())))) AND (("profissional_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."profissionais" "pr"
  WHERE (("pr"."id" = "pagamentos"."profissional_id") AND ("pr"."usuario_id" = "auth"."uid"())))))));



ALTER TABLE "public"."pagamentos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pagamentos_delete_own" ON "public"."pagamentos" FOR DELETE TO "authenticated" USING ((("usuario_id" = "auth"."uid"()) AND ("auth"."uid"() <> "public"."demo_uid"())));



CREATE POLICY "pagamentos_insert_own" ON "public"."pagamentos" FOR INSERT TO "authenticated" WITH CHECK ((("usuario_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."pacientes" "pa"
  WHERE (("pa"."id" = "pagamentos"."paciente_id") AND ("pa"."usuario_id" = "auth"."uid"()))))));



CREATE POLICY "pagamentos_rls" ON "public"."pagamentos" USING ((EXISTS ( SELECT 1
   FROM "public"."profissionais" "p"
  WHERE (("p"."id" = "pagamentos"."profissional_id") AND ("p"."usuario_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profissionais" "p"
  WHERE (("p"."id" = "pagamentos"."profissional_id") AND ("p"."usuario_id" = "auth"."uid"())))));



CREATE POLICY "pagamentos_select_own" ON "public"."pagamentos" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "pagamentos_update_own" ON "public"."pagamentos" FOR UPDATE TO "authenticated" USING (("usuario_id" = "auth"."uid"())) WITH CHECK ((("usuario_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."pacientes" "pa"
  WHERE (("pa"."id" = "pagamentos"."paciente_id") AND ("pa"."usuario_id" = "auth"."uid"()))))));



CREATE POLICY "precos_delete_own" ON "public"."precos_paciente" FOR DELETE TO "authenticated" USING ((("usuario_id" = "auth"."uid"()) AND ("auth"."uid"() <> "public"."demo_uid"())));



CREATE POLICY "precos_insert_own" ON "public"."precos_paciente" FOR INSERT TO "authenticated" WITH CHECK ((("usuario_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."pacientes" "p"
  WHERE (("p"."id" = "precos_paciente"."paciente_id") AND ("p"."usuario_id" = "auth"."uid"())))) AND (("profissional_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."profissionais" "pr"
  WHERE (("pr"."id" = "precos_paciente"."profissional_id") AND ("pr"."usuario_id" = "auth"."uid"())))))));



ALTER TABLE "public"."precos_paciente" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "precos_paciente_rls" ON "public"."precos_paciente" USING ((EXISTS ( SELECT 1
   FROM "public"."profissionais" "p"
  WHERE (("p"."id" = "precos_paciente"."profissional_id") AND ("p"."usuario_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profissionais" "p"
  WHERE (("p"."id" = "precos_paciente"."profissional_id") AND ("p"."usuario_id" = "auth"."uid"())))));



CREATE POLICY "precos_select_own" ON "public"."precos_paciente" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "precos_update_own" ON "public"."precos_paciente" FOR UPDATE TO "authenticated" USING (("usuario_id" = "auth"."uid"())) WITH CHECK ((("usuario_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."pacientes" "p"
  WHERE (("p"."id" = "precos_paciente"."paciente_id") AND ("p"."usuario_id" = "auth"."uid"())))) AND (("profissional_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."profissionais" "pr"
  WHERE (("pr"."id" = "precos_paciente"."profissional_id") AND ("pr"."usuario_id" = "auth"."uid"())))))));



CREATE POLICY "prof_delete_own" ON "public"."profissionais" FOR DELETE TO "authenticated" USING ((("usuario_id" = "auth"."uid"()) AND ("auth"."uid"() <> "public"."demo_uid"())));



CREATE POLICY "prof_insert_own" ON "public"."profissionais" FOR INSERT TO "authenticated" WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "prof_select_own" ON "public"."profissionais" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "prof_update_own" ON "public"."profissionais" FOR UPDATE TO "authenticated" USING (("usuario_id" = "auth"."uid"())) WITH CHECK (("usuario_id" = "auth"."uid"()));



ALTER TABLE "public"."profissionais" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profissionais_delete_own" ON "public"."profissionais" FOR DELETE TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "profissionais_insert_own" ON "public"."profissionais" FOR INSERT TO "authenticated" WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "profissionais_select_own" ON "public"."profissionais" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "profissionais_select_self" ON "public"."profissionais" FOR SELECT USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "profissionais_update_own" ON "public"."profissionais" FOR UPDATE TO "authenticated" USING (("usuario_id" = "auth"."uid"())) WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "select agenda via view" ON "public"."agenda_semana_padrao" FOR SELECT USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "select own pacientes" ON "public"."pacientes" FOR SELECT USING (("usuario_id" = "auth"."uid"()));



ALTER TABLE "public"."sessoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sessoes_delete_own" ON "public"."sessoes" FOR DELETE TO "authenticated" USING ((("usuario_id" = "auth"."uid"()) AND ("auth"."uid"() <> "public"."demo_uid"())));



CREATE POLICY "sessoes_insert_own" ON "public"."sessoes" FOR INSERT TO "authenticated" WITH CHECK ((("usuario_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."pacientes" "p"
  WHERE (("p"."id" = "sessoes"."paciente_id") AND ("p"."usuario_id" = "auth"."uid"())))) AND (("profissional_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."profissionais" "pr"
  WHERE (("pr"."id" = "sessoes"."profissional_id") AND ("pr"."usuario_id" = "auth"."uid"())))))));



CREATE POLICY "sessoes_rls" ON "public"."sessoes" USING ((EXISTS ( SELECT 1
   FROM "public"."profissionais" "p"
  WHERE (("p"."id" = "sessoes"."profissional_id") AND ("p"."usuario_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profissionais" "p"
  WHERE (("p"."id" = "sessoes"."profissional_id") AND ("p"."usuario_id" = "auth"."uid"())))));



CREATE POLICY "sessoes_select_own" ON "public"."sessoes" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "sessoes_update_own" ON "public"."sessoes" FOR UPDATE TO "authenticated" USING (("usuario_id" = "auth"."uid"())) WITH CHECK ((("usuario_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."pacientes" "p"
  WHERE (("p"."id" = "sessoes"."paciente_id") AND ("p"."usuario_id" = "auth"."uid"())))) AND (("profissional_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."profissionais" "pr"
  WHERE (("pr"."id" = "sessoes"."profissional_id") AND ("pr"."usuario_id" = "auth"."uid"())))))));



CREATE POLICY "sms_lembretes_delete_auth" ON "public"."sms_lembretes_enviados" FOR DELETE TO "authenticated" USING (true);



ALTER TABLE "public"."sms_lembretes_enviados" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sms_lembretes_insert_auth" ON "public"."sms_lembretes_enviados" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "sms_lembretes_select_auth" ON "public"."sms_lembretes_enviados" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "sms_lembretes_update_auth" ON "public"."sms_lembretes_enviados" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."tipos_despesa" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tipos_despesa_select" ON "public"."tipos_despesa" FOR SELECT TO "authenticated" USING (("ativo" = true));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."agentpsi_consultar_paciente"("p_usuario_id" "uuid", "p_nome_paciente" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."agentpsi_consultar_paciente"("p_usuario_id" "uuid", "p_nome_paciente" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."agentpsi_consultar_paciente"("p_usuario_id" "uuid", "p_nome_paciente" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."agentpsi_criar_paciente"("p_usuario_id" "uuid", "p_nome_completo" "text", "p_telefone" "text", "p_email" "text", "p_observacoes" "text", "p_primeira_consulta" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."agentpsi_criar_paciente"("p_usuario_id" "uuid", "p_nome_completo" "text", "p_telefone" "text", "p_email" "text", "p_observacoes" "text", "p_primeira_consulta" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."agentpsi_criar_paciente"("p_usuario_id" "uuid", "p_nome_completo" "text", "p_telefone" "text", "p_email" "text", "p_observacoes" "text", "p_primeira_consulta" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."agentpsi_dashboard"("p_usuario_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."agentpsi_dashboard"("p_usuario_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."agentpsi_dashboard"("p_usuario_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."agentpsi_listar_despesas_ultimas_30"("p_usuario_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."agentpsi_listar_despesas_ultimas_30"("p_usuario_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."agentpsi_listar_despesas_ultimas_30"("p_usuario_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."agentpsi_listar_pacientes_ativos"("p_usuario_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."agentpsi_listar_pacientes_ativos"("p_usuario_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."agentpsi_listar_pacientes_ativos"("p_usuario_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."agentpsi_listar_pagamentos_ultimos_30"("p_usuario_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."agentpsi_listar_pagamentos_ultimos_30"("p_usuario_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."agentpsi_listar_pagamentos_ultimos_30"("p_usuario_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."agentpsi_registrar_despesa"("p_usuario_id" "uuid", "p_nome_tipo_despesa" "text", "p_valor_despesa" numeric, "p_data_competencia" "date", "p_descricao" "text", "p_metodo" "text", "p_observacoes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."agentpsi_registrar_despesa"("p_usuario_id" "uuid", "p_nome_tipo_despesa" "text", "p_valor_despesa" numeric, "p_data_competencia" "date", "p_descricao" "text", "p_metodo" "text", "p_observacoes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."agentpsi_registrar_despesa"("p_usuario_id" "uuid", "p_nome_tipo_despesa" "text", "p_valor_despesa" numeric, "p_data_competencia" "date", "p_descricao" "text", "p_metodo" "text", "p_observacoes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."agentpsi_registrar_pagamento"("p_usuario_id" "uuid", "p_nome_paciente" "text", "p_valor_pagamento" integer, "p_data_pagamento" "date", "p_metodo" "text", "p_observacoes" "text", "p_tipo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."agentpsi_registrar_pagamento"("p_usuario_id" "uuid", "p_nome_paciente" "text", "p_valor_pagamento" integer, "p_data_pagamento" "date", "p_metodo" "text", "p_observacoes" "text", "p_tipo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."agentpsi_registrar_pagamento"("p_usuario_id" "uuid", "p_nome_paciente" "text", "p_valor_pagamento" integer, "p_data_pagamento" "date", "p_metodo" "text", "p_observacoes" "text", "p_tipo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."agentpsi_registrar_sessao"("p_usuario_id" "uuid", "p_nome_paciente" "text", "p_ocorreu_em" timestamp with time zone, "p_modalidade" "text", "p_duracao_minutos" integer, "p_observacoes" "text", "p_gerar_pagamento" boolean, "p_valor_pagamento" integer, "p_metodo" "text", "p_tipo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."agentpsi_registrar_sessao"("p_usuario_id" "uuid", "p_nome_paciente" "text", "p_ocorreu_em" timestamp with time zone, "p_modalidade" "text", "p_duracao_minutos" integer, "p_observacoes" "text", "p_gerar_pagamento" boolean, "p_valor_pagamento" integer, "p_metodo" "text", "p_tipo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."agentpsi_registrar_sessao"("p_usuario_id" "uuid", "p_nome_paciente" "text", "p_ocorreu_em" timestamp with time zone, "p_modalidade" "text", "p_duracao_minutos" integer, "p_observacoes" "text", "p_gerar_pagamento" boolean, "p_valor_pagamento" integer, "p_metodo" "text", "p_tipo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_profissional_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_profissional_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_profissional_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."demo_uid"() TO "anon";
GRANT ALL ON FUNCTION "public"."demo_uid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."demo_uid"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_pacientes_sync_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_pacientes_sync_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_pacientes_sync_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_precos_sync_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_precos_sync_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_precos_sync_ids"() TO "service_role";



GRANT ALL ON TABLE "public"."agenda_semana_padrao" TO "anon";
GRANT ALL ON TABLE "public"."agenda_semana_padrao" TO "authenticated";
GRANT ALL ON TABLE "public"."agenda_semana_padrao" TO "service_role";



GRANT ALL ON TABLE "public"."comentarios_locais_atendimento" TO "anon";
GRANT ALL ON TABLE "public"."comentarios_locais_atendimento" TO "authenticated";
GRANT ALL ON TABLE "public"."comentarios_locais_atendimento" TO "service_role";



GRANT ALL ON TABLE "public"."config_app" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."config_app" TO "authenticated";
GRANT ALL ON TABLE "public"."config_app" TO "service_role";



GRANT ALL ON TABLE "public"."custos_sms_mensal" TO "anon";
GRANT ALL ON TABLE "public"."custos_sms_mensal" TO "authenticated";
GRANT ALL ON TABLE "public"."custos_sms_mensal" TO "service_role";



GRANT ALL ON TABLE "public"."despesas" TO "anon";
GRANT ALL ON TABLE "public"."despesas" TO "authenticated";
GRANT ALL ON TABLE "public"."despesas" TO "service_role";



GRANT ALL ON TABLE "public"."feedback" TO "anon";
GRANT ALL ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";



GRANT ALL ON SEQUENCE "public"."feedback_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."feedback_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."feedback_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."locais_atendimento" TO "anon";
GRANT ALL ON TABLE "public"."locais_atendimento" TO "authenticated";
GRANT ALL ON TABLE "public"."locais_atendimento" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pacientes" TO "authenticated";
GRANT ALL ON TABLE "public"."pacientes" TO "service_role";



GRANT ALL ON TABLE "public"."pagamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."pagamentos" TO "service_role";



GRANT ALL ON TABLE "public"."precos_paciente" TO "authenticated";
GRANT ALL ON TABLE "public"."precos_paciente" TO "service_role";



GRANT ALL ON TABLE "public"."profissionais" TO "authenticated";
GRANT ALL ON TABLE "public"."profissionais" TO "service_role";



GRANT ALL ON TABLE "public"."sessoes" TO "authenticated";
GRANT ALL ON TABLE "public"."sessoes" TO "service_role";



GRANT ALL ON TABLE "public"."sms_lembretes_enviados" TO "anon";
GRANT ALL ON TABLE "public"."sms_lembretes_enviados" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_lembretes_enviados" TO "service_role";



GRANT ALL ON TABLE "public"."tipos_despesa" TO "anon";
GRANT ALL ON TABLE "public"."tipos_despesa" TO "authenticated";
GRANT ALL ON TABLE "public"."tipos_despesa" TO "service_role";



GRANT ALL ON TABLE "public"."v_adesao_usuarios" TO "service_role";



GRANT ALL ON TABLE "public"."v_admin_dashboard_usuarios" TO "anon";
GRANT ALL ON TABLE "public"."v_admin_dashboard_usuarios" TO "authenticated";
GRANT ALL ON TABLE "public"."v_admin_dashboard_usuarios" TO "service_role";



GRANT ALL ON TABLE "public"."v_campanha_despesas" TO "anon";
GRANT ALL ON TABLE "public"."v_campanha_despesas" TO "authenticated";
GRANT ALL ON TABLE "public"."v_campanha_despesas" TO "service_role";



GRANT ALL ON TABLE "public"."v_sms_base_mensal" TO "anon";
GRANT ALL ON TABLE "public"."v_sms_base_mensal" TO "authenticated";
GRANT ALL ON TABLE "public"."v_sms_base_mensal" TO "service_role";



GRANT ALL ON TABLE "public"."v_custo_sms_mensal" TO "anon";
GRANT ALL ON TABLE "public"."v_custo_sms_mensal" TO "authenticated";
GRANT ALL ON TABLE "public"."v_custo_sms_mensal" TO "service_role";



GRANT ALL ON TABLE "public"."v_custo_sms_mensal_por_profissional" TO "anon";
GRANT ALL ON TABLE "public"."v_custo_sms_mensal_por_profissional" TO "authenticated";
GRANT ALL ON TABLE "public"."v_custo_sms_mensal_por_profissional" TO "service_role";



GRANT ALL ON TABLE "public"."v_dashboard_resumo" TO "anon";
GRANT ALL ON TABLE "public"."v_dashboard_resumo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_dashboard_resumo" TO "service_role";



GRANT ALL ON TABLE "public"."v_dashboard_payload_json" TO "anon";
GRANT ALL ON TABLE "public"."v_dashboard_payload_json" TO "authenticated";
GRANT ALL ON TABLE "public"."v_dashboard_payload_json" TO "service_role";



GRANT ALL ON TABLE "public"."v_despesas_ultimas_10" TO "anon";
GRANT ALL ON TABLE "public"."v_despesas_ultimas_10" TO "authenticated";
GRANT ALL ON TABLE "public"."v_despesas_ultimas_10" TO "service_role";



GRANT ALL ON TABLE "public"."v_despesas_ultimas_30" TO "anon";
GRANT ALL ON TABLE "public"."v_despesas_ultimas_30" TO "authenticated";
GRANT ALL ON TABLE "public"."v_despesas_ultimas_30" TO "service_role";



GRANT ALL ON TABLE "public"."v_feedback_email" TO "anon";
GRANT ALL ON TABLE "public"."v_feedback_email" TO "authenticated";
GRANT ALL ON TABLE "public"."v_feedback_email" TO "service_role";



GRANT ALL ON TABLE "public"."v_feedback_email_aggregated" TO "anon";
GRANT ALL ON TABLE "public"."v_feedback_email_aggregated" TO "authenticated";
GRANT ALL ON TABLE "public"."v_feedback_email_aggregated" TO "service_role";



GRANT ALL ON TABLE "public"."v_financeiro_mensal" TO "authenticated";
GRANT ALL ON TABLE "public"."v_financeiro_mensal" TO "service_role";



GRANT ALL ON TABLE "public"."v_minha_adesao" TO "anon";
GRANT ALL ON TABLE "public"."v_minha_adesao" TO "authenticated";
GRANT ALL ON TABLE "public"."v_minha_adesao" TO "service_role";



GRANT ALL ON TABLE "public"."v_pacientes_cartao" TO "anon";
GRANT ALL ON TABLE "public"."v_pacientes_cartao" TO "authenticated";
GRANT ALL ON TABLE "public"."v_pacientes_cartao" TO "service_role";



GRANT ALL ON TABLE "public"."v_pacientes_sms_ativos_resumo" TO "anon";
GRANT ALL ON TABLE "public"."v_pacientes_sms_ativos_resumo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_pacientes_sms_ativos_resumo" TO "service_role";



GRANT ALL ON TABLE "public"."v_pendencias_por_paciente" TO "authenticated";
GRANT ALL ON TABLE "public"."v_pendencias_por_paciente" TO "service_role";



GRANT ALL ON TABLE "public"."v_preco_vigente_paciente" TO "authenticated";
GRANT ALL ON TABLE "public"."v_preco_vigente_paciente" TO "service_role";



GRANT ALL ON TABLE "public"."v_precos_paciente" TO "authenticated";
GRANT ALL ON TABLE "public"."v_precos_paciente" TO "service_role";



GRANT ALL ON TABLE "public"."v_profissional_atual" TO "authenticated";
GRANT ALL ON TABLE "public"."v_profissional_atual" TO "service_role";



GRANT ALL ON TABLE "public"."v_sms_lembretes_pendentes" TO "anon";
GRANT ALL ON TABLE "public"."v_sms_lembretes_pendentes" TO "authenticated";
GRANT ALL ON TABLE "public"."v_sms_lembretes_pendentes" TO "service_role";



GRANT ALL ON TABLE "public"."view_agenda_semana_padrao" TO "anon";
GRANT ALL ON TABLE "public"."view_agenda_semana_padrao" TO "authenticated";
GRANT ALL ON TABLE "public"."view_agenda_semana_padrao" TO "service_role";



GRANT ALL ON TABLE "public"."view_locais_atendimento_cards" TO "anon";
GRANT ALL ON TABLE "public"."view_locais_atendimento_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."view_locais_atendimento_cards" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






