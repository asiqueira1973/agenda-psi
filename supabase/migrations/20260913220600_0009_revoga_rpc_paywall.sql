-- =============================================================================
-- Agenda Psi — Migration 0009 — Fecha as funções do paywall à API pública
--
-- O que faz: tira das roles anon e authenticated o direito de executar, por RPC
-- do PostgREST, as funções criadas na migration 0003.
--
-- Regras do spec: P4 (nenhum segredo nem superfície desnecessária no cliente),
-- P2 (quem decide o paywall é o banco), 20.1 a 20.3 e a exigência de 7.5 e 26
-- de rodar get_advisors depois de toda DDL e não deixar alerta crítico aberto.
--
-- Por que existe: o get_advisors rodado logo após a 0003 mostrou que toda função
-- em public vira endpoint /rest/v1/rpc/<nome> e, sendo SECURITY DEFINER, roda
-- ignorando as 68 policies. Na prática:
--
--   recontar_uso_mensal  — o pior caso. Apaga e reescreve uso_mensal do mês
--                          inteiro, de TODOS os profissionais. Chamável com a
--                          chave anônima, que está no bundle do app publicado.
--                          Não vaza dado; corrompe a contagem que sustenta o
--                          paywall. É manutenção, e manutenção não se expõe.
--   fn_uso_mensal_incrementa — função de trigger, não tem sentido fora dele.
--   limite_sms_do_plano  — devolve o limite de um profissional_id qualquer.
--
-- limite_sms_do_plano CONTINUA executável por authenticated, e isso é proposital:
-- v_meu_plano é security_invoker, então a função roda com a identidade de quem
-- consulta a view. Revogar de authenticated quebraria a tela do plano no app.
-- O que sobra de exposição é saber o limite de um uuid que já se conhece — e o
-- uuid de profissional não circula fora do banco.
-- =============================================================================

revoke all on function public.recontar_uso_mensal(date)      from anon, authenticated, public;
revoke all on function public.fn_uso_mensal_incrementa()     from anon, authenticated, public;
revoke all on function public.limite_sms_do_plano(uuid)      from anon, public;

-- Mantido de propósito: é a view v_meu_plano, security_invoker, que precisa.
grant execute on function public.limite_sms_do_plano(uuid) to authenticated;
