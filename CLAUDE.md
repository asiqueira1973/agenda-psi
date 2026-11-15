# CLAUDE.md — Agenda Psi

App de gestão de consultório para psicólogos autônomos. Expo SDK 55, React
Native, TypeScript strict, Supabase. iOS e Android.

A fonte de verdade do produto é `docs/spec.md`. Este arquivo é o resumo
operacional do que não pode ser quebrado. **Onde os dois divergirem, `spec.md`
manda** — e onde o código já divergiu do spec de propósito, está escrito em
`DOCUMENTACAO-TECNICA.md`, seção 6.

---

## As sete pegadinhas

Valem para qualquer mudança, em qualquer arquivo. Há um comando de verificação
para cada uma em "Como conferir".

### 1. O app NUNCA escreve em `assinaturas`

Quem grava plano são as Edge Functions `apple-notificacoes` e
`play-notificacoes`, com `service_role`. A tabela não tem policy de escrita para
ninguém, e isso é proposital: é o que impede um cliente comprometido de se
conceder Pro a partir da resposta local do StoreKit.

Corolário do mesmo princípio: **toda compra precisa ser carimbada com o
`usuario_id`** — `appAccountToken` no iOS, `obfuscatedAccountId` no Android.
Sem o carimbo, a notificação da loja chega sem dizer de quem é a compra: o
dinheiro entra e o Pro não. Nenhum teste pega isso; só comprar no sandbox pega.

A máquina de estado 12.1 lista isso como transição proibida. Se aparecer um
`.from('assinaturas').insert(` ou `.update(` no app, é defeito de segurança, não
atalho.

### 2. Preço vigente NUNCA é calculado no cliente

Ele vem de `v_pacientes_cartao.preco_vigente`. `precos_paciente` é append-only:
atualizar preço é inserir linha nova, nunca dar update.

Vale para todo número financeiro: os 13 indicadores da Home saem inteiros de
`v_dashboard_resumo`, e o arquivo de indicadores não tem uma soma sequer
(princípio P2). Indicador errado se conserta na view.

### 3. `usuario_id` NUNCA vai no corpo de uma Edge Function

Ele é derivado do JWT, sempre. É a correção do defeito mais grave do app
anterior: o webhook do Agente Psi recebia o `usuario_id` no corpo, sem
autenticação nenhuma, e quem tivesse a URL lia e escrevia dado de qualquer
psicólogo trocando um uuid.

O corpo de `agente` tem **um** campo, `mensagens`.

### 4. Nenhuma chave secreta no bundle

Só `EXPO_PUBLIC_*` vive no app, e só porque são públicas por design: a
publicável do Supabase (inútil sem passar pela RLS), as de cliente do RevenueCat
e a de ingestão do Visão do Produto (só escrita).

`service_role`, `N8N_WEBHOOK_SECRET`, `PLAY_PUSH_TOKEN` e a chave privada da
conta de serviço do Google existem **apenas** nos secrets das Edge Functions. Se precisar de credencial para chamar alguém, a
chamada vira Edge Function.

### 5. Os nomes de evento de analytics não mudam

Quatro eventos têm série histórica no Visão do Produto e estão preservados byte
a byte em `src/lib/analytics/events.ts`:

```
agenda_psi_novapaciente  agenda_psi_novasessao
agenda_psi_novopagamento agenda_psi_novoagendamento
```

Renomear qualquer um parte o gráfico do produto em dois, e o gráfico passa a
mentir por omissão. (Os nomes `psi_*` que o spec cita na seção 21 eram do
PostHog, que saiu.)

**E nenhum evento carrega nome de paciente, valor, observação ou texto
digitado.** O tipo `PropriedadesDeEvento` é fechado para não haver onde colocar.

### 6. Os valores da tabela 11.4 são literais do banco

Estão em `src/features/patients/valores-do-banco.ts`, com teste que compara byte
a byte. Em particular:

- `sessoes.pagamento` aceita **`nao pagou`**, sem acento;
- `pagamentos.tipo` aceita **`por sessão`**, com acento e espaço.

