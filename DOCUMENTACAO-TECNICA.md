# Documentação técnica — Agenda Psi

Descreve o sistema **como ele ficou**, não como foi planejado. Conteúdo e ordem
seguem a seção 19 do `docs/spec.md`.

| | |
|---|---|
| **Versão do app** | 5.0.0 (a anterior, em FlutterFlow, é a 4.0.0+17) |
| **Stack** | Expo SDK 55 · React Native 0.83.10 · React 19.2.0 · expo-router · TanStack Query v5 · Supabase · expo-iap |
| **Banco** | Supabase `tocytpjtupbbxwgamtxq`, região `sa-east-1` |
| **Última atualização** | 14/09/2026 |

O retrato mecânico do schema — colunas, tipos, padrões — está em
[`docs/schema.md`](docs/schema.md), que é **gerado** e não deve ser editado à
mão. Este documento é o que aquele arquivo não consegue dizer: o que cada coisa
significa e por quê.

---

## 1. Modelo de dados explicado

Volume em produção, medido em 14/09/2026. Onde a contagem difere do spec, o
motivo está na seção 6 deste documento.

### `profissionais` — quem usa o app

Uma linha por psicólogo. É a raiz de tudo.

| Coluna | O que significa |
|---|---|
| `id` | Chave da tabela. **Não é o que as outras tabelas usam para filtrar** — ver a nota sobre os dois uuids, abaixo |
| `usuario_id` | O `auth.users.id` do Supabase Auth. **Esta é a chave de tenancy de todo o banco** |
| `nome`, `email` | Obrigatórios. O e-mail é `NOT NULL`, e é exatamente o campo que falta nas contas órfãs |
| `telefone`, `linkedin`, `instagram` | Opcionais, editáveis em Meu perfil |
| `ativo` | **Nullable, com padrão `true`. Nulo significa ativo** — as views fazem `COALESCE(ativo, true)`. É por aqui que a desativação de conta funciona |
| `usuario_fundador` | Marca de cortesia vitalícia. 148 pessoas reais |
| `fcm_token` | Sempre nulo. Push nunca foi implementado |

**Os dois uuids.** `profissionais.id` e `profissionais.usuario_id` são dois
identificadores diferentes para a mesma pessoa. A maioria das tabelas referencia
`usuario_id`; `profissional_id` fica nulo ou é preenchido por trigger. **Toda
query nova filtra por `usuario_id`.** A exceção são as duas tabelas do paywall,
`assinaturas` e `uso_mensal`, cuja chave é `profissionais.id` — e é por isso que
o trigger do contador precisa de dois saltos em vez de um.

### `pacientes` — quem é atendido

| Coluna | O que significa |
|---|---|
| `nome_completo`, `telefone`, `email` | Nome e telefone são obrigatórios no app, no cadastro **e** na edição |
| `status` | `ativo` ou `inativo`. Inativo continua no banco, some da lista principal |
| `receber_sms` | Liga o lembrete para este paciente. Sozinho não basta: é preciso ter horário fixo |
| `primeira_consulta` | Data pura, opcional |
| `observacoes` | Texto livre. A Política de Privacidade pede explicitamente que não se escreva informação clínica aqui |
| `profissional_id` | Preenchido por trigger. Nulo em 2 de 1.065 — ver seção 6 |

**Exclusão é definitiva**, com cascata para sessões, pagamentos, preços e
horários. É a única entidade do app assim, e por isso a única com confirmação
nominal.

### `precos_paciente` — o histórico de preço

Tabela **append-only**. Preço não se edita: cada mudança é uma linha nova, com
`vigencia_desde` igual à data de hoje. O preço vigente é derivado pelas views —
`v_pacientes_cartao.preco_vigente` — e **nunca calculado no app**.

`preco` é `integer` e está em **reais inteiros, sem centavos**: 200 quer dizer
R$ 200,00. O banco aceita zero (`CHECK preco >= 0`); o app exige positivo. A
diferença é proposital: zero é tecnicamente válido e não faz sentido de negócio.

### `sessoes` — o atendimento que aconteceu

