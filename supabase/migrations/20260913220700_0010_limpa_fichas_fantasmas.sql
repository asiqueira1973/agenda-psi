-- =============================================================================
-- Agenda Psi — Migration 0010 — Limpa as fichas fantasmas
--
-- O que faz: remove de `assinaturas` as cortesias que o seed da 0006 concedeu a
-- contas fantasmas, e desativa essas fichas.
--
-- Regras do spec: 11.6 (cortesia é de fundador), 6.4 (desativação é
-- `ativo = false`, nunca delete), 21 (as métricas partem de uma base real).
--
-- O que é uma ficha fantasma, verificado no banco em 13/09/2026: linha de
-- `profissionais` de conta anônima do Supabase Auth, ou com `nome` e `email` em
-- branco. São 82 de 362. Nasceram em lotes de 3 e 4 no mesmo dia, cada uma com
-- um único login no dia em que foi criada — padrão de aparelho de revisão de
-- loja, não de gente. O login anônimo que as produziu já foi desabilitado no
-- projeto; a última nasceu em 22/08/2026.
--
-- Por que isto é uma correção e não uma faxina opcional: 47 dessas fichas estão
-- marcadas como `usuario_fundador`, e o seed da 0006 — que seguiu a regra 11.6
-- ao pé da letra — deu cortesia Pro vitalícia às 47. A tabela `assinaturas`
-- nasceu com 195 linhas das quais 47 não correspondem a ninguém.
--
-- Nada é apagado de profissionais nem de auth.users. Desativar é o mecanismo
-- que o próprio app usa (6.4) e se desfaz com um update.
--
-- Trava de segurança: só mexe em ficha SEM NENHUM dado. Se um profissional de
-- verdade tiver deixado o nome em branco, ele tem paciente, sessão, pagamento,
-- despesa ou horário — e esta migration não o toca.
-- =============================================================================

-- Sem `on commit drop`: assim a migration funciona tanto dentro da transação
-- do supabase db push quanto rodada solta no psql, onde cada instrução é a
-- sua própria transação e a tabela temporária sumiria antes do delete.
create temporary table fichas_fantasmas as
select p.id, p.usuario_id
  from public.profissionais p
  join auth.users u on u.id = p.usuario_id
 where (u.is_anonymous or coalesce(p.nome,'') = '' or coalesce(p.email,'') = '')
   and not exists (select 1 from public.pacientes           x where x.usuario_id = p.usuario_id)
   and not exists (select 1 from public.sessoes             x where x.usuario_id = p.usuario_id)
   and not exists (select 1 from public.pagamentos          x where x.usuario_id = p.usuario_id)
   and not exists (select 1 from public.despesas            x where x.usuario_id = p.usuario_id)
   and not exists (select 1 from public.agenda_semana_padrao x where x.usuario_id = p.usuario_id);

-- Tira a cortesia que o seed da 0006 concedeu por engano.
delete from public.assinaturas a
 where a.store = 'cortesia'
   and a.profissional_id in (select id from fichas_fantasmas);

-- Desativa a ficha. Login numa conta dessas passa a cair na regra 6.3 e é
-- bloqueado, que é o comportamento correto para uma conta que não é de ninguém.
update public.profissionais p
   set ativo = false
 where p.id in (select id from fichas_fantasmas)
   and p.ativo is distinct from false;

drop table fichas_fantasmas;
