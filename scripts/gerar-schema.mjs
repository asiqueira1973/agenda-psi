#!/usr/bin/env node
/**
 * Gera docs/schema.md a partir do JSON produzido por scripts/gerar-schema.sql.
 *
 * Uso:
 *   docker exec -i <container_do_postgres> psql -X -A -t -U postgres -d postgres \
 *     -f - < scripts/gerar-schema.sql > /tmp/schema.json
 *   node scripts/gerar-schema.mjs /tmp/schema.json > docs/schema.md
 *
 * Por que existe: a seção 18 do spec pede que `docs/schema.md` seja GERADO do
 * banco real, não escrito à mão. Documentação de schema escrita à mão envelhece
 * mentindo — e mentir sobre o schema é pior do que não documentar.
 */
import { readFileSync } from 'node:fs';

const caminho = process.argv[2];
if (!caminho) {
  console.error('uso: node scripts/gerar-schema.mjs <arquivo.json>');
  process.exit(1);
}

const d = JSON.parse(readFileSync(caminho, 'utf8'));
const hoje = new Date().toISOString().slice(0, 10);
const linhas = [];

linhas.push('# Schema do banco — Agenda Psi');
linhas.push('');
linhas.push('> **Arquivo gerado. Não edite à mão.**');
linhas.push('>');
linhas.push('> Produzido por `scripts/gerar-schema.sql` + `scripts/gerar-schema.mjs`,');
linhas.push('> lidos do catálogo do Postgres. Regerar depois de toda migration.');
linhas.push('>');
linhas.push(`> Gerado em ${hoje}, a partir do banco local reconstruído pelas migrations`);
linhas.push('> deste repositório. A contagem de linhas não aparece porque o banco local');
linhas.push('> não tem dados — para volume de produção, ver o DOCUMENTACAO-TECNICA.md.');
linhas.push('');
linhas.push('A convenção é **português, `snake_case`**, em tabelas, colunas, funções,');
linhas.push('triggers e policies (spec 18). O código TypeScript é em inglês, e os tipos');
linhas.push('gerados mantêm os nomes em português: não há camada de tradução.');
linhas.push('');
linhas.push(`## Resumo`);
linhas.push('');
linhas.push('| | |');
linhas.push('|---|---|');
linhas.push(`| Tabelas | ${d.tabelas.length} |`);
linhas.push(`| Views | ${d.views.length} |`);
linhas.push(`| Funções | ${d.funcoes.length} |`);
linhas.push(`| Triggers | ${d.triggers.length} |`);
linhas.push(`| Policies de RLS | ${d.policies.length} |`);
linhas.push('');

linhas.push('## Tabelas');
linhas.push('');
for (const t of d.tabelas) {
  linhas.push(`### \`${t.tabela}\``);
  linhas.push('');
  if (t.comentario) {
    linhas.push(`> ${t.comentario}`);
    linhas.push('');
  }
  linhas.push('| Coluna | Tipo | Nulo | Padrão |');
  linhas.push('|---|---|---|---|');
  for (const c of t.colunas) {
    const padrao = c.padrao ? `\`${c.padrao}\`` : '—';
    linhas.push(`| \`${c.nome}\` | ${c.tipo} | ${c.nulo ? 'sim' : 'não'} | ${padrao} |`);
  }
  linhas.push('');
}

linhas.push('## Views');
linhas.push('');
for (const v of d.views) linhas.push(`- \`${v}\``);
linhas.push('');

linhas.push('## Funções');
linhas.push('');
for (const f of d.funcoes) {
  linhas.push(`- \`${f.nome}(${f.args})\``);
}
linhas.push('');

linhas.push('## Triggers');
linhas.push('');
linhas.push('| Trigger | Tabela |');
linhas.push('|---|---|');
for (const g of d.triggers) linhas.push(`| \`${g.nome}\` | \`${g.tabela}\` |`);
linhas.push('');

linhas.push('## Policies de RLS');
linhas.push('');
let tabelaAtual = null;
for (const p of d.policies) {
  if (p.tabela !== tabelaAtual) {
    tabelaAtual = p.tabela;
    linhas.push('');
    linhas.push(`**\`${p.tabela}\`**`);
    linhas.push('');
  }
  linhas.push(`- \`${p.nome}\` — ${p.cmd}`);
}
linhas.push('');

process.stdout.write(linhas.join('\n'));
