-- =============================================================================
-- 0015 — Sinalizador separado para as INCLUSÕES do agente
-- =============================================================================
--
-- A fase 2 do agente (docs/agente-plano.md) grava sessão, pagamento, paciente,
-- horário e despesa a partir de linguagem natural, sempre por cartão de
-- confirmação. É a parte com risco de dado errado no banco.
--
-- Um sinalizador próprio permite desligar SÓ as inclusões e manter as
-- consultas no ar:
--
--   update feature_flags set ativo = false where chave = 'agente_registros';
--
-- Com `agente` desligado, nada do agente funciona, com este ligado ou não.
-- Nasce desligado, como todo sinalizador (0014).
-- =============================================================================

insert into public.feature_flags (chave, ativo, descricao) values
  ('agente_registros', false,
   'Inclusões pelo agente (sessão, pagamento, paciente, horário, despesa), com cartão de confirmação. Depende de "agente" ligado.')
on conflict (chave) do nothing;
