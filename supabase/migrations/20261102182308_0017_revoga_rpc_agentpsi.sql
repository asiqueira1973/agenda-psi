-- =============================================================================
-- Agenda Psi — Migration 0017 — Fecha as funções do Agente Psi antigo à API
--
-- O que faz: tira de anon, authenticated e public o direito de executar, por
-- RPC do PostgREST, as nove funções `agentpsi_*` do agente da época do
-- FlutterFlow.
--
-- Por que existe: o get_advisors de 02/11/2026, rodado depois da 0016, mostrou
-- que as nove são SECURITY DEFINER, executáveis pela chave ANÔNIMA (que está no
-- bundle do app publicado) e recebem `p_usuario_id` como parâmetro. Quem
-- soubesse o uuid de um psicólogo lia os pacientes e o dashboard dele e criava
-- paciente, sessão, pagamento e despesa na conta dele — ignorando as policies.
-- É o defeito 11.9.17 (o mais grave do app anterior, pegadinha 3 do CLAUDE.md)
-- pelo caminho das funções em vez do webhook. A 0009 fechou as do paywall; estas
-- ficaram.
--
-- Quem usava: o fluxo n8n `AgentePsi`, que saiu do produto em 14/09/2026. O
-- agente novo (Edge Function `agente`) não chama nenhuma delas: lê as views e
-- grava pelos hooks do app, sempre com o JWT do usuário. Nenhuma policy, view ou
-- função do banco depende delas (conferido em 02/11/2026).
--
-- As funções CONTINUAM existindo (service_role ainda executa), para não mexer em
-- histórico de quem ainda tenha o fluxo antigo; só deixam de ser endpoint.
--
-- FORA desta migration, de propósito: `demo_uid()`. Ela também é SECURITY
-- DEFINER e executável por anon, mas seis policies de DELETE (pacientes,
-- sessoes, pagamentos, precos_paciente, despesas, profissionais) a chamam.
-- Revogá-la de authenticated faria todo "excluir" do app falhar. Não recebe
-- parâmetro nem expõe dado de outro usuário.
--
-- De carona: fixa o search_path da função de trigger da 0014, que o advisor
-- apontou (function_search_path_mutable).
-- =============================================================================

revoke all on function public.agentpsi_consultar_paciente(uuid, text) from anon, authenticated, public;
revoke all on function public.agentpsi_criar_paciente(uuid, text, text, text, text, date) from anon, authenticated, public;
revoke all on function public.agentpsi_dashboard(uuid) from anon, authenticated, public;
revoke all on function public.agentpsi_listar_despesas_ultimas_30(uuid) from anon, authenticated, public;
revoke all on function public.agentpsi_listar_pacientes_ativos(uuid) from anon, authenticated, public;
revoke all on function public.agentpsi_listar_pagamentos_ultimos_30(uuid) from anon, authenticated, public;
revoke all on function public.agentpsi_registrar_despesa(uuid, text, numeric, date, text, text, text) from anon, authenticated, public;
revoke all on function public.agentpsi_registrar_pagamento(uuid, text, integer, date, text, text, text) from anon, authenticated, public;
revoke all on function public.agentpsi_registrar_sessao(uuid, text, timestamptz, text, integer, text, boolean, integer, text, text) from anon, authenticated, public;

alter function public.feature_flags_toca_atualizado_em() set search_path = '';