| Coluna | O que significa |
|---|---|
| `ocorreu_em_dia` | **A data que a interface usa.** Data pura, escolhida pela pessoa |
| `ocorreu_em` | Timestamp com padrão `now()`. **Nunca escrito pelo app.** É por ele que `v_dashboard_resumo` conta as sessões do mês |
| `status` | Padrão `realizada`. Nunca escrito pelo app |
| `modalidade` | `presencial` ou `remota` |
| `pagamento` | `pagou`, `nao pagou` (**sem acento**) ou `pagamento mensal` |
| `devesercobrada` | Sem separador de palavras, ao contrário do resto do banco |
| `duracao_minutos` | Opcional. Vazio grava nulo, nunca zero |

### `pagamentos` — o dinheiro que entrou

| Coluna | O que significa |
|---|---|
| `data_competencia` | **O mês a que o pagamento pertence.** É o que a interface mostra e o que a pessoa escolhe |
| `pago_em` | O instante do registro no app. **Não é a data escolhida** |
| `valor_pagamento` | Inteiro, em reais |
| `tipo` | `mensal` ou `por sessão` (**com acento e espaço**) |
| `status` | O app grava sempre `pago` |
| `metodo`, `vencimento_em` | Existem no banco e nunca foram usados (pergunta 25.2, respondida: não adicionar) |

### `despesas` — o dinheiro que saiu

Mesma estrutura de datas dos pagamentos. `tipo_despesa_id` é **obrigatório** e
aponta para o catálogo. `descricao` é opcional — quando falta, a lista mostra o
nome do tipo.

### `tipos_despesa` — catálogo global

13 linhas, compartilhadas por todos. O filtro `ativo = true` vive **na policy**,
não no app.

### `agenda_semana_padrao` — os horários fixos

Não é agenda de calendário: é "segunda às 14h com a Fernanda", que se repete
toda semana até ser excluída. Sem data, sem exceção, sem feriado.

`dia_semana` é `smallint`, **1 = segunda … 7 = domingo** — que não é a
convenção do JavaScript, onde 0 é domingo. Confundir as duas é o que produz o
defeito de o horário mudar de dia sozinho.

**Criar um horário aqui é o que liga o lembrete por SMS.** Excluir desliga.

### `sms_lembretes_enviados` — o log de SMS

Uma linha por lembrete efetivamente enviado. **Não tem `usuario_id`**: o
profissional é derivado pelo join com `agenda_semana_padrao`.

A constraint `sms_lembretes_enviados_un (agenda_id, ocorrencia_data)` é o que
garante **um SMS por agendamento por dia**, e é a base da contagem do paywall.

### `assinaturas` — o plano vigente (NOVA)

Uma linha por profissional. **Escrita somente pelas Edge Functions
`apple-notificacoes` e `play-notificacoes`**, com `service_role`. Não existe
policy de escrita para ninguém.

As colunas `rc_customer_id` e `rc_entitlement` mantêm o nome herdado da época em
que o RevenueCat estava no projeto. Hoje guardam, respectivamente, o
`usuario_id` carimbado na compra e o identificador do produto na loja. Renomear
coluna em produção só para melhorar o nome é risco sem retorno; a migration 0011
explica isso no próprio catálogo.

| Coluna | Valores e o que significam |
|---|---|
| `plano` | `free` ou `pro` |
| `status` | `ativo`, `em_atraso` (período de graça, acesso mantido), `cancelado` (acesso até `expira_em`), `expirado` |
| `store` | `app_store`, `play_store` ou `cortesia`. Nulo em cortesia concedida à mão |
| `expira_em` | Nulo significa sem data de término — é o caso da cortesia vitalícia dos fundadores |

### `uso_mensal` — o contador de SMS do mês (NOVA)

Chave composta `(profissional_id, mes)`, com `mes` sempre no dia 1, **apurado no
fuso de Brasília**. Alimentado por trigger, nunca pelo app. Reconstruível a
qualquer momento pela função `recontar_uso_mensal`.

### Tabelas que existem e o app v1 não toca

`locais_atendimento` e `comentarios_locais_atendimento` (módulo cortado do MVP,
volta em 28.8), `notifications` (push não implementado), `custos_sms_mensal`
(fatura do Bird, operacional) e `config_app` (chave/valor).

---

## 2. Relacionamentos

```
auth.users
   │ 1
   └──< profissionais (usuario_id)
            │
            │  usuario_id é a chave de tenancy de TUDO abaixo
            │
            ├──< pacientes ──┬──< precos_paciente   (histórico de vigência)
            │                ├──< sessoes
            │                ├──< pagamentos
            │                └──< agenda_semana_padrao ──< sms_lembretes_enviados
            │
            ├──< despesas >── tipos_despesa
            ├──< feedback
            ├──< assinaturas        (1:1, pela chave profissionais.id)
            ├──< uso_mensal         (1:N por mês, pela chave profissionais.id)
            └──< notifications

locais_atendimento ──< comentarios_locais_atendimento    (comunitário, sem tenancy)
custos_sms_mensal                                        (operacional, sem tenancy)
config_app                                               (chave/valor)
```

