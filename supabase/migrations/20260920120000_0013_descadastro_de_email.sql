-- =============================================================================
-- 0013 — Quem pediu para não receber mais e-mail
-- =============================================================================
--
-- POR QUE
--
-- Em 19/09/2026 saiu o e-mail de lançamento da versão 5.0.0 para toda a base,
-- pedindo que quem não quisesse mais receber respondesse com "Sair". Até agora
-- uma pessoa respondeu. Sem um lugar no banco para registrar isso, o pedido
-- vive na caixa de entrada — e o próximo envio o ignora.
--
-- O FORMATO: UMA DATA, NÃO UM BOOLEANO
--
-- `descadastro_email_em` nulo significa que a pessoa recebe. Preenchido
-- significa que pediu para sair, E DIZ QUANDO.
--
-- Um booleano `aceita_email` responderia "recebe?" e nada mais. A data responde
-- também "desde quando" e "isso foi honrado?", que é o que importa quando
-- alguém pergunta por que recebeu um e-mail — ou quando a LGPD pergunta. O
-- padrão continua sendo enviar: quem nunca pediu nada tem a coluna nula.
--
-- `descadastro_email_origem` guarda como o pedido chegou. Hoje é sempre
-- resposta de e-mail; se um dia houver um link de descadastro ou um botão no
-- app, a distinção vai importar e a coluna já existe.
--
-- COMO USAR NO PRÓXIMO ENVIO
--
--   select email from profissionais
--    where descadastro_email_em is null
--      and coalesce(ativo, true)
--      and email is not null;
--
-- A condição é a coluna ser NULA, não ser falsa. Filtrar por `= false` deixaria
-- de fora justamente quem nunca se manifestou — que é a maioria.
-- =============================================================================

alter table public.profissionais
  add column if not exists descadastro_email_em     timestamptz,
  add column if not exists descadastro_email_origem text;

comment on column public.profissionais.descadastro_email_em is
  'Quando a pessoa pediu para não receber mais e-mail. NULO = recebe (padrão). Filtre por IS NULL, nunca por = false.';

comment on column public.profissionais.descadastro_email_origem is
  'Como o pedido chegou: resposta_email, link_descadastro, app. Nulo quando nunca houve pedido.';

-- O primeiro pedido, recebido em 19/09/2026 como resposta ao e-mail de
-- lançamento. Identificado pelo e-mail e não pelo id, para a intenção ficar
-- legível na migration.
update public.profissionais
   set descadastro_email_em     = timestamptz '2026-09-19 13:28:00-03',
       descadastro_email_origem = 'resposta_email'
 where email = 'psi.lemos1801@gmail.com'
   and descadastro_email_em is null;
