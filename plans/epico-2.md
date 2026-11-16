# Épico 2 — Registrar despesa de ponta a ponta (local)

## Contexto
Seção 8.2 do `mcp-server/spec.md`. É a primeira gravação, e serve de molde para as outras ações (épicos 5 e 6). Três peças:
1. `abrir_formulario_despesa`, visível ao modelo, abre o formulário MCP Apps já preenchido;
2. o formulário (`ui://agenda-psi/despesa.html`) salva por `salvar_despesa`, que só o app vê;
3. `registrar_despesa` é o fallback com prévia e `token_previa`, para clientes sem MCP Apps (13.4).

O servidor revalida tudo (P3) e grava as mesmas colunas e os mesmos valores que `useCriarDespesa` do app (P4).

## Premissas conferidas (15/11/2026)

| Premissa | O que foi conferido | Resultado |
|---|---|---|
| Como saber se o cliente tem MCP Apps num servidor stateless (13.4) | SDK v2 e ext-apps | Na revisão 2026-07-28, **cada request** traz as capacidades em `params._meta["io.modelcontextprotocol/clientCapabilities"]`, e `getUiCapability(caps)` do ext-apps lê a extensão `io.modelcontextprotocol/ui`. O `app.ts` lê o corpo uma vez e entrega o resultado à fábrica. **Clientes de 2025 não repetem as capacidades a cada request**, e no modo stateless o `initialize` não fica guardado. Por isso, para eles o servidor não sabe se há UI e registra o fallback (leitura literal da 13.4: "não anuncia"). Confirmar no épico 3 como o Claude e o ChatGPT se identificam. |
| API do formulário | `ext-apps/dist/src/app.d.ts` | `new App(...)` com `ontoolresult`, `onhostcontextchanged` e `onteardown` registrados **antes** de `connect()`. Depois, `callServerTool`, `updateModelContext({ content })` e `getHostContext()`. Tema: `applyDocumentTheme` e `applyHostStyleVariables`. |
| Registro | `ext-apps/server` | `registerAppTool(server, nome, { _meta: { ui: { resourceUri, visibility } } }, cb)` e `registerAppResource(server, nome, uri, { mimeType: RESOURCE_MIME_TYPE }, cb)`. O CSP padrão já é `connect-src 'none'`. |
| Build da UI | npm | `vite` 8.3.8 e `vite-plugin-singlefile` 2.3.4 (aceita vite 8). |
| Colunas gravadas (P4) | `app/src/features/expenses/use-expenses.ts:127-135` | `usuario_id`, `tipo_despesa_id`, `valor_despesa`, `data_competencia`, `pago_em` (ISO de agora), `status = 'pago'`, `descricao` e `observacoes`. `metodo` não é gravado. |
| Evento (21) | `use-expenses.ts:144-150` e `app/src/lib/analytics/client.ts` | `POST <VISAODEPRODUTO_URL>` com `x-api-key` e `{ eventos: [{ id: <id da despesa>, nome: 'agenda_psi_novadespesa', distinct_id: <e-mail>, ocorrido_em, tela, descricao: 'nova despesa criada', propriedades: {} }] }`. A `tela` é `mcp_despesa` (21). O e-mail vem do claim `email` do token (24.4). |
| basic-host | npm e GitHub | **Não é publicado no npm.** Fica em `examples/basic-host` do repositório oficial `github.com/modelcontextprotocol/ext-apps` (ver pergunta 2). |

## Arquivos

