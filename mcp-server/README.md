# Servidor MCP do Agenda Psi

Conector que deixa o psicólogo consultar e registrar no Agenda Psi pelo Claude ou pelo ChatGPT. Ele é o mesmo banco do app, com a mesma RLS e o mesmo login. O spec é [`spec.md`](spec.md), e a seção "Servidor MCP" do [`DOCUMENTACAO-TECNICA.md`](../DOCUMENTACAO-TECNICA.md) explica tabelas, policies e a lógica de cada ferramenta.

- **Endereço do conector:** `https://app.agendapsi.app.br/mcp`
- **Como funciona:** toda gravação abre um **formulário** dentro da conversa (MCP Apps), já preenchido com o que a pessoa disse. Nada é gravado sem o clique em Salvar. Clientes sem formulário usam o caminho `registrar_*`: prévia, depois confirmação com `token_previa`.
- **Privacidade:** ao conectar, nomes de pacientes, telefones, datas, valores e a agenda passam a trafegar pelo provedor do assistente (Anthropic ou OpenAI). **Observações clínicas nunca saem** (P5): o servidor não lê essa coluna em nenhuma ferramenta.

## Rodar localmente

```bash
cd mcp-server && npm install
cp .env.example .env.local    # preencha: chave publicável, conta de teste, MCP_PREVIEW_SECRET
npm run dev                   # http://localhost:3333/mcp (monta os formulários antes)
```

**Token de desenvolvimento.** `npm run dev:token` entra com a conta de teste e imprime um access token. O servidor local só aceita esse token (que não tem `client_id`) com `MCP_DEV_ALLOW_SESSION_TOKEN=1`, e recusa a flag se estiver na Vercel.

**MCP Inspector:**
```bash
npx @modelcontextprotocol/inspector
```
- Transporte: Streamable HTTP, URL `http://localhost:3333/mcp`.
- Header: `Authorization: Bearer <token do dev:token>`.
- Sem o header, o servidor responde 401 com `WWW-Authenticate` apontando para o metadata do OAuth.
- O Inspector não anuncia MCP Apps. Se o pedido dele vier sem capacidades, o servidor manda as leituras, os formulários e os `registrar_*`; se vier dizendo que não tem MCP Apps, só as leituras e os `registrar_*`.

**basic-host do ext-apps (para ver os formulários):**
- Clone `github.com/modelcontextprotocol/ext-apps` num diretório temporário e rode `examples/basic-host`.
- Em outro terminal, rode `npm run dev:proxy`. O proxy escuta em `127.0.0.1:3001`, entra com a conta de teste, injeta o token e libera o CORS só para o basic-host.
- Aponte o basic-host para `http://localhost:3001/mcp`.

**Comandos de conferência (22.1):**
```bash
npm test && npm run typecheck && npm run build
```
O `build` precisa de `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` no ambiente, para montar a página de login.

## Deploy

A Vercel publica sozinha a cada push na *Production Branch*. Durante o desenvolvimento ela é `feature/mcp-server`; depois do merge, volta a ser `main`.

- O `ignoreCommand` do [`vercel.json`](vercel.json) só publica quando `mcp-server/` muda.
- **Variáveis na Vercel:** `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `MCP_PUBLIC_URL` (`https://app.agendapsi.app.br/mcp`), `MCP_PREVIEW_SECRET` (Sensitive, 32+ caracteres, diferente do local) e, opcionais, `VISAODEPRODUTO_KEY` e `VISAODEPRODUTO_URL`.
- **Nunca** cadastre `MCP_DEV_ALLOW_SESSION_TOKEN` na Vercel.

**Depois de um deploy que mudou um formulário:** o Claude guarda o HTML do formulário por endereço. O endereço já muda com o conteúdo (`ui://agenda-psi/<nome>-<hash>.html`), mas uma conversa já aberta continua com o antigo. **Teste sempre numa conversa nova.**

## Checklist de produção (6.5), feito pelo Alexandre

1. JWT Signing Keys: **não migrar** (25.4). O projeto usa HS256 legado, e `agente` e `notifica-admin` dependem de `verify_jwt`.
2. Vercel: projeto `agenda-psi-mcp`, com Root Directory `mcp-server/`, as variáveis acima e o *Ignored Build Step*.
3. Vercel → Domains: `app.agendapsi.app.br`.
4. Registro.br: o CNAME de `app` aponta para o registro que a Vercel pediu.
5. Conferir que `https://app.agendapsi.app.br/` abre a página do conector e que `/oauth/consent` abre a página de login.
6. Supabase → Authentication → OAuth Server: ligado, com **Dynamic Client Registration** ligado e *authorization path* `/oauth/consent`. A Site URL não muda.
7. Redirect URIs: com DCR, cada cliente registra as suas.

**Por que o servidor anuncia o próprio domínio como emissor OAuth:** o Supabase com HS256 recusa o escopo `openid` ("HS256 is not supported for ID token signing"), e o Claude sempre pede `openid`. Só `/oauth/authorize` passa pelo servidor, que redireciona para o Supabase sem o `openid`. Token, registro de cliente e JWKS vão direto ao Supabase.

