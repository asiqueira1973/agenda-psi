# Épico 1 — Esqueleto, autenticação por token e uma leitura

## Contexto
Seção 8.1 do `mcp-server/spec.md`. O objetivo é ter o servidor rodando localmente e respondendo a um cliente MCP real (o Inspector), com o JWT verificado pelo Supabase Auth e a RLS valendo. A primeira leitura é `consultar_despesas` (visível ao modelo); `listar_tipos_despesa` fica só para o app e vai ser usada pelo formulário do épico 2.

## Premissas conferidas (15/11/2026)

| Premissa (spec) | O que foi conferido | Resultado |
|---|---|---|
| Versões (4.1) | `npm view` | `@modelcontextprotocol/server` **2.4.0**, `@modelcontextprotocol/ext-apps` **2.0.4**, `zod` **4.6.7**, `@supabase/supabase-js` **2.119.0**, `vitest` **5.1.0**, `typescript` **7.0.2**, `tsx` **4.23.15**. Batem com a 4.1. |
| API do SDK v2 | `.d.mts` instalados num diretório temporário | `createMcpHandler(factory, opts)` devolve `{ fetch }` web-standard. O `authInfo` é **pass-through**: o handler não verifica token, quem verifica é o nosso código, que passa `fetch(req, { authInfo })`. A fábrica recebe `{ era, authInfo, requestInfo }`. Há ajudantes prontos: `requireBearerAuth`, `bearerAuthChallengeResponse` e `getOAuthProtectedResourceMetadataUrl`, além da interface `OAuthTokenVerifier`. O `registerTool(nome, { inputSchema: z.object(...), annotations, _meta }, cb)` aceita zod v4. |
| Visibilidade "só app" | `ext-apps/server` | `_meta.ui.visibility: ["app"]` (constante `EXTENSION_ID = "io.modelcontextprotocol/ui"`; o helper `getUiCapability` vai servir ao fallback 13.4 no épico 2). |
| Vercel servir handler `fetch` (4.2) | docs da Vercel, Node runtime, atualizada em 11/08/2026 | `api/<arquivo>.ts` com `export default { fetch(request) }` é suportado. A Vercel **recomenda uma função só**, com roteamento interno, em vez de uma por rota (ver Divergências). |
| Verificação 6.4 | tipos do `supabase-js` 2.119 | `auth.getClaims(jwt)` existe. Com o segredo HS256 legado, ele confirma o token no servidor de Auth (o JWKS vazio impede a verificação local), sem segredo no MCP. |

## Arquivos (todos novos, todos em `mcp-server/`, exceto este plano)

