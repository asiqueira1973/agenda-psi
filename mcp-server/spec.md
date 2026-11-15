# Spec — Servidor MCP do Agenda Psi (conector para Claude e ChatGPT)

| | |
|---|---|
| Versão | 1.1 (15/11/2026: hospedagem na Vercel; 25.1, 25.4 e 25.5 respondidas) |
| Responsável de produto | Alexandre |
| Status | aprovado para implementação |
| Data | 15/11/2026 |
| Branch | `feature/mcp-server` |
| Tipo | Spec adicional de feature: o app já existe e funciona. Este documento NÃO substitui `docs/spec.md`. |

## Como usar este documento

Este é o spec de uma peça nova e isolada: um **servidor MCP remoto** que leva ao Claude (web e desktop) e ao ChatGPT a mesma experiência do agente interno do app (`supabase/functions/agente`). As consultas viram ferramentas de leitura. As gravações viram **formulários de verdade**, via MCP Apps.

Ele vai ser consumido pelo Claude Code em outro computador, que já tem Node, Supabase CLI e Vercel CLI prontos. Leia junto o `CLAUDE.md` da raiz: as sete pegadinhas valem aqui integralmente.

**Antes de gerar código, revise a seção 24 (Assunções).** Assunção não revisada vira verdade no minuto em que o agente começa a codar. Diante de qualquer item da seção 25 (Perguntas abertas), **pergunte, não assuma**.

Se este spec divergir de `docs/spec.md` sobre uma regra do produto, `docs/spec.md` manda. Se divergir sobre o servidor MCP, este manda.

---

## 0. Princípios não-negociáveis

| # | Nome | Regra |
|---|---|---|
| P1 | **O usuário é o JWT** | Toda chamada ao Supabase usa o access token do próprio usuário, e a RLS decide. A `service_role` não existe no servidor MCP: nem em variável de ambiente, nem em código, nem em teste. `usuario_id` nunca é argumento de ferramenta; ele vem do token (pegadinha 3). |
| P2 | **O modelo propõe, a pessoa grava** | Nenhuma ferramenta visível ao modelo grava no primeiro chamado. Quem grava é o botão Salvar do formulário. Sem formulário, grava a segunda chamada com o `token_previa` devolvido pela prévia. |
| P3 | **O servidor revalida tudo** | Toda validação da tela é repetida no servidor antes de gravar: tipo, obrigatoriedade, regra de negócio e permissão. A tela é conveniência. |
| P4 | **Mesma gravação que o app** | Um registro criado pelo MCP é indistinguível de um criado pela tela: mesmas colunas, mesmos padrões, mesmos literais do banco (pegadinha 6), mesma convenção de dia (pegadinha 7) e o mesmo evento de analytics. |
| P5 | **Nada clínico na v1** | Observações de paciente e de sessão não saem em nenhuma resposta e não entram por nenhum formulário. Na dúvida se um campo é clínico, ele fica de fora e vira pergunta aberta. |

---

## 1. Visão e problema

Hoje a psicóloga só registra despesas, sessões, pagamentos e pacientes dentro do app, pela tela ou pelo agente interno. Este servidor deixa fazer o mesmo de dentro do Claude ou do ChatGPT. A conversa entende o pedido, abre um formulário já preenchido com o que foi dito, a pessoa confere e salva. Respostas de consulta ("quanto gastei de aluguel este ano?") saem das mesmas views do app.

Segundo objetivo, tão importante quanto o primeiro: **ser o modelo de referência** para um sistema da empresa onde o Alexandre trabalha. Isso significa padrão claro, um módulo por ação, regra em um lugar só, README que alguém de fora consiga seguir, e um código que troque de hospedagem sem reescrita.

**Anti-escopo** (o que este servidor NÃO é):
- não é prontuário, nem expõe conteúdo clínico (P5);
- não substitui o app: paywall, SMS, assinaturas e ajustes continuam só no app;
- não é API pública: só o próprio usuário, logado, acessa os próprios dados;
- não apaga paciente (mesma decisão do agente interno, 02/11/2026);
- não escreve em `assinaturas` (pegadinha 1).

---

## 2. Personas e cenários de uso

**Psicóloga autônoma que já usa o Agenda Psi e também usa Claude ou ChatGPT no computador.** O momento típico é o fim do dia, na frente do computador: "atendi a Beatriz e o Caio hoje, a Beatriz pagou 280; e paguei 1.450 de aluguel". O caso mais difícil é a ambiguidade, como duas Helenas no cadastro ou "aluguel" que casa com dois tipos. Ele define a regra: **o servidor nunca escolhe sozinho entre dois.** O formulário mostra as opções e a pessoa escolhe.

---

## 3. Escopo do MVP

### Dentro
| Item | Seção |
|---|---|
| Servidor MCP remoto (Streamable HTTP, protocolo 2026-07-28, com compatibilidade para clientes de 2025) | 4 |
| Login com o e-mail e a senha do Agenda Psi pelo fluxo OAuth do MCP, usando o OAuth 2.1 Server do Supabase | 6 |
| 9 ferramentas de leitura | 8.4 / 13.2 |
| Formulários MCP Apps para: despesa, sessões, pagamento, paciente (com horários), horário fixo, feedback, troca e remoção de horário, edição de paciente e edição e exclusão de sessão, pagamento e despesa | 8.3 / 8.5 / 8.6 |
| Ferramentas de fallback com prévia e confirmação, para clientes sem MCP Apps | 13.4 |
| Eventos de analytics iguais aos do app | 21 |
| Deploy na Vercel, em `app.agendapsi.app.br`, junto com a página de login | 4 |
| README com execução local, deploy, conector no Claude e no ChatGPT e roteiro de teste manual | 8.7 |

### Fora
| Item | Destino | Motivo |
|---|---|---|
| **Ambiente de staging / projeto de teste** | Descartado por decisão de 15/11/2026 | Não haverá. Os testes manuais usam produção com uma **conta de teste dedicada** (seção 22). |
| Observações de paciente e de sessão (leitura e escrita) | v2, condicionada à decisão de LGPD (25.3) | Dado de saúde (P5) |
| Excluir paciente | Descartado | É exclusão em cascata; a ficha do app tem a confirmação nominal |
| Assinatura, paywall, SMS, ajustes da conta | Descartado | Não são ação de consultório e têm regra de loja |
| CIMD (Client ID Metadata Documents) | v2 | O Supabase OAuth Server não suporta hoje; Claude e ChatGPT caem em DCR |
| Ferramentas exclusivas do ChatGPT (`widgetState`, `requestModal`, checkout) | Descartado | O padrão MCP Apps já cobre e mantém o código portável |
| Migration de CHECK constraints para as regras que só existem no app | Separado, opcional (25.2) | Fica para decisão própria, fora deste trabalho |

---

## 4. Arquitetura

### 4.1 Stack (versões conferidas em 15/11/2026)

| Peça | Versão | Por quê | Alternativa descartada |
|---|---|---|---|
| Spec MCP | **2026-07-28** (stateless) | Versão atual | 2025-11-25 só por compatibilidade, via o fallback do SDK |
| `@modelcontextprotocol/server` (SDK v2) | **2.4.x** | `createMcpHandler` stateless e web-standard (`fetch`), roda em Node, Workers e Deno | `@modelcontextprotocol/sdk` 1.x, que está em modo manutenção e não cobre a 2026-07-28 |
| `@modelcontextprotocol/ext-apps` | **2.0.x** | MCP Apps (SEP-1865, spec estável 2026-01-26): `registerAppTool`, `registerAppResource`, `App` | `window.openai`, que só funciona no ChatGPT |
| zod | **v4** | É o peer exigido pelo SDK v2 e pelo ext-apps | — |
| `@supabase/supabase-js` | 2.x (a mesma major do app) | Cliente com o JWT do usuário | Chamar o PostgREST na mão, o que duplicaria tratamento de erro |
| UI dos formulários | TypeScript + Vite + `vite-plugin-singlefile`, **sem React** | Cada formulário vira um único HTML pequeno, embutido no servidor | React, que pesa no bundle e não ajuda num formulário de seis campos |
| Testes | Vitest (Node) para regras, handlers e rotas | Regras são TS puro | — |
| Hospedagem | **Vercel** (Vercel Functions, runtime Node), projeto próprio com Root Directory `mcp-server/`, domínio `app.agendapsi.app.br` | Decisão de 15/11/2026: é a infra de todos os outros projetos do Alexandre; serve HTML (a página de login) e o servidor no mesmo domínio; e deixa o servidor **totalmente fora** do Supabase Functions, onde roda o `agente` (25.4) | Supabase Edge Function `mcp`: dividiria o deploy com o `agente` e não serve a página de login |

**Premissa a validar no épico 1:** confirmar no npm as versões exatas antes de fixá-las no `package.json` e conferir a API real do SDK v2 e do ext-apps. As assinaturas citadas aqui vêm da documentação de 15/11/2026.

### 4.2 Onde o código vive

```
mcp-server/                      # TUDO do servidor mora aqui
  spec.md                        # este documento
  package.json  tsconfig.json  vitest.config.ts
  src/
    handler.ts                   # createMcpHandler: monta o McpServer por request
    auth/                        # verificação do JWT, metadata RFC 9728, desafio 401
    supabase.ts                  # cria o cliente com o JWT do usuário (P1)
    rules/                       # regras portadas do app, uma por arquivo, com teste
      db-literals.ts             # literais da tabela 11.4 (pegadinha 6)
      weekday.ts                 # diaDaSemanaDoBanco (pegadinha 7)
      money.ts                   # valor inteiro em reais, sem centavos
      dates.ts                   # "hoje" em America/Sao_Paulo, AAAA-MM-DD
      patient-match.ts           # resolverPaciente (ok / ambiguo / nao_encontrado)
      messages.ts                # mensagens de erro em português (literais do app)
    tools/
      read/                      # as 9 ferramentas de leitura
      expense/                   # um módulo por ação: open-form, options, save, fallback
      sessions/ payment/ patient/ schedule/ feedback/ ...
    analytics.ts                 # eventos do Visão do Produto (pegadinha 5)
    preview-token.ts             # HMAC do fallback (13.4)
  api/
    mcp.ts                       # Vercel Function: só exporta o handler (casca fina)
    oauth-protected-resource.ts  # metadata RFC 9728 (6.2)
  ui/
    shared/                      # bootstrap do App, tema do host, componentes de campo
    expense/ sessions/ ...       # um formulário por ação → dist/<acao>.html
  site/                          # páginas estáticas do domínio (6.3)
    index.html                   # "/" : destino dos e-mails de confirmação (6.3)
    oauth/consent/               # página de login e consentimento do OAuth
  vercel.json                    # rewrites: /mcp → api/mcp; /.well-known/... → api/...
  test/
  README.md
```

