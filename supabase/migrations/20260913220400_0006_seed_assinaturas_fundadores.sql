-- =============================================================================
-- Agenda Psi — Migration 0006 — Seed das assinaturas de cortesia dos fundadores
--
-- O que faz: cria a linha de assinatura Pro vitalícia de cortesia para cada
-- profissional marcado como fundador.
--
-- Regras do spec: 7.5 (seed), 11.6 (plano e cortesia), assunção 24.4.
--
-- Quem não é fundador NÃO é semeado: a ausência de linha em assinaturas já
-- significa free, tanto em limite_sms_do_plano quanto em v_meu_plano (regra
-- 11.5, "comportamento em caso de dúvida").
--
-- Conferido no banco em 13/09/2026: 195 profissionais com usuario_fundador
-- verdadeiro, de 362 no total — exatamente o número do spec.
--
-- Idempotente: rodar de novo não duplica nem sobrescreve cortesia existente.
-- =============================================================================

insert into public.assinaturas
  (profissional_id, plano, status, store, expira_em, inicio_em, atualizado_em)
select pr.id,
       'pro',
       'ativo',
       'cortesia',
       null,        -- vitalícia: cortesia não expira (spec 11.6 e 24.4)
       now(),
       now()
  from public.profissionais pr
 where coalesce(pr.usuario_fundador, false) = true
on conflict (profissional_id) do nothing;