| Arquivo | O que faz | Regra |
|---|---|---|
| `src/tools/expense/schema.ts` | Schema zod de `salvar_despesa` e de `registrar_despesa`, compartilhado com o formulário. Campos com o nome da coluna (`tipo_despesa_id`, `valor_despesa`, `data_competencia`, `descricao`, `observacoes`), sem camada de tradução | 18 |
| `src/tools/expense/validate.ts` | Validação pura: obrigatórios, 11.1/11.2, 11.3, tamanhos (descrição 200, observações 1000) e formato uuid do tipo. Devolve `{ erros: [{ campo, mensagem }] }` | 11, P3 |
| `src/tools/expense/resolve-type.ts` | Regra 11.15 (porta de `proporDespesas`): substring sem acento; exatamente 1 → ok; senão o tipo começa vazio e os candidatos viram aviso | 11.15 |
| `src/tools/expense/open-form.ts` | `abrir_formulario_despesa` (modelo, `registerAppTool`): normaliza os argumentos, data padrão = hoje em SP e `structuredContent` com o pré-preenchimento e os avisos. A descrição diz que nada é gravado até a pessoa clicar em Salvar (9.2) | 8.2, 9.2 |
| `src/tools/expense/options.ts` | `listar_tipos_despesa`, já existente | — |
| `src/tools/expense/save.ts` | `salvar_despesa` (só app): revalida, confere o tipo em `tipos_despesa` (inexistente ou inativo vira erro de campo), insert igual ao do app, `{ ok, ids, resumo }`, evento. Erro do banco vira a mensagem geral da 12 | 8.2, 12, P3, P4 |
| `src/tools/expense/fallback.ts` | `registrar_despesa` (modelo, só sem UI): chamada 1 devolve `previa`, `pendencias` e `token_previa`; chamada 2 com `confirmar: true` grava pelo mesmo caminho de `save.ts` | 13.4 |
| `src/tools/expense/resource.ts` | `registerAppResource` de `ui://agenda-psi/despesa.html`, com o HTML embutido | 13.1 |
| `src/preview-token.ts` | HMAC-SHA256(`MCP_PREVIEW_SECRET`) de `sub + acao + JSON canônico + exp`, com 10 min e comparação em tempo constante | 13.4 |
| `src/analytics.ts` | Envio para o Visão do Produto com o mesmo contrato do app: dispara e esquece, falha nunca quebra a gravação, propriedades fechadas | 21, pegadinha 5 |
| `src/events.ts` | `agenda_psi_novadespesa` (e os outros quatro), com teste lendo `app/src/lib/analytics/events.ts` byte a byte | 21 |
| `src/client-capabilities.ts` | Lê as capacidades do corpo do request e diz se o cliente tem MCP Apps | 13.4 |
| `src/app.ts`, `src/handler.ts`, `src/config.ts`, `src/tools/index.ts` | Alterados: passam `clienteTemUi`, `email` e as variáveis novas (`MCP_PREVIEW_SECRET` obrigatória; `VISAODEPRODUTO_*` opcionais) | — |
| `src/rules/messages.ts` | Mensagens novas (ver pergunta 1) e a copy da tela de despesa do app, byte a byte | 15 |
| `ui/shared/` | Bootstrap do `App`, tema do host e componentes de campo (rótulo, erro com `aria-describedby`, 44 px) | 16, 17 |
| `ui/expense/index.html`, `ui/expense/main.ts`, `ui/expense/state.ts` | O formulário e a máquina de estados da 12 (carregando, erro ao carregar com "Tentar de novo", pronto, salvando, sucesso trancado, erro de validação). `state.ts` é puro e testado | 8.2, 12 |
| `vite.config.ts`, `scripts/embed-ui.ts` | `vite build` com singlefile, gerando `ui/dist/despesa.html`; depois embute o HTML em `src/ui/generated.ts` (no `.gitignore`) e falha se passar de 150 KB | 4.2, 17 |
| `package.json` | `build:ui`, com `pretest` e `pretypecheck` rodando o `build:ui`. `build` = UI + `tsc` | 22.1 |
| `test/expense/*.test.ts` | validate, resolve-type, open-form, save (Supabase simulado: colunas e valores do insert, tipo inexistente, erro cru do banco), fallback (prévia, token bom, adulterado, vencido, dados mudados, pendências) e estado do formulário | 22 |
| `test/app.test.ts`, `test/schemas.test.ts` | Ampliados: `tools/list` com UI não mostra `registrar_despesa`; sem UI, mostra. `salvar_despesa` e `listar_tipos_despesa` com `visibility: ["app"]` | 8.2 |
| `.env.example` | `MCP_PREVIEW_SECRET` e `VISAODEPRODUTO_*` | 18 |