**Regra de escopo:** nada em `app/` nem em `supabase/` é alterado: nem funções, nem `config.toml`, nem migrations (este trabalho não muda o banco). Fora de `mcp-server/`, os únicos caminhos tocados são `.claude/`, `REVIEW.md`, `plans/`, `DOCUMENTACAO-TECNICA.md` e uma linha do `CLAUDE.md`. Isso é garantido por hook (18.1).

**Build na Vercel:** o `npm run build` gera os HTMLs dos formulários (Vite singlefile) e os embute no servidor como string; as páginas de `site/` saem como estáticos. `api/*.ts` só reexportam o que está em `src/`, para o código trocar de hospedagem sem reescrita (seção 1). **Premissa a validar no épico 1:** a forma atual de a Vercel servir um handler web-standard (`fetch`) em Vercel Functions Node; registre no plano.

### 4.3 Como roda

```
Claude / ChatGPT ──HTTPS──> https://app.agendapsi.app.br/mcp   (Vercel)
      │                           │  1. sem token → 401 + WWW-Authenticate (resource_metadata)
      │                           │  2. com token → verifica JWT (pelo Supabase Auth)
      │                           │  3. createClient(url, publishable, { Authorization: Bearer <JWT do usuário> })
      │                           └─> PostgREST → RLS → tabelas e views
      │
      └──OAuth──> Supabase Auth OAuth 2.1 Server (/auth/v1/oauth/authorize|token, DCR)
                        └─> página de login + consentimento (seção 6.3)
```

O handler é **stateless**: um `McpServer` por request, sem sessão em memória. Os limites das Vercel Functions bastam para CRUD. Nenhuma ferramenta pode fazer laço sobre o banco inteiro.

---

## 5. Perfis de usuário e matriz de permissões

Há um único perfil: **profissional** (o titular da conta do Agenda Psi). O escopo de tudo é o próprio `auth.uid()`, garantido pela RLS do banco. O servidor não acrescenta permissão; o filtro `.eq('usuario_id', sub)` nas leituras é uma segunda tranca, como no agente.

| Ação | Profissional | Sem login | Conta demo (`demo_uid()`) |
|---|---|---|---|
| Ler pacientes, agenda, sessões, pagamentos, despesas e resumos | ✅ **só os próprios** | ❌ 401 | ✅ só os próprios |
| Criar despesa, sessão, pagamento, paciente ou horário | ✅ **só para si**, e só com paciente e tipo que a RLS deixa ver | ❌ | ✅ |
| Editar sessão, pagamento, despesa ou paciente | ✅ **só registros próprios** | ❌ | ✅ |
| Excluir sessão, pagamento, despesa ou horário | ✅ **só registros próprios** | ❌ | ❌ (a policy de DELETE barra; o erro vira mensagem clara) |
| Excluir paciente | ❌ ninguém, pelo MCP | ❌ | ❌ |
| Escrever em `assinaturas` | ❌ ninguém (pegadinha 1) | ❌ | ❌ |
| Enviar feedback | ✅ | ❌ | ✅ |

Não há primeiro administrador: a conta é a mesma do app.

---

## 6. Autenticação e identidade

### 6.1 Decisão: OAuth 2.1 Server do próprio Supabase (opção A)

| | |
|---|---|
| Decisão | Usar o **OAuth 2.1 Server do Supabase Auth** (beta), com **Dynamic Client Registration ligado**. O servidor MCP é só *resource server*. |
| Por quê | Os tokens emitidos são JWTs normais do Supabase (`sub`, `role`, `client_id`), então a RLS vale direto (P1). Não guardamos refresh token nem segredo de usuário em lugar nenhum, e o refresh fica por conta do Supabase. |
| Alternativa descartada | Um authorization server próprio dentro do MCP, que faria `signInWithPassword`, guardaria a sessão do Supabase criptografada e emitiria tokens próprios. Daria controle de CIMD, `aud` e `iss`, mas obrigaria a guardar refresh tokens de conta com dado de saúde e a manter muito mais código de segurança. |
| Risco | Beta, e com limitações conhecidas. Ver 6.4 e a seção 23. |

### 6.2 Fluxo

1. O cliente chama `https://app.agendapsi.app.br/mcp` sem token e recebe **401** com `WWW-Authenticate: Bearer resource_metadata="<url>/.well-known/oauth-protected-resource"`.
2. Esse documento de Protected Resource Metadata (RFC 9728) declara:
   - `resource`: igual, byte a byte, à URL que a pessoa digita no conector;
   - `authorization_servers`: um único item, `https://tocytpjtupbbxwgamtxq.supabase.co/auth/v1`, porque o Claude usa só o primeiro.
3. O cliente lê `/.well-known/oauth-authorization-server/auth/v1`, se registra por DCR e abre o authorize com PKCE S256.
4. O Supabase redireciona para a **página de consentimento**, com `?authorization_id=`.
5. A página pede e-mail e senha se não houver sessão, faz `signInWithPassword` e depois chama `supabase.auth.oauth.getAuthorizationDetails`. Ela mostra "Claude quer acessar seu Agenda Psi" com os botões Permitir e Negar, que chamam `approveAuthorization` ou `denyAuthorization` e seguem o `redirect_url` devolvido.
6. O cliente troca o code por tokens e passa a chamar o MCP com `Authorization: Bearer <JWT>`.

### 6.3 Página de login e consentimento

O *authorization path* do Supabase é **relativo à Site URL do projeto**, que é `https://app.agendapsi.app.br/` (conferida no painel em 15/11/2026). Esse domínio servia o app web antigo do FlutterFlow, que **ninguém mais usa**. Decisão 25.1: o domínio passa a apontar para o projeto da Vercel, e a página fica em `https://app.agendapsi.app.br/oauth/consent`. **A Site URL não muda**, então os e-mails do app e o login do app não são afetados.

Consequência: a raiz `/` desse domínio é para onde o Supabase manda quem clica no link de confirmação de conta (o `signUp` do app não passa `emailRedirectTo`). Ela deixa de abrir o app antigo e passa a ser uma página estática curta dizendo que o e-mail foi confirmado e que a pessoa deve voltar ao app; o texto exato é aprovado pelo Alexandre (assunção 24.8). Qualquer outro caminho antigo (`/inicio` etc.) redireciona para `/`.

**Premissa a validar no épico 3:** a Site URL termina com `/`. Conferir se o Supabase monta `https://app.agendapsi.app.br//oauth/consent` (barra dupla). Se montar, o `vercel.json` aceita os dois caminhos; **não** mexer na Site URL.

Conteúdo da página, qualquer que seja o lugar:
- campos de e-mail e senha, e o botão "Entrar";
- link "Esqueci minha senha", que dispara o mesmo `resetPasswordForEmail` do app. O caminho oficial de recuperação continua sendo o do app;
- depois do login, o nome do cliente (`client_name` do DCR), as permissões em linguagem simples e os botões "Permitir" e "Negar";
- só a chave publicável do Supabase; nenhuma chave secreta.

### 6.4 Verificação do token no servidor MCP

| Checagem | Como |
|---|---|
| Assinatura | **Pelo próprio Supabase Auth**, com `supabase.auth.getClaims(token)` (ou `getUser(token)`), que funciona com o segredo HS256 legado. O projeto **não** usa chaves assimétricas e **não** vai migrar agora (decisão 25.4, 15/11/2026). Não verificar localmente com o segredo legado: ele é segredo e não entra no MCP. |
| `iss` | Igual a `https://tocytpjtupbbxwgamtxq.supabase.co/auth/v1` |
| `exp` | Não vencido; vira o `expiresAt` do AuthInfo |
| `role` | `authenticated` |
| `client_id` | **Obrigatório.** Recusa token de sessão comum do app (sem `client_id`), para o token do app não servir no MCP. |
| `aud` | O Supabase emite `authenticated`, não a URL do MCP. **Não** exigir RFC 8707 enquanto o Supabase não suportar; compensam isso a `iss`, a assinatura e o `client_id`. Registrado como risco (23). |

Escopos OAuth (`openid`, `email`, `profile`) não controlam acesso a dado; quem controla é a RLS.

### 6.5 Pré-requisitos no projeto de produção (feitos pelo Alexandre, nunca pelo agente)

O agente de código **não altera configuração do projeto Supabase de produção, nem DNS, nem domínio, nem variáveis de ambiente de produção na Vercel**. Ele produz um checklist no README, e o Alexandre executa:

1. ~~Migrar para JWT Signing Keys assimétricas.~~ **Não fazer** (decisão 25.4). Conferido em 15/11/2026: o JWKS do projeto está vazio, ou seja, ele usa o segredo HS256 legado. A rotação pode quebrar as funções `agente` e `notifica-admin`, que usam `verify_jwt = true`, e o `agente` é muito usado em produção.
2. **Vercel:** criar o projeto a partir do repositório `agenda-psi`, com Root Directory `mcp-server/`, e cadastrar as variáveis da seção 18. Durante o desenvolvimento, a *Production Branch* é `feature/mcp-server`; depois do merge, volta a ser `main`. Configurar o *Ignored Build Step* para só publicar quando `mcp-server/` mudar.
3. **Vercel → Domains:** adicionar `app.agendapsi.app.br` ao projeto e anotar o registro DNS que a Vercel pedir.
4. **Registro.br:** trocar o registro de `app.agendapsi.app.br` (hoje um `A` para `34.136.28.237`, o app antigo do FlutterFlow) pelo que a Vercel pediu. Isso desliga o app web antigo, que não é mais usado.
5. Conferir que `https://app.agendapsi.app.br/` abre a página nova e que `/oauth/consent` abre a página de login.
6. **Supabase** → Authentication → OAuth Server: ligar, ligar o **Dynamic Client Registration** e definir o *authorization path* `/oauth/consent`. A Site URL **não** muda.
7. Adicionar as redirect URIs só se o painel pedir. Com DCR, o cliente registra as dele: `https://claude.ai/api/mcp/auth_callback`, as do ChatGPT e o loopback do Claude Code.

### 6.6 Sessão e logout

- O access token dura o tempo padrão do Supabase, e o cliente MCP renova pelo refresh token.
- Desconectar o conector no Claude ou no ChatGPT é o logout.
- Revogar acesso: o Supabase lista as autorizações do usuário. Expor isso no app fica para a v2.

---

## 7. Modelo de dados

**Este trabalho não cria nem altera tabela, coluna, view, função, trigger ou policy.** O servidor usa o schema existente, documentado em `docs/schema.md` (gerado em 18/09) e nas migrations 0001–0019. Como `docs/schema.md` está desatualizado em relação às migrations 0013–0019, o épico 1 começa regerando-o pelo comando do `CLAUDE.md`.

Tabelas e views que o servidor lê e grava:

