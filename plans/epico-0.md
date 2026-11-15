# Épico 0 — Guardrails do servidor MCP

## Contexto
O épico 0 (spec `mcp-server/spec.md`, seção 8.0) instala os guardrails do Anexo B antes de qualquer código. Ele prende o Claude ao escopo (nada em `app/` nem `supabase/`, para proteger o `agente`, muito usado em produção), proíbe `service_role`, migrations e deploy para produção, e cria o subagente `verifier` e o `REVIEW.md`. Hoje o repositório não tem `.claude/`, `REVIEW.md` nem `plans/`. O `jq` (1.7.1) e o `python3` estão instalados; as regex dos hooks foram testadas no `grep` do macOS.

## Arquivos que serão criados (nenhum existente é alterado)
| Arquivo | Origem |
|---|---|
| `.claude/hooks/guard-secrets.sh` | Anexo B, literal |
| `.claude/hooks/guard-app-scope.sh` | Anexo B, literal (bloqueia `app/` e `supabase/`) |
| `.claude/hooks/guard-migrations.sh` | Anexo B, literal |
| `.claude/hooks/guard-tests.sh` | Anexo B, literal |
| `.claude/hooks/guard-tool-schema.sh` | Anexo B, literal |
| `.claude/hooks/guard-production.sh` | Anexo B, literal |
| `.claude/hooks/remind-advisors.sh` | Anexo B, literal |
| `.claude/hooks/guard-bash-drift.sh` | **Novo, proposto aqui** (ver abaixo) |
| `.claude/settings.json` | Anexo B + entrada do hook novo |
| `.claude/agents/verifier.md` | Anexo B, com o item (d) ampliado para `supabase/` |
| `.claude/.gitignore` | `fix-mode` e `settings.local.json` (em vez de mexer no `.gitignore` da raiz, que fica fora do escopo 4.2) |
| `REVIEW.md` | Anexo B, com "app/ e supabase/ intocados" no passe de conformidade |
| `plans/epico-0.md` | Este plano, aprovado |

## Uma brecha que o Anexo B não fecha (proposta)
Os hooks do Anexo B só olham as ferramentas Write e Edit. Um comando Bash (`sed -i`, `cat >`) consegue editar `app/` ou `supabase/` sem passar por eles. Proponho o `guard-bash-drift.sh`, em **PostToolUse do Bash**, só na branch `feature/mcp-server`:
- se `git status --porcelain -- app/ supabase/` não estiver vazio → exit 2 com "pare, desfaça com `git checkout -- <arquivo>` e explique ao Alexandre";
- se algum arquivo de `mcp-server/` (fora `spec.md`) contiver `service_role|SERVICE_ROLE|sb_secret_|N8N_WEBHOOK_SECRET|PLAY_PUSH_TOKEN` → exit 2.

Ele não impede o comando (roda depois), mas avisa na hora. Se aprovado, também acrescento esse hook ao Anexo B e à tabela 18.1 da spec, no mesmo commit.

## Ordem de execução
1. Criar os oito scripts e dar `chmod +x`.
2. Criar `verifier.md`, `REVIEW.md`, `.claude/.gitignore`.
3. Criar `.claude/settings.json` **por último**, para os hooks só valerem com tudo no lugar.
4. Provocar cada hook uma vez, com a saída colada no plano (critério da 8.0). Cada um é chamado direto, com um JSON de entrada simulado, e quando possível também pela ferramenta real:
   - `guard-secrets`: Write de `service_role` em `mcp-server/src/x.ts` → bloqueado;
   - `guard-app-scope`: Write em `app/src/x.ts` e Edit em `supabase/config.toml` → bloqueados;
   - `guard-migrations`: Edit em `supabase/migrations/20260620155347_enable_unaccent_and_fix_sms_view.sql` → bloqueado;
   - `guard-tests`: com `.claude/fix-mode` presente, Write em `mcp-server/test/x.test.ts` → bloqueado (depois apago o `fix-mode`);
   - `guard-tool-schema`: Write de `usuario_id: z.string()` em `mcp-server/src/tools/x.ts` → bloqueado;
   - `guard-production`: `supabase functions deploy`, `supabase config push`, `vercel --prod`, `vercel env add` → bloqueados; `supabase functions list` e `vercel --version` → liberados (sem falso positivo);
   - `remind-advisors`: entrada simulada de migration → mensagem;
   - `guard-bash-drift`: `touch app/src/x.tmp` → alerta; depois `rm` do arquivo.
   Os testes de "bloqueado" nunca chegam a gravar, e os arquivos temporários são apagados. Nenhum comando de produção roda de verdade: o hook barra antes.