## Perguntas antes de começar
1. **Textos que não existem no app nem no spec** (a regra é não inventar mensagem). Proponho:
   - data inválida: "Informe uma data válida";
   - descrição longa: "A descrição pode ter até 200 caracteres";
   - observações longas: "As observações podem ter até 1000 caracteres";
   - erro ao carregar os tipos: "Não foi possível carregar os tipos de despesa." + botão "Tentar de novo" (este último está no spec);
   - "Cancelar" como texto (16).

   Também há um conflito: o app escreve "Despesa registrada." **com ponto** (15.3 do app), e a seção 15 deste spec escreve sem ponto. Pela regra "vem do app quando existe lá", proponho **com ponto**. Os rótulos também vêm do app: "Tipo da despesa", "Valor", "Data", "Descrição", "Observações", "Salvar" e "Salvando...".
2. **basic-host.** Para o critério 1 (e as capturas de tela da 22.1), preciso clonar `github.com/modelcontextprotocol/ext-apps` no diretório temporário e rodar o `examples/basic-host` (dependências do npm). Nada entra no repositório. Posso?
3. **Analytics em teste local.** Proponho deixar `VISAODEPRODUTO_KEY` **vazia** localmente, para os testes com a conta de teste não entrarem na série do produto. O envio fica provado por teste automatizado com `fetch` simulado, e de verdade só no épico 3. Se preferir ver o evento chegar já agora, eu copio a chave (pública, só escrita) do `app/.env`.
4. **Limpeza da conta de teste.** As gravações de prova (umas três despesas fictícias, descrição "Teste MCP") ficam na conta de teste. Quando eu terminar, apago essas linhas pelo PostgREST com o token da própria conta, por id, mostrando a lista antes. Ou você prefere apagar pelo app?

A sua resposta "pode seguir" vale como a autorização da 22 para **gravar com a conta de teste**. Só essa conta, só dados fictícios.

## Critérios (8.2) e como cada um será mostrado
1. basic-host: `abrir_formulario_despesa {tipo: "aluguel", valor: 1450}` abre com o tipo (ou vazio, com aviso, se houver mais de um "aluguel"), 1450 e a data de hoje. Screenshot.
2. `1450,50` é recusado na tela (screenshot) **e** no servidor (teste + chamada direta), com a mensagem do app.
3. `salvar_despesa` sem tipo, pelo Inspector CLI, devolve erro no campo `tipo_despesa_id` e não grava.
4. `tipo_despesa_id` inexistente e com formato errado: erro de campo, nunca erro do Postgres.
5. A linha gravada, lida de volta pelo PostgREST com o token da conta de teste, tem `status = 'pago'`, `pago_em` preenchido e as mesmas colunas do app.
6. `tools/list`: `listar_tipos_despesa` e `salvar_despesa` com `visibility: ["app"]`.
7. Inspector sem UI: aparece `registrar_despesa`; prévia + token; confirmação grava; token adulterado e vencido não gravam.
8. `updateModelContext` com "Despesa registrada: <tipo>, R$ <valor>, competência <dd/mm/aaaa> (id <uuid>)." visto no log do basic-host. A resposta do modelo em si só se vê no Claude (épico 3).

Fecho: comandos 22.1, screenshots dos quatro estados, `verifier` e a revisão contra o `REVIEW.md`.

---

## Execução (15/11/2026)