| Arquivo | O que faz | Regra |
|---|---|---|
| `package.json`, `package-lock.json` | Versões acima fixadas. Scripts: `dev`, `dev:token`, `test`, `typecheck`, `build` e `gen:types` | 4.1, 22.1 |
| `tsconfig.json`, `vitest.config.ts` | TS strict, ESM, Node 22 | 18 |
| `.gitignore` | `.vercel/` (os padrões `node_modules`, `dist` e `.env.*` já vêm do `.gitignore` da raiz) | 18 |
| `vercel.json` | Rewrites de `/mcp` e `/.well-known/oauth-protected-resource(/mcp)` para `api/index` | 4.2 |
| `api/index.ts` | Casca fina: `export default { fetch: app.fetch }` | 1, 4.2 |
| `src/app.ts` | Roteador: PRM, `/mcp` (auth, depois o handler) e 404 | 4.3 |
| `src/config.ts` | Lê `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `MCP_PUBLIC_URL` e `MCP_DEV_ALLOW_SESSION_TOKEN`. Falha alto se faltar alguma obrigatória | 18 |
| `src/auth/verify-token.ts` | `OAuthTokenVerifier`: `getClaims` e depois as checagens `iss`, `exp`, `role = authenticated` e `client_id` obrigatório (só dispensado com `MCP_DEV_ALLOW_SESSION_TOKEN=1`). Devolve `AuthInfo` com `extra.sub` | 6.4, P1 |
| `src/auth/metadata.ts` | Documento RFC 9728: `resource` = `MCP_PUBLIC_URL`, `authorization_servers` = [`https://tocytpjtupbbxwgamtxq.supabase.co/auth/v1`] (montado a partir de `SUPABASE_URL`) | 6.2 |
| `src/supabase.ts` | `createClient(url, publishable, { global: { headers: { Authorization: Bearer <JWT> } } })`, sem sessão persistida | P1 |
| `src/database.types.ts` | Gerado por `supabase gen types typescript --linked` (só leitura do schema) | 18 |
| `src/handler.ts` | `createMcpHandler` com fábrica que monta o `McpServer` por request, a partir do `authInfo` | 4.3 |
| `src/log.ts` | Log de uma linha: ferramenta, duração, ok/erro e hash SHA-256 truncado do `sub`. Sem argumentos nem resultados | 18 |
| `src/rules/text.ts` | `normalizar` (sem acento e caixa), igual ao do agente | 11.14 |
| `src/rules/db-literals.ts` | Literais 11.4 e `STATUS_PAGO`, com os rótulos 11.5 | 11.4, 11.5 |
| `src/rules/weekday.ts` | `diaDaSemanaDoBanco` e `diasDaSemanaDe` | 11.6 |
| `src/rules/money.ts` | `validarValorEmReais` (só dígitos, > 0) e o teto de 1.000.000 | 11.1, 11.2 |
| `src/rules/dates.ts` | `hojeEmSaoPaulo()` (via `Intl`, `America/Sao_Paulo`) e `dataValida` (recusa 31/02) | 11.3 |
| `src/rules/patient-match.ts` | `resolverPaciente` (ok / ambiguo / nao_encontrado), portado do agente | 11.14 |
| `src/rules/messages.ts` | `valorInvalido` copiado byte a byte do app, os textos novos da 15 e os erros da 12 | 12, 15 |
| `src/tools/read/consultar-despesas.ts` | Porta literal de `consultarDespesas` do agente (nome, descrição, entrada, saída, teto de 30), com `isError: true` no erro | 13.2 |
| `src/tools/expense/options.ts` | `listar_tipos_despesa` (visibilidade `["app"]`, `readOnlyHint`): `id` e `nome` de `tipos_despesa`, ordenados por nome | 13.3 |
| `src/tools/index.ts` | Registra as ferramentas no `McpServer` | 13.1 |
| `scripts/dev-server.ts` | Adaptador `node:http` → `Request` → `app.fetch`, só local | — |
| `scripts/dev-token.ts` | `signInWithPassword` com `TEST_EMAIL`/`TEST_PASSWORD` do `.env.local` e imprime o access token | 8.1.3 |
| `test/rules/*.test.ts` | Ver critérios abaixo | 22 |
| `test/auth.test.ts` | Verificador com `getClaims` simulado: sem `client_id`, com `iss` errado, vencido e `role` errado → recusado. Flag de dev → aceito sem `client_id` | 6.4 |
| `test/app.test.ts` | Sem token → 401 com `WWW-Authenticate` contendo `resource_metadata`. GET do PRM → JSON da 6.2 | 6.2 |
| `test/tools/consultar-despesas.test.ts` | Cliente simulado: filtro `usuario_id`, período, tipo sem acento, totais e teto de 30 | 13.2 |
| `test/schemas.test.ts` | Percorre `tools/list` e falha se algum `inputSchema` tiver `usuario_id` | 22, P1 |
| `plans/epico-1.md` | Este plano, depois com as saídas | 29 |

`npm run build` neste épico é só o `tsc` com emissão para `dist/`. O Vite dos formulários entra no épico 2, e aí o `build` ganha a parte de UI.

## Divergências do spec (propostas)
1. **Uma função na Vercel em vez de duas.** O spec lista `api/mcp.ts` e `api/oauth-protected-resource.ts`. A doc atual da Vercel recomenda uma função com roteamento interno, porque o Fluid compute reaproveita a instância. Proponho `api/index.ts` → `src/app.ts`. A casca continua fina e o código segue portável.
2. **Mensagem 11.1 sem ponto final.** O spec escreve "…Ex: 200." e o app (`validation.ts:98`) tem "…Ex: 200", sem ponto. A regra de cópia diz que o app manda, então vale o texto do app, com teste lendo o arquivo.
3. **PRM montado à mão.** O `buildOAuthProtectedResourceMetadata` do SDK exige o metadata completo do authorization server e também serviria `/.well-known/oauth-authorization-server` no nosso domínio. A 6.2 quer só `resource` e `authorization_servers`, apontando para o Supabase. Basta um JSON de três linhas.