5. Salvar `plans/epico-0.md` com este plano e as saídas, e fazer o commit.

## Verificação
- `ls -l .claude/hooks` mostra os oito scripts executáveis.
- `jq . .claude/settings.json` válido.
- `git status --short` depois dos testes mostra só os arquivos novos; `git diff main --stat -- app/ supabase/` vazio.
- O subagente `verifier` roda sobre o épico 0. Os comandos `npm test/typecheck/build` ainda não existem em `mcp-server/`; ele registra como "não verificável no épico 0", e o resto precisa dar PRONTO.

## Fora deste épico
Nada de `package.json`, código do servidor ou Vercel: isso é o épico 1.

---

## Execução (15/11/2026)

**Status: PRONTO COM UMA PENDÊNCIA** — falta a prova real numa sessão nova (ver abaixo).

### Divergências em relação ao plano
- O `.claude/settings.json` foi criado junto com os scripts (extraídos de uma vez do Anexo B), não por último. Sem efeito: todos os scripts já existiam.
- `guard-bash-drift.sh` aprovado e acrescentado ao Anexo B e à tabela 18.1 da spec.
- Item (d) do `verifier.md` e linha de conformidade do `REVIEW.md` ampliados para `supabase/`, e o Anexo B atualizado junto (apontado pelo verificador).
- A migration do critério 8.0 (`…0001_baseline.sql`) também foi provocada.

### Hooks provocados com entrada simulada (CLAUDE_PROJECT_DIR = raiz do repo)
| Hook | Caso | Resultado |
|---|---|---|
| guard-secrets | `SUPABASE_SERVICE_ROLE_KEY` em `mcp-server/src/x.ts` | exit 2, bloqueado |
| guard-secrets | `SUPABASE_PUBLISHABLE_KEY` (controle) | exit 0 |
| guard-app-scope | Write em `app/src/x.ts` | exit 2, bloqueado |
| guard-app-scope | Edit em `supabase/config.toml` | exit 2, bloqueado |
| guard-app-scope | Write em `mcp-server/src/x.ts` (controle) | exit 0 |
| guard-migrations | Edit em `supabase/migrations/20260620155347_…sql` | exit 2, bloqueado |
| guard-tests | teste com `.claude/fix-mode` presente | exit 2, bloqueado |
| guard-tests | teste sem `fix-mode` (controle) | exit 0 |
| guard-tool-schema | `usuario_id: z.string().uuid()` em `src/tools/x.ts` | exit 2, bloqueado |
| guard-production | `supabase functions deploy` | exit 2, bloqueado |
| guard-production | `supabase functions deploy mcp` | exit 2, bloqueado |
| guard-production | `supabase config push` | exit 2, bloqueado |
| guard-production | `supabase db push --linked` | exit 2, bloqueado |
| guard-production | `supabase secrets set X=1` | exit 2, bloqueado |
| guard-production | `npx vercel deploy --prod` | exit 2, bloqueado |
| guard-production | `vercel env add X` | exit 2, bloqueado |
| guard-production | `vercel domains add app.agendapsi.app.br` | exit 2, bloqueado |
| guard-production | MCP `deploy_edge_function` (agente) | exit 2, bloqueado |
| guard-production | MCP `apply_migration` | exit 2, bloqueado |
| guard-production | `supabase functions list`, `vercel --version`, `vercel dev`, `npm run vercel-build` (controles) | exit 0 |
| remind-advisors | migration nova escrita | exit 2, lembrete |
| guard-bash-drift | Bash criou `app/src/x.tmp` | exit 2, alerta (arquivo apagado em seguida) |
| guard-bash-drift | Bash sem efeito (controle) | exit 0 |