| Objeto | Leitura | Escrita | Observação |
|---|---|---|---|
| `despesas` | ✅ | insert / update / delete | `valor_despesa integer >= 0`; a policy exige `tipos_despesa.ativo` |
| `tipos_despesa` | ✅ (a policy já filtra ativos) | — | Catálogo global, cerca de 13 linhas |
| `sessoes` | ✅ (sem `observacoes`) | insert / update / delete | `ocorreu_em_dia` não se edita |
| `pagamentos` | ✅ (sem `observacoes`) | insert / update / delete | `data_competencia` não se edita |
| `pacientes` | ✅ (sem `observacoes`) | insert / update | Sem delete pelo MCP |
| `precos_paciente` | via `v_pacientes_cartao.preco_vigente` | insert (append-only, pegadinha 2) | Nunca update |
| `agenda_semana_padrao` | via `view_agenda_semana_padrao` | insert / delete | `dia_semana` de 1 a 7 |
| `feedback` | — | insert, e depois a Edge Function `notifica-admin` | Mesmo fluxo da tela de Ajustes |
| `v_pacientes_cartao`, `v_financeiro_mensal`, `v_pendencias_por_paciente`, `view_agenda_semana_padrao` | ✅ | — | Os números vêm prontos (P2 do app) |

Nenhum `.dbml` acompanha este spec, porque não há modelo de dados novo.

**Migrations:** nenhuma. Se surgir necessidade, a migration é escrita, **mostrada ao Alexandre e só aplicada com aprovação**, como uma nova, nunca editando uma versionada (hook 18.1).

---

## 8. Épicos e critérios de aceite

Ordem obrigatória. **Há uma parada de aprovação depois do épico 3**: nada do épico 4 em diante começa sem o Alexandre ver a despesa funcionando no Claude.

### 8.0 Épico 0 — Guardrails
Objetivo: instalar o Anexo B antes de qualquer feature.
- [x] `.claude/settings.json`, `.claude/hooks/*.sh` (executáveis), `.claude/agents/verifier.md` e `REVIEW.md` criados com o conteúdo do Anexo B.
- [x] Cada hook provocado uma vez, com a saída do bloqueio colada: escrever `service_role` em `mcp-server/src/x.ts`, editar `supabase/migrations/…0001_baseline.sql`, escrever em `app/src/x.ts`, editar um teste com `.claude/fix-mode` presente, e rodar `supabase functions deploy` (sem nome) e `vercel --prod` (o hook bloqueia antes de executar).
- [x] `.claude/fix-mode` está no `.gitignore` (em `.claude/.gitignore`).

### 8.1 Épico 1 — Esqueleto, autenticação por token e uma leitura
Objetivo: servidor local respondendo a um cliente MCP real, com JWT verificado e RLS valendo.
1. Criar o `package.json` com as versões conferidas no npm, o `tsconfig` strict e o Vitest.
2. Escrever `handler.ts` com `createMcpHandler`, `rules/` portadas com testes, `auth/` (verificação 6.4, metadata RFC 9728, 401) e `supabase.ts`.
3. Escrever o script `npm run dev:token`, que faz `signInWithPassword` com a **conta de teste** (variáveis locais `TEST_EMAIL` e `TEST_PASSWORD`) e imprime um access token. Só para desenvolvimento: tokens sem `client_id` são aceitos **apenas** quando `MCP_DEV_ALLOW_SESSION_TOKEN=1`, e essa variável **nunca** existe no deploy.
4. Implementar a primeira leitura: `listar_tipos_despesa` (só app) e `consultar_despesas` (modelo).

Critérios:
- [x] `npm test`, `npm run typecheck` e `npm run build` passam, com a saída colada.
- [x] Com o MCP Inspector apontando para `http://localhost:<porta>/mcp` sem token, a resposta é 401 com `WWW-Authenticate` contendo `resource_metadata`.
- [x] Com o token da conta de teste, `consultar_despesas` devolve só despesas da conta de teste.
- [x] Um token adulterado (um caractere trocado na assinatura) dá 401.
- [x] Os testes de `rules/` cobrem: literais 11.4 byte a byte (comparados com o texto de `app/src/features/patients/valores-do-banco.ts`), `diaDaSemanaDoBanco` (domingo = 7), "hoje" em São Paulo às 23h30 de Brasília (não pode virar o dia seguinte) e `resolverPaciente` nos três casos.

### 8.2 Épico 2 — Registrar despesa de ponta a ponta (local)
Objetivo: o padrão completo numa ação, que serve de molde para as outras.

Fluxo:
1. O modelo chama `abrir_formulario_despesa` com o que entendeu (tipo, valor, data, descrição), tudo opcional.
2. A ferramenta normaliza os argumentos: resolve o tipo pelo nome contra `tipos_despesa`, valida o valor e a data e devolve `structuredContent` com o pré-preenchimento e os avisos ("'aluguel' casou com 2 tipos, escolha um"). O host abre `ui://agenda-psi/despesa.html`.
3. O formulário registra os handlers **antes** de `app.connect()`, recebe o resultado da ferramenta e carrega as opções por `callServerTool('listar_tipos_despesa')`.
4. A pessoa edita e clica em Salvar. O botão fica desabilitado enquanto falta campo obrigatório e durante o envio.
5. O formulário chama `callServerTool('salvar_despesa', {...})`. O servidor revalida (seção 11), grava com o JWT e devolve `{ id, resumo }` ou `{ erros: [{ campo, mensagem }] }`.
6. Em caso de sucesso: a tela mostra "Despesa registrada" com o resumo e chama `app.updateModelContext` com `"Despesa registrada: <tipo>, R$ <valor>, competência <dd/mm/aaaa> (id <uuid>)."`. O evento `agenda_psi_novadespesa` é emitido pelo servidor (seção 21).
7. Em caso de erro: a mensagem aparece **embaixo do campo** e nada de sucesso é mostrado. Erro de rede ou de banco vira a mensagem geral, sem stack.

Estados: carregando (esqueleto dos campos enquanto as opções chegam), erro ao carregar opções (mensagem + "Tentar de novo"), salvando, sucesso (formulário trancado com o resumo) e erro de validação.

Campos do formulário:

| Campo | Controle | Obrigatório | Regra (seção 11) |
|---|---|---|---|
| Tipo da despesa | Lista (`tipos_despesa`, ordenada por nome) | sim | Começa **vazio** se não houver um único casamento (defeito 11.9.5 do app) |
| Valor (R$) | Inteiro, teclado numérico, prefixo "R$" | sim | 11.1 |
| Competência | Data, padrão hoje em São Paulo | sim | 11.3 |
| Descrição | Texto curto (até 200) | não | — |
| Observações | Texto (até 1000) | não | Despesa não é dado clínico |

Critérios:
- [x] No basic-host do ext-apps, "paguei 1450 de aluguel hoje" abre o formulário com tipo Aluguel (ou vazio, se houver mais de um "aluguel"), valor 1450 e a data de hoje.
- [x] Valor `1450,50` é recusado na tela **e** no servidor com "Informe um valor inteiro, sem centavos. Ex: 200".
- [x] Chamar `salvar_despesa` direto pelo Inspector, sem tipo, devolve erro no campo `tipo_despesa_id`, em português, sem gravar.
- [x] Chamar `salvar_despesa` com um `tipo_despesa_id` inexistente ou inativo devolve erro de campo, nunca erro cru do Postgres.
- [x] A linha gravada tem `status = 'pago'`, `pago_em` preenchido e os mesmos campos que a tela do app grava (conferido no painel do Supabase).
- [x] `listar_tipos_despesa` e `salvar_despesa` **não** aparecem no `tools/list` visto pelo modelo (`visibility: ["app"]`).
- [x] Num cliente sem a extensão MCP Apps (Inspector sem UI), aparece `registrar_despesa`. A primeira chamada devolve a prévia e o `token_previa`; a segunda, com `confirmar: true` e o token, grava; token adulterado ou vencido não grava.
- [ ] Depois do Salvar, o modelo responde sabendo o id e o resumo, sem a pessoa repetir nada. (Contexto entregue ao host no épico 2; a resposta do modelo se confere no épico 3.)

### 8.3 Épico 3 — OAuth e deploy em produção (conector no Claude)
Objetivo: a despesa do épico 2 funcionando no Claude web e desktop como conector personalizado.

Bloqueado pelo checklist 6.5, que o Alexandre executa (25.1 respondida em 15/11/2026).

Critérios:
- [ ] O deploy na Vercel sobe, e `GET https://app.agendapsi.app.br/.well-known/oauth-protected-resource` devolve o JSON da seção 6.2.
- [ ] No Claude, em Configurações > Conectores > Adicionar conector personalizado, a URL leva ao login, ao consentimento e ao conector ativo.
- [ ] "Registra 120 de supervisão de ontem" abre o formulário, salva e aparece no app (lista de despesas) com os mesmos dados.
- [ ] O token do app (sessão comum, sem `client_id`) é recusado pelo MCP em produção.
- [ ] Os logs da Vercel não contêm nome de paciente, valor, descrição nem token (conferido no painel ou com `vercel logs`).
- [ ] Um cadastro novo no app recebe o e-mail de confirmação, e o link termina na página `/` nova.

**→ PARADA. Mostrar ao Alexandre e só seguir com a aprovação dele.**

### 8.4 Épico 4 — Ferramentas de leitura
As 9 ferramentas do agente, com os mesmos nomes, descrições e saídas, exceto:
- sem `observacoes` (P5), o que afeta `buscar_paciente`;
- sem ids internos nas respostas ao modelo (como o agente já faz).

Detalhe em 13.2. Critérios:
- [ ] Para cada ferramenta, o resultado bate com o do agente interno do app para a mesma pergunta na conta de teste (roteiro do README).
- [ ] Nenhuma resposta tem a chave `observacoes`; um teste automatizado percorre as 9.
- [ ] Toda resposta de lista tem teto (30 linhas no histórico, 5 pacientes na busca, como no agente) e avisa `pode_haver_mais`.

### 8.5 Épico 5 — Demais criações
Replicar o molde do épico 2 para cada ação, um módulo por ação. Os campos e as regras estão na tabela 13.3:
`sessoes` (várias numa vez), `pagamento` (vários), `paciente` (com horários), `horario`, `feedback`.

Critérios por ação:
- [ ] Formulário pré-preenchido a partir da conversa, paciente com busca e autocomplete (`buscar_pacientes_opcoes`), e ambiguidade mostrada como escolha, nunca resolvida sozinha.
- [ ] O `salvar_*` revalida tudo e devolve erros por campo em português.
- [ ] Valor gravado igual ao da tela do app, conferido no painel: literais 11.4 e `dia_semana` 1–7.
- [ ] Sessão marcada "Pagou" **não** cria pagamento. Depois de salvar, o formulário oferece "Registrar também o pagamento?", que abre o formulário de pagamento pré-preenchido com o preço de referência (mesma regra de `ofertaDePagamento`).
- [ ] Paciente com horários: o paciente é gravado primeiro e os horários depois. Se só os horários falharem, o paciente fica e o formulário mostra o que faltou.
- [ ] Horário sobreposto a outro paciente aparece como **aviso**, não bloqueio (`conflitosDoHorario`).
- [ ] Fallback `registrar_*` com prévia e confirmação em todas.

