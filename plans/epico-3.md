# Épico 3 — OAuth e deploy em produção (conector no Claude)

## Pré-requisitos 6.5 já executados (15/11/2026)

O Alexandre mandou fazer pelo MCP da Vercel: o projeto, as variáveis e o domínio. Acesso do MCP ao time "asiqueira1973's projects" autorizado por ele.

| Item 6.5 | Feito | Detalhe |
|---|---|---|
| 2. Projeto na Vercel | sim (MCP) | `agenda-psi-mcp` (`prj_ymtHWIecSCYdc8pYQuMOv0RSiUDZ`), repositório `asiqueira1973/agenda-psi`, Root Directory `mcp-server`, framework nenhum, build `npm run build`, install `npm ci`, Ignored Build Step `git diff --quiet HEAD^ HEAD -- .`, deploys de preview desligados. Nenhum deploy foi feito. |
| 2. Production Branch `feature/mcp-server` | **não** | O MCP não expõe esse campo. Fica com o Alexandre no painel: Settings → Environments → Production → Branch Tracking. |
| 2. Variáveis (seção 18), alvo production | sim (MCP) | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `MCP_PUBLIC_URL=https://app.agendapsi.app.br/mcp` e `VISAODEPRODUTO_URL` (plain); `VISAODEPRODUTO_KEY` (encrypted); `MCP_PREVIEW_SECRET` (sensitive, gerado na hora, diferente do local). `MCP_DEV_ALLOW_SESSION_TOKEN` **não** foi cadastrada. |
| 3. Domínio no projeto | sim (MCP) | `app.agendapsi.app.br`, verificado pela Vercel (sem TXT). Configuração pendente: DNS. |
| 4. DNS no Registro.br | **não** | Com o Alexandre. Hoje: `A app → 34.136.28.237`. Novo: `CNAME app → 41edf717ff19fa8a.vercel-dns-017.com.` (recomendado pela Vercel). |
| 6. OAuth Server no Supabase | **não** | Com o Alexandre (painel), regra 25.4. |

## Guardrail acrescentado
O `guard-production.sh` e o seu matcher passaram a cobrir as ferramentas do MCP da Vercel: deploy, promote, rollback, alias, variáveis, domínio, projeto, DNS e firewall. A partir daqui, essas mudanças voltam a passar pelo Alexandre. O Anexo B e a tabela 18.1 do spec foram atualizados juntos. Testado com entrada simulada: as de escrita saem com 2, as de leitura (`list_projects`, `get_domain_config`) com 0. Como hooks só carregam no início da sessão, a trava vale a partir da próxima.

## Ainda a planejar
O plano do épico 3 em si (página de login e consentimento, página `/`, vercel.json, deploy e roteiro no Claude) vem em seguida, para aprovação.