**Aprovado** em 15/11/2026, com os textos novos propostos, o clone do basic-host, nenhum envio de analytics nos testes locais e a limpeza por id feita por mim. O "pode seguir" valeu como autorização para gravar com a conta de teste.

### Divergências em relação ao plano e ao spec
1. **Teto do HTML: 300 KB, não 150 KB (seção 17, decisão do Alexandre em 15/11/2026).** Só o `App` do ext-apps 2.0.4 já ocupa 234 KB (60 KB em gzip), porque traz os schemas zod do protocolo. O formulário inteiro tem 242,6 KB. A seção 17 do spec foi atualizada, e o `embed-ui.ts` falha acima de 300 KB.
2. **Formulário × fallback, em três casos (13.4).** `sim` mostra só o formulário, `nao` só o fallback, `desconhecido` os dois. "Desconhecido" é o cliente de 2025, que só anuncia as capacidades no `initialize`, que o servidor stateless não guarda. O basic-host e o Inspector CLI são clientes 2025 (o basic-host negociou `2025-11-25`) e caem nesse caso. **Confirmar no épico 3** como o Claude e o ChatGPT se apresentam.
3. **Schemas sem `anyOf`.** O Inspector acusou 5 avisos de portabilidade: o valor como "texto ou número" e os textos como "ou nulo". Ficou assim: o valor é **número** nas ferramentas do modelo (`abrir_formulario_despesa`, `registrar_despesa`), e tudo é **texto** no `salvar_despesa`, que recebe o que foi digitado. Um teste agora falha se algum schema usar `anyOf` ou `oneOf`. Depois disso o Inspector não mostrou mais avisos.
4. **`model.ts` separado de `schema.ts`.** Constantes e tipos ficaram sem zod, para o formulário não carregar o zod inteiro. Uma checagem de compilação garante que o tipo escrito à mão é igual ao `z.infer`.
5. **Textos para o modelo** (não para a pessoa), sem equivalente no spec: "Formulário de despesa aberto. Nada foi gravado ainda…", "Prévia pronta. Nada foi gravado…", "Nada foi gravado. Resolva as pendências…", "A prévia venceu ou não confere…", "Há escolhas pendentes na prévia…" e "'<termo>' não casou com nenhum tipo, escolha um" (o ambíguo é literal do spec). **Aprovados pelo Alexandre em 15/11/2026.** Todos ficam em `src/rules/messages.ts` (`textosParaOModelo` e `erros`), nenhum inline.
6. **"Cancelar"** chama `app.requestTeardown()`: o host fecha a visualização, e nada é gravado (9.2).
7. **Analytics esperado com teto de 1,5 s**, em vez de "dispara e esquece" como no app. Numa função serverless, uma promessa solta depois da resposta pode ser cortada. Falha nunca derruba a gravação.
8. **Proxy local `npm run dev:proxy`** (porta 3001): o basic-host não manda `Authorization` e chama de outra origem. O proxy entra com a conta de teste, injeta o token e libera CORS só para a origem do basic-host. O servidor não muda. Nesta máquina, as portas 3000, 8081 e 8091 estão ocupadas, e o basic-host rodou em 18090/18091 (porta da sandbox trocada na cópia local).

### Defeito achado no basic-host e corrigido com teste primeiro (22.1)
`.carregar-erro { display: flex }` sobrepunha o atributo `hidden`, e "Não foi possível carregar os tipos de despesa." aparecia com as opções já carregadas. O teste novo em `test/misc.test.ts` falhou primeiro; depois veio `.claude/fix-mode`, a regra `[hidden] { display: none !important; }` em `ui/shared/form.css` e o `rm`. O teste vai no commit do épico (não foi commitado sozinho antes, pelo mesmo motivo do épico 1).

### Provas no basic-host (conta de teste, servidor local)
O basic-host lista `abrir_formulario_despesa`, `consultar_despesas` e `registrar_despesa`. Esconde `listar_tipos_despesa` e `salvar_despesa`, que têm `visibility: ["app"]`.