### 8.6 Épico 6 — Agenda, edições e exclusões
`troca_horario`, `remocao_horario`, `edicao_paciente`, `edicao_sessao`, `exclusao_sessao`, `edicao_pagamento`, `exclusao_pagamento`, `edicao_despesa` e `exclusao_despesa`.

Critérios:
- [ ] O formulário mostra **antes e depois**, e quando a frase casa com vários registros, lista os candidatos (até 6 recentes) para escolher.
- [ ] A data da sessão e a competência de pagamento e despesa aparecem **somente leitura**.
- [ ] Na edição de paciente, as observações atuais são preservadas **sem serem lidas para o modelo nem mostradas na tela**: o servidor relê o registro e regrava o campo como está.
- [ ] Preço novo vira linha nova em `precos_paciente` (pegadinha 2).
- [ ] Troca de horário grava o novo antes de tirar o antigo; se só a saída falhar, a tela diz isso.
- [ ] Exclusão exige um segundo clique de confirmação ("Excluir definitivamente") no formulário. O fallback exige `token_previa`.
- [ ] Na conta demo, a exclusão devolve "Esta conta de demonstração não permite excluir registros."

### 8.7 Épico 7 — ChatGPT, README e documentação
Critérios:
- [ ] O conector funciona no ChatGPT (modo desenvolvedor) com o mesmo servidor, sem código específico de ChatGPT.
- [ ] O `mcp-server/README.md` contém:
  - como rodar localmente: Inspector, basic-host do ext-apps e token de desenvolvimento;
  - como fazer o deploy;
  - o checklist 6.5;
  - como adicionar como conector personalizado no Claude (web e desktop) e no ChatGPT;
  - o **roteiro de teste manual de cada ferramenta**: frase de exemplo, o que deve abrir, o que conferir no app e o caso de erro.
- [ ] `DOCUMENTACAO-TECNICA.md` (da raiz) ganha a seção "Servidor MCP", com os seis itens da seção 19.
- [ ] O `CLAUDE.md` da raiz ganha **uma linha** no mapa de pastas apontando para `mcp-server/` e o comando de teste. Ele precisa continuar cabendo numa página.

---

## 9. Fluxos ponta a ponta

**9.1 Primeira conexão (Claude)**
1. A pessoa adiciona a URL do conector.
2. O Claude recebe 401 e faz discovery e DCR.
3. A página de login abre; a pessoa entra com e-mail e senha.
4. Ela vê o consentimento e clica em Permitir.
5. O conector fica ativo.

Exceção: se a senha estiver errada, a página mostra a mensagem do app ("E-mail ou senha incorretos") e não redireciona. Se a pessoa clicar em Negar, o cliente recebe `access_denied` e o conector não ativa.

**9.2 Registro a partir da conversa:** frase → `abrir_formulario_*` → formulário → Salvar → `salvar_*` → `updateModelContext` → o modelo confirma em uma frase.

Exceção: se a pessoa fechar o formulário sem salvar, nada é gravado e o modelo não afirma que gravou. A descrição de `abrir_formulario_*` deixa isso explícito para o modelo.

**9.3 Cliente sem MCP Apps:** frase → `registrar_*` (prévia + `token_previa`) → o modelo mostra a prévia e pergunta → a pessoa confirma → `registrar_*` com `confirmar: true` e o token → grava.

Exceção: se a pessoa mudar algum dado, o modelo chama a prévia de novo, e o token anterior deixa de valer, porque o hash dos dados não bate.

---

## 10. Inventário de telas

Não se aplica como inventário de telas do app. Os "formulários" deste servidor são descritos campo a campo em 8.2 e 13.3. Não há prompt de design: os formulários seguem o tema do host (16).

---

## 11. Regras de negócio

Toda regra abaixo é aplicada **no servidor** (`mcp-server/src/rules/`) antes de gravar, e repetida na tela por conveniência. As marcadas "só no app hoje" não têm garantia no banco (ver 25.2). Por isso o servidor é a única garantia para gravações vindas do MCP.

| # | Regra | Valor exato | Origem no app | Garantia no banco? |
|---|---|---|---|---|
| 11.1 | Valor em reais | Inteiro, só dígitos, > 0. `200,00` e `200.00` são **recusados**, nunca arredondados. Mensagem: "Informe um valor inteiro, sem centavos. Ex: 200". | `app/src/lib/validation.ts` (`validarValorEmReais`) | Parcial: `integer` e `>= 0` |
| 11.2 | Teto do valor | ≤ 1.000.000 | `propostas.ts` (`valorValido`) | Não |
| 11.3 | "Hoje" | Data civil em **America/Sao_Paulo**, AAAA-MM-DD; datas inexistentes (31/02) são recusadas | migration 0007 e `dataValida` | Não |
| 11.4 | Literais | `sessoes.pagamento` ∈ {`pagou`, `nao pagou`, `pagamento mensal`}; `pagamentos.tipo` ∈ {`mensal`, `por sessão`}; `sessoes.modalidade` ∈ {`presencial`, `remota`}; `pacientes.status` ∈ {`ativo`, `inativo`} | `valores-do-banco.ts` (pegadinha 6) | **Não**, só no app hoje |
| 11.5 | Rótulo × valor | Na tela: "Não pagou", "Mensal", "Por sessão". No banco, o literal de 11.4. | idem | — |
| 11.6 | Dia da semana | 1 = segunda … 7 = domingo; a lista na tela pode começar no domingo, mas grava 1–7 | `diaDaSemanaDoBanco` (pegadinha 7) | **Não** |
| 11.7 | Horário | `hora_fim > hora_inicio`, HH:MM 24h; o fim padrão é início + 50 min, sem passar de 23:59 | `validarIntervaloDeHoras` e `horaFimPadrao` | **Não** |
| 11.8 | Duração da sessão | Inteiro entre 1 e 600; padrão 50 | `propostas.ts` | Não |
| 11.9 | Padrões da sessão | `pagamento` = `pagamento mensal` se não dito; `modalidade` = `presencial`; `devesercobrada` = true; `observacoes` = null (P5) | `use-confirmar.ts` | Não |
| 11.10 | Padrões de pagamento e despesa | `status` = `pago`, `pago_em` = agora (ISO); `tipo` do pagamento = `mensal` se não dito | `use-payments.ts`, `use-expenses.ts` | **Não**, só no app hoje |
| 11.11 | Valor sugerido do pagamento | O dito na frase; senão `preco_vigente` da view (nunca calculado); senão vazio, e a tela pede | `valorDoPagamento` | — |
| 11.12 | Paciente novo | Nome obrigatório (trim), **telefone obrigatório**, e-mail opcional mas válido se preenchido, preço obrigatório (11.1), `receber_sms` padrão true, `status` = `ativo`; o preço vira linha em `precos_paciente` | `validation.ts`, `use-patients.ts` | Nome sim; telefone **não** |
| 11.13 | Formato do telefone | O mesmo que a tela do app grava hoje. **Conferir** em `use-patients.ts` e na migration 0019 antes de implementar; não inventar normalização. | app + 0019 | — |
| 11.14 | Resolução de paciente | Nome inteiro igual (sem acento e caixa) vence; senão, todas as palavras contidas. 1 → ok; >1 → ambíguo (ativos primeiro, até 8); 0 → não encontrado. **Nunca escolhe sozinho.** | `resolverPaciente` | — |
| 11.15 | Resolução de tipo de despesa | Substring sem acento; exatamente 1 → ok; senão a lista começa vazia e mostra os candidatos | `proporDespesas` | — |
| 11.16 | Imutáveis na edição | `sessoes.ocorreu_em_dia`, `pagamentos.data_competencia`, `despesas.data_competencia` | `registros.ts` (spec do app, telas 15, 17 e 20) | Não |
| 11.17 | Preço | Sempre insert em `precos_paciente`, nunca update | pegadinha 2 | Não |
| 11.18 | Sessão paga ≠ pagamento | Marcar "Pagou" não cria pagamento; oferece criar | decisão de 02/11/2026 | — |
| 11.19 | Sobreposição de horário | Aviso, não bloqueio | `conflitosDoHorario` | — |
| 11.20 | Edição sem mudança | Recusada: "Nada mudou no registro" | `rascunhos.ts` | — |
| 11.21 | Feedback | Mensagem obrigatória, até 2000 caracteres; categoria ∈ {problema, sugestão, elogio}; grava como a tela de Ajustes (`useEnviarFeedback`) | `use-settings.ts` | Não |

**O que NÃO é automático:** o servidor não soma dinheiro além do que o agente já soma (totais de despesa e saldo de período, como em `ferramentas.ts`), não calcula preço e não cria pagamento a partir de sessão.

**Regra de cópia:** os literais e as mensagens são copiados **byte a byte** do app para `rules/`, e um teste lê o arquivo do app como texto e confere. Se o app mudar, o teste quebra; essa é a intenção.

---

## 12. Máquinas de estado e tratamento de erro

**Formulário:** `carregando_opcoes → pronto ⇄ editando → salvando → (sucesso | erro_validacao → editando | erro_geral → editando)`. Em `sucesso` o formulário fica trancado: não há segundo Salvar, o que evita gravar em duplicidade.

**Erros devolvidos por `salvar_*`:**

| Origem | Retorno | Mensagem |
|---|---|---|
| Validação | `{ ok: false, erros: [{ campo, mensagem }] }` | Literais de 11.x |
| RLS ou registro não encontrado | `{ ok: false, erros: [{ campo: null, mensagem: "Registro não encontrado ou sem permissão." }] }` | — |
| Policy de DELETE da conta demo | idem | "Esta conta de demonstração não permite excluir registros." |
| Token vencido | HTTP 401 (o host renova) | — |
| Erro inesperado do banco | `{ ok: false, erros: [{ campo: null, mensagem: "Não foi possível salvar agora. Tente de novo." }] }` | Nunca repassar mensagem crua do Postgres |

Erro de ferramenta de leitura volta como `isError: true` com texto curto em português, para o modelo se corrigir (como o `{ erro }` do agente).

---

## 13. Contratos de ferramentas

### 13.1 Convenções
- Nomes de ferramenta em português, `snake_case` (são o contrato com o modelo). Código em inglês.
- Toda ferramenta de leitura tem `annotations.readOnlyHint = true`. As de exclusão têm `destructiveHint = true`.
- Todo `inputSchema` em zod v4, com `.describe()` em português; datas `AAAA-MM-DD`, meses `AAAA-MM` e horas `HH:MM`.
- **Nenhum schema tem `usuario_id`** (P1).
- Visibilidade: `["model"]` para leitura, `abrir_formulario_*` e fallback; `["app"]` para opções e `salvar_*`.
- `abrir_formulario_*` usa `registerAppTool` com `_meta.ui.resourceUri = "ui://agenda-psi/<acao>.html"`. Cada HTML é um `registerAppResource` com `RESOURCE_MIME_TYPE`. O CSP padrão é restritivo (`connect-src 'none'`): o formulário **não** acessa a rede, e tudo passa por `callServerTool`.

