-- Consulta que gera o conteúdo de docs/schema.md.
--
-- Rode no SQL Editor do Supabase (ou por MCP) e passe o JSON para
-- scripts/gerar-schema.mjs. O schema.md NÃO deve ser escrito à mão: ele é o
-- retrato do banco, e retrato escrito à mão envelhece mentindo (spec 18).
select json_build_object(
  'tabelas', (
    select json_agg(t order by t->>'tabela')
    from (
      select json_build_object(
        'tabela', c.relname,
        'linhas', (select n_live_tup from pg_stat_user_tables s where s.relid = c.oid),
        'comentario', obj_description(c.oid),
        'colunas', (
          select json_agg(json_build_object(
            'nome', a.attname,
            'tipo', format_type(a.atttypid, a.atttypmod),
            'nulo', not a.attnotnull,
            'padrao', pg_get_expr(d.adbin, d.adrelid)
          ) order by a.attnum)
          from pg_attribute a
          left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
          where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
        )
      ) as t
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
    ) x
  ),
  'views', (select json_agg(viewname order by viewname) from pg_views where schemaname='public'),
  'funcoes', (
    select json_agg(json_build_object('nome', p.proname, 'args', pg_get_function_identity_arguments(p.oid)) order by p.proname)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid = p.prolang
    where n.nspname='public' and l.lanname in ('plpgsql','sql')
  ),
  'triggers', (
    select json_agg(json_build_object('nome', t.tgname, 'tabela', c.relname) order by c.relname, t.tgname)
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and not t.tgisinternal
  ),
  'policies', (
    select json_agg(json_build_object('tabela', tablename, 'nome', policyname, 'cmd', cmd) order by tablename, policyname)
    from pg_policies where schemaname='public'
  )
) as schema;
