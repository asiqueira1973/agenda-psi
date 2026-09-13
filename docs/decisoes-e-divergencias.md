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
| 4.5 | **A atualização desloga 100% da base, por construção.** O app atual é `supabase_flutter` 2.9.0, que persiste a sessão em `SharedPreferences` (NSUserDefaults no iOS). O app Expo persiste em `expo-secure-store` (Keychain). São lugares diferentes: o app novo não encontra a sessão do antigo | Critério de aceite de 8.12: "instala por cima do app FlutterFlow no iOS como atualização, **mantendo a sessão**". Risco 23.8 trata o deslogamento em massa como possibilidade de baixa probabilidade | O critério de 8.12 é **impossível** como escrito, e o risco 23.8 deixa de ser risco e vira evento certo. As 362 contas fazem login de uma vez, e quem esqueceu a senha depende de um fluxo de recuperação que **não existe no app atual** (spec 6.4) e nunca rodou em produção. Levantado por Alexandre em 13/09/2026 |
| 4.6 | Expo SDK 57 exige iOS **16.4**, não 16.0 | Requisito 17.6: "iOS 16+" | `deploymentTarget` fica em 16.4. Aparelhos entre 16.0 e 16.3 ficam de fora |
| 4.7 | O app atual está na versão **4.0.0+17** | O rodapé de Configurações no handoff diz `Agenda Psi 1.0 · Dab Lab` | O `app.json` foi para `5.0.0`, `versionCode` 18. O rodapé precisa mostrar a versão real, não 1.0 |
| 4.8 | A chave do Visão do Produto é de ingestão, só escrita — pública como a do PostHog | Tabela de variáveis da 18 classifica `VISAODEPRODUTO_API_KEY` como "só Edge Functions"; risco 23.3 a trata como chave de terceiro indevidamente no bundle | Decidido por Alexandre em 13/09/2026: vai no bundle como `EXPO_PUBLIC_VISAODEPRODUTO_KEY`, sem Edge Function no meio. A chave atual está exposta no app publicado e precisa ser rotacionada no lançamento |
| 4.9 | Analytics deixa de ser PostHog e passa a ser **Visão do Produto** | Seção 4.1 (stack), 20.4, 21 e risco 23.9 falam de PostHog | Decidido por Alexandre em 13/09/2026. Os nomes `psi_*` são mantidos (21) e a regra de 20.4 continua valendo: nenhum evento carrega nome de paciente, valor, observação ou texto digitado. O argumento da série histórica (risco 23.9) perde o sentido, já que a série do PostHog fica para trás de qualquer jeito |

---

## 5. Pendências que dependem de você

| # | O quê | Trava |
|---|---|---|
| 5.1 | Aplicar a **0009** (`supabase db push --linked`) — o comando foi bloqueado pelo classificador do Claude Code | Uma função de manutenção do paywall segue exposta à chave anônima em produção |
| 5.2 | Guardar a `service_role` atual no Vault (passo 1 do runbook no cabeçalho da 0005) | A **0005** e, com ela, o risco 23.2 |
| 5.3 | Responder a **25.1** — preço, periodicidade e teste gratuito do Pro | O 8.11 e a criação dos produtos nas duas lojas, que é ação sua e leva dias |
| 5.4 | Conta EAS, chaves do RevenueCat, `EXPO_PUBLIC_POSTHOG_KEY` | O épico 8.1 |


---

## 6. O deslogamento em massa — o que precisa ser decidido

Detalhe do fato 4.5, porque é o item de maior impacto sobre usuário real que
apareceu até agora.

**O que acontece hoje, sem fazer nada:** a pessoa atualiza o app, abre, e está
na tela de login. Ela não lembra a senha, porque entrou uma vez há um ano e o
app nunca mais pediu. O caminho dela passa a ser: "Esqueci minha senha" → e-mail
→ link → deep link abrindo o app na tela de nova senha. São quatro passos novos,
nenhum deles jamais executado em produção, e todos acontecendo no mesmo dia para
as 362 contas.

**Os caminhos possíveis:**

1. **Importar a sessão antiga na primeira abertura.** Ler a chave
   `flutter.supabase.auth.token` de `NSUserDefaults` (iOS) e de
   `FlutterSharedPreferences` (Android), extrair o `refresh_token` e chamar
   `supabase.auth.setSession`. Ninguém é deslogado. Custo: um módulo nativo
   pequeno, que o Expo não traz pronto, mais o teste em aparelho com o app
   antigo instalado por cima. É a única opção que salva o critério de 8.12.