### 13.2 Leitura (visíveis ao modelo)
Mesmos nomes, descrições, entradas e saídas de `supabase/functions/agente/ferramentas.ts`, exceto as remoções de P5:

| Ferramenta | Entrada | Diferença em relação ao agente |
|---|---|---|
| `buscar_paciente` | `nome` | Sem `observacoes` |
| `historico_do_paciente` | `nome`, `desde?`, `ate?` | — |
| `consultar_despesas` | `desde?`, `ate?`, `tipo?` | — |
| `listar_pacientes` | `status?`, `receber_sms?` | — |
| `consultar_periodo` | `desde`, `ate` (AAAA-MM) | — |
| `consultar_mes` | `mes` | — |
| `agenda_do_dia` | `data` | — |
| `agenda_da_semana` | `data` | — |
| `listar_pendencias` | — | — |

Na v1, a lógica é **portada** para `mcp-server/src/tools/read/`, com teste. Extrair um módulo compartilhado com o agente fica para depois (assunção 24.3).

### 13.3 Escrita: ações, ferramentas e campos

| Ação | Abre (modelo) | Opções (app) | Salva (app) | Fallback (modelo) | Campos do formulário |
|---|---|---|---|---|---|
| despesa | `abrir_formulario_despesa` | `listar_tipos_despesa` | `salvar_despesa` | `registrar_despesa` | 8.2 |
| sessões | `abrir_formulario_sessoes` | `buscar_pacientes_opcoes` | `salvar_sessoes` | `registrar_sessoes` | por linha: paciente*, data*, pagamento (Pagou / Não pagou / Mensal), modalidade, duração |
| pagamento | `abrir_formulario_pagamento` | `buscar_pacientes_opcoes` | `salvar_pagamentos` | `registrar_pagamentos` | por linha: paciente*, valor*, data*, tipo (Mensal / Por sessão) |
| paciente | `abrir_formulario_paciente` | — | `salvar_paciente` | `registrar_paciente` | nome*, telefone*, e-mail, preço*, recebe SMS; horários (dia*, início*, fim) |
| horário | `abrir_formulario_horario` | `buscar_pacientes_opcoes`, `listar_agenda` | `salvar_horarios` | `registrar_horarios` | paciente*, dia*, início*, fim |
| feedback | `abrir_formulario_feedback` | — | `salvar_feedback` | `registrar_feedback` | categoria*, mensagem* |
| troca de horário | `abrir_formulario_troca_horario` | `listar_horarios_do_paciente`, `listar_agenda` | `salvar_troca_horario` | `registrar_troca_horario` | horário atual* (lista), novo dia, início e fim |
| remoção de horário | `abrir_formulario_remocao_horario` | `listar_horarios_do_paciente` | `salvar_remocao_horario` | `registrar_remocao_horario` | horário* (lista) + confirmação |
| edição de paciente | `abrir_formulario_edicao_paciente` | `buscar_pacientes_opcoes` | `salvar_edicao_paciente` | `registrar_edicao_paciente` | nome, telefone, e-mail, status, recebe SMS, preço (sem observações) |
| sessão (editar / excluir) | `abrir_formulario_edicao_sessao` / `…_exclusao_sessao` | `listar_sessoes_do_paciente` | `salvar_edicao_sessao` / `salvar_exclusao_sessao` | `registrar_…` | registro* (lista); pagamento, modalidade, duração, cobrada; data só leitura |
| pagamento (editar / excluir) | idem `…_pagamento` | `listar_pagamentos_do_paciente` | idem | idem | registro*; valor, tipo; competência só leitura |
| despesa (editar / excluir) | idem `…_despesa` | `listar_despesas_recentes`, `listar_tipos_despesa` | idem | idem | registro*; tipo, valor, descrição, observações; competência só leitura |

`*` = obrigatório. A entrada de cada `abrir_formulario_*` espelha a do `propor_*` equivalente do agente (`propostas.ts` e `registros.ts`), com tudo opcional exceto o mínimo que o agente já exige.

Saída de todo `salvar_*`: `{ ok: true, ids: string[], resumo: string }` ou o erro da seção 12.

### 13.4 Fallback com prévia (clientes sem MCP Apps)
- **Só é registrado** quando o cliente **não** anuncia a extensão MCP Apps nas capabilities do request. Premissa a validar: a forma exata de ler isso no SDK v2 stateless; o ext-apps tem um helper de capacidade de UI.
- **Chamada 1** (`confirmar` ausente ou false): valida como o `salvar_*`, resolve paciente e tipo e devolve:
  - `previa`: dados normalizados, com rótulos em português;
  - `pendencias`: ambiguidades a resolver;
  - `token_previa`: HMAC-SHA256 (segredo `MCP_PREVIEW_SECRET`) de `sub + acao + JSON canônico dos dados normalizados + exp`, com `exp` em 10 min.
- **Chamada 2** (`confirmar: true` + `token_previa` + os mesmos dados): recalcula o HMAC. Se bater e não tiver vencido, grava. Se divergir, devolve "Os dados mudaram desde a prévia. Mostre a nova prévia à pessoa."
- Com `pendencias` não vazio, a chamada 2 é recusada.
- A descrição da ferramenta instrui: "Nunca envie confirmar=true sem mostrar a prévia à pessoa e ela concordar."

---

## 14. Relatórios, exportação e importação
Não se aplica.

## 15. Copy e tom de voz
- Todo texto visível vem do app quando existe lá: `app/src/lib/validation.ts` (`mensagens`), os `copy.ts` de cada feature e a seção 15 de `docs/spec.md`. **Copiar literalmente, sem reescrever.**
- Textos novos deste servidor, que são finais e ficam em `mcp-server/src/rules/messages.ts`:
  - Sucesso: "Despesa registrada", "Sessões registradas", "Pagamento registrado", "Paciente cadastrado", "Horário adicionado", "Horário alterado", "Horário removido", "Cadastro atualizado", "Registro atualizado", "Registro excluído" e "Feedback enviado".
  - Consentimento: "**{client_name}** quer acessar seu Agenda Psi para consultar e registrar pacientes, sessões, pagamentos e despesas. Você pode desconectar quando quiser." com os botões "Permitir" e "Negar".
  - Os erros da tabela da seção 12.
- Sem exclamação e sem emoji (regra do app).

## 16. Direção visual
- O formulário usa as **variáveis de tema do host** que o ext-apps expõe no contexto do host (claro e escuro), com fallback neutro. Não aplica a marca do Agenda Psi: o formulário vive dentro do Claude ou do ChatGPT e deve parecer parte da conversa.
- Uma coluna, rótulo acima do campo, erro em vermelho semântico abaixo do campo, botão primário "Salvar" à direita e "Cancelar" como texto.
- Área de toque mínima de 44×44 (regra do app).
- Livre para o agente: espaçamento, ícones e animação discreta de sucesso.

## 17. Requisitos não-funcionais

| Item | Alvo |
|---|---|
| Latência de `tools/call` de leitura | p95 < 1,5 s (servidor + banco) |
| Latência de `salvar_*` | p95 < 2 s |
| CPU por request | < 500 ms |
| Tamanho de cada HTML de formulário | < 300 KB (era 150 KB; só o `App` do ext-apps 2.0.4 ocupa 234 KB, 60 KB em gzip. Alterado por decisão do Alexandre em 15/11/2026, épico 2) |
| Acessibilidade | `label` em todo campo, foco visível, navegação por teclado, erro ligado ao campo por `aria-describedby` |
| Idioma | pt-BR |
| Clientes | Claude web e desktop (conector personalizado), ChatGPT (modo desenvolvedor), MCP Inspector e basic-host |
| Volume | Dezenas de pacientes por usuário: pode filtrar em memória após a RLS, como o agente faz |

## 18. Convenções de código e estrutura
- **Idioma:** o banco segue como está (português); código, variáveis e arquivos em inglês; nomes de ferramenta em português. Os tipos do banco mantêm os nomes em português, **sem camada de tradução** (regra do `CLAUDE.md`). Gerar `mcp-server/src/database.types.ts` com `supabase gen types typescript --linked`.
- **Comentários em português** em toda função, ferramenta e handler: o que faz, o que recebe, o que devolve e a regra deste spec que implementa ("regra 11.4", "seção 13.4"). Lógica não óbvia leva comentário inline.
- **Um módulo por ação** em `src/tools/<acao>/`, com `open-form.ts`, `options.ts`, `save.ts`, `fallback.ts` e `schema.ts` (o schema zod é compartilhado entre `save`, `fallback` e o formulário).
- **Regras em `src/rules/`**, sem import de Supabase: puras e testáveis.
- **Logs:** só o nome da ferramenta, a duração, ok ou erro e um hash do `sub`. **Nunca** argumentos, resultados, tokens, nomes nem valores.
- **Variáveis de ambiente:**

| Variável | Onde | Pública? |
|---|---|---|
| `SUPABASE_URL` | servidor | sim |
| `SUPABASE_PUBLISHABLE_KEY` | servidor e página de consentimento | sim (por design) |
| `MCP_PUBLIC_URL` | servidor (o `resource` do PRM) | sim |
| `MCP_PREVIEW_SECRET` | servidor (variável de ambiente da Vercel, marcada como *Sensitive*) | **não** |
| `VISAODEPRODUTO_KEY`, `VISAODEPRODUTO_URL` | servidor | chave só de escrita |
| `MCP_DEV_ALLOW_SESSION_TOKEN` | **só local** | — |
| `TEST_EMAIL`, `TEST_PASSWORD` | **só local**, em `mcp-server/.env.local` (no `.gitignore`) | **não** |

`SUPABASE_SERVICE_ROLE_KEY` **não existe** neste servidor (P1, hook 18.1).

### 18.1 Guardrails executáveis