As duas inconsistências são do banco. "Normalizar" qualquer uma não quebra o
build, não quebra a revisão — quebra a contagem do dashboard semanas depois,
sem ninguém relacionar uma coisa com a outra.

O **rótulo** na tela pode ser diferente do **valor** gravado, e é: "Não pagou"
aparece acentuado, e o valor segue sem acento.

### 7. `dia_semana` é 1 = segunda, 7 = domingo

Não é a convenção do JavaScript, onde 0 é domingo. E a ordem visual do segmented
é uma terceira coisa: começa no domingo.

Três convenções para a mesma ideia é o terreno onde nasce o defeito de um
horário de quinta virar segunda — que é o que o app anterior faz quando alguém
salva as notas de um agendamento. A conversão mora em `diaDaSemanaDoBanco`, num
lugar só, e tem teste.

---

## Regras de escrita de código

**Idioma.** Banco em português, `snake_case`. Código, variáveis e nomes de
arquivo em inglês. Os tipos gerados do Supabase mantêm os nomes em português
(`nome_completo`, `valor_pagamento`) e são usados assim. **Não crie camada de
tradução** — ela só adiciona um lugar para o nome divergir.

**Comentários em português.** Toda função, hook, rotina de servidor, trigger e
policy leva cabeçalho dizendo o que faz e **qual regra do spec implementa, com o
número da seção**. Lógica não óbvia leva comentário inline explicando a
intenção. `// incrementa i` é ruído; `// preço vem da view, nunca calculado no
app (P2, regra 11.2)` é o que se procura seis meses depois.

**Copy é texto final.** Os textos da seção 15 do spec são literais: não
reescreva, não melhore, não acrescente exclamação nem emoji. Cada feature tem
seu `copy.ts`, para revisar a copy ser ler um arquivo e não caçar string.

**Toda escrita invalida a query afetada.** Nada de `setState` com o valor que
acabou de ir para o banco — foi assim que o app anterior acabou com um detalhe
de paciente que nunca recarregava.

**Os quatro estados.** Carregando, sucesso, erro e vazio, em toda escrita e toda
lista. Esqueleto na forma do conteúdo, nunca cartões zerados. E nunca, em
hipótese alguma, mensagem de sucesso quando a escrita falhou.

**Área de toque de 44×44pt.** Texto azul dentro de `Pressable` sem preenchimento
tem área de toque da altura da letra. Use `TextLink` e `IconButton`.

---

## Mapa de pastas

```
app/                          # projeto Expo
  app/                        # rotas do expo-router
    (auth)/                   # login, nova conta, confirme e-mail, nova senha
    (tabs)/                   # as CINCO abas
    patients/ sessions/ payments/ expenses/ schedule/
    settings/ paywall/
  src/
    features/<feature>/       # hooks, copy e componentes, juntos
    components/ui/            # design system
    lib/supabase/             # cliente, tipos gerados, storage da sessão
    lib/analytics/            # Visão do Produto
    theme/                    # tokens, cores, tipografia
supabase/
  migrations/                 # aplicadas, em ordem de timestamp
  migrations-pendentes/       # escritas e retidas, com o porquê no README
  functions/                  # agente, notifica-admin,
                              # apple-notificacoes, play-notificacoes
  tests/                      # pgTAP
mcp-server/                   # conector MCP (Claude/ChatGPT); teste: cd mcp-server && npm test
docs/
  spec.md  schema.md  decisoes-e-divergencias.md
CLAUDE.md  README.md  DOCUMENTACAO-TECNICA.md
```

São **cinco** abas, não seis: Locais de atendimento saiu do MVP. O corte é
limpo — não existe rota, query nem string desse módulo no app.

---

## Comandos

```bash
cd app && npx tsc --noEmit        # typecheck
cd app && npx jest                # testes unitários
cd app && npx expo run:ios        # build local e simulador
cd app && npx expo start          # só o Metro, com o dev client já instalado
```

```bash
supabase db push --linked         # aplica migrations em produção
supabase test db --local          # pgTAP contra o banco local
supabase db reset --local         # reconstrói o banco local do zero
supabase gen types typescript --linked > app/src/lib/supabase/database.types.ts
```