## Duas perguntas antes de começar
1. **`docs/schema.md`.** A seção 7 diz que o épico 1 começa regerando esse arquivo, mas o escopo do Anexo C não inclui `docs/` (e a regeneração precisa do Supabase local no Docker). Proponho **não** mexer nele e usar o `src/database.types.ts` gerado como referência do schema. Se preferir regerar, autorize tocar em `docs/schema.md`.
2. **Leitura com a conta de teste em produção.** Os critérios 3 e 4 pedem chamar `consultar_despesas` com o token da conta de teste e um token adulterado. É **só leitura**, nada é gravado. Posso fazer eu mesmo com o `.env.local`, ou você prefere rodar?

## Critérios (8.1) e como cada um será mostrado
- `npm test`, `npm run typecheck` e `npm run build`, com a saída colada.
- Inspector (`npx @modelcontextprotocol/inspector`) contra `http://localhost:3000/mcp` sem token: 401 com `WWW-Authenticate: Bearer … resource_metadata="…"`. Também com `curl -i`, para colar a saída.
- Com o token de `npm run dev:token` e `MCP_DEV_ALLOW_SESSION_TOKEN=1`: `consultar_despesas` devolve só despesas da conta de teste.
- Token com um caractere trocado na assinatura: 401.
- Testes de `rules/`: literais 11.4 comparados com o texto de `app/src/features/patients/valores-do-banco.ts`; `diaDaSemanaDoBanco` (domingo = 7); "hoje" às 23h30 de Brasília (02:30 UTC do dia seguinte) continua no dia certo; `resolverPaciente` nos três casos.

## Fecho
Comandos 22.1, o `verifier` e a revisão do diff contra o `REVIEW.md`. Depois o commit, com este plano atualizado com as saídas.

---

## Execução (15/11/2026)

**Aprovado** em 15/11/2026 com as três divergências. Respostas: `docs/schema.md` **não** é regerado (fica fora do escopo; o schema de referência é `mcp-server/src/database.types.ts`, gerado com `supabase gen types --linked`); a leitura em produção com a conta de teste foi autorizada e feita por mim, só leitura.

### Divergências em relação ao plano
- **Porta local 3333, não 3000.** A 3000 desta máquina está ocupada por outro projeto (um Next.js). O `dev-server` agora usa 3333 por padrão e avisa quando a porta está ocupada. O `.env.local` e o `.env.example` usam `http://localhost:3333/mcp`.
- **Motivos de recusa do token em inglês ASCII.** Na prova ao vivo, "Token inválido." chegou como "Token inv lido." no `WWW-Authenticate`, porque cabeçalho HTTP não carrega acento com segurança. Esse texto é lido pelo cliente OAuth, não pela pessoa, então ficou em inglês (`Invalid token` e outros). Corrigido com teste primeiro (22.1): teste falhando → `.claude/fix-mode` → correção → `rm`. O teste não foi commitado sozinho antes da correção, porque dependia de arquivos ainda não versionados do épico; o commit do épico leva os dois.
- **Acréscimo de segurança:** `lerConfig` recusa subir com `MCP_DEV_ALLOW_SESSION_TOKEN=1` quando `VERCEL` está definida (a Vercel define em todo deploy). Antes, a regra "nunca existe no deploy" dependia só de disciplina. Também foi feito com teste primeiro.
- **`.env.example`** acrescentado, sem valores secretos, para a outra máquina saber o que preencher.