| Regra | Origem | Mecanismo |
|---|---|---|
| Nenhuma `service_role` ou segredo privilegiado em `mcp-server/` | P1, seção 20 | Hook `guard-secrets.sh` |
| Não alterar `app/` nem `supabase/` nesta branch | 4.2, 25.4 | Hook `guard-app-scope.sh` |
| Nada vai para produção sem o Alexandre: deploy de Edge Function, `config push`, `db push`, secrets, `vercel --prod`, env e domínios da Vercel, pela CLI **e pelo MCP da Vercel** (acrescentado em 15/11/2026) | 6.5, 25.4 | Hook `guard-production.sh` |
| Migration versionada não se edita | 7 | Hook `guard-migrations.sh` |
| Teste não se edita em modo correção | 22.1 | Hook `guard-tests.sh` |
| Advisors depois de qualquer migration | 20 | Hook `remind-advisors.sh` |
| Um comando Bash não pode alterar `app/` ou `supabase/` nem pôr credencial em `mcp-server/` (os hooks de Write/Edit não veem o Bash) | 4.2, 25.4, P1 | Hook `guard-bash-drift.sh` (PostToolUse, avisa depois) |
| `usuario_id` não é argumento de ferramenta | P1, pegadinha 3 | Hook `guard-tool-schema.sh` + `REVIEW.md` |
| Critérios de aceite, P5 e regras 11.x | 8, 11 | Subagente `verifier` + `REVIEW.md` |

O conteúdo de cada arquivo está no Anexo B.

## 19. Documentação técnica
Ao fim do épico 7, acrescentar ao `DOCUMENTACAO-TECNICA.md` da raiz a seção **"Servidor MCP"**, escrita a partir do que foi implementado:
1. as tabelas e views que o servidor usa e o significado de cada coluna tocada;
2. os relacionamentos envolvidos (paciente → sessões, pagamentos, preços e horários; despesa → tipo);
3. as policies de RLS de que cada ferramenta depende, por nome;
4. o mapa ferramenta → tabelas lidas e escritas;
5. a lógica de cada ferramenta: o que valida, o que grava e o que devolve em caso de erro;
6. as divergências em relação a este spec.

Toda mudança posterior atualiza essa seção no mesmo commit.

## 20. Privacidade, segurança e conformidade (LGPD)
- **Dado de saúde:** o servidor nunca lê nem devolve `observacoes` de `pacientes` ou `sessoes` (P5). Um teste automatizado garante isso nas 9 leituras e nas listas de opções.
- **O que sai para o Claude ou o ChatGPT:** nome de paciente, telefone e e-mail (em `buscar_paciente`), datas, valores e agenda. É o mesmo que o agente interno já envia à Anthropic. O README avisa ao usuário que, ao conectar, esses dados passam a trafegar pelo provedor do assistente escolhido. **Pergunta 25.3:** a política de privacidade do app precisa mencionar isso?
- **Base legal:** a mesma do app (execução de contrato / tutela da saúde pelo profissional). Este servidor não muda finalidade.
- **Segredos:** só `MCP_PREVIEW_SECRET` e a chave do Visão do Produto, nas variáveis de ambiente da Vercel.
- **Autorização:** só a RLS, com o JWT do usuário. Sem `service_role` (hook).
- **Logs:** sem PII (seção 18).
- **Advisors:** rodar `get_advisors` (security e performance) depois de qualquer DDL. Neste trabalho não deve haver DDL.
- **Guardrail de IA:** o modelo nunca grava sozinho (P2). A barreira não depende do modelo: o formulário exige clique humano, e o fallback exige um `token_previa` que só a prévia emite.

## 21. Telemetria
- O servidor emite os **mesmos nomes de evento** do app (pegadinha 5): `agenda_psi_novadespesa`, `agenda_psi_novasessao`, `agenda_psi_novopagamento`, `agenda_psi_novapaciente` e `agenda_psi_novoagendamento`. Antes, copie os nomes byte a byte de `app/src/lib/analytics/events.ts`.
- O campo `tela` leva `mcp_<acao>` (ex.: `mcp_despesa`), para separar a origem sem partir a série.
- Mesmas propriedades fechadas do app: **sem nome de paciente, valor, observação ou texto digitado**.
- Falha do analytics nunca falha a gravação.

## 22. Estratégia de teste

**Sem ambiente de staging (decisão de 15/11/2026).**

| Camada | Como |
|---|---|
| Regras (`src/rules/`) | Vitest puro, com 100% dos casos de borda da seção 11 |
| Handlers de ferramenta | Vitest com o cliente Supabase **simulado**: confere colunas e valores enviados no insert e o tratamento de erro |
| Schemas | Teste que percorre `tools/list` e falha se algum `inputSchema` tiver `usuario_id` |
| P5 | Teste que percorre as leituras e as opções com dados simulados que contêm `observacoes` e falha se a chave aparecer na saída |
| Integração manual | **Produção, com a conta de teste dedicada** que o Alexandre cria. Nunca a conta pessoal nem a de usuários reais. Dados fictícios ("Paciente Teste 1"). Ao fim de cada roteiro, o testador apaga pelo app o que criou. |

O agente de código **não** roda testes de escrita contra produção sozinho. Ele prepara o roteiro e pede ao Alexandre para executar, ou executa só com autorização explícita no chat e só com a conta de teste.

### 22.1 Loop de verificação
- Comandos únicos, rodados em `mcp-server/`, cada um saindo com erro quando falha:
  - `npm test` (Vitest);
  - `npm run typecheck` (`tsc --noEmit`);
  - `npm run build` (UI + `build:edge`).
- **Evidência obrigatória:** nenhum épico é declarado pronto sem a saída dos três comandos colada, seguida do relatório do `verifier`.
- **UI:** com o basic-host aberto, capturar uma screenshot de cada estado do formulário (vazio, preenchido, erro e sucesso) e anexar ao fechamento do épico.
- **Bug se corrige com teste primeiro:**
  1. escrever o teste que reproduz o bug e confirmar que ele falha pelo motivo certo;
  2. commitar o teste;
  3. `touch .claude/fix-mode`;
  4. corrigir o código **sem editar o teste**;
  5. `rm .claude/fix-mode`.
- **Regra de ouro:** se um teste falhar, corrija o código, não o teste; nunca pule nem apague teste que falha.

## 23. Riscos e mitigação

| Risco | Impacto | Prob. | Mitigação |
|---|---|---|---|
| OAuth Server do Supabase é beta e muda de comportamento | Alto: conector para de logar | Média | Isolar a verificação em `src/auth/`; acompanhar o changelog; a opção B (AS próprio) fica documentada como plano B |
| `aud` do token não é a URL do MCP (sem RFC 8707) | Médio: um token emitido para outro cliente OAuth do mesmo projeto seria aceito | Baixa (só há este cliente) | Exigir `client_id` presente; v2: allowlist de `client_id`s registrados ou Custom Access Token Hook |
| Testes de escrita em produção sem staging | Alto: dado de teste misturado ou registro gravado na conta errada | Média | Conta de teste dedicada, dados fictícios, limpeza ao fim, e o agente não grava em produção sem autorização no chat |
| Com HS256, o Supabase não emite ID token (`openid`); se o Claude ou o ChatGPT exigirem esse escopo, o login do conector falha | Alto: bloqueia o épico 3 | Baixa a média | Testar no épico 3. Se falhar, **parar e perguntar**: a migração de chaves exige antes trocar `verify_jwt` e verificar o token no código de `agente` e `notifica-admin`, num trabalho separado e aprovado |
| Trocar o DNS de `app.agendapsi.app.br` muda o destino do link de confirmação de conta | Médio: quem se cadastrar vê uma página nova depois de confirmar | Certa | A página `/` diz que o e-mail foi confirmado e manda voltar ao app (6.3); testar com um cadastro novo no épico 3 |
| Regras só no app divergem com o tempo | Médio: MCP e app gravam diferente | Média | Testes que leem os arquivos do app como texto; pergunta 25.2 (CHECKs no banco) |
| O host não suporta algum recurso do ext-apps (ex.: ChatGPT) | Médio | Média | Fallback 13.4; testar no ChatGPT no épico 7 |
| Modelo chama o fallback com `confirmar: true` sem mostrar a prévia | Alto | Baixa | `token_previa` obrigatório (13.4) |
| Dado de saúde vazando por observações | Alto (LGPD) | Baixa | P5 + teste automatizado + `REVIEW.md` |

## 24. Assunções declaradas
> Assunção não revisada vira verdade no minuto em que o agente começa a codar.

| # | Assunção | Por quê | Se discordar |
|---|---|---|---|
| 24.1 | Os testes manuais usam produção com uma conta de teste que o Alexandre cria antes do épico 1 | Sem staging, por decisão | Indicar outra conta |
| 24.2 | A UI dos formulários é TS puro, sem React | Bundle menor e menos dependência | Trocar por `@modelcontextprotocol/ext-apps/react` |
| 24.3 | As leituras são portadas (copiadas) do agente, não compartilhadas | Não mexer na função `agente` em produção | Extrair um módulo comum numa tarefa própria |
| 24.4 | Os eventos de analytics enviam `distinctId` = e-mail do usuário, como o app faz hoje | Paridade com o app | Enviar só o hash do `sub` |
| 24.5 | Excluir horário fixo é permitido (o agente já propõe) | Paridade | Tirar do épico 6 |
| 24.6 | Despesa aceita observações | Não é dado clínico | Tirar o campo |
| 24.7 | O conector do Claude e o do ChatGPT apontam para a mesma URL e o mesmo servidor | Simplicidade | — |
| 24.8 | Texto da página `/`: "E-mail confirmado. Volte ao app Agenda Psi e entre com seu e-mail e senha." | Substitui o app web antigo como destino do link de confirmação | Alexandre ajusta o texto |

## 25. Perguntas abertas
**O agente de código deve perguntar ao cruzar com qualquer item abaixo, nunca assumir.**

| # | Pergunta | Bloqueia | Quem decide |
|---|---|---|---|
| 25.1 | **Respondida em 15/11/2026:** em `https://app.agendapsi.app.br/oauth/consent`, servida pela Vercel junto com o servidor MCP; o domínio do app web antigo, que não é usado, é reaproveitado e a Site URL não muda (6.3). Pergunta original: ~~Onde mora a página de login e consentimento?~~ O authorization path do Supabase é relativo à Site URL de produção. Qual é a Site URL hoje? Dá para hospedar `/oauth/consent` nesse domínio? Opções: (a) uma página estática no domínio da Site URL; (b) mudar a Site URL para um domínio novo, o que afeta os e-mails do app; (c) uma página estática num domínio próprio, se o painel aceitar URL absoluta. **Verificar no painel antes de decidir.** | Épico 3 | Alexandre |
| 25.2 | As regras "só no app hoje" (11.4, 11.6, 11.7, 11.10, telefone) devem ganhar CHECK no banco (`NOT VALID`, sem tocar no legado)? Se sim, a migration é escrita e **mostrada** antes de aplicar. | Nada (opcional) | Alexandre |
| 25.3 | A política de privacidade do app precisa citar que, ao conectar o Claude ou o ChatGPT, dados de pacientes trafegam por esses provedores? | Épico 7 (publicação) | Alexandre |
| 25.4 | ~~Migrar para JWT Signing Keys assimétricas?~~ **Respondida em 15/11/2026: não migrar.** O projeto usa HS256 legado e o `agente` do app, muito usado, depende de `verify_jwt`. O MCP verifica o token pelo Supabase Auth (6.4). **Nada deste trabalho pode interferir no `agente` nem nas outras Edge Functions.** | — | Alexandre |
| 25.5 | ~~Allowlist de e-mails no conector?~~ **Respondida em 15/11/2026: não.** Qualquer usuário do app que logar pode usar; a RLS isola os dados de cada um. | — | Alexandre |