## Conectar como conector personalizado

**Claude (web e desktop):**
1. Settings → Connectors → *Add custom connector*.
2. Nome "Agenda Psi", URL `https://app.agendapsi.app.br/mcp`.
3. *Connect* → login do app → *Permitir*.

O desktop usa o mesmo conector da conta.

**ChatGPT (modo desenvolvedor):**
1. Settings → Apps & Connectors → *Advanced* → ligar o *Developer mode*.
2. *Create* → URL `https://app.agendapsi.app.br/mcp`, autenticação OAuth.
3. Login do app → *Permitir*.

O servidor não tem código específico de ChatGPT:
- se o cliente anuncia MCP Apps, recebe só os formulários;
- se diz que não tem, só os `registrar_*`;
- se não diz nada, recebe os dois.

**Desconectar:** remover o conector no cliente. Para revogar o acesso de vez, troque a senha no app ou peça ao Alexandre para revogar o cliente OAuth no painel do Supabase.

## Roteiro de teste manual

Use a **conta de teste**, sempre numa **conversa nova**. Para cada ferramenta: a frase de exemplo, o que deve abrir, o que conferir no app e um caso de erro. Os registros de teste ficam no banco.

### Leituras

| Ferramenta | Frase | Deve responder | Conferir no app | Caso de erro |
|---|---|---|---|---|
| `buscar_paciente` | "Qual o telefone da Beatriz?" | Telefone e e-mail; sem observações | Ficha do paciente | "da Ana", com duas Anas: pede para escolher |
| `historico_do_paciente` | "Como está a Beatriz?" | Sessões, pagamentos, preço atual | Detalhe do paciente | Nome que não existe: diz que não achou |
| `listar_pacientes` | "Quais pacientes estão ativos?" | Lista com contagem | Aba Pacientes | "Quais estão suspensos?" (status fora de ativo/inativo): o modelo recebe erro de entrada e pergunta de novo |
| `consultar_mes` | "Quanto recebi este mês?" | Recebido e pendente do mês | Home (indicadores) | "mês 13": data inválida |
| `consultar_periodo` | "Quanto recebi de agosto a outubro?" | Totais por mês | Home, mês a mês | Período invertido |
| `agenda_do_dia` | "Qual a minha agenda de hoje?" | Horários do dia | Aba Agenda | Dia sem ninguém: lista vazia |
| `agenda_da_semana` | "Como está a semana?" | Horários por dia | Aba Agenda | Data inválida ("semana de 31/02"): erro curto, sem dados |
| `listar_pendencias` | "Quem não me pagou?" | Pacientes com pendência e total | Home → Pendências | Ninguém devendo: lista vazia, sem inventar nome |
| `consultar_despesas` | "Quanto gastei com aluguel?" | Total e lista | Aba Despesas | Tipo inexistente: diz qual não casou |

### Registros (abrem formulário)

| Ferramenta | Frase | Deve abrir | Conferir no app depois do Salvar | Caso de erro |
|---|---|---|---|---|
| `abrir_formulario_despesa` | "Paguei 1450 de aluguel hoje" | Despesa com tipo, valor e data | Aba Despesas | Valor "1450,50": erro no campo |
| `abrir_formulario_sessoes` | "Atendi a Beatriz e o Caio hoje; a Beatriz pagou" | Duas linhas; a da Beatriz como Pagou | Sessões de cada um; o botão "Registrar também o pagamento" abre o pagamento como Por sessão | Duração 0: "Informe a duração em minutos, de 1 a 600" |
| `abrir_formulario_pagamento` | "A Beatriz pagou 280" | Pagamento com 280 e Mensal | Pagamentos da Beatriz | Paciente ambíguo: seletor vazio com aviso |
| `abrir_formulario_paciente` | "Cadastra a Laura Mendes, 11 99999-0000, 200 por sessão, quartas às 10h" | Cadastro com um horário (fim 10:50) | Ficha da Laura com preço; Agenda de quarta | Sem telefone: o botão fica desabilitado |
| `abrir_formulario_horario` | "Põe o Caio toda quinta às 9h" | Horário com fim 09:50 | Agenda de quinta | Coincide com outro: aviso, sem bloquear |
| `abrir_formulario_feedback` | "O app travou ao salvar uma sessão" | Categoria Problema e o texto | Painel de feedback: "[Problema · via conector] …" | Mensagem vazia: "Escreva a mensagem" |

### Edições e exclusões (épico 6)