2. **Aceitar o deslogamento e blindar a recuperação.** Nada de nativo. Em troca,
   o fluxo de senha precisa estar acima de qualquer suspeita: deep link testado
   nas duas lojas, e-mail chegando, e um texto na tela de login explicando por
   que ela está ali. Mais uma nota de versão que avise antes, não depois.
3. **Os dois.** Tenta importar; se não houver sessão para importar, cai no
   caminho 2. É o mais caro e o mais seguro.

**O que isso muda no plano se a escolha for 1 ou 3:** entra um épico entre 8.2 e
8.3, ou um trecho dentro de 8.2. Não é um ajuste de tela — é código nativo nas
duas plataformas.


---

## 7. A base instalada é menor do que o spec diz

Descoberto em 13/09/2026, ao validar a premissa de confirmação de e-mail da 6.2.

**82 das 362 fichas de `profissionais` são fantasmas**: pertencem a contas
anônimas do Supabase Auth, ou têm `nome` e `email` em branco, e não têm um único
paciente, sessão, pagamento, despesa ou horário. Nasceram em lotes de 3 e 4 no
mesmo dia, cada uma com um login só, no dia da criação — padrão de aparelho de
revisão de loja, não de pessoa. O login anônimo que as produziu já foi
desabilitado por Alexandre; a última nasceu em 22/08/2026.

| Número | Spec | Real |
|---|---|---|
| Profissionais | 362 | **280** |
| Fundadores | 195 | **148** |
| Com ao menos um paciente | 168 | 167 |
| Contas em `auth.users` | 365 | 365, sendo 282 por e-mail, 2 por Apple e **81 anônimas** |

Isso respingou no seed da 0006, que seguiu a regra 11.6 ao pé da letra e deu
cortesia Pro vitalícia a 47 fantasmas. A **migration 0010** corrigiu: tirou as 47
cortesias e desativou as 82 fichas, sem apagar nada. `assinaturas` foi de 195
para **148 linhas**, todas de fundador real.

**As 3 contas órfãs de 3.1 não são três casos iguais**, e o plano da 6.2 — criar
a ficha que faltou no primeiro login — só resolve uma delas:

| Conta | Provider | O que fazer |
|---|---|---|
| `gustavomarquesportes@hotmail.com` | e-mail | Resolve pela 6.2 no primeiro login. É a dona dos 2 pacientes com `profissional_id` nulo |
| `f6hjftpstn@privaterelay.appleid.com` | **apple** | O spec diz que login Apple está desligado (`if (false)`) e é v2, mas há 2 contas Apple no banco. Sem login Apple no MVP, esta conta não tem como entrar |
| sem e-mail | **anônima** | Não tem e-mail para satisfazer o `NOT NULL` de `profissionais.email`. Desativada pela 0010 |

**Premissa da 6.2 validada:** o "Confirm email" está **desligado** no projeto —
nenhuma das 365 contas tem `confirmation_sent_at`. O `signUp` volta com sessão na
hora, e a tela "Confirme seu e-mail" é caminho de contingência, não o padrão.

---

## 8. Decisões de 13/09/2026 sobre a virada

| # | Decisão | Consequência |
|---|---|---|
| 8.1 | **Não construir a importação de sessão.** A atualização desloga todo mundo | Com 14 pessoas ativas de fato (painel do Visão do Produto), um módulo nativo em duas plataformas não se paga. Alexandre avisa as 14 por e-mail antes de publicar. O critério de aceite do 8.12 sobre manter a sessão **não será cumprido**, e o motivo está aqui |
| 8.2 | O fluxo de "Esqueci minha senha" continua sendo construído com cuidado | Ele é obrigatório pela 6.4 e é o único caminho de quem não lembra a senha — só deixa de ser o gargalo por onde 362 pessoas passariam no mesmo dia |
| 8.3 | **O handoff de design é orientação, não lei** | Onde não for factível em React Native, eu adapto e registro aqui. A copy da seção 15 do spec continua literal |
| 8.4 | Copy: caso a caso entre spec e handoff | Conta desativada vence o **spec** (tem o e-mail de contato). Excluir horário vence o **handoff** (avisa que o SMS deixa de sair). Pagamento vence o **handoff** (`Mensal` no segmented; o banco continua gravando `pagamento mensal`) |