### Provas ao vivo (servidor local contra o Supabase de produção, conta de teste, só leitura)
```
### 1. sem token
HTTP/1.1 401 Unauthorized
www-authenticate: Bearer error="invalid_token", error_description="Missing Authorization header", resource_metadata="http://localhost:3333/.well-known/oauth-protected-resource/mcp"
### PRM
{"resource":"http://localhost:3333/mcp","authorization_servers":["https://tocytpjtupbbxwgamtxq.supabase.co/auth/v1"],"bearer_methods_supported":["header"],"resource_name":"Agenda Psi"}
### 2. token da conta de teste (servidor com MCP_DEV_ALLOW_SESSION_TOKEN=1)
HTTP 200, isError: False | quantidade: 14 | linhas listadas: 14 | chaves: ['data', 'descricao', 'tipo', 'valor']
### 2b. isolamento pela RLS: o mesmo token direto no PostgREST, SEM filtro de usuario_id
linhas visíveis: 14 | usuario_id distintos: 1 | todos == sub do token: True
### 3. token com um caractere trocado na assinatura
HTTP/1.1 401 Unauthorized
www-authenticate: Bearer error="invalid_token", error_description="Invalid token", resource_metadata="http://localhost:3333/.well-known/oauth-protected-resource/mcp"
### 4. token de sessão do app (sem client_id) num servidor SEM a flag de dev
HTTP/1.1 401 Unauthorized
www-authenticate: Bearer error="invalid_token", error_description="App session tokens are not accepted; connect through OAuth", resource_metadata="http://localhost:3334/.well-known/oauth-protected-resource/mcp"
### log do servidor (nada além de ferramenta, ms, ok e hash)
{"ferramenta":"consultar_despesas","ms":288,"ok":true,"usuario":"5f5ee0927b99"}
```

### MCP Inspector (cliente real, `@modelcontextprotocol/inspector@2.15.0 --cli`)
```
### Inspector sem token
{"error":{"code":"auth_required","message":"Interactive OAuth requires a TTY on stdin or stderr (or MCP_AUTO_OPEN_ENABLED=true). For CI/non-interactive runs use --stored-auth-only."}}
### Inspector com o token da conta de teste: tools/list
[('consultar_despesas', ['model']), ('listar_tipos_despesa', ['app'])]
### Inspector com token: consultar_despesas tipo=aluguel
isError: False | quantidade: 3 | tipos: ['Aluguel da sala']
```
Sem token, o Inspector recebe o 401, lê o desafio e parte para o OAuth. Esse fluxo só fecha no épico 3, quando o OAuth Server do Supabase estiver ligado (checklist 6.5).

### Riscos que ficam para o épico 3
- O `getClaims` com HS256 consulta o Supabase Auth (`/user`). Ainda não foi provado com um token **OAuth** (com `client_id`), porque o OAuth Server não está ligado. Se o Auth recusar esse token no `/user`, o caminho é verificar de outro jeito, sem segredo no MCP. Isso só se testa no épico 3.
- Se o Supabase Auth estiver fora do ar, a verificação vira 401 (não 503), e o cliente pode pedir login de novo. É aceitável para a v1; fica anotado.

### Comandos 22.1 (em `mcp-server/`)
```
 RUN  v5.1.0 /Users/alexandresiqueira/agenda-psi/mcp-server
 Test Files  10 passed (10)
      Tests  63 passed (63)
EXIT test=0
> agenda-psi-mcp-server@0.1.0 typecheck
> tsc --noEmit
EXIT typecheck=0
> agenda-psi-mcp-server@0.1.0 build
> tsc -p tsconfig.build.json
EXIT build=0
```

### Diferenças menores apontadas pelo verifier
- Arquivos de apoio que o plano não listava: `src/tools/context.ts` (`ToolContext` e o `executar`, que converte `{ erro }` em `isError` e loga), `tsconfig.build.json` (o `build` com emissão) e `test/helpers.ts`.
- O PRM também leva `bearer_methods_supported` e `resource_name`, campos opcionais da RFC 9728, além dos dois exigidos pela 6.2.
- `validarValorEmReais` junta a 11.1 e o teto da 11.2 (que no app vive em `valorValido`) e usa a mesma mensagem do app nos dois casos.

### Verifier
Primeira rodada: NÃO PRONTO, por um único motivo (faltava colar as saídas acima), com todos os critérios e conferências cumpridos. Corrigido. Segunda rodada: **PRONTO** (63 testes, typecheck e build com saída 0; `app/` e `supabase/` sem diferença contra `main`).