| Estado (22.1) | O que apareceu |
|---|---|
| Vazio | `abrir_formulario_despesa {}`: tipo "Selecione...", valor vazio, data 15/11/2026; **Salvar desabilitado** |
| Preenchido (critério 1) | `{"tipo":"aluguel","valor":1450,"descricao":"Teste MCP"}`: "Aluguel da sala" (a conta tem um só aluguel), R$ 1450, 15/11/2026, "Teste MCP" |
| Erro de validação (critério 2, tela) | Valor `1450,50` + Salvar: "Informe um valor inteiro, sem centavos. Ex: 200" embaixo do campo, borda vermelha; **nenhum** `salvar_despesa` no log do servidor |
| Sucesso | "Despesa registrada." + "Aluguel da sala, R$ 1.450, competência 15/11/2026", formulário trancado |
| Model Context (critério 8) | `Despesa registrada: Aluguel da sala, R$ 1.450, competência 15/11/2026 (id e2451931-3630-42a6-9aba-0ffb53f00115).` |

Log do servidor no fluxo (sem PII):
```
{"ferramenta":"abrir_formulario_despesa","ms":133,"ok":true,"usuario":"5f5ee0927b99"}
{"ferramenta":"listar_tipos_despesa","ms":140,"ok":true,"usuario":"5f5ee0927b99"}
{"ferramenta":"salvar_despesa","ms":413,"ok":true,"usuario":"5f5ee0927b99"}
```

### Linha gravada, lida pelo PostgREST com o token da conta de teste (critério 5)
```
{"id": "e2451931-…", "valor_despesa": 1450, "data_competencia": "2026-11-15", "pago_em": "2026-11-15T20:52:31.898+00:00", "status": "pago", "descricao": "Teste MCP", "observacoes": null, "metodo": null, "tipos_despesa": {"nome": "Aluguel da sala"}}
{"id": "603b8437-…", "valor_despesa": 1500, "data_competencia": "2026-09-14", "pago_em": "2026-09-15T01:04:06.152+00:00", "status": "pago", "descricao": null, "observacoes": null, "metodo": null, "tipos_despesa": {"nome": "Aluguel da sala"}}   ← criada pelo app
```
Mesmo padrão: `status = pago`, `pago_em` preenchido, `metodo` nulo e texto vazio gravado como `null`.

### Inspector CLI (critérios 2, 3, 4 e 7)
```
### 3. salvar_despesa SEM tipo
{"ok": false, "erros": [{"campo": "tipo_despesa_id", "mensagem": "Escolha o tipo da despesa"}]}
### 4a. tipo_despesa_id inexistente (uuid válido)
{"ok": false, "erros": [{"campo": "tipo_despesa_id", "mensagem": "Escolha o tipo da despesa"}]}
### 4b. tipo_despesa_id com formato errado
{"ok": false, "erros": [{"campo": "tipo_despesa_id", "mensagem": "Escolha o tipo da despesa"}]}
### 2. servidor recusa 1450,50
{"ok": false, "erros": [{"campo": "valor_despesa", "mensagem": "Informe um valor inteiro, sem centavos. Ex: 200"}]}
### 7. registrar_despesa, chamada 1 (prévia)
{"ok": true, "previa": {"tipo": "Aluguel da sala", "valor": "R$ 120", "data": "15/11/2026", "descricao": "Teste MCP fallback", "observacoes": null}, "pendencias": []}
token_previa: 1794776606.ecb…
### chamada 2 com token adulterado
{"isError": true, "texto": "Os dados mudaram desde a prévia. Mostre a nova prévia à pessoa."}
### chamada 2 com dados mudados (valor 130)
{"isError": true, "texto": "Os dados mudaram desde a prévia. Mostre a nova prévia à pessoa."}
### chamada 2 com token vencido (gerado com exp no passado)
"text": "A prévia venceu ou não confere. Chame a ferramenta de novo, sem confirmar, para gerar outra prévia."  "isError": true
### chamada 2 com o token certo
{"isError": null, "texto": "Despesa registrada: Aluguel da sala, R$ 120, competência 15/11/2026 (id f628e421-1f59-45c2-9f95-28fd4f5f8788)."}
```
Antes de repetir o caso vencido, o banco tinha só as duas linhas esperadas. O vencido não gravou. O tipo inativo segue o mesmo caminho do 4a, porque a policy o esconde, e está coberto em `test/expense/save.test.ts`.

