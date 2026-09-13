# Decisões e divergências — Agenda Psi

Registro corrido do que foi decidido fora do `docs/spec.md` e do que foi
encontrado divergindo dele. É a matéria-prima do item 6 da seção 19
("Divergências em relação a este spec") do `DOCUMENTACAO-TECNICA.md`.

Regra: nada aqui substitui o spec. Quando um item daqui for incorporado ao
spec, ele é marcado como **incorporado** e para de valer sozinho.

---

## 1. Perguntas da seção 25 respondidas

| # | Pergunta | Resposta | Quando |
|---|---|---|---|
| 25.9 | Desativar as tabelas de locais enquanto o módulo está fora? | **Não.** Só corrigir a RLS e deixar os dados parados, como a 0004 já previa | 13/09/2026 |
| 25.5 | O dashboard passa a usar o fuso de Brasília? | **Sim.** Virou a migration 0007 | 13/09/2026 |
| 25.2 | Adicionar método de pagamento (pix, dinheiro, cartão)? | **Não.** As colunas `metodo` seguem sem uso e o fluxo 9.2 continua em sete toques. O Agente Psi continua livre para gravar lá | 13/09/2026 |

Continuam abertas: **25.1** (preço e periodicidade do Pro — agora é a única
fonte de receita, ver item 4 abaixo), **25.4**, **25.6**, **25.7** e **25.8**.

---

## 2. Divergências entre o spec e o banco real

| Onde | O spec diz | O banco mostra | O que foi feito |
|---|---|---|---|
| 7.2 e migration 0004 | "Corrigir os dois registros com `profissional_id` nulo" | Os 2 pacientes pertencem a um `usuario_id` **sem ficha em `profissionais`** — uma das 3 contas órfãs de 3.1. Não existe `profissional_id` para onde apontar | O `UPDATE` da 0004 ficou idempotente (hoje não muda nada, resolve casos futuros). A correção de verdade virou a proteção da mensagem: com nome de profissional nulo, o SMS sai sem a parte do profissional em vez de sair nulo. A linha se resolve sozinha quando a conta órfã completar o cadastro (6.2) |
| 7.5, migration 0003 | A alteração de `v_sms_lembretes_pendentes` entra junto com as funções | Aplicar as duas juntas cortaria na hora os lembretes de **2 profissionais não-fundadores** já acima de 10 SMS no mês, sem tela que explicasse | Separado: a 0003 traz só a lógica; o corte virou a **0008**, retida em `supabase/migrations-pendentes/` até o épico 8.11 |
| 7.5, migration 0001 | "Dump do schema atual" | O `pg_dump` reproduz a `service_role` em texto puro dentro da definição do `trigger-notification` (risco 23.2), e **não versiona extensão nenhuma** — sem `unaccent` o baseline não reconstrói o banco | A instrução do trigger foi redigida do baseline, com o motivo escrito no arquivo; e o `CREATE EXTENSION unaccent` foi acrescentado |
| Anexo | "17 funções" | 13 funções do app + 4 da extensão `unaccent` | Nada a fazer. Registrado para a contagem não assustar |
| 11.8 e 11.1 | O dashboard conta o mês em UTC, e o desvio é de 3 horas | A view filtra pagamentos e despesas por `criado_em` e sessões por `ocorreu_em` — **nunca** por `data_competencia` nem `ocorreu_em_dia`. Um pagamento de agosto lançado hoje entra no dashboard de setembro, enquanto a tela do paciente mostra agosto | A 0007 troca **só o fuso**, como a 25.5 pediu. A base do mês fica como está. Decisão de 13/09/2026 |
| 7.2 | — | `profissionais` não tem índice único em `usuario_id`. Nada no banco impede duas fichas para o mesmo usuário, que é o que o defeito 11.9.10 produz. Hoje há **zero** duplicados | Não feito: não está no spec. Sugerido para decisão |

---

## 3. Decisões de implementação

