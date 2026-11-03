-- =============================================================================
-- 0018 — A auditoria do agente passa a guardar a RESPOSTA
-- =============================================================================
--
-- Pedido do Alexandre em 03/11/2026. Na investigação de um usuário real cujo
-- app Android mostrou erro enquanto o servidor respondia 200, dava para ver a
-- pergunta e as consultas, mas não o que a pessoa deveria ter lido.
--
-- Mesma natureza da coluna `pergunta`: pode citar nome de paciente e valor.
-- A tabela continua de sistema (RLS sem policy, 0016): nada disso é lido pela
-- API nem vai para o Visão do Produto.
--
-- Nulo quando não houve resposta (erro, recusa antes da IA).
-- =============================================================================

alter table public.agente_auditoria add column if not exists resposta text;

comment on column public.agente_auditoria.resposta is
  'Texto que a função devolveu ao app (o que a pessoa leu). Nulo em erro. Pode conter nome de paciente e valor: tabela de sistema, sem leitura pela API.';
