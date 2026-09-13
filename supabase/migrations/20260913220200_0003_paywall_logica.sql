-- =============================================================================
-- Agenda Psi — Migration 0003 — Lógica do paywall no banco
--
-- O que faz: cria a função de limite, o trigger que alimenta o contador, a
-- função de recontagem e a view v_meu_plano.
--
-- O que NÃO faz: não liga o corte. A alteração de v_sms_lembretes_pendentes,
-- que é onde o paywall de fato bloqueia, está na migration 0008 e só é
-- aplicada quando o épico 8.11 estiver pronto para avisar e vender. Decidido
-- por Alexandre em 13/09/2026: ligar o corte antes da tela cortaria hoje os
-- lembretes de 2 profissionais reais sem nenhuma explicação para eles.
-- A 7.5 põe as duas coisas na 0003 — esta separação está em Divergências.
--
-- Regras do spec: 7.4 (lógica que vive no banco), 7.5 (migration 0003),
-- 11.5 (limite de SMS), 11.6 (plano e cortesia), 11.8 (fusos), 12.1 (máquina
-- de estado da assinatura), 8.11 (épico do paywall).
--
-- Princípio P2 e a regra de ouro de 8.11: o enforcement é na view
-- v_sms_lembretes_pendentes, e só ali. O app React Native exibe consumo e
-- vende; ele não decide se um SMS sai. Um cliente comprometido não consegue
-- mandar um SMS a mais.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- limite_sms_do_plano — quantos SMS o profissional pode enviar no mês
--
-- Recebe: p_profissional_id, o profissionais.id (não o usuario_id).
-- Devolve: o limite de SMS do mês, ou NULL quando é ilimitado.
-- Implementa: regra 11.5 (limites), 11.6 (plano e cortesia) e a máquina 12.1.
-- -----------------------------------------------------------------------------
create or replace function public.limite_sms_do_plano(p_profissional_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_fundador boolean;
  v_plano    text;
  v_status   text;
  v_expira   timestamptz;
  -- Limite do plano gratuito. Regra 11.5; a escolha do número 10 está
  -- declarada na assunção 24.3. Mudar o limite é mudar esta linha.
  c_limite_free constant integer := 10;
begin
  -- Sem profissional identificado não há plano a consultar: trata como free,
  -- que é o comportamento em caso de dúvida da regra 11.5.
  if p_profissional_id is null then
    return c_limite_free;
  end if;

  select coalesce(pr.usuario_fundador, false)
    into v_fundador
    from public.profissionais pr
   where pr.id = p_profissional_id;

  -- Fundador é ilimitado independente de plano e de volume (regra 11.5 e 11.6).
  if coalesce(v_fundador, false) then
    return null;
  end if;

  select a.plano, a.status, a.expira_em
    into v_plano, v_status, v_expira
    from public.assinaturas a
   where a.profissional_id = p_profissional_id;

  -- Sem linha em assinaturas o profissional é free (regra 11.5).
  if not found then
    return c_limite_free;
  end if;

  -- Pro com acesso vigente. Cancelado mantém acesso até expira_em e em_atraso
  -- mantém durante o período de graça (regra 11.6 e máquina 12.1).
  if v_plano = 'pro'
     and v_status in ('ativo','em_atraso','cancelado')
     and (v_expira is null or v_expira > now())
  then
    return null;
  end if;

  return c_limite_free;
end;
$$;

comment on function public.limite_sms_do_plano(uuid) is
  'Limite de SMS do mês para um profissional: NULL é ilimitado, 10 é o plano gratuito (spec 11.5, 11.6 e 12.1).';

-- -----------------------------------------------------------------------------
-- fn_uso_mensal_incrementa — soma 1 no contador do mês a cada SMS registrado
--
-- Dispara: after insert em sms_lembretes_enviados.
-- Implementa: regra 11.5 (unidade contada e mês de referência) e 7.4.
-- -----------------------------------------------------------------------------
create or replace function public.fn_uso_mensal_incrementa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profissional_id uuid;
  v_mes             date;
begin
  -- São dois saltos, não um (spec 7.4 e 7.6.5): sms_lembretes_enviados não tem
  -- usuario_id. Vai-se do agendamento ao usuario_id, e do usuario_id ao
  -- profissionais.id, que é a chave de uso_mensal.
  select pr.id
    into v_profissional_id
    from public.agenda_semana_padrao a
    join public.profissionais pr on pr.usuario_id = a.usuario_id
   where a.id = new.agenda_id;

  -- Agendamento órfão, ou dono sem ficha em profissionais: não há a quem
  -- debitar. O registro do SMS não pode falhar por causa disso (teste de 22).
  if v_profissional_id is null then
    return new;
  end if;

  -- Mês apurado em Brasília, não em UTC: um SMS enviado dia 1 às 00:30 conta no
  -- mês novo (regra 11.5 e 11.8).
  v_mes := date_trunc('month', (new.enviado_em at time zone 'America/Sao_Paulo'))::date;

  insert into public.uso_mensal (profissional_id, mes, sms_enviados, atualizado_em)
  values (v_profissional_id, v_mes, 1, now())
  on conflict (profissional_id, mes) do update
     set sms_enviados  = uso_mensal.sms_enviados + 1,
         atualizado_em = now();

  return new;
end;
$$;

comment on function public.fn_uso_mensal_incrementa() is
  'Soma 1 em uso_mensal a cada linha nova em sms_lembretes_enviados, derivando o profissional em dois saltos (spec 7.4 e 11.5).';

create trigger trg_uso_mensal_incrementa
after insert on public.sms_lembretes_enviados
for each row execute function public.fn_uso_mensal_incrementa();

comment on trigger trg_uso_mensal_incrementa on public.sms_lembretes_enviados is
  'Alimenta o contador do paywall a cada SMS registrado (spec 7.4 e 8.11).';

-- -----------------------------------------------------------------------------
-- recontar_uso_mensal — reconstrói o contador de um mês a partir do log
--
-- Recebe: p_mes, qualquer data dentro do mês a recontar.
-- Devolve: quantas linhas de uso_mensal foram reescritas.
-- Implementa: 7.3 (rede de segurança do contador) e o risco 23.10.
-- Uso manual, na conferência mensal contra a fatura do Bird.
-- -----------------------------------------------------------------------------
create or replace function public.recontar_uso_mensal(p_mes date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mes    date;
  v_linhas integer;
begin
  v_mes := date_trunc('month', p_mes)::date;

  delete from public.uso_mensal where mes = v_mes;

  insert into public.uso_mensal (profissional_id, mes, sms_enviados, atualizado_em)
  select pr.id, v_mes, count(*), now()
    from public.sms_lembretes_enviados l
    join public.agenda_semana_padrao a on a.id = l.agenda_id
    join public.profissionais pr       on pr.usuario_id = a.usuario_id
   where date_trunc('month', (l.enviado_em at time zone 'America/Sao_Paulo'))::date = v_mes
   group by pr.id;

  get diagnostics v_linhas = row_count;
  return v_linhas;
end;
$$;

comment on function public.recontar_uso_mensal(date) is
  'Reconstrói uso_mensal de um mês a partir de sms_lembretes_enviados. Rede de segurança para divergência do contador (spec 7.3 e risco 23.10).';

-- -----------------------------------------------------------------------------
-- v_meu_plano — plano, limite e consumo do mês do usuário autenticado
--
-- Auto-filtrada por auth.uid(). É a única fonte do app para o estado do plano;
-- o app não deduz plano de resposta local do StoreKit (spec 11.6 e 12.1).
-- Implementa: 7.4, 11.5, 11.6 e a copy de 15.7.
-- Ausência de linha em assinaturas significa free (regra 11.5).
-- -----------------------------------------------------------------------------
create or replace view public.v_meu_plano
with (security_invoker = on) as
with prof as (
  select p.id                                as profissional_id,
         coalesce(p.usuario_fundador, false)  as usuario_fundador
    from public.profissionais p
   where p.usuario_id = auth.uid()
), mes as (
  -- Mês corrente em Brasília, o mesmo do contador (regra 11.5 e 11.8).
  select date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date as mes_referencia
), base as (
  select pr.profissional_id,
         pr.usuario_fundador,
         m.mes_referencia,
         coalesce(a.plano, 'free')   as plano,
         coalesce(a.status, 'ativo') as status,
         a.store,
         a.expira_em,
         coalesce(u.sms_enviados, 0) as sms_usados,
         public.limite_sms_do_plano(pr.profissional_id) as limite_sms
    from prof pr
    cross join mes m
    left join public.assinaturas a on a.profissional_id = pr.profissional_id
    left join public.uso_mensal  u on u.profissional_id = pr.profissional_id
                                  and u.mes = m.mes_referencia
)
select b.profissional_id,
       b.usuario_fundador,
       b.plano,
       b.status,
       b.store,
       b.expira_em,
       b.mes_referencia,
       b.limite_sms,
       b.sms_usados,
       -- Nulo quando é ilimitado; nunca negativo quando o limite foi estourado.
       case when b.limite_sms is null then null
            else greatest(b.limite_sms - b.sms_usados, 0)
       end as sms_restantes,
       (b.limite_sms is not null and b.sms_usados >= b.limite_sms) as limite_atingido
  from base b;

comment on view public.v_meu_plano is
  'Plano, limite e consumo de SMS do mês do usuário autenticado. Fonte única do app para o estado do plano (spec 7.4, 11.5 e 11.6).';