| # | Decisão | Por quê |
|---|---|---|
| 3.1 | Migrations nomeadas `AAAAMMDDHHMMSS_000N_descricao.sql` | O CLI do Supabase exige prefixo de timestamp; o número do spec fica no nome e no cabeçalho, para as referências continuarem valendo |
| 3.2 | A **0005** entra depois da 0006 e da 0007 na ordem de execução | Ela espera uma ação sua (guardar a chave no Vault). Nenhuma das outras depende dela |
| 3.3 | Migration que não pode ser aplicada ainda **não fica** em `supabase/migrations/` | `supabase db push` aplica tudo que encontra lá. As retidas vivem em `supabase/migrations-pendentes/`, com o porquê no README da pasta |
| 3.4 | Quatro arquivos vazios para as migrations aplicadas antes do repositório existir | Sem eles o `db push` se recusa a rodar, e está certo. O conteúdo delas já está no baseline |
| 3.5 | **Migration 0009**, que não existe no spec | O `get_advisors` mostrou que as três funções da 0003 viraram endpoint `/rest/v1/rpc/`. A pior é `recontar_uso_mensal`: chamável com a chave anônima do bundle, apaga e reescreve o contador do mês de todos os profissionais. A 0009 revoga; `limite_sms_do_plano` continua executável por `authenticated` porque `v_meu_plano` é `security_invoker` |
| 3.6 | `v_meu_plano` criada com `security_invoker = on` | É a única view do banco que não é `SECURITY DEFINER`, e por isso a única que não aparece no alerta do advisor |
| 3.7 | `DOCUMENTACAO-TECNICA.md` na raiz | A seção 19 e a instrução de implementação dizem raiz; a árvore de pastas da 18 diz `docs/`. Vence a 19 |
| 3.8 | Cinco abas | A árvore da seção 18 diz "as 6 abas" — resíduo da v1.0. Valem 8.3, 10 e 24.13 |
| 3.9 | `Versao em FlutterFlow/` fora do git | 215 arquivos de outro projeto, contendo as URLs dos três webhooks abertos e a `x-api-key` do Visão do Produto (riscos 23.1 e 23.3) |

---

## 4. Fatos de produto que o spec não tinha

Descobertos em 13/09/2026, durante a Fase 1. **Precisam ser incorporados ao spec.**

| # | Fato | O que o spec diz hoje | Impacto |
|---|---|---|---|
| 4.1 | **O app já está publicado na Google Play** — `com.dablab.agendapsi`, release de produção em 19/08/2026, 57 instalações, 26 aparelhos ativos por mês | Seção 1: "publicado apenas na App Store". Item 15 da seção 3 e o épico 8.12: "primeira versão na Play Store" | 8.12 deixa de ser primeira publicação e passa a ser **atualização**, com o mesmo `applicationId`. A decisão D4 (mesmo identificador, base instalada preservada) passa a valer para as duas lojas |
| 4.2 | **O app é pago na App Store**: R$ 49,90 no Brasil, receita de R$ 40,93. Na Play está sem preço | Nada. O spec trata o app como gratuito e descreve o paywall como "a infraestrutura de cobrança que o produto ainda não tem" | A copy de 15.7 chama o usuário de "plano gratuito" — para quem pagou R$ 49,90, isso soa errado |
| 4.3 | **Decisão: tirar o preço da Apple na release nova.** O app fica gratuito nas duas lojas e a cobrança passa a ser só o paywall de SMS | — | Resolve a tensão de 4.2: "plano gratuito" volta a ser verdade. Faz da assinatura Pro a **única** fonte de receita, o que aumenta o peso da pergunta 25.1. Quem já pagou continua com o app |
| 4.4 | A Play Console avisa: exigência de *target API level*, prazo **1º de novembro de 2026** | Nada | Entra como restrição de configuração do build Android no 8.12 |

---

## 5. Pendências que dependem de você

| # | O quê | Trava |
|---|---|---|
| 5.1 | Aplicar a **0009** (`supabase db push --linked`) — o comando foi bloqueado pelo classificador do Claude Code | Uma função de manutenção do paywall segue exposta à chave anônima em produção |
| 5.2 | Guardar a `service_role` atual no Vault (passo 1 do runbook no cabeçalho da 0005) | A **0005** e, com ela, o risco 23.2 |
| 5.3 | Responder a **25.1** — preço, periodicidade e teste gratuito do Pro | O 8.11 e a criação dos produtos nas duas lojas, que é ação sua e leva dias |
| 5.4 | Conta EAS, chaves do RevenueCat, `EXPO_PUBLIC_POSTHOG_KEY` | O épico 8.1 |