No vocabulário do negócio:

- Um psicólogo tem muitos pacientes; um paciente pertence a exatamente um
  psicólogo, e nunca é visível para outro.
- Um paciente tem muitos preços ao longo do tempo, e o que vale é o mais
  recente. Nenhum preço antigo é apagado.
- Um paciente tem muitas sessões e muitos pagamentos, e os dois são
  independentes: pode haver sessão sem pagamento e pagamento sem sessão.
- Um paciente tem, no máximo, alguns horários fixos na semana. Cada horário é o
  que faz o lembrete por SMS existir.
- Cada lembrete enviado vira uma linha de log, e é pelo log que se sabe quanto
  do plano gratuito já foi consumido no mês.
- Um psicólogo tem uma assinatura, e um contador de uso por mês.
- Uma despesa pertence a um psicólogo e tem um tipo, escolhido de um catálogo
  que é igual para todo mundo.

---

## 3. Regras que vivem no banco

Esta é a lista que o app não vê. Ler daqui até o fim da seção deve bastar para
entender toda a lógica que não está no React Native — em especial o paywall.

### Triggers

| Trigger | Tabela | Quando | O que faz |
|---|---|---|---|
| `trg_pacientes_sync_ids` | `pacientes` | before insert/update | Preenche `profissional_id` a partir de `usuario_id`, e vice-versa. Recusa insert sem nenhum dos dois |
| `trg_precos_sync_ids` | `precos_paciente` | before insert/update | Idem |
| `trg_uso_mensal_incrementa` | `sms_lembretes_enviados` | after insert | **Soma 1 no contador do mês.** Novo nesta reescrita |
| `trigger-notification` | `notifications` | after insert | Chama a Edge Function de push. **Contém a `service_role` em texto puro** — substituído pela migration 0005, ainda não aplicada |

### Funções

| Função | O que faz |
|---|---|
| `current_profissional_id()` | Devolve o `profissionais.id` do usuário autenticado. Base das policies novas |
| `fn_uso_mensal_incrementa()` | Corpo do trigger do contador. Deriva o profissional em **dois saltos** — `agenda_semana_padrao.usuario_id` → `profissionais.usuario_id` → `profissionais.id` — porque o log de SMS não tem `usuario_id`. Agendamento órfão é ignorado sem derrubar o insert |
| `limite_sms_do_plano(uuid)` | **O coração do paywall.** Devolve `NULL` (ilimitado) para fundador e para Pro com acesso vigente; devolve `10` para todo o resto. Cancelado vale até `expira_em`; em atraso vale durante a graça; sem linha em `assinaturas` é free |
| `recontar_uso_mensal(date)` | Reconstrói o contador de um mês a partir do log. Rede de segurança para divergência |
| `agentpsi_*` (9 funções) | Usadas pelo Agente Psi. Recebem `p_usuario_id` e filtram por ele. Não alteradas |
| `demo_uid()` | Resíduo do login de convidado, que foi descartado. Candidata a remoção |

### Views que o app usa

| View | Para quê |
|---|---|
| `v_profissional_atual` | A regra de acesso: existe ficha? está ativa? |
| `v_dashboard_resumo` | Os 13 indicadores do mês. **Janelas de mês em America/Sao_Paulo** desde a migration 0007 |
| `v_meu_plano` | Plano, limite, consumido e restante do mês. Única fonte do estado do plano |
| `v_pacientes_cartao` | Lista e detalhe de paciente, com `preco_vigente` já calculado |
| `v_despesas_ultimas_30` | A lista de despesas |
| `view_agenda_semana_padrao` | A grade da agenda, com nome do paciente e bloco de hora |
| `v_sms_lembretes_pendentes` | **O ponto único de enforcement do paywall.** Consumida pelo n8n, não pelo app |

### O enforcement do paywall, em uma frase

Quem decide se um SMS sai é a view `v_sms_lembretes_pendentes`, e só ela: se o
profissional estourou o limite do mês, o agendamento simplesmente não aparece na
fila. Nada é enviado, nada fica enfileirado para depois, e **não há reenvio
retroativo depois que a pessoa assina**. Um cliente comprometido não consegue
mandar um SMS a mais, porque o app não participa dessa decisão.