## 26. Definition of Done
- [ ] Épicos 0–7 com os critérios cumpridos, a saída dos comandos 22.1 colada e o `verifier` dizendo PRONTO.
- [ ] Parada do épico 3 aprovada pelo Alexandre.
- [ ] Nenhum arquivo em `app/` alterado (`git diff main --stat -- app/` vazio).
- [ ] Nenhuma `service_role` em `mcp-server/` (`grep -rn "service_role\|SERVICE_ROLE" mcp-server` vazio).
- [ ] Nada em `supabase/` alterado (`git diff main --stat -- supabase/` vazio).
- [ ] Nenhuma resposta de ferramenta com `observacoes` (teste automatizado verde).
- [ ] Toda função e ferramenta comentada em português, com a regra que implementa.
- [ ] `mcp-server/README.md` completo, com o roteiro de teste manual de **cada** ferramenta.
- [ ] `DOCUMENTACAO-TECNICA.md` com a seção "Servidor MCP" conferida contra o código.
- [ ] `CLAUDE.md` com a linha nova no mapa de pastas, ainda cabendo numa página.
- [ ] Guardrails do Anexo B instalados e cada hook testado uma vez.
- [ ] `plans/` com o plano aprovado de cada épico, coerente com o código.
- [ ] Conector testado no Claude web, no Claude desktop e no ChatGPT com a conta de teste, e a conta de teste limpa ao fim.
- [ ] Nenhuma migration aplicada sem aprovação.

## 27. Próximos passos operacionais
1. **Neste computador:** commit e push da branch `feature/mcp-server` com este spec.
2. **No outro computador:** `git fetch && git checkout feature/mcp-server`.
3. Alexandre: criar a **conta de teste** no app (produção) e pôr as credenciais em `mcp-server/.env.local`, que fica fora do git.
4. Alexandre: executar o checklist 6.5 antes do épico 3 (25.1, 25.4 e 25.5 respondidas em 15/11/2026). As outras perguntas podem esperar.
5. Colar o prompt do Anexo C no Claude Code.

## 28. Roadmap
- Observações e conteúdo clínico, com decisão de LGPD (P5).
- CIMD, quando o Supabase OAuth Server suportar.
- `aud` = URL do MCP via Custom Access Token Hook, ou allowlist de `client_id`.
- Tela no app para ver e revogar conectores autorizados.
- Módulo de leitura compartilhado entre o agente e o MCP.
- Template genérico deste servidor para o sistema da empresa: auth, molde de formulário, fallback e guardrails.

## 29. Protocolo de mudanças incrementais
1. Faça um commit de checkpoint antes de qualquer mudança.
2. Não cole o spec inteiro de novo: cole só o trecho alterado.
3. Escreva a instrução como diff ("o servidor já existe e funciona; mude só X").
4. Diga nominalmente o que **não** muda.
5. Peça o plano em plan mode e salve-o em `plans/<feature>.md`. Se for bug, o plano começa pelo teste que falha.
6. Revise o `git diff` contra o plano.
7. Atualize o `DOCUMENTACAO-TECNICA.md` no mesmo commit.

Modelo:
```
O servidor MCP em mcp-server/ já existe e funciona. Leia mcp-server/spec.md e CLAUDE.md.
Mudança: <descreva>. Não altere: app/, as outras ferramentas, src/auth/.
Entre em plan mode, liste arquivos e testes, salve em plans/<nome>.md e espere minha aprovação.
Atualize DOCUMENTACAO-TECNICA.md no mesmo commit.
```

---

## Anexo A — Fontes (consultadas em 15/11/2026)
- Versionamento do MCP: https://modelcontextprotocol.io/specification/versioning
- Changelog 2026-07-28: https://modelcontextprotocol.io/specification/2026-07-28/changelog
- Autorização MCP: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
- SDK TS v2, HTTP: https://ts.sdk.modelcontextprotocol.io/v2/serving/http
- SDK TS v2, autorização: https://ts.sdk.modelcontextprotocol.io/v2/serving/authorization
- ext-apps: https://github.com/modelcontextprotocol/ext-apps (spec `specification/2026-01-26/apps.mdx`)
- Quickstart do MCP Apps: https://apps.extensions.modelcontextprotocol.io/api/documents/quickstart.html
- MCP Apps no ChatGPT: https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt/
- Auth no ChatGPT: https://developers.openai.com/apps-sdk/build/auth
- Modo desenvolvedor do ChatGPT: https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt
- Auth de conectores no Claude: https://claude.com/docs/connectors/building/authentication
- Supabase OAuth Server: https://supabase.com/docs/guides/auth/oauth-server/getting-started
- Supabase OAuth + MCP: https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication
- Segurança de tokens no Supabase: https://supabase.com/docs/guides/auth/oauth-server/token-security
- MCP na Vercel: https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel
- Domínios na Vercel: https://vercel.com/docs/domains

## Anexo B — Kit de guardrails do Claude Code

O repositório ainda não tem `.claude/`. Os hooks dependem de `jq` (`brew install jq`). **O Claude Code carrega os hooks quando a sessão começa:** depois de criar o `.claude/settings.json`, a prova real dos hooks é feita numa sessão nova.

### `.claude/settings.json`
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-secrets.sh" },
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-app-scope.sh" },
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-migrations.sh" },
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-tests.sh" },
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-tool-schema.sh" }
        ]
      },
      {
        "matcher": "Bash|mcp__.*__(deploy_edge_function|apply_migration|create_deployment|request_promote|request_rollback|assign_alias|start_rolling_release|approve_rolling_release_stage|complete_rolling_release|create_project_env|edit_project_env|add_project_domain|verify_project_domain|update_project|create_project|create_git_project|pause_project|unpause_project|buy_domain|create_or_transfer_domain|create_record|update_record|replace_domain_dns_records|update_firewall_config|put_firewall_config|update_project_protection_bypass)",
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-production.sh" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/remind-advisors.sh" }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-bash-drift.sh" }
        ]
      }
    ]
  }
}
```

### `.claude/hooks/guard-secrets.sh`
```bash
#!/bin/bash
# Bloqueia credencial privilegiada no app (bundle) e em qualquer arquivo do servidor MCP.
# Implementa P1 e a seção 20 do mcp-server/spec.md, e a pegadinha 4 do CLAUDE.md.
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Rode brew install jq antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')