**Depois de toda migration com DDL, rode `get_advisors`** (segurança e
performance). Foi ele que pegou as funções do paywall expostas como RPC público.

**Não escreva `docs/schema.md` à mão.** Ele é gerado:

```bash
docker exec -i $(docker ps --format '{{.Names}}' | grep supabase_db) \
  psql -X -A -t -U postgres -d postgres -f - < scripts/gerar-schema.sql > /tmp/schema.json
node scripts/gerar-schema.mjs /tmp/schema.json > docs/schema.md
```

---

## Três armadilhas de ambiente

0. **NUNCA abra `app/ios/AgendaPsi.xcodeproj`. Abra o `.xcworkspace`.** Com
   CocoaPods, só o workspace tem os 120 pods integrados; o projeto sozinho dá
   dezenas de `module map file does not exist`, uma por biblioteca — e a
   mensagem não diz a causa.

   Custou dois archives perdidos, em 15/09 e 06/10. Este é o ÚNICO projeto iOS
   desta máquina que se abre pelo workspace; os outros dez são `.xcodeproj`, e a
   memória muscular está certa para eles. Por isso existe o script abaixo, que
   não dá a escolha:

   ```bash
   ./scripts/arquivar-ios.sh
   ```

   Para confirmar de qual container veio um build que falhou:

   ```bash
   /usr/libexec/PlistBuddy -c "Print :WorkspacePath" \
     ~/Library/Developer/Xcode/DerivedData/AgendaPsi-*/info.plist
   ```

1. **A pasta do projeto não pode ter espaço no nome.** O script do RN 0.83 que
   baixa dependências pré-compiladas falha, e a mensagem fala de podspec sem
   atributo `source` — que manda investigar CocoaPods, que não é o problema.
2. **Expo SDK 57 não compila nesta máquina** (Xcode 26.1.1 / Swift 6.2.1). O
   erro é dentro do `expo-modules-jsi`. Por isso o projeto está no SDK 55.

---

## Como conferir as pegadinhas

Todos devem dar vazio, menos os dois últimos, que devem passar.

```bash
# 1. O app escreve em assinaturas?
grep -rn "from('assinaturas')" app/src app/app

# 3. Manda usuario_id no corpo do agente?  (o -v tira os comentários que
#    explicam justamente a ausência dele)
grep -rn "usuario_id" app/src/features/agent | grep -vE "^\S+:[0-9]+: *(\*|//)"

# 4. Segredo de verdade no bundle?
grep -rnE "SUPABASE_SERVICE_ROLE|N8N_WEBHOOK_SECRET|PLAY_PUSH_TOKEN" app/src

# Corte de Locais limpo?  database.types.ts é GERADO do banco inteiro e cita as
#    tabelas por definição — por isso fica de fora da conta.
grep -rniE "locais_atendimento|comentarios_locais" app/src app/app \
  --exclude=database.types.ts

# 6 e 7. Literais do banco e dias da semana.
cd app && npx jest src/features/patients/__tests__/valores-do-banco.test.ts
cd app && npx jest src/features/schedule/__tests__/dias.test.ts
```

---

## O que está fora de escopo

Nada da seção 28 do spec: login social, push, exportação, exclusão real de
dados, fila offline, moderação e **Locais de atendimento**. E nada do anti-escopo
da seção 1: prontuário eletrônico, agenda de calendário, emissor fiscal,
plataforma para clínicas, canal de comunicação com o paciente.

---

## Protocolo de mudança

A seção 29 do spec define o procedimento. O essencial: **liste os arquivos que
vai alterar antes de escrever código**, espere aprovação, e atualize o
`DOCUMENTACAO-TECNICA.md` no mesmo commit.

E **pergunte, não assuma**, ao cruzar com qualquer item da seção 25. A 25.1 foi
respondida em 14/09/2026 — R$ 9,90 por mês, só mensal, sem teste gratuito.
Continuam abertas: 25.4, 25.6, 25.7 e 25.8.