⚠️ **A condição do limite ainda NÃO está na view em produção.** Ela é a migration
0008, retida de propósito — ver seção 6.

### Policies

São 70 em produção. A forma geral é sempre a mesma: `usuario_id = auth.uid()`
para as tabelas de dados do psicólogo, e nada além disso.

As exceções que importam:

| Tabela | Leitura | Escrita |
|---|---|---|
| `tipos_despesa` | qualquer autenticado | ninguém |
| `assinaturas` | só a própria, via `current_profissional_id()` | **ninguém** — só as Edge Functions das lojas, com `service_role` |
| `uso_mensal` | só o próprio | **ninguém** — só o trigger |
| `locais_atendimento` | qualquer autenticado | só o autor (corrigido na 0004) |
| `comentarios_locais_atendimento` | só o que está aprovado | só o autor (corrigido na 0004) |

As quatro policies de locais e comentários tinham `using (true)` para update e
delete: qualquer autenticado podia editar e apagar qualquer local e qualquer
comentário. A migration 0004 corrigiu as quatro, **mesmo o módulo tendo saído do
MVP** — buraco de RLS não some porque a tela sumiu.

---

## 4. Mapa tela → tabelas

As 29 telas do inventário da seção 10, com o que cada uma lê, o que escreve e
por qual policy passa. Onde a coluna de policy diz "própria", leia
`usuario_id = auth.uid()`.

| # | Tela | Lê | Escreve | Policies |
|---|---|---|---|---|
| 1 | Login | `v_profissional_atual` | — | `profissionais_select_own` |
| 2 | Nova conta | `profissionais` (verificação de existência) | `profissionais` | `profissionais_select_own`, `profissionais_insert_own` |
| 3 | Confirme seu e-mail | — | — | — |
| 4 | Nova senha | — | `auth.users` (via GoTrue) | — |
| 5 | Início | `v_dashboard_resumo`, `v_meu_plano`, `pacientes` (contagem) | — | própria em todas |
| 5h | Análise com IA | via Edge Function `analise-financeira` | — | a função lê `v_dashboard_payload_json` com o JWT |
| 6 | Agenda | `view_agenda_semana_padrao`, `v_meu_plano` | — | `select agenda via view` |
| 7 | Novo agendamento | `v_pacientes_cartao`, `view_agenda_semana_padrao` | `agenda_semana_padrao` | `Insert only own rows` |
| 8 | Detalhe do agendamento | `agenda_semana_padrao` + join com `pacientes` | `agenda_semana_padrao` (**só `observacoes`**) | `Update only own rows`, `Delete only own rows` |
| 9 | Pacientes | `v_pacientes_cartao` | `pacientes` (delete) | `pacientes_select_own`, `pacientes_delete_own` |
| 10 | Novo paciente | — | `pacientes`, `precos_paciente` | `pacientes_insert_own`, `precos_insert_own` |
| 11 | Detalhe do paciente | `v_pacientes_cartao`, `sessoes`, `pagamentos`, `precos_paciente` | `pacientes` (delete) | própria em todas |
| 12 | Editar paciente | `v_pacientes_cartao` | `pacientes` | `pacientes_update_own` |
| 13 | Atualizar preço | `v_pacientes_cartao` | `precos_paciente` | `precos_insert_own` |
| 14 | Registrar sessão | — | `sessoes` | `sessoes_insert_own` |
| 15 | Detalhe da sessão | `sessoes` | `sessoes` (sem a data) | `sessoes_update_own`, `sessoes_delete_own` |
| 16 | Registrar pagamento | `v_pacientes_cartao` (preço vigente) | `pagamentos` | `pag_insert_own` |
| 17 | Detalhe do pagamento | `pagamentos` | `pagamentos` (sem a competência) | `pag_update_own`, `pag_delete_own` |
| 18 | Despesas | `v_despesas_ultimas_30` | — | `despesas_select` |
| 19 | Registrar despesa | `tipos_despesa` | `despesas` | `tipos_despesa_select`, `despesas_insert` |
| 20 | Detalhe da despesa | `despesas`, `tipos_despesa` | `despesas` (sem a competência) | `despesas_update`, `despesas_delete` |
| 21 | Configurações | `v_meu_plano` | — | `uso_mensal_select_proprio`, `assinaturas_select_proprio` |
| 22 | Meu perfil | `v_profissional_atual` | `profissionais` | `profissionais_update_own` |
| 23 | Trocar senha | sessão (e-mail) | — | — |
| 24 | Meu plano | `v_meu_plano` | — | idem 21 |
| 25 | Paywall | a loja (StoreKit / Play Billing), via `expo-iap` | — | a escrita em `assinaturas` é do servidor |
| 26 | Feedback | — | `feedback` + Edge Function `notifica-admin` | `feedback_insert_public` |
| 27 | Apagar minha conta | — | `profissionais` (`ativo = false`) | `profissionais_update_own` |
| 28 | Política de privacidade | — | — | — |
| 29 | Agente Psi | via Edge Function `agente-psi` | via as funções `agentpsi_*` | a função valida o JWT |