| Ferramenta | Frase | Deve abrir | Conferir no app | Caso de erro |
|---|---|---|---|---|
| `abrir_formulario_edicao_sessao` | "A sessão da Beatriz de terça foi remota" | Sessão escolhida, data só leitura, "Antes: Presencial" | Detalhe da sessão | Sem data dita: lista as 6 últimas |
| `abrir_formulario_exclusao_sessao` | "Apaga a sessão do Caio de ontem" | Registro + "Excluir sessão" → "Excluir definitivamente" | A sessão some | Conta demo: "Esta conta de demonstração não permite excluir registros." |
| `abrir_formulario_edicao_pagamento` | "O pagamento da Beatriz de ontem era 300" | Valor 300, "Antes: R$ 280", competência só leitura | Detalhe do pagamento | Salvar sem mudar nada: "Nada mudou no registro" |
| `abrir_formulario_exclusao_pagamento` | "Apaga o pagamento duplicado da Beatriz" | Lista para escolher | O pagamento some | Clicar "Excluir pagamento" só pede a confirmação; nada some antes de "Excluir definitivamente" |
| `abrir_formulario_edicao_despesa` | "O aluguel deste mês era 1500" | Valor 1500 e "Antes" | Detalhe da despesa | Valor "1500,50": "Informe um valor inteiro, sem centavos. Ex: 200" |
| `abrir_formulario_exclusao_despesa` | "Apaga a despesa de Uber de ontem" | Registro e confirmação dupla | A despesa some | Cancelar na confirmação volta um passo; Cancelar de novo fecha sem apagar |
| `abrir_formulario_edicao_paciente` | "A Beatriz agora paga 320" | Preço 320 com o aviso de vigência | Histórico de preços com linha nova | E-mail inválido: "Digite um e-mail válido" |
| `abrir_formulario_troca_horario` | "O Caio passou de quinta 9h para sexta 10h" | Horário atual + novo, fim mantendo a duração | Agenda: sai quinta, entra sexta | Coincide com outro: aviso |
| `abrir_formulario_remocao_horario` | "O Caio parou de vir às sextas" | Horário + "Tirar da agenda" → "Excluir definitivamente" | A agenda de sexta sem o Caio; o paciente continua | Conta demo: "Esta conta de demonstração não permite excluir registros." |

### Sem formulário (`registrar_*`)

No Inspector, cada `registrar_*` funciona em duas chamadas:
1. Sem `confirmar`: devolve `previa` e `token_previa`, e não grava.
2. Com `confirmar: true` e o mesmo `token_previa`: grava.

Casos de erro que valem para todos:
- dados diferentes dos da prévia: "Os dados mudaram desde a prévia…";
- token vencido (10 min) ou adulterado: recusado;
- pendência aberta (paciente ou registro a escolher): recusado até a escolha vir em `paciente_id` ou `registro_id`.

| Ferramenta | Chamada 1 (argumentos) | A prévia deve trazer | Caso de erro |
|---|---|---|---|
| `registrar_despesa` | `{tipo: "aluguel", valor: 1450}` | Tipo, valor, competência | Dois tipos "aluguel": pendência de tipo |
| `registrar_sessoes` | `{itens: [{paciente: "beatriz", pagamento: "pagou"}]}` | Paciente, data de hoje, Pagou | `duracao_minutos: 0`: erro no campo |
| `registrar_pagamentos` | `{itens: [{paciente: "beatriz"}]}` | Valor do cadastro, marcado como sugerido | Paciente sem preço e sem valor: erro de valor |
| `registrar_paciente` | `{nome: "Laura", telefone: "11 9", preco: 200, horarios: [{dia: "quarta", hora_inicio: "10:00"}]}` | Cadastro e "Quarta 10:00–10:50" | Sem telefone: erro, sem token |
| `registrar_horarios` | `{itens: [{paciente: "caio", dia: "quinta", hora_inicio: "09:00"}]}` | Horário e aviso de coincidência | Sem dia: "dia ou hora inválidos" |
| `registrar_feedback` | `{categoria: "problema", mensagem: "Travou"}` | "[Problema · via conector] Travou" | Mensagem vazia: erro |
| `registrar_edicao_sessao` | `{paciente: "beatriz", data: "<dia>", modalidade: "remota"}` | Antes e depois da modalidade | Sem data, com várias sessões: pendência de registro |
| `registrar_exclusao_sessao` | `{paciente: "beatriz", data: "<dia>"}` | O registro e `apaga: true` | Conta demo: a mensagem da 12 na chamada 2 |
| `registrar_edicao_pagamento` | `{paciente: "beatriz", data: "<dia>", valor: 300}` | Valor antes e depois | Mesmo valor: "Nada mudou no registro" |
| `registrar_exclusao_pagamento` | `{paciente: "beatriz", valor: 280}` | O registro | Vários de 280: pendência de registro |
| `registrar_edicao_despesa` | `{tipo_atual: "aluguel", valor: 1500}` | Valor antes e depois | Nenhuma despesa: "Nenhuma despesa registrada ainda." |
| `registrar_exclusao_despesa` | `{tipo: "uber", data: "<dia>"}` | O registro | — igual à exclusão de sessão |
| `registrar_edicao_paciente` | `{paciente: "beatriz", preco: 320}` | Preço antes e depois | E-mail inválido: erro no campo |
| `registrar_troca_horario` | `{paciente: "caio", dia_atual: "quinta", novo_dia: "sexta"}` | Horário antes e depois e aviso de coincidência | Repetir a chamada depois de falha parcial não duplica o horário novo |
| `registrar_remocao_horario` | `{paciente: "caio", dia: "sexta"}` | O registro | Conta demo: a mensagem da 12 |