### Saídas literais dos bloqueios

```
$ guard-secrets: service_role em mcp-server/src/x.ts
Bloqueado: credencial privilegiada em /Users/alexandresiqueira/agenda-psi/mcp-server/src/x.ts. O servidor MCP usa só o JWT do usuário e a chave publicável (spec seção 0, P1, e seção 20). Se a operação parece exigir service_role, pare e pergunte ao Alexandre.
→ exit 2

$ guard-app-scope: Write em app/src/x.ts
Bloqueado: na branch feature/mcp-server não se altera o app nem nada em supabase/ (spec 4.2 e 25.4). Copie a regra para mcp-server/src/rules/ com teste, ou pare e pergunte.
→ exit 2

$ guard-app-scope: Edit em supabase/config.toml
Bloqueado: na branch feature/mcp-server não se altera o app nem nada em supabase/ (spec 4.2 e 25.4). Copie a regra para mcp-server/src/rules/ com teste, ou pare e pergunte.
→ exit 2

$ guard-migrations: Edit em 0001_baseline.sql
Bloqueado: supabase/migrations/20260913220000_0001_baseline.sql já está versionada. Crie uma migration nova e mostre ao Alexandre antes de aplicar (spec seção 7).
→ exit 2

$ guard-tests: teste com .claude/fix-mode presente
Bloqueado: modo de correção ativo (.claude/fix-mode). Corrija o código, não o teste (seção 22.1). Se o teste estiver errado de fato, pare e explique ao Alexandre.
→ exit 2

$ guard-tool-schema: usuario_id no schema
Bloqueado: usuario_id declarado como entrada de ferramenta em /Users/alexandresiqueira/agenda-psi/mcp-server/src/tools/x.ts. O usuário vem do JWT (sub), nunca do argumento (P1, pegadinha 3).
→ exit 2

$ guard-production: supabase functions deploy
Bloqueado: 'supabase functions deploy/delete'. Sem nome, o deploy republica todas as funções, inclusive o agente. Pare e peça ao Alexandre (spec 6.5 e 25.4).
→ exit 2

$ guard-production: vercel --prod
Bloqueado: deploy de produção na Vercel. Produção sai pelo push na Production Branch, com o Alexandre. Pare e peça ao Alexandre (spec 6.5 e 25.4).
→ exit 2

$ guard-production: vercel env add
Bloqueado: mudança de variáveis, domínio ou projeto na Vercel. Pare e peça ao Alexandre (spec 6.5 e 25.4).
→ exit 2

$ remind-advisors: migration nova
Migration escrita. NÃO aplique sem a aprovação do Alexandre. Depois de aplicada, rode get_advisors (security e performance) e resolva alertas críticos (spec seção 20).
→ exit 2

```

(O `guard-bash-drift` foi provocado com `touch app/src/x.tmp`, apagado em seguida; saída na tabela acima.)

### Prova real pelo Claude Code — PENDENTE
Nesta sessão, um Write real em `app/src/x.ts` **não** foi bloqueado: a sessão começou antes de existir o `.claude/settings.json`, e o Claude Code só carrega hooks no início da sessão. O arquivo foi apagado na hora (`git status -- app/ supabase/` vazio).

**Primeira tarefa da próxima sessão, antes do épico 1:** tentar um Write em `app/src/x.ts` e um `supabase functions deploy` pelo Bash, colar aqui o bloqueio real e trocar o status para PRONTO.