**Nenhuma tela lê ou escreve `locais_atendimento` ou
`comentarios_locais_atendimento`.** O corte do módulo é limpo: não há rota, query
nem string dessas tabelas no código do app.

---

## 5. Lógica por tela

O que é validado, o que é gravado, o que é calculado e onde, e o que a pessoa vê
quando dá errado. As telas sem particularidade estão resumidas.

### Regras que valem para TODAS as telas

- **Quatro estados em toda escrita** (princípio P3): carregando, sucesso, erro e
  vazio. Nenhum botão fica ativo durante a chamada, e **nenhuma operação falha
  em silêncio mostrando mensagem de sucesso**.
- **Erro de validação não pinta borda no campo**: o rótulo vira vermelho e a
  mensagem aparece como rodapé do grupo.
- **Nenhum erro do Supabase chega cru em inglês.** A tradução está em
  `auth-service.ts`, num lugar só.
- **Toda escrita invalida a query afetada.** Não existe `setState` com o valor
  que acabou de ir para o banco.
- **Nada financeiro é calculado no cliente** (princípio P2).

### 1. Login

Valida que e-mail e senha não estão vazios. Depois do `signInWithPassword`, a
raiz do app consulta `v_profissional_atual` e decide: ficha ativa entra; ficha
com `ativo = false` mostra o alerta de conta desativada, desloga e fica no
Login; sem ficha vai para Nova conta completar o cadastro.

Erros: credencial errada vira `E-mail ou senha incorretos.`; falha de rede vira
`Sem conexão. Verifique sua internet e tente de novo.`

### 2. Nova conta

Serve a dois casos. No cadastro novo, valida nome, e-mail, senha e confirmação —
senhas diferentes mostram `As senhas não são iguais.` em português. São duas
escritas não transacionais: `signUp` e depois o insert em `profissionais`, este
**idempotente** (consulta antes). Se o projeto exigir confirmação de e-mail, a
sessão não volta, a tela "Confirme seu e-mail" aparece e a ficha é criada no
primeiro login.

No segundo caso — autenticado sem ficha — só o nome é pedido; o e-mail vem da
sessão, em leitura, e não há campo de senha.

### 5. Início

Lê uma linha de `v_dashboard_resumo` e monta os 13 indicadores. **Não calcula
nenhum**: o arquivo de indicadores não tem uma soma sequer. Dinheiro sai como
`R$ 1.234`, percentual como `42,5%`, nulo como `R$ 0`.

Enquanto carrega, mostra esqueleto na forma do conteúdo — nunca cartões zerados.
Sem paciente nenhum, mostra o estado de boas-vindas com um caminho só.

O aviso de limite de SMS aparece em laranja a partir de 80% do limite e em
vermelho quando estoura. Os números vêm de `v_meu_plano`.

### 5h. Análise com IA

Chama a Edge Function com corpo vazio; a função lê a view com o JWT. Exibe as
quatro seções, **incluindo riscos e oportunidades**. Falha mostra erro com botão
de tentar de novo, e **preserva a análise anterior**.

### 6. Agenda

Grade de 08:00 a 21:00 para o dia escolhido, abrindo **no dia de hoje**. Hora
vazia é faixa baixa com hairline; hora ocupada é o cartão do agendamento. Com o
limite de SMS estourado, os agendamentos ganham `SMS pausado` em laranja.

### 7. Novo agendamento

Valida paciente escolhido e `hora_fim > hora_inicio`. Avisa — sem bloquear —
quando já existe horário no mesmo dia e hora. Salvar com campo faltando **mostra
erro**, em vez de abortar em silêncio.