### Limpeza da conta de teste
```
apagadas: [('e2451931', 1450, 'Teste MCP'), ('f628e421', 120, 'Teste MCP fallback')]
restantes de hoje: 0
```

### O que fica para o épico 3
- A resposta **do modelo** depois do Salvar (critério 8, segunda metade) só se vê num host com modelo (Claude). Aqui foi provado que o `updateModelContext` chega com o texto do spec.
- Como o Claude e o ChatGPT anunciam as capacidades (divergência 2).

### Comandos 22.1 (em `mcp-server/`)
```
ui/expense: 242.6 KB
 RUN  v5.1.0 /Users/alexandresiqueira/agenda-psi/mcp-server
 Test Files  16 passed (16)
      Tests  127 passed (127)
EXIT test=0
> agenda-psi-mcp-server@0.1.0 pretypecheck
> npm run -s build:ui
ui/expense: 242.6 KB
> agenda-psi-mcp-server@0.1.0 typecheck
> tsc --noEmit
EXIT typecheck=0
> agenda-psi-mcp-server@0.1.0 build
> npm run build:ui && tsc -p tsconfig.build.json
> agenda-psi-mcp-server@0.1.0 build:ui
> FORM=expense vite build && tsx scripts/embed-ui.ts
ui/expense: 242.6 KB
EXIT build=0
```

### Revisão do verifier (primeira rodada: NÃO PRONTO) e o que foi feito
- **Textos para o modelo:** os seis foram aprovados pelo Alexandre (divergência 5) e saíram do código para `src/rules/messages.ts`.
- **Critério 8:** o Alexandre aprovou deixar a conferência da **resposta do modelo** para o épico 3, no Claude. Fica desmarcado no spec, com a nota. Aqui está provado que o `updateModelContext` chega ao host com o texto literal.
- **Capturas de tela da 22.1:** foram feitas no navegador da sessão (basic-host) e aparecem na conversa de 15/11/2026: vazio, preenchido, erro de validação e sucesso, com o painel Model Context. **Não foram salvas como arquivo no repositório.** A tabela "Provas no basic-host" acima descreve cada uma.
- **Descrição longa:** antes era cortada em 200 caracteres sem aviso. Agora fica inteira e vai o aviso "A descrição pode ter até 200 caracteres", como já acontecia com valor e data. Teste primeiro, `fix-mode`, correção.
- **`dev:proxy`** escuta só em `127.0.0.1`, porque injeta o token da conta de teste.
- Comentários desatualizados corrigidos (`model.ts`, `vite.config.ts`).
- Divergências de forma que ficam como estão: `ui/shared/` tem só o `form.css` (o bootstrap, o tema e os campos moram em `ui/expense/main.ts`, e a extração fica para o épico 5, quando houver um segundo formulário); a saída é `ui/dist/expense/index.html`; o teste de eventos fica em `test/misc.test.ts`; `src/rules/format.ts`, o claim `email` em `verify-token.ts`, `tsconfig.json`, `test/helpers.ts` e `SERVER_INFO.version` 0.2.0 entraram além da lista de arquivos.
- Tipo **inativo**: coberto por teste (a policy o esconde, e a consulta devolve vazio). Não houve prova ao vivo, porque a conta de teste não enxerga tipos inativos.

