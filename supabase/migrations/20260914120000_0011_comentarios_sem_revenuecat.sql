-- =============================================================================
-- Agenda Psi — Migration 0011 — Corrige os comentários que citam o RevenueCat
--
-- O que faz: atualiza os comentários de `assinaturas` e das suas duas policies.
-- Nenhuma estrutura muda; nenhum dado é tocado.
--
-- Por que existe: a migration 0002 registrou, no catálogo do Postgres, que quem
-- escreve em `assinaturas` é a Edge Function `rc-webhook`. Em 14/09/2026 o
-- RevenueCat saiu do projeto — a compra passa a ser direto nas lojas, com uma
-- Edge Function por loja. Comentário errado no catálogo é pior que comentário
-- ausente: quem for investigar a tabela daqui a um ano vai procurar uma função
-- que não existe, e concluir que entendeu errado o sistema.
--
-- As colunas `rc_customer_id` e `rc_entitlement` MANTÊM o nome, de propósito:
-- renomear coluna de tabela em produção, só para melhorar o nome, é risco sem
-- retorno. O comentário explica o que elas passam a guardar.
-- =============================================================================

comment on table public.assinaturas is
  'Plano vigente de cada profissional. Fonte da verdade do paywall (spec 11.6). Escrita somente pelas Edge Functions apple-notificacoes e play-notificacoes, com service_role; o app nunca grava aqui (spec 5 e 12.1).';

comment on column public.assinaturas.rc_customer_id is
  'Identificador do usuário na loja: o profissionais.usuario_id carimbado na compra como appAccountToken (Apple) ou obfuscatedAccountId (Google). Nome herdado da época do RevenueCat.';

comment on column public.assinaturas.rc_entitlement is
  'Identificador do produto assinado na loja. Nome herdado da época do RevenueCat.';

comment on policy assinaturas_select_proprio on public.assinaturas is
  'Leitura da própria assinatura (spec 6.5). Não existe policy de escrita: quem grava são as Edge Functions de notificação das lojas, com service_role, que ignora RLS (spec 5 e 12.1).';