### 8. Detalhe do agendamento

Paciente, dia e horário em **leitura**. Só as notas são editáveis, e o hook de
edição aceita um único parâmetro. Para mudar dia ou hora, exclui-se e cria-se de
novo — e o rodapé diz isso. A exclusão avisa que o lembrete daquele dia deixa de
sair.

### 9. Pacientes

Busca em memória, sem diferenciar maiúsculas nem acento, em qualquer posição do
nome. Exclusão por deslize, seguida de alerta nominal que lista o que vai junto.

### 10 e 12. Novo e editar paciente

Nome e telefone obrigatórios **nos dois**. Preço obrigatório e inteiro positivo
só no cadastro — vírgula, ponto e vazio são rejeitados antes do insert. A edição
não tem campo de preço.

### 11. Detalhe do paciente

As duas primeiras linhas são `Registrar sessão` e `Registrar pagamento`. Preço,
totais e históricos vêm de **query invalidável**, não do parâmetro de rota.
Nenhum número acima de 17pt.

### 14 e 15. Sessão

Tudo já vem preenchido: hoje, Presencial, Mensal, cobrada, 50 minutos. Grava
exatamente oito campos. No detalhe, a **data é leitura**.

### 16 e 17. Pagamento

O valor já vem preenchido com o preço vigente do paciente, editável. Grava
`data_competencia` escolhida e `pago_em` com o instante do registro. No detalhe,
a **competência é leitura** e o **tipo é salvo**.

### 18, 19 e 20. Despesas

A lista vem da mais nova para a mais antiga; descrição nula mostra o nome do
tipo. No cadastro, o tipo **começa nulo** e o botão fica desabilitado até ser
escolhido. O catálogo vem ordenado por nome nas duas telas.

O estado vazio é o texto mais trabalhado do app, e é literal da seção 15.6.

### 21 a 27. Configurações

Meu perfil lê do banco. Feedback exige mensagem não vazia. Apagar conta tem
campo **editável**, botão que só habilita com `QUERO DELETAR` exato, e **logout
imediato**. Sair pede confirmação.

### 29. Agente Psi

Conversa com histórico da sessão, campo limpo ao enviar, resposta em Markdown.
O corpo da requisição leva **só o texto**. O evento de analytics leva o
comprimento e o sucesso, **nunca o texto**.

---

## 6. Divergências em relação ao spec

Sem esta seção o documento envelhece mentindo. Cada item diz o que saiu
diferente e por quê.

### 6.1 O que mudou no plano de migrations

| Spec | O que foi feito | Por quê |
|---|---|---|
| 7.5 põe o corte do paywall na migration 0003 | Separado: a 0003 traz só a lógica; o corte é a **0008**, retida em `supabase/migrations-pendentes/` | Aplicar as duas juntas cortaria na hora os lembretes de 2 profissionais reais, sem nenhuma tela que explicasse |
| 7.5 lista 0001 a 0005 | Existem **0001 a 0010** | 0006 é o seed, 0007 é o fuso do dashboard (resposta da 25.5), 0009 fecha as funções do paywall à API pública e 0010 limpa fichas fantasmas |
| 0001 é o dump do schema | O dump foi **redigido** num ponto e **acrescido** em outro | O `pg_dump` reproduz a `service_role` em texto puro dentro do `trigger-notification`, e versionar isso publicaria a chave. E o dump não versiona extensão nenhuma: sem `CREATE EXTENSION unaccent` o baseline não reconstrói o banco |
| 0004 corrige os 2 pacientes com `profissional_id` nulo | O `UPDATE` é idempotente e **hoje não muda nada** | Os 2 pertencem a um `usuario_id` **sem ficha em `profissionais`** — não existe para onde apontar. A correção real virou a proteção da mensagem do SMS |

**Migrations aplicadas em produção:** 0001, 0002, 0003, 0004, 0006, 0007, 0009 e
0010. A **0011** — que só corrige comentários do catálogo — está escrita e
validada localmente.
**Retidas, com motivo escrito:** 0005 (Vault) e 0008 (corte do paywall).

### 6.2 Números que o spec dá e o banco desmente

**82 das 362 fichas de `profissionais` eram fantasmas** — contas anônimas do
Supabase Auth, ou com nome e e-mail em branco, sem um único paciente, sessão,
pagamento, despesa ou horário. Nasceram em lotes de 3 e 4 no mesmo dia, cada uma
com um login só. O login anônimo que as produziu já foi desabilitado.

