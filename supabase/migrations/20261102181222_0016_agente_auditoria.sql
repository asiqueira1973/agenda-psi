-- =============================================================================
-- 0016 — Auditoria do agente (tabela de sistema)
-- =============================================================================
--
-- Uma linha por pergunta feita ao agente: quem perguntou, o texto, quanto
-- custou e o que aconteceu. Pedido do Alexandre em 02/11/2026, para saber se a
-- funcionalidade é usada e quanto ela custa.
--
-- É TABELA DE SISTEMA, de auditoria interna:
--
-- - RLS ligada e NENHUMA policy. Nem o próprio usuário lê ou escreve aqui pelo
--   app. Quem grava é a Edge Function `agente`, com service_role, e só nesta
--   tabela; quem lê é o painel ou SQL do administrador.
-- - O texto da pergunta fica guardado e costuma ter nome de paciente e valor.
--   Por isso ele NÃO vai para o Visão do Produto (lá vai só a contagem, regra
--   20.4) e não há leitura por API.
--
-- O custo é ESTIMADO: tokens × preço por milhão vigente no deploy. O preço
-- usado fica gravado na linha, para recalcular se a tabela de preços mudar.
-- =============================================================================

create table if not exists public.agente_auditoria (
  id                    uuid primary key default gen_random_uuid(),
  usuario_id            uuid not null references auth.users (id) on delete cascade,
  criado_em             timestamptz not null default now(),
  -- A última mensagem da pessoa, a que foi respondida.
  pergunta              text not null,
  -- ok, erro, limite_excedido, conversa_invalida, desligado.
  resultado             text not null,
  modelo                text,
  rodadas               integer not null default 0,
  tokens_entrada        integer not null default 0,
  tokens_saida          integer not null default 0,
  -- Preço por milhão de tokens usado na estimativa, em dólar.
  preco_entrada_por_mi  numeric(10, 4),
  preco_saida_por_mi    numeric(10, 4),
  custo_estimado_usd    numeric(12, 6) not null default 0,
  ferramentas           text[] not null default '{}',
  -- Quantos cartões de confirmação a resposta trouxe.
  rascunhos             integer not null default 0,
  duracao_ms            integer
);

comment on table public.agente_auditoria is
  'Auditoria interna do agente: uma linha por pergunta, com texto, tokens e custo estimado. Tabela de sistema: RLS sem policy, escrita só pela Edge Function agente (service_role).';

alter table public.agente_auditoria enable row level security;
-- Sem policy de propósito: nenhum papel da API lê ou escreve.

create index if not exists agente_auditoria_usuario_criado
  on public.agente_auditoria (usuario_id, criado_em desc);
create index if not exists agente_auditoria_criado
  on public.agente_auditoria (criado_em desc);