case "$path" in
  */app/src/*|*/app/app/*|*/mcp-server/*) ;;
  *) exit 0 ;;
esac
# O próprio spec cita os nomes para proibi-los; ele não é código.
case "$path" in
  */mcp-server/spec.md|*/plans/*) exit 0 ;;
esac

if echo "$content" | grep -qE 'service_role|SERVICE_ROLE|N8N_WEBHOOK_SECRET|PLAY_PUSH_TOKEN|sb_secret_'; then
  echo "Bloqueado: credencial privilegiada em $path. O servidor MCP usa só o JWT do usuário e a chave publicável (spec seção 0, P1, e seção 20). Se a operação parece exigir service_role, pare e pergunte ao Alexandre." >&2
  exit 2
fi
exit 0
```

### `.claude/hooks/guard-app-scope.sh`
```bash
#!/bin/bash
# Impede alterar o app e qualquer coisa do Supabase (funções, config.toml, migrations)
# enquanto o trabalho é o servidor MCP. Protege o agente, muito usado em produção.
# Implementa a regra de escopo da seção 4.2 e a decisão 25.4 do mcp-server/spec.md.
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Rode brew install jq antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
branch=$(git -C "$CLAUDE_PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null)

case "$branch" in feature/mcp-server*) ;; *) exit 0 ;; esac
case "$path" in
  */app/*|*/supabase/*)
    echo "Bloqueado: na branch $branch não se altera o app nem nada em supabase/ (spec 4.2 e 25.4). Copie a regra para mcp-server/src/rules/ com teste, ou pare e pergunte." >&2
    exit 2 ;;
esac
exit 0
```

### `.claude/hooks/guard-migrations.sh`
```bash
#!/bin/bash
# Impede editar uma migration já versionada; mudança de schema vira migration nova e aprovada.
# Implementa a seção 7 do mcp-server/spec.md.
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Rode brew install jq antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

case "$path" in
  */supabase/migrations/*|*/supabase/migrations-pendentes/*) ;;
  *) exit 0 ;;
esac

rel="${path#"$CLAUDE_PROJECT_DIR"/}"
if git -C "$CLAUDE_PROJECT_DIR" ls-files --error-unmatch "$rel" >/dev/null 2>&1; then
  echo "Bloqueado: $rel já está versionada. Crie uma migration nova e mostre ao Alexandre antes de aplicar (spec seção 7)." >&2
  exit 2
fi
exit 0
```

### `.claude/hooks/guard-tests.sh`
```bash
#!/bin/bash
# Em modo correção (.claude/fix-mode), impede editar testes para "fazer passar".
# Implementa a seção 22.1 do mcp-server/spec.md.
[ -f "$CLAUDE_PROJECT_DIR/.claude/fix-mode" ] || exit 0
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Rode brew install jq antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

case "$path" in
  *.test.ts|*.test.tsx|*.spec.ts|*/__tests__/*|*/mcp-server/test/*|*/supabase/tests/*)
    echo "Bloqueado: modo de correção ativo (.claude/fix-mode). Corrija o código, não o teste (seção 22.1). Se o teste estiver errado de fato, pare e explique ao Alexandre." >&2
    exit 2 ;;
esac
exit 0
```

### `.claude/hooks/guard-tool-schema.sh`
```bash
#!/bin/bash
# Impede declarar usuario_id como argumento de ferramenta MCP: o usuário vem do JWT.
# Implementa P1 do mcp-server/spec.md e a pegadinha 3 do CLAUDE.md.
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Rode brew install jq antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')

case "$path" in
  */mcp-server/src/tools/*) ;;
  *) exit 0 ;;
esac
# Procura usuario_id como chave de schema zod ou propriedade de entrada.
if echo "$content" | grep -qE 'usuario_id\s*:\s*z\.|["'\'']usuario_id["'\'']\s*:\s*\{'; then
  echo "Bloqueado: usuario_id declarado como entrada de ferramenta em $path. O usuário vem do JWT (sub), nunca do argumento (P1, pegadinha 3)." >&2
  exit 2
fi
exit 0
```

### `.claude/hooks/guard-production.sh`
```bash
#!/bin/bash
# Nada sai para produção sem o Alexandre. O servidor MCP mora na Vercel, então nenhuma
# Edge Function é publicada nesta branch: `supabase functions deploy` sem nome republica
# TODAS, inclusive o agente, que é muito usado. `supabase config push` sobrescreveria a
# auth de produção com o config.toml local. Na Vercel, produção, variáveis e domínios
# são do Alexandre. Implementa a regra 6.5 e a decisão 25.4 do mcp-server/spec.md.
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Rode brew install jq antes de continuar." >&2; exit 2; }
input=$(cat)
tool=$(echo "$input" | jq -r '.tool_name // empty')

block() { echo "Bloqueado: $1 Pare e peça ao Alexandre (spec 6.5 e 25.4)." >&2; exit 2; }

case "$tool" in
  *__deploy_edge_function) block "deploy de Edge Function. O servidor MCP roda na Vercel; nenhuma função do Supabase é publicada nesta branch." ;;
  *__apply_migration)      block "migration via MCP do Supabase. Este trabalho não muda o banco." ;;
  # MCP da Vercel (acrescentado em 15/11/2026): o mesmo que a CLI abaixo, pelo outro
  # caminho. Projeto, variáveis e domínio foram criados uma vez, com ordem explícita do
  # Alexandre; daqui em diante, qualquer mudança desse tipo volta a passar por ele.
  *__create_deployment|*__request_promote|*__request_rollback|*__assign_alias|*__start_rolling_release|*__approve_rolling_release_stage|*__complete_rolling_release)
    block "deploy, promoção, rollback ou alias de produção na Vercel pelo MCP." ;;
  *__create_project_env|*__edit_project_env|*__add_project_domain|*__verify_project_domain|*__update_project|*__create_project|*__create_git_project|*__pause_project|*__unpause_project)
    block "mudança de projeto, variáveis ou domínio na Vercel pelo MCP." ;;
  *__buy_domain|*__create_or_transfer_domain|*__create_record|*__update_record|*__replace_domain_dns_records|*__update_firewall_config|*__put_firewall_config|*__update_project_protection_bypass)
    block "domínio, DNS, firewall ou proteção na Vercel pelo MCP." ;;
esac

cmd=$(echo "$input" | jq -r '.tool_input.command // empty')
has() { echo "$cmd" | grep -qE "$1"; }

has '\bsupabase[[:space:]]+functions[[:space:]]+(deploy|delete)\b' && block "'supabase functions deploy/delete'. Sem nome, o deploy republica todas as funções, inclusive o agente."
has '\bsupabase[[:space:]]+config[[:space:]]+push\b'  && block "'supabase config push' sobrescreve a configuração de auth de produção."
has '\bsupabase[[:space:]]+db[[:space:]]+push\b'      && block "'supabase db push' aplica migrations em produção."
has '\bsupabase[[:space:]]+secrets[[:space:]]+(set|unset)\b' && block "'supabase secrets' altera segredos de todas as funções do projeto."
has '\bvercel\b.*(--prod\b|[[:space:]]promote\b|[[:space:]]rollback\b)' && block "deploy de produção na Vercel. Produção sai pelo push na Production Branch, com o Alexandre."
has '\bvercel[[:space:]]+(env|domains|dns|alias|certs|project[[:space:]]+rm|remove|rm)\b' && block "mudança de variáveis, domínio ou projeto na Vercel."
exit 0
```

### `.claude/hooks/guard-bash-drift.sh`
```bash
#!/bin/bash
# Fecha a brecha dos hooks de Write/Edit: um comando Bash (sed -i, cat >) também edita
# arquivos. Depois de cada Bash, confere se algo mudou em app/ ou supabase/ e se entrou
# credencial privilegiada em mcp-server/. Roda depois do comando, então avisa, não impede.
# Implementa a regra de escopo 4.2, a decisão 25.4 e P1 do mcp-server/spec.md.
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Rode brew install jq antes de continuar." >&2; exit 2; }
cd "$CLAUDE_PROJECT_DIR" || exit 0
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
case "$branch" in feature/mcp-server*) ;; *) exit 0 ;; esac

drift=$(git status --porcelain -- app/ supabase/)
if [ -n "$drift" ]; then
  echo "ALERTA: o último comando alterou app/ ou supabase/, o que é proibido nesta branch (spec 4.2 e 25.4):" >&2
  echo "$drift" >&2
  echo "Pare. Desfaça (git checkout -- <arquivo> ou rm do arquivo novo) e explique ao Alexandre." >&2
  exit 2
fi

# `sb_secret_` só conta seguido de caracteres de chave: o supabase-js embutido nas páginas
# do site (public/) tem o PREFIXO como texto, numa checagem de formato, sem chave nenhuma.
# Ajuste autorizado pelo Alexandre em 15/11/2026 (épico 3).
leak=$(grep -rlE 'service_role|SERVICE_ROLE|sb_secret_[A-Za-z0-9]|N8N_WEBHOOK_SECRET|PLAY_PUSH_TOKEN' mcp-server \
  --exclude=spec.md --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.vercel 2>/dev/null)
if [ -n "$leak" ]; then
  echo "ALERTA: credencial privilegiada em: $leak. O servidor MCP usa só o JWT do usuário e a chave publicável (P1). Remova e explique ao Alexandre." >&2
  exit 2
fi
exit 0
```

### `.claude/hooks/remind-advisors.sh`
```bash
#!/bin/bash
# Depois de escrever uma migration, lembra de mostrar ao Alexandre e rodar os advisors.
# Implementa as seções 7 e 20 do mcp-server/spec.md.
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Rode brew install jq antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
case "$path" in
  */supabase/migrations/*)
    echo "Migration escrita. NÃO aplique sem a aprovação do Alexandre. Depois de aplicada, rode get_advisors (security e performance) e resolva alertas críticos (spec seção 20)." >&2
    exit 2 ;;
esac
exit 0
```

### `.claude/agents/verifier.md`
```markdown
---
name: verifier
description: Confere em contexto limpo se o épico do servidor MCP cumpre os critérios do mcp-server/spec.md. Use ao terminar cada épico, antes de declarar pronto.
tools: Bash, Read, Grep
---
Você verifica; não corrige nada.

1. Leia em mcp-server/spec.md a seção 8.X do épico indicado, os princípios da seção 0, a matriz da seção 5 e as regras da seção 11 que o épico toca.
2. Leia o plano correspondente em plans/ e o git diff do épico (git diff main...HEAD).
3. Em mcp-server/, rode npm test, npm run typecheck e npm run build, e guarde a saída.
4. Para cada critério de aceite: cumprido / não cumprido / não verificável, sempre com evidência (saída de comando ou arquivo:linha).
5. Confira:
   (a) nenhum inputSchema tem usuario_id;
   (b) nenhuma resposta inclui observacoes;
   (c) nenhuma referência a service_role;
   (d) git diff main --stat -- app/ supabase/ está vazio;
   (e) literais e mensagens de 11.x são idênticos aos do app;
   (f) nenhum log imprime argumentos ou resultados.
6. Liste as divergências entre o diff e o plano.

Termine com uma linha: PRONTO ou NÃO PRONTO, e os itens que impedem.
```

### `REVIEW.md`
```markdown
# Instruções de revisão — servidor MCP

## Passes
Faça três passes e marque cada achado com o passe:
- Bugs: lógica, caso de borda (fuso de São Paulo, dia 1–7, valor com centavos, paciente ambíguo), regressão.
- Segurança: só o JWT do usuário e a RLS (P1); sem service_role; usuario_id nunca como argumento; nada de observacoes (P5); nada de PII em log; fallback só grava com token_previa válido (13.4).
- Conformidade: bate com mcp-server/spec.md (épicos da seção 8, regras da seção 11, contratos da seção 13) e com o plano em plans/; app/ e supabase/ intocados; rotinas comentadas em português com a regra que implementam.

## O que é Importante
O que grava diferente do app, vaza dado ou viola o spec. Estilo é detalhe.

## Limite de detalhes
No máximo cinco detalhes por revisão; resuma o resto como contagem.

## Não reportar
Arquivos gerados (dist/, database.types.ts, .vercel/).
```

## Anexo C — Prompt de implementação (colar no Claude Code do outro computador)

```
Estou na branch feature/mcp-server do repositório agenda-psi. Leia por inteiro:
mcp-server/spec.md (o spec deste trabalho) e CLAUDE.md (as sete pegadinhas valem aqui).

Regras:
- Entre em plan mode. Para cada épico, monte o plano (arquivos que mudam, ordem,
  riscos, testes que provam) e mostre para aprovação ANTES de codar. Salve o plano
  aprovado em plans/<epico>.md e commite; se a implementação divergir, atualize o
  plano no mesmo commit.
- Ordem: épico 0 (guardrails do Anexo B: criar .claude/settings.json, .claude/hooks/,
  .claude/agents/verifier.md e REVIEW.md, chmod +x nos scripts e provocar cada hook
  uma vez), depois os épicos 1, 2 e 3. PARE depois do épico 3 e me mostre a despesa
  funcionando no Claude. Só siga para os épicos 4 a 7 com a minha aprovação.
- Escopo: só mcp-server/, .claude/, REVIEW.md, plans/ e, no fim, DOCUMENTACAO-TECNICA.md
  e uma linha no CLAUDE.md. O servidor e a página de login rodam na Vercel. NÃO altere
  app/ nem nada em supabase/: o agente do app é muito usado em produção. NÃO
  implemente nada da seção 28 (roadmap) nem o que está "Fora" na seção 3.
- Desempate: os princípios da seção 0 (P1 a P5).
- Banco em português como já está; código e variáveis em inglês; nomes de ferramenta
  em português. Comente toda função e ferramenta em português, dizendo o que faz e
  qual regra do spec implementa (ex.: "regra 11.4").
- Siga literalmente as tabelas das seções 5, 11 e 13. Copie literais e mensagens do
  app byte a byte, com teste. Não invente valor nem mensagem.
- Antes de fixar versões, confira no npm @modelcontextprotocol/server,
  @modelcontextprotocol/ext-apps e zod, e confira a API real na documentação atual.
- Nunca use service_role. Nunca altere configuração do projeto Supabase de produção:
  prepare o checklist 6.5 e me peça para executar. Nenhuma migration sem me mostrar.
- Testes de escrita só com a conta de teste (mcp-server/.env.local) e só com a minha
  autorização no chat. Não há ambiente de staging.
- Ao fechar cada épico: rode npm test, npm run typecheck e npm run build em
  mcp-server/ e cole a saída; acione o subagente verifier e só avance com PRONTO;
  revise o próprio diff contra REVIEW.md e plans/.
- Se um teste falhar, corrija o código, não o teste. Bug se corrige com teste que
  falha primeiro.
- Diante de qualquer item da seção 25 (Perguntas abertas), PERGUNTE em vez de assumir.
- No fim (épico 7), escreva o mcp-server/README.md completo e a seção "Servidor MCP"
  no DOCUMENTACAO-TECNICA.md, a partir do que foi realmente implementado.
```