| Número | Spec | Real |
|---|---|---|
| Profissionais | 362 | **280** |
| Fundadores | 195 | **148** |
| Contas em `auth.users` | 365 | 365, sendo 282 por e-mail, 2 por Apple e **81 anônimas** |

Isso respingou no seed: ele seguiu a regra 11.6 ao pé da letra e deu cortesia Pro
vitalícia a 47 fantasmas. A migration 0010 corrigiu.

**As 3 contas órfãs não são três casos iguais**, e o plano da 6.2 só resolve uma:
uma é por e-mail (resolve no primeiro login), uma é por **Apple** — apesar de o
spec dizer que login Apple está desligado —, e uma é **anônima, sem e-mail**, o
que impede satisfazer o `NOT NULL` de `profissionais.email`.

**A premissa da 6.2 foi validada:** o "Confirm email" está **desligado** no
projeto. Nenhuma das 365 contas tem `confirmation_sent_at`.

### 6.3 Ambiente de build

| Spec | O que foi feito |
|---|---|
| Assunção 24.1: Expo SDK 57 | **SDK 55.** O 57 não compila com o Swift 6.2.1 do Xcode 26.1.1 — o erro é dentro do `expo-modules-jsi`, em três camadas. A própria 24.1 previa a troca como "uma linha no `package.json`" |
| Requisito 17.6: iOS 16+ | **iOS 16.0**, literal. No SDK 57 seria obrigatoriamente 16.4 |
| — | A pasta do projeto foi renomeada para `agenda-psi`: o script do RN 0.83 que baixa dependências pré-compiladas **não trata caminho com espaço**, e falha com uma mensagem sobre podspec que manda investigar o lugar errado |

### 6.4 Sai o RevenueCat

Decisão de 14/09/2026: a compra passa a ser direto nas lojas, com `expo-iap` no
app e uma Edge Function por loja no servidor. O spec escolheu RevenueCat em 4.1
para ter um webhook só (13.3); sem ele, são dois mecanismos diferentes — a Apple
manda o estado inteiro num JWS assinado, e o Google manda só um aviso de que
algo mudou, obrigando a perguntar à API do Play.

A regra de ouro não mudou: o app não concede Pro, e `assinaturas` segue sem
policy de escrita para ninguém.

**Preço, respondendo a 25.1: R$ 9,90 por mês, só mensal, sem teste gratuito.** O
paywall passa a ter uma linha, e não as duas do handoff. O detalhe da conta — o
Pro para de se pagar por volta de 12 pacientes com SMS ligado — está em
`docs/decisoes-e-divergencias.md`, seção 11.

### 6.5 Analytics

Sai o PostHog, entra o **Visão do Produto** (decisão de 13/09/2026). Consequências:

- os nomes `psi_*` citados na seção 21 eram do PostHog. Os nomes que têm série
  histórica são os `agenda_psi_*`, e os quatro com dados foram preservados byte
  a byte;
- `agenda_psi_nova despesa`, com espaço no meio, foi corrigido para
  `agenda_psi_novadespesa`. Ele **nunca disparou** — não aparece no catálogo, o
  que confirma o defeito da tela de despesas;
- a chave de ingestão vai no bundle como `EXPO_PUBLIC_VISAODEPRODUTO_KEY`. A
  tabela da seção 18 a classifica como "só Edge Functions"; Alexandre confirmou
  que ela é de escrita apenas, como a do PostHog. **Ela está exposta no app
  publicado e precisa ser rotacionada no lançamento**;
- a regra de 20.4 continua valendo: nenhum evento carrega nome de paciente,
  valor, observação ou texto digitado. O tipo das propriedades é fechado
  justamente para não haver onde colocar.

### 6.6 Design

O handoff é **orientação, não lei** (decisão de 13/09/2026). Onde não foi
factível, adaptei:

