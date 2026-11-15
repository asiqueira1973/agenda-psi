# Épico 3 — OAuth e deploy em produção (conector no Claude)

## Pré-requisitos 6.5 já executados (15/11/2026)

O Alexandre mandou fazer pelo MCP da Vercel: o projeto, as variáveis e o domínio. Acesso do MCP ao time "asiqueira1973's projects" autorizado por ele.

| Item 6.5 | Feito | Detalhe |
|---|---|---|
| 2. Projeto na Vercel | sim (MCP) | `agenda-psi-mcp` (`prj_ymtHWIecSCYdc8pYQuMOv0RSiUDZ`), repositório `asiqueira1973/agenda-psi`, Root Directory `mcp-server`, framework nenhum, build `npm run build`, install `npm ci`, Ignored Build Step `git diff --quiet HEAD^ HEAD -- .`, deploys de preview desligados. Nenhum deploy foi feito. |
| 2. Production Branch `feature/mcp-server` | sim (Alexandre, painel) | Branch Tracking salvo em 15/11/2026; o Redeploy sugerido pela Vercel **não** foi feito (o remoto ainda está no épico 0). |
| 2. Variáveis (seção 18), alvo production | sim (MCP) | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `MCP_PUBLIC_URL=https://app.agendapsi.app.br/mcp` e `VISAODEPRODUTO_URL` (plain); `VISAODEPRODUTO_KEY` (encrypted); `MCP_PREVIEW_SECRET` (sensitive, gerado na hora, diferente do local). `MCP_DEV_ALLOW_SESSION_TOKEN` **não** foi cadastrada. |
| 3. Domínio no projeto | sim (MCP) | `app.agendapsi.app.br`, verificado pela Vercel (sem TXT). Configuração pendente: DNS. |
| 4. DNS no Registro.br | sim (Alexandre) | `A app → 34.136.28.237` apagado; `CNAME app → 41edf717ff19fa8a.vercel-dns-017.com.` criado e conferido com `dig` no `d.sec.dns.br`. Sobrou `www.app → …flutterflow.app`, do app antigo, sem efeito aqui. |
| 6. OAuth Server no Supabase | sim (Alexandre, painel) | OAuth Server e Dynamic OAuth Apps ligados, Authorization Path `/oauth/consent`, Site URL intacta. Conferido em `/.well-known/oauth-authorization-server/auth/v1`: issuer igual ao do servidor, `registration_endpoint` presente, PKCE `S256`. |

**Premissa 6.3 confirmada:** o painel monta `https://app.agendapsi.app.br//oauth/consent` (barra dupla, porque a Site URL termina em `/`). O épico 3 serve os dois caminhos; a Site URL não muda.

## Guardrail acrescentado
O `guard-production.sh` e o seu matcher passaram a cobrir as ferramentas do MCP da Vercel: deploy, promote, rollback, alias, variáveis, domínio, projeto, DNS e firewall. A partir daqui, essas mudanças voltam a passar pelo Alexandre. O Anexo B e a tabela 18.1 do spec foram atualizados juntos. Testado com entrada simulada: as de escrita saem com 2, as de leitura (`list_projects`, `get_domain_config`) com 0. Como hooks só carregam no início da sessão, a trava vale a partir da próxima.

## Ainda a planejar
O plano do épico 3 em si (página de login e consentimento, página `/`, vercel.json, deploy e roteiro no Claude) vem em seguida, para aprovação.