| Handoff | O que foi feito | Por quê |
|---|---|---|
| Rótulo de aba em 12pt | **10pt** | "Configurações" truncava para "Configura..." |
| Coluna de rótulo de formulário entre 76 e 96pt | **116pt** no cadastro, 150pt no pagamento | "Confirmação" e "Mês de competência" não cabem e quebram em duas linhas |
| Tipo da despesa e paciente como "linha de navegação" | Linha que abre **folha modal** | Devolver a escolha para a tela anterior com expo-router exigiria estado global para um problema que não é global |
| Alerta de excluir horário conforme 15.4 | Texto do **handoff** | Ele avisa que o lembrete daquele dia deixa de sair — informação que o da 15.4 não traz |
| Rótulo `Pagamento mensal` da tabela 11.4 | **`Mensal`** no segmented | Não cabe em três posições. O **valor gravado** continua `pagamento mensal` |
| Alerta de conta desativada do handoff | Texto do **spec** | O do spec diz para onde escrever; "fale com o suporte" sem endereço não resolve |
| Rodapé `Agenda Psi 1.0` | Versão lida do `app.json` | O app publicado está na 4.0.0; número fixo envelheceria na primeira release |
| Rótulo da quinta aba `Configurações` | **`Ajustes`** | Não cabe em 80pt de aba, nem em 10pt: truncava para "Configuraçõ...". É como o próprio iOS chama esse app em português, e o título da tela continua "Configurações" — rótulo de aba mais curto que o título é padrão do sistema |

### 6.7 Quatro defeitos que só o aparelho mostrou

Nenhum pegável por `tsc` nem por teste unitário:

1. o large title subia por baixo da barra de status — o `Screen` respeitava a
   área segura de baixo e não a de cima;
2. o rodapé ficava com fundo claro no modo escuro, sumindo com o texto;
3. **os links de texto não respondiam ao toque** — texto dentro de `Pressable`
   sem preenchimento tem área de toque da altura da letra. Virou o componente
   `TextLink`, com os 44×44pt do requisito 17.4. É o mais grave: com mouse quase
   não aparece, com o dedo o link não funciona;
4. `Configurações` truncava na quinta aba;
5. **a barra de abas tinha fundo claro no modo escuro** — sem `tabBarStyle`
   declarado, o React Navigation usa o tema claro dele, e o app ficava com uma
   faixa branca no pé.

### 6.8 O que NÃO está pronto

| Item | O que falta | De quem depende |
|---|---|---|
| **Compra no paywall** | Produtos cadastrados nas duas lojas e os secrets das notificações. A 25.1 foi respondida: R$ 9,90/mês, só mensal, sem teste | Alexandre |
| **Migration 0008** | Entra junto com o 8.11, quando a tela souber avisar e vender | consequência do item acima |
| **Migration 0005** | O passo 1 do runbook: guardar a `service_role` atual no Vault | Alexandre |
| **Edge Functions no ar** | Deploy e os segredos do n8n (`N8N_AGENTE_URL`, `N8N_ANALISE_URL`, `N8N_MEAVISA_URL`, `N8N_WEBHOOK_SECRET`) e das lojas (`APPLE_BUNDLE_ID`, `PLAY_PUSH_TOKEN`, `PLAY_SERVICE_ACCOUNT_EMAIL`, `PLAY_SERVICE_ACCOUNT_PRIVATE_KEY`) | Alexandre |
| **As duas funções de loja** | Nunca foram exercitadas contra a Apple nem contra o Google. Passam em `deno check`, mas isso não é o mesmo que funcionar | depende dos produtos existirem |
| **Pergunta 25.6** | A Edge Function `agendapsi-chat` (v5) vira a implementação de 13.1 ou é despublicada? | Alexandre |
| **Perguntas 25.4, 25.7, 25.8** | Exclusão real de dados; quando o aviso de limite aparece (o app usa 80%, que é a suposição do spec); se dá para escolher quem recebe SMS | Alexandre |
| **Épico 8.12** | Publicação. **O app já está na Play Store** — não é primeira publicação, é atualização | Alexandre |
| **Verificação em Android** | Nada foi rodado em aparelho nem emulador Android | — |
| **Testes de regressão dos 21 defeitos** | Há teste para os que cabem em função pura; os de tela dependem de teste de componente, ainda não escrito | — |

### 6.9 A atualização desloga toda a base

O app FlutterFlow guarda a sessão em `SharedPreferences`; o Expo guarda no
Keychain. São lugares diferentes: **todo mundo é deslogado na atualização**, por
construção, não por defeito.

Isso torna **impossível** o critério de aceite de 8.12 que fala em "manter a
sessão", e transforma o risco 23.8 em evento certo. Com 14 pessoas ativas de
fato, Alexandre decidiu não construir a importação de sessão e avisar essas 14
por e-mail antes de publicar. A tela de login ganhou um texto explicando por que
a pessoa está ali.
