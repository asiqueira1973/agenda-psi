# Agenda Psi — Especificação de Reescrita em React Native (Expo)

| | |
|---|---|
| **Versão do documento** | 1.1 |
| **Responsável de produto** | Alexandre Siqueira (Dab Lab) |
| **Status** | rascunho — aguarda revisão da seção 24 |
| **Data** | 13 de setembro de 2026 |
| **Mudança na 1.1** | Locais de atendimento sai do MVP e vai para o roadmap (28.8). Pergunta 25.3 resolvida. A barra de abas passa de 6 para 5. |
| **Substitui** | app Agenda Psi construído em FlutterFlow (Flutter/Dart, 124 arquivos, ~31 mil linhas) |

---

## Como usar este documento

Este é o **spec único** da reescrita do Agenda Psi do FlutterFlow para React Native com Expo. Ele foi escrito a partir de três fontes reais, não de memória: o código Dart exportado do FlutterFlow, o schema vivo do Supabase (projeto `tocytpjtupbbxwgamtxq`) e os dados de uso em produção.

O consumidor deste documento é o **Claude Code**, que vai implementar o app a partir dele. A regra é: **o spec decide, o código obedece.** Toda ambiguidade que sobrar aqui vira decisão arbitrária do agente depois.

⚠️ **Revise a seção 24 (Assunções declaradas) antes de gerar qualquer código.** Assunção não revisada vira verdade no minuto em que o agente começa a implementar.

A numeração das seções é estável. O prompt de implementação e as conversas futuras referenciam "seção 8.3", "regra 11.2" — não renumere.

---

## 0. Princípios não-negociáveis

**P1 — Paridade funcional, não paridade de bugs.**
O app novo faz tudo que o app atual faz. Ele **não** reproduz os defeitos listados na seção 11.9 — eles são corrigidos, e cada correção está escrita. Quando houver dúvida entre "o Flutter fazia assim" e "assim está certo", vence o que está escrito neste spec.

**P2 — O banco é a fonte da verdade; o app é uma casca.**
Nenhum cálculo financeiro, de vigência de preço ou de limite de plano é feito no cliente. O app lê views e chama funções; ele não recalcula o que o Postgres já calcula. Isso vale inclusive para o paywall: quem decide se um SMS sai é o banco, nunca o React Native.

**P3 — Toda escrita tem os quatro estados.**
Carregando, sucesso, erro e vazio. Nenhum botão de submit fica ativo durante a operação; **nenhuma operação falha em silêncio mostrando mensagem de sucesso**; nenhuma lista aparece em branco sem explicação. O botão bloqueado durante a chamada o app atual já faz (o `FFButtonWidget` do FlutterFlow cuida disso). As outras três partes ele não faz em tela nenhuma — é a diferença de qualidade mais visível da reescrita.

**P4 — Nenhum segredo no cliente.**
Chave de API de terceiro, webhook sem autenticação e `service_role` não existem no bundle do app. Toda integração que precisa de credencial passa por Edge Function do Supabase, com o JWT do usuário validado.

**P5 — Simplicidade antes de complexidade prematura.**
Sem state manager global, sem camada de abstração sobre o Supabase, sem microfrontend. O estado de servidor vive no TanStack Query; o estado de tela vive na tela. Se uma feature precisa de três camadas para funcionar, ela está mal modelada.

---

## 1. Visão e problema

O Agenda Psi é um app de gestão de consultório para psicólogos autônomos brasileiros. Ele resolve o problema de quem atende 10, 20, 40 pacientes e controla tudo em caderno, planilha ou nada: quem é o paciente, quanto ele paga, quando é a sessão fixa da semana, quanto entrou no mês, quanto saiu, e quanto sobrou. Manda lembrete por SMS para o paciente antes da sessão.

Hoje o app existe e funciona, construído em FlutterFlow, publicado apenas na App Store. A reescrita tem três objetivos concretos: **uma base de código única para iOS e Android** (hoje só há iOS), **saída da dependência de uma ferramenta no-code** que limita o que dá para fazer, e **a infraestrutura de cobrança** que o produto ainda não tem.

### Anti-escopo

O Agenda Psi **não é**:

- **prontuário eletrônico.** Não guarda evolução clínica, não substitui o registro exigido pelo Conselho Federal de Psicologia, e a Política de Privacidade recomenda explicitamente que o profissional não escreva informação sensível nas observações. Nada na reescrita muda isso.
- **agenda de calendário.** A agenda do app é de **horários fixos semanais recorrentes** (segunda às 14h com a Fernanda), não uma agenda de datas com exceções, remarcações e feriados. Não há sincronização com Google Calendar nem iCal.
- **emissor fiscal.** Não emite recibo, RPA, NFS-e nem integra com banco. O controle financeiro é gerencial.
- **plataforma para clínicas.** Um usuário = um psicólogo autônomo. Não há time, não há secretária, não há múltiplos profissionais numa conta.
- **canal de comunicação com o paciente.** O paciente nunca instala o app nem tem conta. O único contato com ele é o SMS de lembrete.

---

## 2. Personas e cenários de uso

**Persona única: o psicólogo autônomo.** Mulher, 30–50 anos, atende entre 8 e 30 pacientes por semana, entre consultório alugado, coworking e atendimento remoto. Não é técnica. Usa o iPhone como computador principal.

Os dois momentos que definem o desenho:

**Entre sessões.** Ela tem cinco minutos entre um paciente e o outro, está de pé, o celular numa mão. É aqui que ela registra que a sessão aconteceu e que o paciente pagou. Se esse fluxo custar mais que três toques, ela não faz — e é exatamente o que os dados mostram hoje: 168 pessoas cadastraram paciente, mas só 16 registraram sessão nos últimos 60 dias.

**Fim do mês.** Sentada, com tempo, querendo saber quanto entrou, quanto saiu e quanto sobrou. É o único momento em que ela olha o dashboard com atenção. É também o momento em que ela deveria lançar despesas — e não lança: apenas 98 despesas registradas em toda a base, contra 451 pagamentos. A pessoa acompanha receita, não lucro.

Esses dois momentos justificam duas decisões deste spec: o registro de sessão e pagamento precisa ser o caminho mais curto do app, e a tela de despesas precisa de estado vazio com chamada para ação, não de uma lista em branco.

---

## 3. Escopo do MVP

### Dentro

| # | Item | Observação |
|---|---|---|
| 1 | Autenticação email/senha contra o Supabase Auth existente | Mesmo `auth.users`, zero migração de conta. São **365 contas em `auth.users` e 362 com registro em `profissionais`** — as 3 órfãs são resultado do defeito 11.9.10 e precisam de destino (ver 6.2) |
| 2 | Cadastro de nova conta | Com o tratamento de confirmação de email que hoje falta |
| 3 | Pacientes: lista, cadastro, detalhe, edição, exclusão | Módulo mais usado do app |
| 4 | Preço do paciente com histórico de vigência | Modelo append-only já existente no banco |
| 5 | Sessões: registro, detalhe, edição, exclusão | |
| 6 | Pagamentos: registro, detalhe, edição, exclusão | |
| 7 | Despesas: lista, registro, detalhe, edição, exclusão | Com estado vazio ativo (ver 8.7) |
| 8 | Agenda semanal: grade por dia, criar, editar notas, excluir | Horários fixos recorrentes |
| 9 | Dashboard com os 13 indicadores do mês | Lido de `v_dashboard_resumo` |
| 10 | Análise financeira por IA | Mantida, mas via Edge Function (ver 13.2) |
| 11 | Agente Psi (comando em linguagem natural) | Idem, e **ganha entrada na navegação** — hoje a tela é órfã |
| 12 | Configurações: perfil, trocar senha, feedback, apagar conta | Exclusão de conta passa a **funcionar** (ver 11.9) |
| 13 | Política de privacidade | Texto igual, agora acessível também de dentro do app |
| 14 | **Paywall por SMS** | Épico novo — seção 8.11 |
| 15 | Build e publicação Android | Primeira versão na Play Store |

### Fora

| Item | Destino | Motivo / dependência |
|---|---|---|
| **Locais de atendimento** (diretório comunitário: lista, sugestão, comentários) | **v2 — seção 28.8** | Foi um teste e quase não foi usado: 12 locais e **zero comentários** em toda a base. São 4 das 33 telas, uma aba inteira da navegação, duas tabelas e três dos defeitos da lista 11.9. Cortar libera cerca de uma semana e reduz a barra de abas de 6 para 5. O detalhe já especificado está preservado em 28.8 — a decisão é de escopo, não de descarte. **As tabelas continuam no banco e as correções de RLS delas continuam na migration 0004** (ver 6.5): as policies permissivas são um buraco aberto independentemente de existir tela |
| Login com Google | **v2** | Código existe no Flutter mas está desligado (`if (false)`). Reativar exige configurar OAuth no Google Cloud e `google-services.json`. Se entrar, a Apple passa a exigir Sign in with Apple junto. |
| Login com Apple | **v2** | Mesma dependência acima, invertida. Decidir os dois juntos, não um. |
| Login de convidado (`demo@agendapsi.com`) | **descartado** | Está desligado no app atual, e a credencial fixa vive no `app_state` servindo de guarda em duas telas (Trocar senha e Configurações). Remover reduz superfície de ataque e código morto. |
| Push notifications | **v2** | O app atual **não tem** push implementado: `profissionais.fcm_token` existe, a tabela `notifications` existe com 0 linhas, a Edge Function `sendpushnotification` existe — mas o `pubspec.yaml` não tem `firebase_messaging`. Não há nada para portar. Ver 28.2. |
| Grade semanal de 7 colunas (desktop) | **descartado** | Existe no Flutter dentro de um `if (false)`. Nunca renderizou. |
| Ação `linkGoogle` | **descartado** | Código neutralizado no Flutter; dependia de `dart:html`. |
| Moderação de locais e comentários dentro do app | **v2** | Hoje a aprovação é feita direto no banco. Sem volume que justifique tela. |
| Exclusão definitiva de dados (LGPD) | **v2** | Hoje é soft delete (`ativo = false`). Ver risco 23.6 e pergunta 25.4. |
| Web / PWA | **descartado** | O app atual tem alvo web no FlutterFlow mas nunca foi publicado. Expo gera web, mas nada no spec depende disso. |
| Sincronização offline com fila de escrita | **v2** | Ver requisito 17.3 para o que o MVP faz de offline. |

---

## 4. Arquitetura

### 4.1 Stack

| Camada | Escolha | Versão | Por quê | Alternativa descartada |
|---|---|---|---|---|
| Framework | **Expo (managed)** | SDK 57 (React Native 0.86, React 19.2) | Build e submit para as duas lojas pelo EAS, OTA updates, config plugins resolvem o nativo sem tocar em Xcode/Gradle. É o que mais se aproxima da produtividade que o FlutterFlow dava. | React Native CLI (bare): controle total do nativo, que este app não precisa, ao custo de manter dois projetos nativos à mão. |
| Linguagem | TypeScript (strict) | — | Os tipos do banco são gerados a partir do schema real; `strict` é o que faz isso valer alguma coisa. | JavaScript |
| Navegação | **expo-router** | do SDK 57 | Roteamento por arquivo, tipado, com layouts aninhados — mapeia direto na estrutura de abas + modais deste app. | React Navigation puro |
| Estado de servidor | **TanStack Query v5** | — | Cache, invalidação explícita e estados de loading/error de graça. Resolve sozinho o bug do app atual de não recarregar listas após escrita. | Redux/Zustand: estado de servidor não é estado global de app. |
| Backend | **Supabase** (projeto `tocytpjtupbbxwgamtxq`) | existente | Não muda. Mesmo banco, mesmo auth, mesmas 68 policies. | — |
| Cliente de dados | `@supabase/supabase-js` v2 | — | | |
| Compras | **RevenueCat** (`react-native-purchases` + `react-native-purchases-ui`) | — | Uma API para StoreKit e Play Billing, webhook de status, paywall pronto. Exige **development build** — não roda no Expo Go. | `expo-iap`: mais simples, mas sem servidor de assinaturas nem webhook; o estado da assinatura teria que ser reconstruído à mão. |
| Analytics | `posthog-react-native` | — | Mesmo projeto (257402), **mesmos nomes de evento** | |
| Ícones | `expo-symbols` (SF Symbols no iOS) + fallback | — | Parte do design system Apple da seção 16 | |
| Armazenamento local | `expo-secure-store` (sessão) + AsyncStorage (preferências) | — | | |

### 4.2 O que roda onde

```
┌─ App (Expo, iOS + Android) ───────────────────────────────┐
│  expo-router · TanStack Query · supabase-js · RevenueCat  │
│  Nenhuma chave secreta. Só a anon key do Supabase.        │
└────────────┬──────────────────────────────┬───────────────┘
             │ JWT do usuário               │ compras
             ▼                              ▼
┌─ Supabase (sa-east-1) ────────────┐  ┌─ App Store / Play ─┐
│  Postgres + RLS (68 policies)     │  │  StoreKit / Billing│
│  15 tabelas · 23 views · 17 fns   │  └─────────┬──────────┘
│  Edge Functions:                  │            │ webhook
│   · agendapsi-chat (existente)    │            ▼
│   · sendpushnotification (v2)     │  ┌─ RevenueCat ───────┐
│   · analise-financeira  (NOVA)    │◄─┤  webhook → rc-webhook
│   · agente-psi          (NOVA)    │  └────────────────────┘
│   · rc-webhook          (NOVA)    │
└────────────┬──────────────────────┘
             │ cron / trigger
             ▼
┌─ n8n (dablab.app.n8n.cloud) ─┐   ┌─ Bird ─┐
│  disparo de SMS · campanhas  │──►│  SMS   │
└──────────────────────────────┘   └────────┘
```

### 4.3 Decisões de arquitetura com trade-off declarado

**D1 — O banco não é reescrito.**
As 15 tabelas, 23 views, 68 policies, 17 funções e 3 triggers continuam como estão. A reescrita é só do cliente.
*Por quê:* o modelo de dados está correto e é o que sustenta os 362 usuários existentes. Reescrever o banco significaria migração de dados e risco desproporcional.
*Trade-off:* o app novo herda as inconsistências de nomenclatura do banco (ver 7.6). Aceito.
*Premissa a validar:* que nenhuma view assume comportamento específico do cliente Flutter. As views foram lidas e não assumem — confirmado.

**D2 — O schema passa a ser versionado em migrations no repositório.**
Hoje o schema existe apenas no Supabase, construído pela UI e por MCP. O primeiro commit do repositório novo traz um `supabase db dump --schema public` como migration inicial.
*Por quê:* sem isso não há como revisar, reverter nem reproduzir o banco em ambiente de teste.
*Alternativa descartada:* continuar aplicando DDL pela UI. Já causou problema (ver aprendizado: `CREATE OR REPLACE VIEW` falhando por incompatibilidade de tipo).

**D3 — Os três webhooks n8n abertos viram Edge Functions.**
Hoje o app chama `https://dablab.app.n8n.cloud/webhook/...` **sem nenhuma autenticação**, em três lugares, com gravidades diferentes:

| Chamada | O que manda | Risco |
|---|---|---|
| `AgentePsi` | `usuario_id` **no corpo** + o texto do comando | **IDOR**: qualquer pessoa com a URL lê e escreve dados de qualquer psicólogo |
| `AnaliseFinanceira` | o payload financeiro inteiro de `v_dashboard_payload_json` | **vazamento de saída**: os números do usuário trafegam para uma URL pública |
| `MeAvisa` | título, mensagem e `currentUserEmail` (feedback e sugestão de local) | e-mail do usuário e texto digitado para URL pública; qualquer um pode gerar notificações falsas |

As três passam a ser Edge Functions do Supabase que validam o JWT e derivam o `usuario_id` do token, nunca do corpo (13.1, 13.2 e 13.4).
*Por quê:* o primeiro caso é falha de autorização direta a objeto (IDOR) sobre dados de saúde; os outros dois são exposição de dado pessoal.
*Trade-off:* as Edge Functions passam a ser um intermediário a manter. Elas podem continuar chamando o n8n por dentro, com um segredo compartilhado — o fluxo de IA não precisa ser reescrito, só protegido.
*Ver risco 23.1.*

**D4 — Mesmo bundle identifier no iOS.**
O app da App Store é **atualizado**, não substituído por um app novo. Os usuários recebem a versão nova pela atualização normal.
*Por quê:* preserva avaliações, histórico e a base instalada.
*Consequência:* não é possível rodar os dois em paralelo na mesma conta de loja. O paralelo se faz por TestFlight (ver 8.12).

### 4.4 Repositório e deploy

- Repositório novo, Git, monorepo simples: `app/` (Expo), `supabase/` (migrations + Edge Functions), `docs/`.
- Deploy do app: EAS Build + EAS Submit, canais `development`, `preview` (TestFlight / faixa interna da Play) e `production`.
- Deploy do banco: Supabase CLI, migrations aplicadas por comando, nunca pela UI.
- `CLAUDE.md` na raiz (seção 18).

---

## 5. Perfis de usuário e permissões

O app tem **um único perfil de usuário final**: o psicólogo (`profissional`). Não há administrador dentro do app — a administração (aprovar local sugerido, marcar feedback como tratado, inserir a fatura de SMS do mês) é feita direto no Supabase pelo dono do produto.

| Ação | Psicólogo autenticado | Não autenticado |
|---|---|---|
| Criar conta | ✅ | ✅ (é o único caminho) |
| Entrar | ✅ | ✅ |
| Ver/editar o próprio perfil | ✅ **só o próprio registro** (`usuario_id = auth.uid()`) | ❌ |
| CRUD de pacientes, sessões, pagamentos, despesas, preços, agenda | ✅ **só os próprios** (`usuario_id = auth.uid()`) | ❌ |
| Ver dados de outro psicólogo | ❌ nunca, em nenhuma circunstância | ❌ |
| Ver o catálogo `tipos_despesa` | ✅ leitura, global | ❌ |
| Locais de atendimento e comentários | **fora do MVP** — nenhuma tela do app v1 lê ou escreve essas tabelas. A RLS delas mesmo assim é corrigida (6.5) | ❌ |
| Desativar a própria conta | ✅ **só a própria** | ❌ |
| Tratar feedback, lançar fatura de SMS, moderar locais | ❌ — feito fora do app | ❌ |
| Comprar/gerenciar assinatura | ✅ **só a própria** | ❌ |
| Gravar em `assinaturas` | ❌ **ninguém pelo app** — só a Edge Function `rc-webhook` com `service_role` | ❌ |

**Não existe seed de primeiro administrador** porque não existe perfil administrador. O acesso administrativo é o acesso ao painel do Supabase, fora do escopo do app.

**Regra de acesso do app** (herdada do Flutter, mantida): autenticar no Supabase não basta. Depois do login bem-sucedido, o app consulta `v_profissional_atual`; se `ativo` for falso ou não houver registro, o app **desloga imediatamente** e mostra a mensagem de bloqueio. É assim que a desativação de conta funciona. Ver 6.3.

---

## 6. Autenticação e identidade

### 6.1 Identificação

E-mail e senha, no Supabase Auth (GoTrue), no mesmo projeto de hoje. Os usuários existentes continuam com as mesmas credenciais — não há migração, não há redefinição forçada de senha, o app novo simplesmente autentica contra o mesmo `auth.users` (365 contas, 362 com registro em `profissionais`).

Google e Apple ficam para v2 (seção 3). O login de convidado é removido, e com ele a constante `emailconvidado` do estado global e as duas guardas `currentUserEmail != 'demo@agendapsi.com'` (Trocar senha e Configurações).

### 6.2 Criação de conta

Autocadastro, na tela Nova conta. Duas operações **não transacionais**, nesta ordem:

1. `supabase.auth.signUp({ email, password })` → cria a linha em `auth.users`.
2. `INSERT INTO profissionais (nome, email, usuario_id)` → cria o registro do profissional. **`profissionais.email` é `NOT NULL` no banco** — o insert sem ele falha, e é justamente o passo que hoje não acontece nas contas órfãs.

**As 3 contas órfãs existentes** (em `auth.users` sem linha em `profissionais`) são resolvidas pelo caminho de baixo: no primeiro login bem-sucedido, o app cria o registro que faltou. Não é preciso migration para elas — mas a tela precisa pedir o nome, que não existe em lugar nenhum para essas contas.

**Correção obrigatória em relação ao app atual:** hoje, se o projeto Supabase exigir confirmação de e-mail, o passo 1 retorna sem sessão, o app aborta em silêncio, o passo 2 nunca acontece, e o usuário fica com uma conta órfã em `auth.users` que ao logar recebe "Usuário sem acesso ao app". O app novo trata os dois caminhos:

- **Sem confirmação de e-mail exigida** (sessão volta imediatamente): executa o passo 2 e leva o usuário para dentro do app.
- **Com confirmação exigida** (sessão não volta): mostra a tela "Confirme seu e-mail", explicando que ele deve clicar no link recebido. O passo 2 é executado **no primeiro login bem-sucedido**, verificando antes se já existe registro em `profissionais` para aquele `usuario_id` (idempotente — o app atual não verifica e pode criar linhas duplicadas).

*Premissa a validar antes de implementar:* qual é a configuração atual de "Confirm email" no projeto Supabase. A implementação cobre os dois casos, mas o texto da tela depende disso.

### 6.3 Fluxo pós-login (regra de autorização do app)

1. Autentica no Supabase.
2. Consulta `v_profissional_atual` (auto-filtrada por `auth.uid()`).
3. Se **existe registro e `ativo` é verdadeiro ou nulo**: carrega nome, telefone, linkedin e instagram no estado do app e entra na Home. (`profissionais.ativo` é **nullable** no banco, com default `true`; a view `v_profissional_atual` já faz `COALESCE(ativo, true)`. Nulo significa ativo.)
4. Se **existe registro e `ativo = false`**: mostra o alerta bloqueante (copy em 15.2), faz `signOut()` e permanece no Login.
5. Se **não existe registro**: leva para a tela Nova conta para completar o cadastro (o app atual só faz isso no fluxo Apple; aqui vale para todos).

### 6.4 Senha, sessão e exclusão de conta

| Item | Comportamento |
|---|---|
| **Recuperação de senha** | **Novidade obrigatória:** o app atual **não tem "esqueci minha senha" na tela de Login** — só troca de senha para quem já está logado. O app novo tem o link na tela de Login, usando `resetPasswordForEmail` com `redirectTo` apontando para um deep link do app. Sem isso, cada esquecimento vira suporte manual. |
| **Troca de senha (logado)** | Mantém o fluxo atual: dispara `resetPasswordForEmail` para o e-mail da conta, a partir de Configurações. |
| **Sessão** | Persistida em `expo-secure-store`, com auto-refresh do token. Expiração segue a configuração do projeto Supabase. |
| **Logout** | **Muda de lugar:** hoje o botão "Sair do app" fica no cabeçalho da Home, o que é atípico. No app novo ele vai para **Configurações**, com confirmação. Limpa o estado local e a sessão. |
| **Apagar minha conta** | Soft delete: `UPDATE profissionais SET ativo = false WHERE usuario_id = auth.uid()`. **Duas correções:** o campo de confirmação passa a ser editável (hoje é read-only, o que torna a feature inoperante), e o app **desloga imediatamente** após a desativação (hoje não desloga e o usuário continua navegando). Nenhum dado é apagado — ver risco 23.6. |

### 6.5 Autorização no banco (RLS)

As 68 policies existentes ficam. Convenção de nome para policies novas ou corrigidas: `<tabela>_<ação>_<sujeito>` (ex.: `assinaturas_select_proprio`).

| Tabela | Leitura | Escrita | Ação nesta reescrita |
|---|---|---|---|
| `profissionais` | próprio (`usuario_id = auth.uid()`) | próprio | manter |
| `pacientes`, `precos_paciente`, `sessoes`, `pagamentos`, `despesas`, `agenda_semana_padrao` | próprio | próprio | manter |
| `tipos_despesa` | autenticado, global | ninguém | manter |
| `locais_atendimento` | autenticado, **sem filtro de status** — o filtro de `aprovado` vive na view `view_locais_atendimento_cards`, não na policy | **hoje qualquer autenticado faz update e delete em qualquer local** (`locais_atendimento_update_auth` e `_delete_auth` têm `using (true)`) | **corrigir mesmo sem tela** (ver abaixo) |
| `comentarios_locais_atendimento` | autenticado, sem filtro de status | **hoje qualquer autenticado faz insert, update e delete em qualquer comentário** | **corrigir mesmo sem tela** (ver abaixo) |
| `feedback` | autenticado | insert liberado | manter |
| `notifications` | próprio | nenhuma pelo app | manter |
| **`assinaturas`** (nova) | próprio, via `v_meu_plano` | **nenhuma pelo app** — só `service_role` | criar: `assinaturas_select_proprio` |
| **`uso_mensal`** (nova) | próprio, via `v_meu_plano` | só trigger/`service_role` | criar: `uso_mensal_select_proprio` |

**Sobre as duas tabelas de locais:** o módulo saiu do MVP (seção 3), mas as tabelas continuam no banco, com dados, e as policies permissivas continuam valendo para qualquer usuário autenticado do app — inclusive dos usuários da v1, que não têm tela nenhuma para isso. Um buraco de RLS não some porque a tela sumiu. A migration 0004 corrige as duas: update e delete só do próprio (`criado_por_usuario_id = auth.uid()`), leitura de comentário só com `status = 'aprovado'`. Quando o módulo voltar (28.8), volta com a RLS já certa.

**Correção de segurança fora do escopo do app, a fazer de imediato:** o trigger `trigger-notification` na tabela `notifications` tem a chave `service_role` em **texto puro dentro da definição do trigger**, legível por quem tiver acesso ao catálogo do Postgres. Essa chave ignora todas as 68 policies. Mover para o Vault do Supabase e **rotacionar a chave**. Ver risco 23.2.

---

## 7. Modelo de dados

Convenção do banco: **português, `snake_case`**. O banco já está assim e não muda. O código TypeScript é em inglês; os tipos que espelham o banco mantêm os nomes em português (seção 18).

### 7.1 Diagrama

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
            ├──< assinaturas        (1:1, NOVA)
            ├──< uso_mensal         (1:N por mês, NOVA)
            └──< notifications

locais_atendimento ──< comentarios_locais_atendimento    (comunitário, sem tenancy)
custos_sms_mensal                                        (operacional, sem tenancy)
config_app                                               (chave/valor)
```

### 7.2 Tabelas existentes (não alterar)

**`profissionais`** — o registro do psicólogo. `id` uuid pk default `gen_random_uuid()`; `usuario_id` uuid **not null** (= `auth.users.id`); `nome` text **not null**; `email` text **not null** (⚠️ o insert de cadastro obrigatoriamente inclui o e-mail); `telefone` text; `linkedin` text; `instagram` text; `criado_em` timestamptz not null default `now()`; `ativo` boolean **nullable**, default `true` (**nulo significa ativo** — as views fazem `COALESCE(ativo, true)`); `fcm_token` text (nulo — push não implementado, ver 28.2); `usuario_fundador` boolean not null default `false` (195 registros marcados — usado no paywall, regra 11.6).

**`pacientes`** — `id` uuid pk; `usuario_id` uuid not null; `profissional_id` uuid (preenchido pelo trigger `trg_pacientes_sync_ids` em praticamente todas as linhas — **2 nulos em 1.065**; ver nota abaixo); `nome_completo` text not null; `telefone` text; `email` text; `status` text not null default `'ativo'` (valores: `ativo`, `inativo`); `observacoes` text; `primeira_consulta` date; `receber_sms` boolean not null default `false`; `criado_em` timestamptz not null default `now()`.
*Exclusão:* **hard delete**, com cascata para sessões, pagamentos, preços e agenda. É a única entidade do app com exclusão definitiva, e por isso a única com diálogo de confirmação nominal (copy em 15.4).

⚠️ **Os 2 pacientes com `profissional_id` nulo quebram o SMS.** A view `v_sms_lembretes_pendentes` monta o texto da mensagem concatenando `profissional_nome`, obtido por `LEFT JOIN profissionais ON pr.id = p.profissional_id`. Com `profissional_id` nulo a concatenação inteira vira nulo e o lembrete sai vazio. Corrigir os dois registros na migration 0004 e adicionar `COALESCE` na view.

**`precos_paciente`** — histórico **append-only** de preço. `id` uuid pk; `usuario_id` uuid not null; `profissional_id` uuid (preenchido pelo trigger `trg_precos_sync_ids` — 0 nulos em 773); `paciente_id` uuid not null; `preco` integer **not null** (CHECK `>= 0`); `vigencia_desde` date not null default `CURRENT_DATE`; `observacoes` text; `criado_em` timestamptz not null default `now()`.
*Nunca se faz update de preço — cria-se uma linha nova.* O preço vigente é derivado pelas views, nunca calculado no app.
*Trade-off declarado:* não há como agendar preço futuro nem corrigir vigência retroativa pela interface. Aceito — é o comportamento atual e ninguém pediu diferente.

**`sessoes`** — `id` uuid pk; `usuario_id` uuid not null; `profissional_id` uuid (**sempre nulo** — 1.178 de 1.178; esta tabela não tem trigger de sincronização); `paciente_id` uuid not null; `ocorreu_em` timestamptz not null default `now()` (**nunca escrito pelo app**); `ocorreu_em_dia` date not null default `CURRENT_DATE` (**esta é a data que a interface usa**); `status` text not null default `'realizada'` (nunca escrito pelo app); `modalidade` text (`presencial`, `remota`); `duracao_minutos` integer; `pagamento` text (`pagou`, `nao pagou`, `pagamento mensal` — sem acento em "nao", literal do banco); `devesercobrada` boolean default `true`; `observacoes` text; `criado_em` timestamptz not null default `now()`.

**`pagamentos`** — `id` uuid pk; `usuario_id` uuid not null; `profissional_id` uuid (**sempre nulo** — 451 de 451); `paciente_id` uuid not null; `valor_pagamento` integer **not null** (CHECK `>= 0`); `data_competencia` date default `CURRENT_DATE` (**o mês a que o pagamento pertence — é o que a interface mostra**); `pago_em` timestamptz (**o instante do registro no app, não a data escolhida**); `vencimento_em` date (nunca usado); `status` text not null default `'pendente'` (o app sempre grava `'pago'`); `metodo` text (nunca usado — ver 25.2); `tipo` text (`mensal`, `por sessão`); `observacoes` text; `criado_em` timestamptz not null default `now()`.

**`despesas`** — `id` uuid pk; `usuario_id` uuid not null; `tipo_despesa_id` uuid **not null** (FK); `descricao` text; `valor_despesa` integer **not null** (CHECK `>= 0`); `data_competencia` date default `CURRENT_DATE`; `pago_em` timestamptz; `status` text not null default `'pendente'` (o app sempre grava `'pago'`); `metodo` text (nunca usado); `observacoes` text; `criado_em` timestamptz not null default `now()`.

**`tipos_despesa`** — catálogo global, 13 linhas (todas ativas hoje). `id` uuid pk; `nome` text not null; `ativo` boolean not null default `true`; `criado_em` timestamptz not null default `now()`.
*O filtro `ativo = true` já vive na policy `tipos_despesa_select` — o app não precisa filtrar (princípio P2).* A correção em relação ao app atual é só a **ordenação por `nome`**, que hoje é inconsistente entre a tela de criação e a de detalhe.

**`agenda_semana_padrao`** — horário fixo semanal. `id` uuid pk; `usuario_id` uuid not null; `paciente_id` uuid not null; `dia_semana` smallint not null (1 = segunda … 7 = domingo); `hora_inicio` time not null; `hora_fim` time not null; `observacoes` text; `criado_em` timestamptz not null default `now()`.

**`sms_lembretes_enviados`** — log de SMS. `id` uuid pk; `agenda_id` uuid not null (FK para `agenda_semana_padrao`); `ocorrencia_inicio` timestamptz not null; `ocorrencia_data` date not null; `enviado_em` timestamptz not null default `now()`; `provider_message_id` text.
*Não tem `usuario_id`* — o profissional é derivado pelo join com `agenda_semana_padrao`. Isso importa para o paywall (regra 11.5).
*Constraint existente:* `sms_lembretes_enviados_un UNIQUE (agenda_id, ocorrencia_data)` — é ela que garante **um SMS por agendamento por dia**, e é a base da contagem do paywall. A FK já está indexada por esse unique; **não criar índice novo** sobre `agenda_id`.

**`locais_atendimento`** — diretório comunitário. **Fora do MVP** (seção 3): documentada porque a tabela existe, tem 12 linhas e sua RLS é corrigida na migration 0004. Nenhuma tela da v1 a lê ou escreve. `id` uuid pk; `nome` text not null; `cidade` text not null; `bairro` text (**nullable — causa do bug 11.9.8**); `estado` text not null; `tipo_local` text not null (`consultorio`, `coworking`, `clinica`); `url_contato` text; `origem` text not null (o app grava `'comunidade'`); `status` text not null default `'pendente'`; `criado_por_usuario_id` uuid; `criado_em` timestamptz not null default `now()`.

**`comentarios_locais_atendimento`** — **fora do MVP**, pelo mesmo motivo acima (0 linhas). `id` uuid pk; `local_atendimento_id` uuid not null; `comentario` text not null; `contexto_uso` text (nunca usado); `status` text not null default `'pendente'` (**mas o app grava `'aprovado'` explicitamente** — ver 25.3); `criado_por_usuario_id` uuid not null; `criado_em` timestamptz not null default `now()`.

**`feedback`** — `id` bigint pk; `created_at` timestamptz not null default `now()`; `email` text; `mensagem` text; `handle_at` timestamp (marcação administrativa); `app_name` text default `'agenda_psi'`.

**`notifications`** — 0 linhas, push não implementado. `id` bigint pk; `created_at` timestamptz not null default `now()`; `title` text not null; `body` text not null; `recipient_usuario_id` uuid not null; `is_read` boolean not null default `false`.

**`custos_sms_mensal`** — fatura real do Bird, fonte da verdade de custo. `mes` date pk; `valor_eur` numeric not null; `cambio_eur_brl` numeric not null; `mensagens_bird` integer; `fatura_numero` text; `fechado` boolean not null default `true`; `observacao` text; `atualizado_em` timestamptz not null default `now()`. CHECKs existentes: `valor_eur >= 0`, `cambio_eur_brl > 0`.

**`config_app`** — `chave` text pk; `valor` uuid.

### 7.3 Tabelas novas (paywall)

```sql
-- Plano vigente de cada profissional.
-- Fonte da verdade: webhook do RevenueCat. O app NUNCA escreve aqui.
create table assinaturas (
  profissional_id  uuid primary key references profissionais(id) on delete cascade,
  plano            text        not null default 'free',      -- free | pro
  status           text        not null default 'ativo',     -- ativo | em_atraso | cancelado | expirado
  store            text,                                     -- app_store | play_store | cortesia
  rc_customer_id   text,                                     -- id do cliente no RevenueCat
  rc_entitlement   text,                                     -- entitlement que concedeu o acesso
  inicio_em        timestamptz not null default now(),
  expira_em        timestamptz,                              -- nulo = sem expiração (cortesia)
  atualizado_em    timestamptz not null default now()
);

-- Consumo do mês por profissional. Alimentado por trigger, não pelo app.
create table uso_mensal (
  profissional_id  uuid        not null references profissionais(id) on delete cascade,
  mes              date        not null,                     -- sempre o dia 1 do mês
  sms_enviados     integer     not null default 0,
  atualizado_em    timestamptz not null default now(),
  primary key (profissional_id, mes)
);
```

**Nullability como decisão de negócio:**

| Campo | Quando é nulo | O que significa |
|---|---|---|
| `assinaturas.store` | assinatura de cortesia manual | concedida fora das lojas |
| `assinaturas.rc_customer_id` | cortesia, ou antes da primeira compra | o usuário nunca passou pelo RevenueCat |
| `assinaturas.expira_em` | plano `free`, ou cortesia vitalícia | acesso sem data de término |

**Constraints e índices:**

```sql
alter table assinaturas add constraint assinaturas_plano_valido
  check (plano in ('free','pro'));
alter table assinaturas add constraint assinaturas_status_valido
  check (status in ('ativo','em_atraso','cancelado','expirado'));
alter table assinaturas add constraint assinaturas_store_valida
  check (store is null or store in ('app_store','play_store','cortesia'));
create index idx_assinaturas_rc_customer on assinaturas (rc_customer_id);
create index idx_uso_mensal_mes on uso_mensal (mes);
-- NÃO criar índice sobre sms_lembretes_enviados(agenda_id): a constraint
-- sms_lembretes_enviados_un (agenda_id, ocorrencia_data) já indexa a FK.
-- O índice idx_sms_lembretes_enviados_agenda_data é redundante com ela —
-- candidato a DROP, não a CREATE.
```

**Constraints de valor já existentes nas tabelas de dinheiro:** `precos_paciente.preco >= 0`, `pagamentos.valor_pagamento >= 0`, `despesas.valor_despesa >= 0`. Ou seja, **o banco aceita zero e rejeita negativo.** A validação do app (regra 11.2) é mais estrita — exige inteiro **positivo** — e essa diferença é proposital: zero é tecnicamente válido mas não faz sentido de negócio. Os testes de 22 cobrem os dois lados.

*Estratégia de exclusão:* ambas as tabelas usam `on delete cascade` a partir de `profissionais`. Como a exclusão de profissional é soft (`ativo = false`), na prática nenhuma linha é apagada.

*Trade-off de `uso_mensal`:* mantemos um contador materializado em vez de contar `sms_lembretes_enviados` a cada verificação. Isso duplica a informação e pode divergir. Escolhido porque a view de disparo de SMS roda com frequência e um `count` com join a cada execução não escala. O contador é reconstruível a qualquer momento a partir do log (função `recontar_uso_mensal`, abaixo).

### 7.4 Lógica que vive no banco

| Nome | Tipo | Onde | Quando | O que faz |
|---|---|---|---|---|
| `trg_pacientes_sync_ids` | trigger | `pacientes` | before insert/update | **existente** — sincroniza `profissional_id` a partir de `usuario_id` |
| `trg_precos_sync_ids` | trigger | `precos_paciente` | before insert/update | **existente** — idem |
| `trigger-notification` | trigger | `notifications` | after insert | **existente** — chama a Edge Function de push. ⚠️ contém `service_role` em texto puro. Ver 6.5 |
| `current_profissional_id()` | função | — | — | **existente** — devolve o `profissionais.id` do usuário autenticado. Base das policies novas |
| `agentpsi_*` (9 funções) | funções | — | — | **existentes** — usadas pelo Agente Psi. Não alterar |
| **`fn_uso_mensal_incrementa`** | trigger | `sms_lembretes_enviados` | after insert | **NOVA** — deriva o `usuario_id` via join com `agenda_semana_padrao`, converte para `profissionais.id` (que é a chave de `uso_mensal`), e faz upsert somando 1 no mês de `enviado_em`. **São dois saltos, não um** — `agenda_semana_padrao.usuario_id` → `profissionais.usuario_id` → `profissionais.id` |
| **`recontar_uso_mensal(p_mes date)`** | função | — | manual | **NOVA** — reconstrói `uso_mensal` do mês a partir de `sms_lembretes_enviados`. Rede de segurança para divergência do contador |
| **`limite_sms_do_plano(p_profissional_id uuid)`** | função | — | — | **NOVA** — devolve o limite de SMS do mês para aquele profissional (regra 11.5) |
| **`v_meu_plano`** | view | — | — | **NOVA** — plano, status, limite, consumido e restante do mês corrente, auto-filtrada por `auth.uid()` |
| **`v_sms_lembretes_pendentes`** | view | — | — | **ALTERAR** — passa a excluir quem estourou o limite (regra 11.5). É o ponto único de enforcement do paywall |

Toda função, trigger e policy leva comentário em português dizendo o que faz e qual regra deste spec implementa (seção 18).

### 7.5 Seed e migrations

- **Migration 0001:** dump do schema atual (`supabase db dump --schema public`), incluindo tabelas, views, funções, triggers e policies. É o retrato do que existe hoje.
  ⚠️ **O dump inclui a definição do `trigger-notification`, e com ela a chave `service_role` em texto puro.** Rodar este passo como está copia a chave para dentro do repositório Git, onde ela fica no histórico para sempre. Ordem obrigatória: **corrigir o trigger e rotacionar a chave ANTES de gerar a 0001** — ou, se o dump já tiver sido gerado, reescrever a linha do trigger à mão antes do primeiro commit e rotacionar mesmo assim.
- **Migration 0002:** tabelas `assinaturas` e `uso_mensal`, constraints, índices, policies novas.
- **Migration 0003:** funções e trigger do paywall, view `v_meu_plano`, alteração de `v_sms_lembretes_pendentes`.
- **Migration 0004:** correções de RLS de `comentarios_locais_atendimento` e `locais_atendimento` (6.5); `COALESCE` no `profissional_nome` de `v_sms_lembretes_pendentes` e correção dos 2 pacientes com `profissional_id` nulo (7.2).
- **Migration 0005:** `trigger-notification` refeito lendo o segredo do Vault, e rotação da `service_role`.
- **Seed:** `INSERT INTO assinaturas` para os 195 `usuario_fundador`, com `plano='pro'`, `store='cortesia'`, `expira_em=null` (regra 11.6). Os demais nascem `free` na primeira leitura de `v_meu_plano` (a view trata a ausência de linha como `free`, então não é preciso semear todo mundo).

*Após cada migration com DDL, rodar `get_advisors` (segurança e performance) — o Supabase pega RLS faltando, `SECURITY DEFINER` exposto, `search_path` mutável e FK sem índice.*

### 7.6 Inconsistências herdadas do banco (documentadas, não corrigidas)

Estas ficam como estão para não quebrar as views e os dados existentes. O agente de código deve conhecê-las para não "consertar" por conta própria:

1. `devesercobrada` sem separador de palavras (as outras colunas usam `snake_case`).
2. `pagamentos.tipo` aceita `'por sessão'` **com acento e espaço**, enquanto `sessoes.pagamento` aceita `'nao pagou'` **sem acento**. É assim no banco.
3. `feedback` usa `created_at` e `handle_at` em inglês; o resto do banco é português.
4. `profissionais.id` e `profissionais.usuario_id` são dois uuids diferentes para a mesma pessoa; a maioria das tabelas usa `usuario_id`, e `profissional_id` fica nulo ou é preenchido por trigger. **Toda query nova filtra por `usuario_id`.**
5. `sms_lembretes_enviados` não tem `usuario_id` — exige join com `agenda_semana_padrao`.
---

## 8. Épicos e critérios de aceite

Ordem de implementação. Cada épico só começa quando o anterior passou nos seus critérios.

### 8.1 Fundação

**Objetivo:** projeto Expo rodando em iOS e Android, autenticado contra o Supabase existente, com o design system da seção 16 aplicado.

**Entregas:** scaffold Expo SDK 57 + expo-router + TypeScript strict; projeto no EAS com os três canais; cliente Supabase com sessão em `expo-secure-store`; TanStack Query configurado; tipos do banco gerados (`supabase gen types`); tokens de design, tipografia e componentes base (botão, campo, cartão, lista, estado vazio, estado de erro, spinner, folha modal).

**Critérios de aceite**

- [ ] `eas build --profile development` produz builds que instalam em iPhone e Android.
- [ ] Login com uma conta real de produção entra no app; login com senha errada mostra mensagem em português.
- [ ] Fechar e reabrir o app mantém a sessão sem pedir login de novo.
- [ ] `npx tsc --noEmit` passa sem erro.
- [ ] Os componentes base renderizam corretamente em modo claro e escuro, no iOS e no Android.

### 8.2 Autenticação e conta

**Objetivo:** entrar, criar conta, recuperar senha e sair, com todos os caminhos de erro tratados.

**Fluxo:** Login → (sucesso) consulta `v_profissional_atual` → `ativo=true` entra / `ativo=false` bloqueia e desloga / sem registro leva para Nova conta. Nova conta → `signUp` → se sessão volta, insere em `profissionais` e entra; se não volta, mostra "Confirme seu e-mail" e o insert acontece no primeiro login (idempotente). Esqueci minha senha → `resetPasswordForEmail` com deep link.

**Critérios de aceite**

- [ ] Criar conta com e-mail novo resulta em uma linha em `auth.users` e exatamente uma em `profissionais`.
- [ ] Criar conta duas vezes com o mesmo `usuario_id` não cria linha duplicada em `profissionais`.
- [ ] Usuário com `ativo = false` vê a mensagem de bloqueio, é deslogado e permanece na tela de Login.
- [ ] "Esqueci minha senha" envia o e-mail e o link abre o app na tela de nova senha.
- [ ] Senha e confirmação divergentes mostram mensagem **em português** (hoje é `Passwords don't match!`).
- [ ] Nenhum botão de submit fica ativo durante a chamada; nenhum erro do Supabase aparece cru em inglês.

### 8.3 Navegação e Home

**Objetivo:** estrutura de abas e o dashboard.

**Abas (5):** Início, Agenda, Pacientes, Despesas, Configurações. **Mudança em relação ao app atual:** o app FlutterFlow tem 6 abas — a quinta era Locais de atendimento, que saiu do MVP (seção 3). Com isso morre também o defeito do rótulo dessa aba, que estava escrito "Pacientes" por erro de cópia. **Correção que permanece:** os rótulos passam a aparecer (hoje estão ocultos, e cinco ícones sem rótulo obrigam a decorar).

**Dashboard:** lê uma linha de `v_dashboard_resumo` e monta 13 indicadores (tabela 11.1). Um cartão de largura total (Pacientes ativos) e 12 em pares. Botão "Análise com IA" que chama a Edge Function `analise-financeira` e preenche o cartão de resultado.

**Correções em relação ao app atual:** valores monetários passam a ser formatados em BRL (regra 11.3, hoje saem como inteiro cru); a análise ganha esqueleto de carregamento e tratamento de erro, preservando o resultado anterior em caso de falha (hoje o resultado é zerado antes da chamada e se perde); os campos `riscos` e `oportunidades` — hoje extraídos e nunca exibidos — passam a ser exibidos; "Sair do app" sai do cabeçalho e vai para Configurações.

**Critérios de aceite**

- [ ] Os 13 indicadores batem com o resultado de `select * from v_dashboard_resumo` para a mesma conta.
- [ ] Valores monetários aparecem como `R$ 1.234`; percentuais com uma casa (`42,5%`); nulos aparecem como `R$ 0` e `0`.
- [ ] Enquanto a query carrega, aparece esqueleto — não cartões zerados.
- [ ] Tocar em "Análise com IA" mostra progresso e exibe as quatro seções (Resumo, Riscos, Oportunidades, Ações prioritárias).
- [ ] Se a análise falhar, aparece mensagem de erro com opção de tentar de novo, e a análise anterior **não** é perdida.
- [ ] A barra tem 5 abas, todas com rótulo visível, e não há aba de Locais.

### 8.4 Pacientes

**Objetivo:** CRUD completo de paciente com busca, mais o histórico de preço.

**Fluxo:** Lista (`v_pacientes_cartao`, busca por nome, ordenada por status e nome) → Detalhe (dados + preço vigente + três históricos + atalhos para registrar sessão e pagamento) → Editar / Novo / Atualizar preço.

**Correções:** preço passa a ser obrigatório e só aceita inteiro no cadastro e na atualização (hoje grava `NULL` numa coluna `NOT NULL` quando o campo está vazio ou tem vírgula); nome e telefone obrigatórios também na edição (hoje só no cadastro); **o cartão "Preço atual" e os totais passam a vir de query invalidável, não do parâmetro de rota** — hoje eles vêm da linha de `v_pacientes_cartao` recebida na navegação e nunca recarregam, então atualizar o preço não muda nada na tela (o diálogo de atualização é o único modal da tela que nem chama `setState` ao fechar); navegação após salvar volta ao detalhe do paciente em vez de empilhar a lista; atualização de preço abre sempre como folha modal (hoje o card abre diálogo e o botão abre folha, para o mesmo componente); as listas de histórico ordenam pela mesma coluna que exibem (hoje ordenam por `pago_em`/`criado_em` e exibem `data_competencia`/`vigencia_desde`); edição de paciente passa a emitir evento de analytics.

**Critérios de aceite**

- [ ] Buscar "ana" retorna pacientes com "ana" em qualquer posição do nome, sem diferenciar maiúsculas.
- [ ] Cadastrar paciente cria uma linha em `pacientes` e uma em `precos_paciente` com o preço informado.
- [ ] Tentar salvar sem preço, ou com `150,00`, bloqueia o botão e mostra erro no campo — nenhuma linha é criada.
- [ ] Registrar uma sessão pelo detalhe faz a sessão aparecer no histórico **sem sair da tela**.
- [ ] Atualizar o preço cria uma nova linha em `precos_paciente` e o card "Preço atual" mostra o novo valor imediatamente.
- [ ] Excluir paciente pede confirmação nominal e remove também sessões, pagamentos, preços e agenda daquele paciente.

### 8.5 Sessões

**Objetivo:** registrar, editar e excluir sessão.

**Campos:** data (obrigatória, default **hoje**), modalidade (`presencial` / `remota`, default `presencial`), pagamento (`pagou` / `nao pagou` / `pagamento mensal`, default `pagamento mensal`), sessão será cobrada (default marcado), duração em minutos, observações.

**Correções:** ⚠️ o app atual, ao **editar** uma sessão, grava `duracao_minutos` a partir do **campo de data** — o parse falha e toda edição zera a duração no banco. Corrigido: grava do campo de duração. Data e modalidade ganham default (hoje começam vazios e o usuário precisa abrir o seletor para a data existir). Exclusão ganha confirmação.

**Critérios de aceite**

- [ ] Nova sessão grava `paciente_id`, `usuario_id`, `ocorreu_em_dia`, `modalidade`, `duracao_minutos`, `pagamento`, `devesercobrada`, `observacoes` — e nada mais.
- [ ] Editar uma sessão de 50 minutos mudando só a observação mantém `duracao_minutos = 50`.
- [ ] Excluir pede confirmação.
- [ ] Erro de escrita mostra mensagem de erro e **não** mostra "Sessão registrada".

### 8.6 Pagamentos

**Objetivo:** registrar, editar e excluir pagamento.

**Campos:** tipo (`mensal` / `por sessão`), data de competência (default hoje), valor, observações.

**Correções:** ⚠️ mesmo bug da sessão — o app atual grava `valor_pagamento` a partir do campo de data ao editar, zerando o valor; e o dropdown de tipo é editável mas nunca é salvo. Ambos corrigidos. **Melhoria:** o valor passa a vir **pré-preenchido com o preço vigente do paciente** (`v_pacientes_cartao.preco_vigente`), editável — é a melhoria de fluxo mais óbvia da tela e encurta o registro entre sessões (persona 2). O rótulo do campo de data passa a ser "Mês de competência", que é o que ele de fato é.

**Critérios de aceite**

- [ ] Abrir "Registrar pagamento" para um paciente de R$ 200 mostra `200` já preenchido.
- [ ] Salvar grava `valor_pagamento`, `data_competencia` (escolhida), `pago_em` (agora), `status='pago'`, `tipo`, `paciente_id`, `usuario_id`, `observacoes`.
- [ ] Editar um pagamento de R$ 300 mudando só a observação mantém `valor_pagamento = 300`.
- [ ] Editar o tipo de `mensal` para `por sessão` persiste no banco.

### 8.7 Despesas

**Objetivo:** listar, registrar, editar e excluir despesa — e fazer a pessoa começar a lançar.

**Correções:** ⚠️ o dropdown de tipo começa com a string literal `Option 1` (placeholder do FlutterFlow); sem seleção, o insert falha contra uma coluna `uuid NOT NULL` e **o app mostra "Despesa cadastrada" mesmo assim**. Corrigido: tipo obrigatório, sem valor inicial inválido, botão bloqueado até a seleção. O catálogo passa a filtrar `ativo = true` e ordenar por nome nas duas telas.

**Melhoria de produto (persona, seção 2):** a lista ganha **estado vazio com chamada para ação** — 98 despesas em toda a base contra 451 pagamentos mostram que a feature não é descoberta. Copy em 15.6. Não é enfeite: é o item do funil com menor adesão.

**Critérios de aceite**

- [ ] Com zero despesas, a tela mostra o estado vazio com o botão de registrar, não uma área em branco.
- [ ] Salvar sem escolher o tipo é impossível — o botão fica desabilitado.
- [ ] A lista mostra as 30 mais recentes, da mais nova para a mais antiga (**correção:** o app atual reordena a view e mostra da mais antiga para a mais nova).
- [ ] Cada item mostra descrição, tipo e valor em BRL.
- [ ] Se a descrição for nula, o item mostra o nome do tipo — não quebra (hoje quebra).

### 8.8 Agenda semanal

**Objetivo:** grade de horários fixos por dia da semana, com criar, editar notas e excluir.

**Fluxo:** seletor de dia (1–7, default = dia atual) → 14 blocos de hora (08:00 a 21:00) → cada bloco lista `hh:mm - Nome do paciente` → tocar abre o detalhe.

**Correções:** ⚠️ o app atual, ao salvar as notas de um agendamento, **grava `dia_semana = 1`** — um agendamento de quinta vira segunda. Corrigido: o salvar grava apenas `observacoes`. O seletor de dia passa a abrir no dia de hoje (hoje abre sempre em segunda). Salvar com campo faltando passa a mostrar erro (hoje aborta em silêncio e o usuário acha que o botão está quebrado). Exclusão ganha confirmação. Passa a validar `hora_fim > hora_inicio` e a avisar quando já existe agendamento no mesmo dia e hora.

**Critérios de aceite**

- [ ] Editar as notas de um agendamento de quinta-feira mantém o agendamento na quinta.
- [ ] Criar agendamento com hora fim anterior à hora início mostra erro e não grava.
- [ ] Tocar em Salvar sem escolher paciente mostra erro no campo.
- [ ] A grade abre no dia da semana de hoje.
- [ ] Criar um agendamento faz ele aparecer na grade sem precisar sair e voltar.
- [ ] Excluir pede confirmação.

### 8.9 Agente Psi

**Objetivo:** comando em linguagem natural que registra sessão, despesa e pagamento, e responde perguntas.

**Correção estrutural:** a tela existe no app atual (`/Agente`) mas **nenhuma tela navega para ela** — é órfã, alcançável só por deep link, e não tem nem botão de voltar. No app novo ela ganha entrada: **botão no cabeçalho da Home**.

**Correção de segurança (D3):** o app deixa de chamar o webhook n8n aberto e passa a chamar a Edge Function `agente-psi`, que valida o JWT e deriva o `usuario_id` do token. O corpo da requisição passa a levar **só o texto** — nunca o `usuario_id`.

**Correção de privacidade:** o app atual manda o **texto integral do comando** para o PostHog como propriedade do evento `psi_perguntou_assistente`. Como o comando costuma conter nome de paciente e valor pago, isso para. O evento passa a levar só o comprimento do texto e se a resposta veio com sucesso. Ver 20.4.

**Melhorias:** vira chat com histórico da conversa na sessão (hoje é pergunta única, e a resposta anterior some ao enviar a próxima); a resposta é renderizada como Markdown (hoje o texto sai com asteriscos crus); o campo é limpo após enviar; há spinner e o botão desabilita.

**Critérios de aceite**

- [ ] Existe um caminho visível da Home até o Agente Psi, e dele de volta.
- [ ] "Registre uma despesa de estacionamento de 30 reais hoje" cria a despesa e ela aparece na aba Despesas.
- [ ] A requisição para a Edge Function **não** contém `usuario_id` no corpo; a função rejeita chamada sem JWT válido com 401.
- [ ] O evento no PostHog **não** contém o texto do comando.
- [ ] Falha de rede mostra erro e mantém a conversa anterior na tela.

### 8.10 Configurações e conta

**Objetivo:** fechar a paridade — perfil, senha, feedback, política, logout, exclusão de conta.

*(Na v1.0 deste spec este épico incluía Locais de atendimento. O módulo saiu do MVP — seção 3 — e o detalhe está preservado em 28.8.)*

**Correções:** "Meu perfil" passa a ler do banco, não do cache local (hoje mostra dado defasado se algo mudar fora do app); o feedback passa a exigir mensagem não vazia (hoje aceita em branco e dispara um e-mail vazio ao administrador); a exclusão de conta passa a **funcionar** — o campo de confirmação é read-only no app atual, o que torna a feature inoperante — e a deslogar imediatamente; a política de privacidade ganha entrada em Configurações (hoje só é acessível pela tela de Login); logout ganha item em Configurações, com confirmação, saindo do cabeçalho da Home.

**Critérios de aceite**

- [ ] Digitar `QUERO DELETAR` e confirmar desativa a conta e desloga o usuário imediatamente.
- [ ] Alterar o nome em "Meu perfil", sair e voltar mostra o nome novo — sem precisar deslogar.
- [ ] Feedback vazio não pode ser enviado.
- [ ] A política de privacidade abre a partir de Configurações e a partir do Login.
- [ ] Sair pede confirmação e limpa a sessão.
- [ ] **Mesmo sem tela de locais no app**, um usuário autenticado não consegue editar nem apagar local ou comentário de outro — verificado direto contra a RLS (migration 0004).

### 8.11 Paywall por SMS

**Objetivo:** limitar o envio de lembretes por SMS no plano gratuito e vender o plano Pro pelas lojas.

**A regra de ouro:** o enforcement é **no banco**, na view `v_sms_lembretes_pendentes`. O app React Native só exibe consumo e vende. Um cliente comprometido não consegue mandar um SMS a mais.

**Fluxo do usuário**
1. Na Home e na tela do plano, ele vê "Você usou 7 de 10 lembretes deste mês".
2. Ao chegar em 8 de 10, aparece um aviso na Home com o caminho para o Pro.
3. Ao estourar o limite, os lembretes daquele mês param de sair. O app avisa, e os agendamentos afetados aparecem marcados na agenda.
4. Tocar em "Assinar o Pro" abre o paywall do RevenueCat.
5. Compra confirmada → RevenueCat chama `rc-webhook` → `assinaturas` vira `pro` → na próxima leitura de `v_meu_plano` o app mostra ilimitado e os SMS voltam a sair.
6. "Restaurar compras" reativa o Pro em um aparelho novo.

**Fluxo do servidor**
- Cada insert em `sms_lembretes_enviados` dispara `fn_uso_mensal_incrementa`, que soma 1 em `uso_mensal` do profissional (derivado por join com `agenda_semana_padrao`).
- `v_sms_lembretes_pendentes` ganha a condição da regra 11.5.
- `rc-webhook` valida a assinatura do webhook do RevenueCat, mapeia `app_user_id` → `profissional_id` e faz upsert em `assinaturas`.

**Identificação no RevenueCat:** o `appUserID` é o `profissionais.usuario_id` (o uuid do Supabase Auth), passado no `Purchases.logIn` logo após o login. Nunca usar o ID anônimo do RevenueCat — sem isso, a compra não liga na conta.

**Critérios de aceite**

- [ ] Um profissional `free` com 10 SMS no mês não aparece em `v_sms_lembretes_pendentes`, mesmo tendo agendamentos com `receber_sms = true`.
- [ ] O mesmo profissional, depois de virar `pro`, volta a aparecer na mesma consulta.
- [ ] Um profissional com `usuario_fundador = true` nunca é bloqueado, independente do volume.
- [ ] O contador zera na virada do mês (fuso America/Sao_Paulo — regra 11.5).
- [ ] Comprar no ambiente sandbox da App Store muda `assinaturas.plano` para `pro` em menos de 30 segundos, sem o app escrever no banco.
- [ ] "Restaurar compras" em um segundo aparelho, com a mesma conta, recupera o Pro.
- [ ] Cancelar a assinatura na loja faz `status` virar `cancelado` e, ao expirar, `plano` voltar para `free`.
- [ ] O app nunca concede acesso Pro com base em resposta local do StoreKit sem que `assinaturas` confirme.
- [ ] `recontar_uso_mensal` para um mês passado produz os mesmos números de `select count(*) from sms_lembretes_enviados ... group by`.

### 8.12 Publicação e corte

**Objetivo:** trocar o app FlutterFlow pelo app Expo nas lojas, sem perder usuário.

**Passos:** produtos de assinatura criados no App Store Connect e no Play Console, ligados ao RevenueCat; inscrição no Small Business Program da Apple e no programa equivalente da Play (15% em vez de 30% — regra 11.7); build de produção; TestFlight e faixa interna da Play com o Alexandre e alguns fundadores; **duas semanas em paralelo** com o app atual; substituição do build de produção mantendo o mesmo bundle identifier; primeira publicação na Play Store.

**Critérios de aceite**

- [ ] O app Expo instala por cima do app FlutterFlow no iOS como atualização, mantendo a sessão.
- [ ] A ficha da Play Store passa na revisão, com a Política de Privacidade e a declaração de coleta de dados preenchidas.
- [ ] Os eventos `psi_*` aparecem no PostHog vindos do app novo, com os mesmos nomes.
- [ ] Uma compra real (não sandbox) em cada loja é concluída e refletida em `assinaturas`.

---

## 9. Fluxos principais ponta a ponta

### 9.1 Primeiro uso até o primeiro valor

Este é o fluxo que os dados dizem estar quebrado: 362 cadastrados, 168 com paciente, 85 com agenda, **16 ativos**. Cada degrau perde gente.

1. Instala → Nova conta → confirma e-mail (se exigido) → Login.
2. Home **vazia**: zero pacientes. Em vez dos 13 cartões zerados, mostra o estado de boas-vindas com um caminho único: "Cadastre seu primeiro paciente".
3. Cadastra paciente (nome, telefone, preço) → volta para a lista, agora com um cartão.
4. Detalhe do paciente → "Registrar sessão" → sessão gravada.
5. "Registrar pagamento" → valor já preenchido com o preço → gravado.
6. Home agora mostra números reais.
7. Agenda → cria o horário fixo semanal → **este é o passo que liga o SMS**.

**Caminho da exceção:** o usuário que cadastra paciente e some. Ele volta semanas depois e a Home mostra números velhos. O estado vazio e o de "sem movimento no mês" precisam ser diferentes — um convida a começar, o outro mostra o que existe.

### 9.2 A rotina entre sessões

O fluxo mais frequente e o mais sensível a atrito: Home → Pacientes → busca o nome → Detalhe → Registrar sessão → salva → Registrar pagamento → salva. **Sete toques.** Nenhuma tela desse caminho pode ganhar campo obrigatório novo sem justificativa escrita aqui.

### 9.3 Do limite ao pagamento

1. Décimo lembrete do mês sai; `uso_mensal` chega a 10.
2. O décimo primeiro agendamento do mês **não entra** em `v_sms_lembretes_pendentes`. Nada é enviado.
3. Na próxima abertura do app, a Home mostra o aviso de limite atingido.
4. Ele toca em "Ver planos" → paywall → compra.
5. `rc-webhook` grava `pro`.
6. `v_meu_plano` passa a devolver limite nulo (ilimitado) e o app tira o aviso.
7. O próximo lembrete do dia seguinte sai normalmente.

**Caminho da exceção — o lembrete perdido:** o SMS que não saiu **não é reenviado retroativamente** depois da compra. A assinatura libera dali para frente. Isso precisa estar escrito na tela do paywall (copy 15.7), senão vira reclamação.

### 9.4 Virada de mês

Na virada, `uso_mensal` ganha uma linha nova (a chave é `(profissional_id, mes)` e o upsert cria a do mês corrente). O contador do mês anterior fica no histórico. Nenhum job é necessário — a virada é consequência do `date_trunc` na regra 11.5. Fuso: **America/Sao_Paulo**, não UTC (regra 11.8).

---

## 10. Inventário de telas

Todas com o perfil `[Psi]` — há só um perfil. "M" = folha modal (bottom sheet), "T" = tela de rota.

| # | Tela | Tipo | Mostra | Lê | Escreve |
|---|---|---|---|---|---|
| 1 | Login | T | e-mail, senha, esqueci minha senha, criar conta, política | `v_profissional_atual` | — |
| 2 | Nova conta | T | nome, e-mail, senha, confirmação | — | `profissionais` |
| 3 | Confirme seu e-mail | T | instrução, reenviar | — | — |
| 4 | Nova senha (deep link) | T | senha, confirmação | — | `auth.users` |
| 5 | **Início** (aba 1) | T | 13 indicadores do mês, análise por IA, aviso de limite de SMS, atalho para o Agente | `v_dashboard_resumo`, `v_meu_plano` | — |
| 6 | **Agenda** (aba 2) | T | seletor de dia, 14 blocos de hora, agendamentos | `view_agenda_semana_padrao`, `v_meu_plano` | — |
| 7 | Novo agendamento | M | paciente, dia, hora início, hora fim, notas | `pacientes` | `agenda_semana_padrao` |
| 8 | Detalhe do agendamento | M | paciente, dia, horas (leitura), notas | — | `agenda_semana_padrao` |
| 9 | **Pacientes** (aba 3) | T | busca, cartões com nome, status, contato, sessões, preço, última sessão, não pagas | `v_pacientes_cartao` | `pacientes` (delete) |
| 10 | Novo paciente | T | nome, telefone, e-mail, observações, preço, receber SMS | — | `pacientes`, `precos_paciente` |
| 11 | Detalhe do paciente | T | dados, preço vigente, totais, 3 históricos, atalhos | `v_pacientes_cartao` (param), `sessoes`, `pagamentos`, `precos_paciente` | — |
| 12 | Editar paciente | T | nome, telefone, e-mail, observações, status, receber SMS | — | `pacientes` |
| 13 | Atualizar preço | M | preço atual, novo preço, observações | — | `precos_paciente` |
| 14 | Registrar sessão | M | data, modalidade, pagamento, cobrar, duração, observações | — | `sessoes` |
| 15 | Detalhe da sessão | M | os mesmos campos, editáveis exceto data | — | `sessoes` |
| 16 | Registrar pagamento | M | tipo, competência, valor (pré-preenchido), observações | `v_pacientes_cartao` | `pagamentos` |
| 17 | Detalhe do pagamento | M | tipo, competência (leitura), valor, observações | — | `pagamentos` |
| 18 | **Despesas** (aba 4) | T | últimas 30, estado vazio com CTA | `v_despesas_ultimas_30` | — |
| 19 | Registrar despesa | M | data, tipo, descrição, valor, observações | `tipos_despesa` | `despesas` |
| 20 | Detalhe da despesa | M | os mesmos, competência em leitura | `tipos_despesa` | `despesas` |
| 21 | **Configurações** (aba 5) | T | perfil, senha, plano, feedback, política, sair, apagar conta | `v_meu_plano` | — |
| 22 | Meu perfil | M | nome, telefone, linkedin, instagram | `v_profissional_atual` | `profissionais` |
| 23 | Trocar senha | M | e-mail (leitura), enviar | — | — |
| 24 | **Meu plano** | T | plano, consumo do mês, benefícios, assinar, restaurar | `v_meu_plano` | — |
| 25 | **Paywall** | M | planos, preço, botão de compra, restaurar | RevenueCat | — |
| 26 | Feedback | M | mensagem | — | `feedback` |
| 27 | Apagar minha conta | M | aviso, campo de confirmação | — | `profissionais` |
| 28 | Política de privacidade | T | texto integral | — | — |
| 29 | Agente Psi | T | exemplos, comando, conversa | — | via Edge Function |

São **29 telas**. As de número **3, 4, 24 e 25** não existem no app atual. O paywall cria ou altera **5, 6, 24 e 25**.

As 4 telas do módulo de Locais de atendimento — lista, sugerir local, comentários e novo comentário — estavam neste inventário na v1.0 e saíram com o corte de escopo. Elas voltam em 28.8, junto com a aba correspondente.

---

## 11. Regras de negócio

### 11.1 Indicadores do dashboard

Todos calculados por `v_dashboard_resumo` no banco. **O app não recalcula nenhum.** Janelas em UTC na view atual — ver regra 11.8.

| # | Cartão | Coluna da view | Formato |
|---|---|---|---|
| 1 | Pacientes ativos | `pacientes_ativos` | inteiro |
| 2 | Sessões no mês | `sessoes_mes_corrente` | inteiro |
| 3 | Sessões mês −1 | `sessoes_mes_anterior` | inteiro |
| 4 | Pagamentos no mês | `pagamentos_mes_corrente` | BRL |
| 5 | Pagamentos mês −1 | `pagamentos_mes_anterior` | BRL |
| 6 | Despesas no mês | `despesas_mes_corrente` | BRL |
| 7 | Despesas mês −1 | `despesas_mes_anterior` | BRL |
| 8 | Lucro no mês | `rentabilidade_mes_corrente` | BRL |
| 9 | Lucro mês −1 | `rentabilidade_mes_anterior` | BRL |
| 10 | Custo médio por paciente | `custo_medio_por_paciente_mes_corrente` | BRL |
| 11 | Receita média por paciente | `receita_media_por_paciente_mes_corrente` | BRL |
| 12 | Margem do mês | `margem_mes_corrente_pct` | percentual, 1 casa |
| 13 | Break-even (sessões) | `break_even_sessoes_mes_corrente` | inteiro |

### 11.2 Regras de preço

| Regra | Valor |
|---|---|
| Onde vive o preço | `precos_paciente`, append-only |
| Como se altera | **insert** de nova linha, nunca update |
| Vigência | sempre `CURRENT_DATE` — não há preço futuro nem retroativo |
| Preço vigente | calculado pelas views (`v_pacientes_cartao.preco_vigente`); o app **nunca** calcula |
| Unidade | **reais inteiros, sem centavos** (200 = R$ 200,00) |
| Validação | obrigatório, inteiro **positivo**. Vírgula, ponto e vazio são rejeitados **no app**, antes do insert. O banco é mais permissivo (CHECK `preco >= 0`, ou seja aceita zero) — a diferença é proposital |

### 11.3 Formatação

| O quê | Formato | Exemplo | Nulo vira |
|---|---|---|---|
| Dinheiro | BRL sem centavos, separador de milhar | `R$ 1.234` | `R$ 0` |
| Percentual | 1 casa, vírgula decimal | `42,5%` | `0%` |
| Data | `dd/MM/yyyy` **com zero à esquerda** (correção — hoje é `5/3/2026`) | `05/03/2026` | `—` |
| Hora | 24h | `14:30` | `—` |
| Telefone | armazenado com `+` e DDI; exibido formatado | `+55 21 99999-9999` | `—` |

### 11.4 Valores literais dos campos de escolha

Gravados **exatamente assim** no banco. Não normalizar, não acentuar, não traduzir.

| Campo | Valores | Rótulo na interface |
|---|---|---|
| `pacientes.status` | `ativo`, `inativo` | Ativo, Inativo |
| `sessoes.modalidade` | `presencial`, `remota` | Presencial, Remota |
| `sessoes.pagamento` | `pagou`, `nao pagou`, `pagamento mensal` | Pagou, Não pagou, Pagamento mensal |
| `pagamentos.tipo` | `mensal`, `por sessão` | Mensal, Por sessão |
| `pagamentos.status`, `despesas.status` | o app grava sempre `pago` | — |
| `agenda_semana_padrao.dia_semana` | `1`–`7` | Segunda … Domingo |
| `locais_atendimento.tipo_local` | `consultorio`, `coworking`, `clinica` | Consultório, Coworking, Clínica |
| `locais_atendimento.origem` | o app grava sempre `comunidade` | — |

### 11.5 Limite de SMS (o paywall)

| Regra | Valor | Onde é aplicada |
|---|---|---|
| Limite do plano `free` | **10 SMS por mês** | função `limite_sms_do_plano` |
| Limite do plano `pro` | ilimitado (função devolve `NULL`) | idem |
| Limite de `usuario_fundador` | ilimitado, independente de plano | idem |
| Unidade contada | uma linha em `sms_lembretes_enviados` = 1 | trigger `fn_uso_mensal_incrementa` |
| Mês de referência | `date_trunc('month', enviado_em AT TIME ZONE 'America/Sao_Paulo')` | trigger e view |
| Como o profissional é derivado | join `sms_lembretes_enviados.agenda_id` → `agenda_semana_padrao.usuario_id` | trigger |
| Onde o bloqueio acontece | **`v_sms_lembretes_pendentes`**, e só ali | banco |
| O que acontece ao estourar | o agendamento não entra na fila; nada é enviado; nada é enfileirado para depois | banco |
| Reenvio retroativo após assinar | **não existe** | — |
| Comportamento em caso de dúvida | se `assinaturas` não tem linha para o profissional, ele é `free` | view `v_meu_plano` |

**Escolha do número 10, declarada:** a mediana de consumo hoje é 8 SMS por mês, a média 13 e o p90 é 30. Um limite de 10 deixa a maioria dos usuários de SMS confortável e transforma o uso intenso em conversa sobre plano. Ver assunção 24.3 — este número é uma decisão de produto, não uma restrição técnica, e mudá-lo é alterar uma linha da função.

**Nota de precisão:** o Bird cobra cerca de 17% mais mensagens do que `sms_lembretes_enviados` registra (fragmentação e retentativas). O limite conta o número do **nosso** banco, que é menor que o real. Para um limite de 10 isso é irrelevante, mas está registrado para não gerar confusão ao comparar com a fatura.

### 11.6 Plano e cortesia

| Regra | Valor |
|---|---|
| Plano padrão | `free` |
| Fundadores (`profissionais.usuario_fundador = true`, 195 pessoas) | `pro` com `store = 'cortesia'` e `expira_em = null`, **vitalício** |
| Fonte da verdade do plano | tabela `assinaturas`, escrita **somente** pela Edge Function `rc-webhook` |
| O app pode conceder Pro sozinho? | **não**, em nenhuma hipótese |
| Assinatura cancelada na loja | `status = 'cancelado'`, mas o acesso continua até `expira_em` |
| Assinatura expirada | `plano = 'free'` |
| Assinatura em atraso (billing retry) | `status = 'em_atraso'`, acesso mantido durante o período de graça |

### 11.7 Comissão das lojas

Valores factuais verificados em setembro de 2026 (fontes no anexo). Entram aqui porque definem o preço.

| Regra | Valor |
|---|---|
| Apple, padrão | 30% no primeiro ano, 15% a partir do segundo |
| Apple, Small Business Program | **15% desde o primeiro ano**, para quem fatura menos de US$ 1 milhão/ano. Inscrição manual na conta de desenvolvedor |
| Google Play | **15% sobre assinaturas desde o primeiro dia**, para qualquer desenvolvedor. (A regra do 15% sobre o primeiro US$ 1 milhão de faturamento anual é separada e vale para compras em geral — para assinatura não muda nada, porque a taxa já é 15%) |
| Brasil, compra externa | O acordo da Apple com o CADE (dez/2025) permite link externo de pagamento e lojas alternativas no Brasil, com alíquotas próprias. **As regras ainda estavam sendo detalhadas quando este spec foi escrito** — ver risco 23.5. O MVP usa **IAP pelas lojas**, sem link externo |

### 11.8 Fusos e virada de dia

| Contexto | Fuso | Observação |
|---|---|---|
| Contagem de SMS do mês | **America/Sao_Paulo** | um SMS enviado dia 1 às 00:30 de Brasília conta no mês novo, não no anterior |
| `v_dashboard_resumo` | **UTC** (é como a view está hoje) | consequência: nos últimos 3h de cada mês, o dashboard já mostra o mês seguinte. Não corrigido no MVP — ver pergunta 25.5 |
| Datas escolhidas pelo usuário | data pura, sem hora e sem fuso | `ocorreu_em_dia`, `data_competencia`, `vigencia_desde` |
| `pago_em`, `criado_em` | timestamptz, instante do registro | não é a data escolhida |

### 11.9 Defeitos do app atual corrigidos nesta reescrita

Cada linha é um comportamento que **não** deve ser reproduzido. Este é o contrato do princípio P1, e cada linha vira um teste de regressão (22). **Os itens 8, 9 e 20 ficaram sem efeito** com o corte de Locais (seção 3) — a numeração é preservada para não quebrar referências, e eles voltam junto com o módulo em 28.8. **Restam 21 defeitos ativos.**

| # | Onde | Defeito | Correção |
|---|---|---|---|
| 1 | Detalhe da sessão | grava `duracao_minutos` a partir do campo de data → zera a duração | grava do campo certo |
| 2 | Detalhe do pagamento | grava `valor_pagamento` a partir do campo de data → zera o valor | grava do campo certo |
| 3 | Detalhe do pagamento | o tipo é editável mas nunca é salvo | passa a salvar |
| 4 | Detalhe do agendamento | salvar notas grava `dia_semana = 1` → o agendamento muda de dia | grava só `observacoes` |
| 5 | Registrar despesa | tipo começa com `Option 1`; sem seleção o insert falha e o app diz "Despesa cadastrada" | tipo obrigatório, botão bloqueado, erro tratado |
| 6 | Novo paciente / Atualizar preço | preço vazio ou com vírgula grava `NULL` em coluna `NOT NULL` | validação de inteiro obrigatório |
| 7 | Apagar minha conta | campo de confirmação é read-only → a feature **nunca funcionou** | campo editável + logout imediato |
| 8 | ~~Locais~~ | filtro `ILIKE` incondicional sobre `bairro` nulável esconde locais sem bairro | **não se aplica ao MVP** — módulo cortado (3). Registrado em 28.8 |
| 9 | ~~Comentários~~ | a tela mostra todos os status; o cartão conta só aprovados → números divergem | **não se aplica ao MVP** — idem |
| 10 | Nova conta | confirmação de e-mail pendente aborta em silêncio e deixa conta órfã | trata os dois caminhos |
| 11 | Detalhe do paciente | o cartão de preço e os totais vêm do parâmetro de rota e nunca recarregam; o diálogo de atualização de preço nem chama `setState` ao fechar → atualizar o preço não muda nada na tela | query invalidável em vez de parâmetro |
| 12 | Todas as escritas | nenhuma checa o resultado; sucesso é mostrado mesmo em falha | P3 |
| 13 | RLS de locais e comentários | qualquer autenticado pode editar e apagar **qualquer local e qualquer comentário** (policies com `using (true)`). **Continua valendo mesmo sem tela** — o app cortou o módulo, o banco não | RLS restrita ao autor, migration 0004 (6.5) |
| 14 | Listas | sem estado vazio e sem estado de erro | P3 |
| 15 | Novo agendamento | salvar com campo faltando aborta sem nenhuma mensagem | erro no campo |
| 16 | Agente Psi | tela sem entrada e sem botão de voltar | entrada na Home |
| 17 | Agente Psi, Análise IA, Feedback e Sugestão de local | **três** webhooks n8n sem autenticação: `AgentePsi` (com `usuario_id` no corpo — IDOR de leitura e escrita), `AnaliseFinanceira` (payload financeiro para URL pública) e `MeAvisa` (e-mail do usuário + texto digitado) | Edge Functions com JWT (13.1, 13.2, 13.4) |
| 18 | Agente Psi | texto do comando (com dados de paciente) enviado ao PostHog | só metadados |
| 19 | Todo o app | chaves de API de terceiros no bundle | Edge Functions |
| 20 | ~~Aba 5~~ | rótulo diz "Pacientes", leva para Locais | **deixa de existir** — a aba saiu com o módulo (8.3) |
| 21 | Vários | textos em inglês e erros de digitação (`confimar`, `Finalisando`, `Atulizar`, `irreverssível`) | ver seção 15 |
| 22 | Edição de paciente | quatro variáveis globais gravadas e nunca lidas | removidas |
| 23 | Editar paciente | sem validação de nome e telefone (o cadastro tem) | mesma validação |
| 24 | Login | tocar no fundo apaga o que foi digitado | removido |
---

## 12. Máquinas de estado

### 12.1 Assinatura (`assinaturas.status` × `plano`)

```
        compra confirmada
 free ─────────────────────► pro/ativo ──────┐
   ▲                            │ │          │ renovação
   │                            │ │          │ ok
   │           falha de cobrança│ │          └──► pro/ativo
   │                            ▼ │
   │                      pro/em_atraso ──── recuperada ──► pro/ativo
   │                            │
   │                            │ período de graça esgotado
   │                            ▼
   │                      pro/expirado
   │                            │
   └────────────────────────────┘  (volta a free na próxima leitura)

 pro/ativo ── cancelou na loja ──► pro/cancelado ── chega expira_em ──► pro/expirado ──► free
```

Transições **proibidas**: qualquer transição para `pro` que não venha de `rc-webhook`; qualquer escrita do app em `assinaturas`; conceder Pro a partir do resultado local do StoreKit sem confirmação do webhook.

**Cortesia** é um estado paralelo: `plano='pro'`, `store='cortesia'`, `expira_em=null`. Não sofre nenhuma transição automática. Só sai por escrita manual no banco.

### 12.2 Local de atendimento

**Fora do MVP** (seção 3) — mantido aqui porque as tabelas continuam no banco e o módulo volta em 28.8: `pendente` → `aprovado` (manual, no banco) → visível na lista; `pendente` → `rejeitado` (manual) → nunca visível. Nenhuma tela da v1 cria nem lê esses estados.

### 12.3 Falhas e o que o usuário vê

| Falha | Comportamento |
|---|---|
| Sem rede numa leitura | dados em cache com aviso discreto de "desatualizado"; botão de recarregar |
| Sem rede numa escrita | erro explícito, o formulário **mantém o que foi digitado**, botão de tentar de novo |
| Erro de RLS (403) | "Você não tem acesso a esse registro" e volta para a lista |
| Sessão expirada (401) | renova o token; se falhar, desloga e volta ao Login com aviso |
| Edge Function fora do ar | erro na tela que a chamou; o resto do app continua funcionando |
| Webhook do RevenueCat atrasado | o app mostra "Processando sua assinatura" e refaz a leitura de `v_meu_plano` em intervalos crescentes por até 2 minutos; depois disso, orienta a usar "Restaurar compras" |
| Compra cancelada pelo usuário | fecha o paywall sem erro |

---

## 13. Contratos das Edge Functions

Quatro funções novas em Deno, no projeto Supabase existente. Todas com `verify_jwt = true`, exceto `rc-webhook`. As três primeiras substituem os três webhooks n8n abertos de hoje (D3).

### 13.1 `agente-psi` (nova — substitui o webhook n8n aberto)

```
POST /functions/v1/agente-psi
Authorization: Bearer <JWT do usuário>
Body: { "chat": "Registre uma despesa de 30 reais hoje" }

200 → { "output": "Despesa registrada: R$ 30 em Transporte, hoje." }
401 → { "error": "nao_autenticado" }
400 → { "error": "chat_vazio" }
502 → { "error": "agente_indisponivel" }
```

**O `usuario_id` é derivado do JWT, nunca do corpo.** A função repassa para o n8n a combinação `{usuario_id derivado, chat}` junto com um segredo compartilhado em header, guardado nos secrets do projeto. Rate limit: 20 chamadas por usuário por hora.

### 13.2 `analise-financeira` (nova — mesmo motivo)

```
POST /functions/v1/analise-financeira
Authorization: Bearer <JWT do usuário>
Body: {}

200 → { "resumo": "...", "riscos": "...", "oportunidades": "...", "acoes_prioritarias": "..." }
401 → { "error": "nao_autenticado" }
502 → { "error": "analise_indisponivel" }
```

A função lê `v_dashboard_payload_json` **com o JWT do usuário** (a view se auto-filtra por `auth.uid()`), monta o payload e chama o n8n. O app deixa de ler a view diretamente e deixa de enviar o payload — hoje ele manda os números financeiros do usuário para uma URL pública sem autenticação. Rate limit: 10 por usuário por dia.

### 13.3 `rc-webhook` (nova)

```
POST /functions/v1/rc-webhook
Authorization: Bearer <segredo configurado no painel do RevenueCat>
verify_jwt = false
Body: evento de webhook do RevenueCat

200 → { "ok": true }
401 → assinatura inválida
```

Valida o header de autorização contra o segredo; mapeia `event.app_user_id` (= `profissionais.usuario_id`) para `profissional_id`; faz upsert em `assinaturas` conforme a tabela 11.6. Eventos tratados: `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE`, `PRODUCT_CHANGE`, `SUBSCRIPTION_PAUSED`, `UNCANCELLATION`. Idempotente: reprocessar o mesmo evento não muda o resultado. Usa `service_role`, que **só existe nos secrets da função**.

### 13.4 `notifica-admin` (nova — substitui o webhook `MeAvisa`)

```
POST /functions/v1/notifica-admin
Authorization: Bearer <JWT do usuário>
Body: { "tipo": "feedback", "referencia": "<id do registro em feedback>" }

200 → { "ok": true }
401 → { "error": "nao_autenticado" }
```

Hoje o app chama o webhook `MeAvisa` direto, sem autenticação, mandando o e-mail do usuário e o texto digitado — qualquer pessoa com a URL pode gerar notificações falsas ou coletar o que passa por ali. A função nova recebe só o **tipo e o id do registro**, busca o conteúdo no banco com o JWT do usuário e chama o n8n com o segredo compartilhado. Rate limit: 5 por usuário por hora.

No app atual o `MeAvisa` tem dois chamadores: feedback e sugestão de local. Com o corte do módulo de Locais (seção 3), **sobra só o feedback** — por isso o `tipo` tem um valor só. O campo continua existindo para o dia em que 28.8 voltar.

### 13.5 Existentes

`agendapsi-chat` (v5) e `sendpushnotification` (v1) continuam publicadas. O app FlutterFlow **não usa** nenhuma das duas — ele fala com o n8n. `agendapsi-chat` deve ser avaliada: ou vira a implementação de 13.1, ou é despublicada para não ficar superfície exposta sem uso (pergunta 25.6).

---

## 14. Exportação

Fora do MVP. Quando entrar (v2), o formato fica definido desde já para não virar retrabalho: CSV **UTF-8 com BOM** (abre no Excel brasileiro sem corromper acento), separador `;`, data `dd/MM/yyyy`, número com vírgula decimal, nome do arquivo `agenda-psi-<entidade>-<AAAA-MM>.csv`, respeitando o filtro aplicado na tela.

---

## 15. Copy e tom de voz

Conteúdo **final**, não placeholder. Tom: direto, em português do Brasil, sem jargão técnico, sem exclamação, sem "ops". Trata o usuário por você. Nunca mostra mensagem de erro de sistema em inglês.

### 15.1 Regras gerais
- Confirmação de ação: verbo no particípio, curto. "Sessão registrada." "Pagamento salvo." "Despesa excluída."
- Erro: diz o que houve e o que fazer. "Não foi possível salvar. Verifique sua conexão e tente de novo."
- Estado vazio: uma frase do que falta e um botão do que fazer.

### 15.2 Autenticação
| Situação | Texto |
|---|---|
| Título do login | `Seja bem-vindo(a)` |
| Subtítulo | `Vamos começar preenchendo as informações abaixo` |
| Botão | `Entrar` |
| Link | `Esqueci minha senha` |
| Link | `Não tem uma conta? Crie uma conta aqui` |
| Credencial errada | `E-mail ou senha incorretos.` |
| Conta desativada | `Sua conta está desativada. Se você pediu a exclusão, o acesso foi encerrado. Escreva para alexandre@dablab.com.br se quiser reativar.` |
| Senhas divergentes | `As senhas não são iguais.` |
| Confirme o e-mail | `Enviamos um link de confirmação para {email}. Abra o e-mail e toque no link para ativar sua conta.` |
| E-mail de senha enviado | `Enviamos um link para trocar sua senha.` |

### 15.3 Paciente, sessão, pagamento, despesa
| Situação | Texto |
|---|---|
| Paciente criado | `{nome} cadastrado.` |
| Paciente atualizado | `{nome} atualizado.` |
| Preço atualizado | `Novo preço de {valor} vigente a partir de hoje.` |
| Sessão criada / atualizada / excluída | `Sessão registrada.` / `Sessão atualizada.` / `Sessão excluída.` |
| Pagamento criado / atualizado / excluído | `Pagamento registrado.` / `Pagamento atualizado.` / `Pagamento excluído.` |
| Despesa criada / atualizada / excluída | `Despesa registrada.` / `Despesa atualizada.` / `Despesa excluída.` |
| Preço inválido | `Informe um valor inteiro, sem centavos. Ex: 200` |
| Nome vazio | `O nome é obrigatório` |
| Telefone vazio | `O telefone é obrigatório` |
| Tipo de despesa não escolhido | `Escolha o tipo da despesa` |

### 15.4 Confirmações destrutivas
| Ação | Texto |
|---|---|
| Excluir paciente | Título: `Excluir {nome}?` — Corpo: `Isso apaga também todas as sessões, pagamentos, preços e horários desse paciente. Não dá para desfazer. Se você só quer parar de atender, mude o status para Inativo.` — Botões: `Cancelar` / `Excluir` |
| Excluir sessão | `Excluir esta sessão? Não dá para desfazer.` |
| Excluir pagamento | `Excluir este pagamento? Não dá para desfazer.` |
| Excluir despesa | `Excluir esta despesa? Não dá para desfazer.` |
| Excluir agendamento | `Excluir o horário de {nome} na {dia} às {hora}?` |
| Sair | `Sair da sua conta?` |
| Apagar conta | `Essa operação é irreversível. Para confirmar, digite QUERO DELETAR no campo abaixo.` |
| Conta desativada | `Sua conta foi desativada. Até logo.` |

### 15.5 Estados vazios
| Tela | Texto |
|---|---|
| Home sem pacientes | `Comece cadastrando seu primeiro paciente.` + botão `Cadastrar paciente` |
| Home sem movimento no mês | `Nenhum lançamento neste mês ainda.` |
| Pacientes | `Você ainda não tem pacientes cadastrados.` + `Cadastrar paciente` |
| Busca sem resultado | `Nenhum paciente encontrado para "{busca}".` |
| Histórico de sessões | `Nenhuma sessão registrada ainda.` |
| Histórico de pagamentos | `Nenhum pagamento registrado ainda.` |
| Agenda | `Nenhum horário fixo em {dia}.` + `Adicionar horário` |

### 15.6 Despesas (a tela que precisa converter)
| Situação | Texto |
|---|---|
| Estado vazio | Título: `Você acompanha quanto entra. E quanto sai?` — Corpo: `Aluguel de sala, supervisão, transporte, material. Registrar as despesas é o que mostra o seu lucro de verdade, não só o faturamento.` — Botão: `Registrar primeira despesa` |
| Cabeçalho da lista | `Últimas 30 despesas` |

### 15.7 Paywall e plano
| Situação | Texto |
|---|---|
| Consumo no plano free | `Você usou {n} de {limite} lembretes por SMS neste mês.` |
| Aviso de 80% | `Faltam {n} lembretes no seu plano gratuito deste mês.` |
| Limite atingido | Título: `Seus lembretes por SMS pausaram até {data}` — Corpo: `Você usou os {limite} lembretes do plano gratuito. Seus pacientes com horário marcado não vão receber o SMS até a virada do mês.` — Botão: `Ver o plano Pro` |
| Tela do plano Pro | Título: `Agenda Psi Pro` — Corpo: `Lembretes por SMS sem limite, para todos os seus pacientes, todo mês. Cancela quando quiser, direto na sua conta da {loja}.` |
| Aviso importante no paywall | `Assinando agora, os lembretes voltam a sair a partir do próximo horário agendado. Os lembretes que não saíram neste mês não são reenviados.` |
| Processando | `Estamos confirmando sua assinatura. Isso leva alguns segundos.` |
| Assinatura confirmada | `Pronto. Seus lembretes estão liberados.` |
| Restaurar | `Restaurar compras` |
| Nada a restaurar | `Não encontramos nenhuma assinatura ativa nesta conta da {loja}.` |
| Fundador | `Você é um dos fundadores do Agenda Psi. Seus lembretes são ilimitados, sem mensalidade.` |
| Plano free, sem consumo | `Plano gratuito — {limite} lembretes por SMS por mês.` |

### 15.8 Agente Psi
| Situação | Texto |
|---|---|
| Título | `Agente Psi` |
| Instrução | `Escreva o que você quer registrar ou perguntar, do seu jeito.` |
| Exemplos | `Registre uma despesa de estacionamento de 30 reais hoje` · `Registre a sessão da Fernanda hoje, remota, 50 minutos` · `O João pagou 400 reais hoje no pix` · `Quanto foi o último pagamento da Fernanda?` |
| Placeholder | `Escreva aqui...` |
| Enviando | `Pensando...` |
| Erro | `Não consegui responder agora. Tente de novo em alguns instantes.` |

### 15.9 Erros genéricos
| Situação | Texto |
|---|---|
| Sem conexão | `Sem conexão. Verifique sua internet e tente de novo.` |
| Falha ao salvar | `Não foi possível salvar. Tente de novo.` |
| Falha ao carregar | `Não foi possível carregar. Toque para tentar de novo.` |
| Sem permissão | `Você não tem acesso a esse registro.` |
| Erro desconhecido | `Algo deu errado. Se continuar, escreva para alexandre@dablab.com.br.` |

### 15.10 Correções de texto do app atual
`irreverssível` → `irreversível` · `opcão` → `opção` · `Atulizar o preço` → `Atualizar o preço` · `confimar` → `confirmar` · `Finalisando` → `Finalizando` · `Paciente {nome}atualizado` (sem espaço) → `{nome} atualizado.` · `Select...` → `Selecione...` · `Passwords don't match!` → 15.2 · `Email required!` → removido · `Error: <supabase>` → mensagens de 15.2 e 15.9 · `, , adicionado por` → `, adicionado por`

*(As correções de `atedimento`, `Comentarios`, `Novo  comentário` e `Local cadastrado com sucesso Obrigado...` pertenciam ao módulo de Locais e voltam com ele em 28.8.)*

---

## 16. Direção visual — design system Apple

Este é um **app mobile de consumidor com navegação por abas**. Não usa menu lateral, portanto o padrão de navegação lateral estilo App Store Connect **não se aplica**.

A referência é a **Human Interface Guidelines da Apple**, com os apps nativos do iOS como modelo: Ajustes, Saúde, Lembretes. Legibilidade acima de personalidade, tipografia fazendo o trabalho da hierarquia, cor só onde significa alguma coisa.

### 16.1 O princípio multiplataforma

Um app que parece iOS puro rodando no Android é rejeitado pelos usuários e às vezes pela revisão da Play. A estratégia é **tokens únicos, dois temas de plataforma**: espaçamento, raio, hierarquia tipográfica e estrutura de tela são idênticos; tipografia, ícones, controles e transições seguem a plataforma.

| | iOS | Android |
|---|---|---|
| Tipografia | SF Pro (fonte do sistema) | Roboto (fonte do sistema) |
| Ícones | SF Symbols via `expo-symbols` | Material Symbols equivalentes |
| Cabeçalho | large title que colapsa ao rolar | top app bar |
| Modal | folha (sheet) com detentes | bottom sheet |
| Voltar | seta no cabeçalho + gesto de borda | seta + botão físico/gesto do sistema |
| Seletores de data e hora | picker nativo do iOS | picker nativo do Material |
| Switch, alerta, ação destrutiva | nativos de cada plataforma | idem |

### 16.2 Cor — paleta do sistema iOS, não uma paleta autoral

**Regra de origem:** nenhuma cor é inventada. Toda cor sai da paleta semântica do iOS (`UIColor.system*`). Paleta autoral dessaturada — verde-azulado de marca, verde escuro de sucesso, laranja queimado de aviso — é exatamente o que faz um app parecer template. As cores da Apple são vivas e específicas; as de template são lavadas e "de bom gosto".

**Não existe cor de marca neste app.** A cor de destaque é o **azul do sistema**, como em Ajustes, Lembretes, Telefone e Mail. O Agenda Psi não tem marca visual forte a defender, e inventar uma custa legibilidade sem devolver nada.

| Papel | Token iOS | Claro | Escuro |
|---|---|---|---|
| Destaque / ação | `systemBlue` | `#007AFF` | `#0A84FF` |
| Texto primário | `label` | `#000000` | `#FFFFFF` |
| Texto secundário | `secondaryLabel` | `#3C3C43` a 60% | `#EBEBF5` a 60% |
| Texto terciário | `tertiaryLabel` | `#3C3C43` a 30% | `#EBEBF5` a 30% |
| Fundo agrupado (tela) | `systemGroupedBackground` | `#F2F2F7` | `#000000` |
| Superfície de lista | `secondarySystemGroupedBackground` | `#FFFFFF` | `#1C1C1E` |
| Separador | `opaqueSeparator` | `#C6C6C8` | `#38383A` |
| Cinza de controle | `systemGray` | `#8E8E93` | `#8E8E93` |
| Positivo | `systemGreen` | `#34C759` | `#30D158` |
| Atenção | `systemOrange` | `#FF9500` | `#FF9F0A` |
| Destrutivo / negativo | `systemRed` | `#FF3B30` | `#FF453A` |

**Onde cada uma aparece — e só aí:**

- **Azul:** texto de linha de ação, ícone dessa linha, botão de voltar, controle selecionado, link. Nunca como fundo de bloco grande. Um botão preenchido azul por tela, no máximo, e só se a tela tiver uma ação de conclusão óbvia.
- **Verde:** valor monetário positivo no dashboard (Lucro do mês, Pagamentos), e nada mais. **Não** é cor de status de paciente, **não** é "Pagou".
- **Laranja:** o aviso de limite de SMS chegando. Um uso no app inteiro.
- **Vermelho:** ação destrutiva (Excluir, Apagar conta, Sair), valor de despesa e lucro negativo, erro de campo. Nada mais.
- **Cinza:** todo o resto. Status, metadados, rótulos, valores neutros.

**Teste de sanidade:** abra qualquer tela e conte as cores fora de preto, branco e cinza. Se passar de duas, está errada. A maioria das telas deve ter **uma** — o azul.

**Status não é pílula colorida.** O padrão do iOS para estado é texto secundário à direita da linha, ou a ausência de marcação. Paciente ativo não recebe nada (ativo é o normal); inativo recebe a palavra `Inativo` em cinza. `Pagou` / `Não pagou` é texto secundário, não semáforo.

### 16.3 Tipografia

Escala do sistema, com **Dynamic Type ativo** (o app responde ao tamanho de fonte do aparelho — requisito 17.4).

| Papel | Estilo | Uso |
|---|---|---|
| Large title | 34 / bold | título de aba que colapsa |
| Title 2 | 22 / bold | número principal de cartão |
| Headline | 17 / semibold | nome do paciente, título de item |
| Body | 17 / regular | texto padrão |
| Subheadline | 15 / regular | subtítulo, valor secundário |
| Footnote | 13 / regular | rótulo de cartão, metadados |
| Caption | 12 / regular | ajuda, texto legal |

Número financeiro em **variante tabular** — sem isso a coluna de valores dança a cada centavo.

### 16.4 Espaçamento e forma

Grade de 4pt: 4, 8, 12, 16, 20, 24, 32. Margem lateral padrão 16. Raio: 10 em cartão, 12 em folha modal, 8 em botão. Área mínima de toque 44×44pt. Sombra: nenhuma — separação por cor de superfície e hairline, como nos apps nativos.

### 16.5 Componentes-chave — a linguagem é lista, não cartão

O erro mais provável desta reescrita é desenhar tudo como cartão branco flutuando sobre cinza, com título em negrito dentro e padding generoso. Isso é vocabulário de dashboard web. iOS é **inset grouped list**: um container arredondado por grupo, linhas de 44pt dentro, separadas por hairline que começa no inset do texto, e o título do grupo **fora** do container, acima, em 13pt cinza.

**Teste antes de desenhar qualquer tela:** ela caberia dentro do app Ajustes, do Saúde ou do Lembretes? Se não, está errada.

**Linha de lista** — o átomo do app. Rótulo à esquerda em texto primário; valor à direita em cinza secundário; chevron só quando navega. Altura 44pt, inset 16pt. Todo par rótulo/valor é uma linha, nunca um bloco.

**Linha de ação** — SF Symbol tintado de azul à esquerda, texto em azul, sem chevron. É assim que "Registrar sessão" e "Registrar pagamento" aparecem no detalhe do paciente: duas linhas no primeiro grupo, como "Adicionar conta" no Ajustes — **não** dois botões preenchidos lado a lado no topo.

**Cabeçalho de grupo** — 13pt, `secondaryLabel`, sentença normal (não caixa alta), fora do container, alinhado à margem de 16pt.

**Botão** — iOS quase não tem botão preenchido. No máximo **um** por tela, largura total, no rodapé, e só onde há uma ação de conclusão (Entrar, Criar conta, Salvar em formulário modal, Assinar no paywall). Fora isso, ação é linha de lista ou item de navigation bar.

**Cartão de indicador (Home)** — é a **única** tela do app onde número grande é permitido. Rótulo em footnote no topo, valor em title 2 abaixo, SF Symbol discreto. Sem borda, sem sombra. Em tela de detalhe, número grande não existe: `Preço atual` … `R$ 200` é uma linha.

**Lista de pacientes** — nome em headline, metadados em subheadline cinza, linha inteira tocável com chevron. Excluir por **deslize**, nunca por botão visível sobre o item.

**Folha modal** — título centralizado, `Cancelar` à esquerda, ação primária à direita em azul (padrão iOS). Conteúdo rolável, teclado empurrando a folha. Detente médio para formulário curto, grande para longo.

**Estado vazio** — SF Symbol grande em `systemGray3`, título em headline, uma frase em body secundário, uma ação em azul. Nunca área em branco.

**Grade da agenda** — coluna de horas à esquerda em footnote tabular cinza, blocos à direita. Hora vazia com altura reduzida e hairline; hora ocupada com a linha do agendamento. Seletor de dia como segmented control de 7 posições.

**Nunca:** gradiente · sombra · borda em cartão · dois botões preenchidos na mesma tela · pílula colorida preenchida como status · número acima de 28pt fora da Home · cartão dentro de cartão · título de seção em negrito preto dentro do container · ícone dentro de círculo colorido · emoji.

### 16.6 Modo escuro

Obrigatório, seguindo o aparelho. Nenhuma cor definida fora dos tokens acima.

### 16.7 Livre para o agente escolher

Microanimações e transições (dentro do padrão da plataforma), curva e duração de animação, ordem visual dos campos dentro de um formulário desde que a ordem lógica do spec seja mantida, e a escolha exata de cada SF Symbol.

**Não é livre:** a paleta (16.2) e a escolha entre lista e cartão (16.5). As duas são a diferença entre um app que parece nativo e um que parece template.

---

## 17. Requisitos não-funcionais

| # | Requisito | Alvo |
|---|---|---|
| 17.1 | Abertura a frio até a primeira tela útil | ≤ 2,5 s em iPhone 12 / Android de gama média |
| 17.2 | Resposta de qualquer lista do app | ≤ 800 ms com rede boa; ≤ 200 ms quando há cache |
| 17.3 | Offline | **Leitura:** telas já visitadas abrem com cache do TanStack Query e aviso de desatualizado. **Escrita:** bloqueada, com erro claro; o formulário não perde o que foi digitado. Fila de escrita offline é v2 |
| 17.4 | Acessibilidade | Dynamic Type até `xxxLarge` sem quebra; contraste ≥ 4,5:1; área de toque ≥ 44×44pt; VoiceOver e TalkBack com rótulo em todo controle; nenhuma informação transmitida só por cor |
| 17.5 | Tamanho do binário | ≤ 60 MB por plataforma |
| 17.6 | Compatibilidade | iOS 16+; Android 8 (API 26)+ |
| 17.7 | Volume | ≤ 5 mil usuários, ≤ 500 pacientes por usuário, ≤ 50 mil sessões no total. Dimensiona a decisão de não paginar listas de paciente |
| 17.8 | Idioma | português do Brasil, único. Sem i18n no MVP |
| 17.9 | Consumo | sem trabalho em segundo plano; sem polling; sem localização |
| 17.10 | Crash-free | ≥ 99,5% das sessões |

---

## 18. Convenções de código e repositório

**Idioma.** Banco em **português**, `snake_case` — tabelas, colunas, enums, funções, triggers e policies. Código, variáveis, funções e nomes de arquivo em **inglês**. A fronteira fica na camada de acesso a dados: os tipos gerados do Supabase mantêm os nomes em português (`nome_completo`, `valor_pagamento`) e são usados assim no código. Não criar camada de tradução — ela só adiciona um lugar para o nome divergir.

**Comentários obrigatórios.** Toda função, hook, rotina de servidor, trigger e policy leva cabeçalho **em português** dizendo o que faz, o que recebe, o que devolve e **qual regra deste spec implementa, com o número da seção**. Lógica não óbvia leva comentário inline. O comentário descreve intenção e regra de negócio — `// incrementa i` é ruído; `// preço vem da view, nunca calculado no app (P2, regra 11.2)` é o que se procura seis meses depois.

**Estrutura de pastas**

```
app/                          # Expo
  app/                        # rotas do expo-router
    (auth)/                   # login, nova conta, esqueci a senha
    (tabs)/                   # as 6 abas
    patients/  sessions/  payments/  expenses/  schedule/
    settings/  paywall/  agent/
  src/
    features/<feature>/       # components, hooks, types, schemas — juntos
    components/ui/            # design system
    lib/supabase/             # cliente, tipos gerados, queries
    lib/purchases/            # RevenueCat
    lib/analytics/            # PostHog
    theme/                    # tokens, tipografia, temas de plataforma
supabase/
  migrations/                 # 0001_baseline.sql em diante
  functions/                  # agente-psi, analise-financeira, rc-webhook
docs/
  spec.md  DOCUMENTACAO-TECNICA.md  schema.md
CLAUDE.md  README.md
```

**Documentação viva.** `docs/schema.md` gerado a partir do banco real, não escrito à mão. `README.md` com setup local, variáveis de ambiente e como rodar migrations. `DOCUMENTACAO-TECNICA.md` conforme a seção 19. Os três atualizados **no mesmo commit** da mudança.

**`CLAUDE.md` na raiz** — lido automaticamente pelo Claude Code a cada sessão. Contém: as convenções acima, o mapa da arquitetura, os comandos (`npx tsc --noEmit`, `eas build`, `supabase db push`, `supabase gen types`), e as pegadinhas que **não podem ser quebradas**: nunca escrever em `assinaturas` pelo app; nunca calcular preço vigente no cliente; nunca mandar `usuario_id` no corpo de uma Edge Function; nunca colocar chave de terceiro no bundle; manter os nomes de evento `psi_*` idênticos; os valores literais da tabela 11.4 são literais do banco e não devem ser "normalizados".

**Variáveis de ambiente**

| Nome | Onde | Público? |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | app | sim |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | app | sim (protegida por RLS) |
| `EXPO_PUBLIC_POSTHOG_KEY` | app | sim (chave de escrita do PostHog é pública por design) |
| `EXPO_PUBLIC_RC_IOS_KEY` / `EXPO_PUBLIC_RC_ANDROID_KEY` | app | sim (chaves públicas do RevenueCat) |
| `SUPABASE_SERVICE_ROLE_KEY` | **só Edge Functions** | **não** |
| `N8N_WEBHOOK_SECRET` | **só Edge Functions** | **não** |
| `N8N_AGENTE_URL` / `N8N_ANALISE_URL` | **só Edge Functions** | não |
| `RC_WEBHOOK_SECRET` | **só Edge Functions** | **não** |
| `VISAODEPRODUTO_API_KEY` | **só Edge Functions** | **não** — hoje está no bundle do app |

Reservado para v2: `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `FCM_SERVER_KEY`.

---

## 19. Documentação técnica (entregável ao fim da implementação)

Ao terminar a implementação, o agente gera `DOCUMENTACAO-TECNICA.md` na raiz, **em português**, descrevendo o sistema como ele ficou — não como foi planejado. Conteúdo mínimo, nesta ordem:

1. **Modelo de dados explicado** — cada tabela: para que serve, o que cada coluna significa em linguagem de negócio, quais valores os campos de escolha aceitam e o que cada valor quer dizer.
2. **Relacionamentos** — diagrama em texto e, para cada relação, uma frase no vocabulário do negócio ("um psicólogo tem muitos pacientes; um paciente pertence a exatamente um psicólogo").
3. **Regras que vivem no banco** — todas as triggers, funções e policies, com **nome exato**, tabela, quando disparam e o que fazem. Deve dar para ler essa lista e entender toda a lógica que o app não vê — em especial o enforcement do paywall.
4. **Mapa tela → tabelas** — para cada uma das 29 telas: o que lê, o que escreve, por quais policies passa.
5. **Lógica por tela** — o que é validado, o que é gravado, o que é calculado e onde, e o que o usuário vê quando dá errado.
6. **Divergências em relação a este spec** — o que saiu diferente e por quê. Sem esta seção o documento envelhece mentindo.

---

## 20. Privacidade, segurança e conformidade

O Agenda Psi guarda **dados de saúde por tabela**: nome completo, telefone e e-mail de pessoas em tratamento psicológico, com data de sessão e valor pago. Sob a LGPD isso é **dado pessoal sensível** (art. 5º, II), e o titular do dado **não é o usuário do app** — é o paciente dele, que nunca consentiu com a Dab Lab diretamente.

### 20.1 a 20.3 — Coleta, armazenamento e segredos

| Item | Decisão |
|---|---|
| Base legal | O psicólogo é o **controlador**; a Dab Lab é **operadora**. A base legal da coleta é a relação profissional dele com o paciente. Isso está na Política de Privacidade e não muda na reescrita |
| Onde ficam | Supabase, região `sa-east-1` (São Paulo) — dado de saúde brasileiro em território brasileiro |
| Quem acessa | O próprio psicólogo, via RLS. O dono do produto tem acesso administrativo ao banco, o que deve constar na política |
| Retenção | Indefinida enquanto a conta existir. Conta desativada mantém os dados (ver risco 23.6) |
| Exportação e exclusão | Fora do MVP. A política promete os dois — ver risco 23.6 e pergunta 25.4 |
| Em trânsito | HTTPS sempre; certificate pinning não é exigido |
| Segredos | `service_role` e chaves de terceiro **só nos secrets das Edge Functions**. Nenhuma no bundle. O `trigger-notification` com `service_role` em texto puro é corrigido na migration 0005 |
| Advisors | `get_advisors` (segurança e performance) rodado após toda migration com DDL. Nenhum alerta crítico pendente no Definition of Done |

### 20.4 Dado sensível em analytics

Corrigidos nesta reescrita, os dois vazamentos do app atual:

- `psi_perguntou_assistente` enviava o **texto integral do comando** ao PostHog — que costuma conter nome de paciente e valor pago. Passa a enviar só comprimento e status.
- `psi_novo_comentario_lugar` enviava o **texto integral do comentário** (até 2000 caracteres). Passa a enviar o `local_atendimento_id`.

Regra geral: **nenhum evento carrega nome de paciente, valor, observação ou qualquer texto digitado pelo usuário.** O `distinct_id` continua sendo o e-mail do psicólogo (para não quebrar a série histórica do PostHog) — é dado do usuário, não do paciente.

### 20.5 Guardrails da IA

Duas superfícies de IA: a análise financeira e o Agente Psi.

| Guardrail | Como |
|---|---|
| Isolamento entre usuários | O `usuario_id` vem do JWT na Edge Function, **nunca do corpo**. Não depende do modelo se comportar |
| Escopo de escrita | O agente só chama as funções `agentpsi_*`, que já recebem `p_usuario_id` e são filtradas por ele. Não há caminho para SQL livre |
| Resposta fora do escopo clínico | Instrução de sistema: o agente não dá orientação clínica, não interpreta caso e não sugere conduta. Se o comando pedir isso, responde com a frase fixa: `Eu ajudo com a gestão do seu consultório — agenda, pacientes, pagamentos e despesas. Para questões clínicas, procure supervisão.` |
| Falha do modelo | Se a resposta não vier no formato esperado, o app mostra o erro de 15.8. **Nunca** mostra texto cru de erro do modelo |
| Rate limit | 20 comandos/hora e 10 análises/dia por usuário, na Edge Function |

A detecção de pedido clínico é feita por instrução de sistema, e por isso é **melhor do que nada, não um guardrail forte**. O guardrail forte é o de isolamento: mesmo que o modelo seja induzido a qualquer coisa, ele não alcança dado de outro psicólogo, porque o `usuario_id` não passa por ele.

---

## 21. Métricas de sucesso

O contexto honesto: 362 cadastrados, **16 ativos**. O problema do Agenda Psi hoje não é monetização — é ativação. As métricas refletem isso.

| # | Métrica | Alvo | Prazo |
|---|---|---|---|
| 1 | **Ativação** — % dos novos cadastros que registram uma sessão em 7 dias | de ~10% para 25% | 90 dias após o lançamento |
| 2 | **Adesão a despesas** — % dos usuários ativos que registram ao menos uma despesa no mês | de ~15% para 40% | 90 dias |
| 3 | **Retenção** — usuários ativos em 60 dias | de 16 para 40 | 120 dias |
| 4 | **Conversão** — assinantes pagantes | 5 assinantes | 120 dias após o paywall |

A métrica 4 é deliberadamente modesta. Com 13 pessoas usando SMS hoje, o paywall existe para **plantar a infraestrutura de cobrança**, não para gerar receita imediata. Se a métrica 3 não se mover, a 4 não tem de onde vir.

**Eventos.** Todos os nomes `psi_*` existentes são mantidos **sem alteração** — mudar quebra as séries históricas. Novos eventos do paywall: `psi_paywall_visto`, `psi_paywall_iniciou_compra`, `psi_paywall_comprou`, `psi_paywall_restaurou`, `psi_limite_sms_atingido`, `psi_limite_sms_aviso`. Propriedades apenas não sensíveis: `plano`, `origem` (tela que abriu o paywall), `sms_usados`. Ver 20.4.

---

## 22. Estratégia de teste

| O quê | Como |
|---|---|
| **Regras da seção 11** | Testes automatizados. Prioridade máxima para 11.5 (limite de SMS) — é a regra que, errada, ou bloqueia quem pagou ou libera quem não pagou |
| **Policies das seções 5 e 6** | Testes de integração contra um branch do Supabase, autenticando como dois usuários diferentes e verificando que A não lê nem escreve dado de B. Sempre — é o teste que protege dado de saúde |
| `limite_sms_do_plano` | Casos: free sem uso, free em 9, free em 10, free em 11, pro, fundador, sem linha em `assinaturas` |
| `v_sms_lembretes_pendentes` | Antes e depois de estourar; na virada do mês com fuso de Brasília; fundador com 50 SMS |
| `fn_uso_mensal_incrementa` | Insert simples, insert de mês diferente, agendamento órfão |
| `recontar_uso_mensal` | Bate com o `count` direto do log |
| Formatação (11.3) | Testes unitários de moeda, data, percentual e nulo |
| Validação de preço (11.2) | `200`, `200,00`, `200.00`, vazio, `abc`, `-5`, `0` |
| Os 21 defeitos ativos de 11.9 | **Um teste de regressão por defeito.** É o que impede a reescrita de reintroduzir o que ela veio corrigir. Os itens 8, 9 e 20 não têm teste porque o módulo que os continha saiu do escopo |
| Fluxos da seção 9 | Manual, em aparelho real das duas plataformas, antes de cada release |
| Compra | Sandbox da App Store e faixa de teste da Play; renovação, cancelamento, expiração, restauração em segundo aparelho |
| Dependente de tempo | Virada de mês testada manipulando `enviado_em` num branch do banco |
| Acessibilidade | VoiceOver e TalkBack nos fluxos 9.1 e 9.2; Dynamic Type no maior tamanho |

---

## 23. Riscos

| # | Risco | Impacto | Prob. | Mitigação |
|---|---|---|---|---|
| 23.1 | **Os três webhooks n8n abertos já estão expostos**, e as URLs estão no bundle do app publicado. No `AgentePsi`, qualquer pessoa com a URL lê e escreve dado de qualquer psicólogo passando `usuario_id` no corpo; `AnaliseFinanceira` e `MeAvisa` vazam dado financeiro e e-mail | Crítico — vazamento de dado de saúde | Média | D3: Edge Functions com JWT (13.1, 13.2, 13.4). **Trocar as três URLs no n8n junto com o lançamento** — senão as antigas continuam vivas |
| 23.2 | **`service_role` em texto puro** na definição do `trigger-notification`, legível por qualquer conexão que leia o catálogo do Postgres. Essa chave ignora as 68 policies. **O caminho mais provável de vazamento é o próprio projeto:** `supabase db dump` (migration 0001) copia a definição do trigger — e a chave — para dentro do repositório Git | Crítico | **Alta**, por causa do dump | Corrigir o trigger e **rotacionar a chave antes de gerar a migration 0001** (7.5). A correção em si é a migration 0005 |
| 23.12 | **Chave privada de service account do Firebase em texto puro** dentro do código da Edge Function `sendpushnotification` (arquivo `service-account.json` no bundle, em vez dos secrets do projeto). Quem tiver essa chave envia push em nome do app | Médio hoje (push não está em uso), Alto quando 28.2 entrar | Baixa — o código da função não é público | Mover para os secrets do projeto e rotacionar a service account no console do Firebase. Pode esperar a implementação de push, mas não deve ir para produção assim |
| 23.3 | Chaves de terceiro no bundle (`x-api-key` do Visão do Produto) — extraíveis de qualquer IPA | Médio | Alta (já aconteceu) | Mover para Edge Function e rotacionar |
| 23.4 | **A reescrita vira um projeto de seis meses** e consome a energia que deveria ir para os 346 cadastrados que nunca ativaram | Alto — de produto | **Média** (era Alta) | Locais já foi cortado na v1.1 do spec — 4 telas, uma aba e 2 tabelas a menos. Fases 8.1 e 8.2 em duas semanas ou reavaliar de novo o escopo. Os próximos cortes candidatos, em ordem: o Agente Psi (8.9) e a análise por IA (8.3) |
| 23.5 | Regras de compra externa no Brasil (acordo CADE) ainda em detalhamento; alíquotas e prazos podem mudar | Baixo no MVP | Média | MVP usa IAP. Reavaliar quando as regras estiverem publicadas |
| 23.6 | **Conta desativada não apaga dado nenhum**, mas a Política de Privacidade promete exclusão a pedido. Dado de saúde de terceiro retido indefinidamente | Alto — jurídico | Média | v2 com exclusão real. Enquanto isso, atender o pedido manualmente e registrar o procedimento |
| 23.7 | RevenueCat exige development build; qualquer teste de compra precisa de build EAS, não Expo Go | Baixo | Alta (certo) | Previsto desde a fase 8.1 |
| 23.8 | Migração de app na App Store com bundle id igual: um bug de sessão desloga toda a base de uma vez | Alto | Baixa | Duas semanas em TestFlight com fundadores; verificar persistência de sessão no critério de 8.12 |
| 23.9 | Os nomes de evento do PostHog mudam por descuido e a análise de funil de dois anos é perdida | Médio | Média | Estão na seção 21 e no `CLAUDE.md`; teste que confere os nomes |
| 23.10 | `uso_mensal` diverge do log de SMS por falha de trigger, e alguém é bloqueado indevidamente | Médio | Baixa | `recontar_uso_mensal` + verificação mensal no fechamento da fatura do Bird |
| 23.11 | A Apple rejeita por "exclusão de conta insuficiente" (exige exclusão real desde 2022) | Médio | Média | O soft delete de hoje já passou na revisão. Se for barrado, 23.6 vira bloqueante |

---

## 24. Assunções declaradas

**Estas decisões foram tomadas sem perguntar. Revise antes de gerar código — assunção não revisada vira verdade no minuto em que o agente começa a implementar.**

| # | Assunção | Por quê | Se você discordar |
|---|---|---|---|
| 24.1 | **Expo SDK 57** (RN 0.86, React 19.2), a versão corrente em setembro de 2026 | Estável desde junho/2026 | Pinar outra versão é uma linha no `package.json` |
| 24.2 | **Paridade funcional, não paridade de bugs** (P1): os 21 defeitos ativos de 11.9 são corrigidos | Reproduzir um bug que zera o valor do pagamento no banco não é paridade, é dano | Diga quais devem ser preservados |
| 24.3 | **Limite gratuito de 10 SMS/mês** | Mediana de consumo hoje é 8; deixa a maioria confortável e converte o uso intenso | É uma linha de `limite_sms_do_plano` |
| 24.4 | **Fundadores são Pro vitalício de cortesia** (195 pessoas, via `usuario_fundador`) | A coluna já existe e o nome promete isso | Se for por tempo limitado, define-se `expira_em` |
| 24.5 | **Preço do plano Pro não definido neste spec** | Depende do Small Business Program e da sua margem-alvo | Ver pergunta 25.1 |
| 24.6 | **Só o SMS é limitado no MVP**; chat e análise de IA continuam livres | O SMS é a única coisa com custo marginal visível e consumo crescente. Limitar a IA junto complica a mensagem de venda na v1 | Dá para adicionar outro limite na mesma função |
| 24.7 | **O logout sai da Home e vai para Configurações**, com confirmação | "Sair do app" no cabeçalho da tela principal é atípico e fácil de tocar por engano | Reverter é trivial |
| 24.8 | **Valor do pagamento pré-preenchido com o preço vigente** | É a melhoria de fluxo mais óbvia da tela mais usada entre sessões | Basta não pré-preencher |
| 24.9 | **Google, Apple e login de convidado ficam fora do MVP** | O primeiro está desligado no código, o segundo depende do primeiro, o terceiro é código morto com credencial fixa | Se quiser login social no v1, ele vai junto com Sign in with Apple obrigatório |
| 24.10 | **Push fica para v2** | Não existe implementação para portar — a coluna `fcm_token` está lá, mas o app nunca teve `firebase_messaging` | Se for prioridade, vira um épico próprio |
| 24.11 | **Datas passam a ter zero à esquerda** (`05/03/2026` em vez de `5/3/2026`) | Padrão brasileiro e alinhamento de coluna | Uma linha no formatador |
| 24.12 | **Dinheiro passa a ser formatado em BRL** (`R$ 1.234` em vez de `1234`) | O app atual imprime o inteiro cru, sem símbolo nem separador | Idem |
| 24.13 | **Os rótulos das abas passam a aparecer** | Seis ícones sem rótulo obrigam a decorar. E o rótulo oculto da aba 5 está errado há tempos justamente por ninguém ver | Voltar a esconder é uma propriedade |
| 24.14 | **Os webhooks n8n continuam existindo**, só passam a ser chamados por Edge Function | Não é preciso reescrever o fluxo de IA para protegê-lo | Se preferir trazer a IA para dentro do Supabase, é outro escopo |
| 24.15 | **Repositório novo**, não um branch do projeto Flutter | Não há código compartilhado entre Dart e TypeScript | — |
| 24.17 | **Locais de atendimento sai do MVP** e vira 28.8 | Decidido por você em 13/09/2026: foi um teste e quase não foi usado (12 locais, 0 comentários). O detalhe fica preservado no roadmap | Se mudar de ideia, 28.8 tem tudo para reinserir sem reespecificar |
| 24.16 | **O app não tem cor de marca. A cor de destaque é o azul do sistema (`systemBlue`)** | Revisado em 13/09/2026 depois de ver o primeiro mockup: uma paleta autoral dessaturada foi o que mais fez o resultado parecer template. Apps nativos da Apple usam a paleta do sistema; o Agenda Psi não tem marca visual a defender | Se existir uma cor de marca oficial da Dab Lab que você queira aplicar, ela substitui só o azul de destaque — as semânticas continuam sendo as do iOS |

---

## 25. Perguntas abertas

**O agente de código deve PERGUNTAR, nunca assumir, ao cruzar com qualquer item desta seção.**

| # | Pergunta | Quem decide | Quando é preciso |
|---|---|---|---|
| 25.1 | **Qual o preço do plano Pro** e a periodicidade? Mensal, anual, ou os dois com desconto no anual? Há teste gratuito? | Alexandre | Antes de 8.11 — define o produto no App Store Connect |
| 25.2 | **Adicionar método de pagamento** (pix, dinheiro, cartão, transferência)? As colunas `pagamentos.metodo` e `despesas.metodo` existem no banco e nunca foram usadas. Os exemplos do Agente Psi mencionam pix, então o agente provavelmente grava lá | Alexandre | Antes de 8.6 |
| ~~25.3~~ | ~~Locais de atendimento entra no MVP?~~ **RESPONDIDA em 13/09/2026: não.** O módulo foi um teste e quase não foi usado. Saiu para 28.8; a spec inteira já reflete o corte | — | resolvida |
| 25.4 | **Exclusão real de dados na v2**: apagar de verdade, anonimizar, ou exportar e apagar? A política promete exclusão a pedido e a Apple exige (risco 23.11) | Alexandre | v2 — mas a decisão afeta o texto do app agora |
| 25.5 | **O dashboard deve passar a usar o fuso de Brasília** em vez de UTC? Hoje, nas últimas 3h de cada mês ele já mostra o mês seguinte. Corrigir muda os números históricos | Alexandre | Antes de 8.3 |
| 25.6 | **A Edge Function `agendapsi-chat` (v5) ainda serve para alguma coisa?** O app FlutterFlow não a usa — ele chama o n8n. Ela vira a implementação de 13.1 ou é despublicada? | Alexandre | Antes de 8.9 |
| 25.9 | **Vale desativar as tabelas de locais no banco** enquanto o módulo está fora, ou só corrigir a RLS e deixar os dados parados? Hoje a decisão do spec é corrigir a RLS e não mexer nos dados | Alexandre | Antes da migration 0004 |
| 25.7 | **Quando o aviso de limite de SMS aparece?** Este spec assume 80% (8 de 10). Antes demais irrita; depois demais não converte | Alexandre | Antes de 8.11 |
| 25.8 | **O psicólogo deve poder desligar o SMS de um paciente** quando o limite chega, escolhendo quem recebe? Hoje `receber_sms` é por paciente, mas não há tela de priorização | Alexandre | Antes de 8.11 |

---

## 26. Definition of Done

**Funcional**
- [ ] As 29 telas da seção 10 implementadas e navegáveis nas duas plataformas.
- [ ] Todos os critérios de aceite de 8.1 a 8.12 verificados um a um.
- [ ] Os **21 defeitos ativos** de 11.9 corrigidos, cada um com teste de regressão (os itens 8, 9 e 20 ficaram sem efeito com o corte de Locais).
- [ ] Nenhuma tela, rota, query ou string do módulo de Locais de atendimento presente no código — o corte é limpo, não comentado.
- [ ] Os fluxos 9.1 a 9.4 percorridos à mão em iPhone e Android reais.

**Dados e banco**
- [ ] Schema em português conforme 18, sem tabela ou coluna fora do padrão.
- [ ] Migrations 0001–0005 aplicadas e versionadas no repositório.
- [ ] Todas as funções, triggers e policies comentadas em português, citando a seção do spec.
- [ ] `get_advisors` (segurança e performance) rodado após a última DDL, sem alerta crítico pendente.
- [ ] Seed dos 195 fundadores aplicado e conferido.

**Paywall**
- [ ] Compra, renovação, cancelamento, expiração e restauração testados em sandbox nas duas lojas.
- [ ] `v_sms_lembretes_pendentes` comprovadamente bloqueia quem estourou e libera quem assinou.
- [ ] O app não escreve em `assinaturas` em nenhum caminho de código.
- [ ] Small Business Program (Apple) e programa equivalente (Play) com inscrição confirmada.

**Segurança e privacidade**
- [ ] Nenhum segredo no bundle — verificado por inspeção do IPA e do APK.
- [ ] Os **três** webhooks n8n antigos desativados (`AgentePsi`, `AnaliseFinanceira`, `MeAvisa`); URLs novas só nas Edge Functions.
- [ ] `service_role` do `trigger-notification` movida para o Vault e **rotacionada**.
- [ ] Teste de isolamento entre dois usuários passando para todas as tabelas — **inclusive `locais_atendimento` e `comentarios_locais_atendimento`**, que não têm tela mas continuam expostas à RLS.
- [ ] Nenhum evento de analytics carregando texto digitado pelo usuário.

**Não-funcional**
- [ ] Alvos de 17.1 a 17.10 medidos em aparelho real.
- [ ] VoiceOver e TalkBack nos fluxos 9.1 e 9.2; Dynamic Type no maior tamanho sem quebra.
- [ ] Modo claro e escuro conferidos em todas as telas.

**Documentação**
- [ ] `DOCUMENTACAO-TECNICA.md` gerado, com os seis itens de 19, conferido contra o que foi implementado. O mapa tela → tabelas cobre as 29 telas.
- [ ] `CLAUDE.md` criado com as pegadinhas de 18.
- [ ] `README.md` com setup, variáveis e migrations.
- [ ] `docs/schema.md` gerado do banco real.

**Publicação**
- [ ] iOS atualizado no mesmo bundle identifier, com sessão preservada.
- [ ] Android publicado pela primeira vez.
- [ ] Declaração de coleta de dados preenchida nas duas lojas.
- [ ] Eventos `psi_*` chegando ao PostHog do app novo, com os mesmos nomes de antes.

---

## 27. Próximos passos operacionais

1. **Revisar a seção 24** (assunções) e responder a seção 25 (perguntas abertas). Nada começa antes disso.
2. **Corrigir a `service_role` do trigger** (risco 23.2) — independe da reescrita e não deve esperar por ela.
3. Criar o repositório e rodar `supabase db dump` → migration 0001.
4. Congelar o FlutterFlow: nenhuma feature nova lá durante a reescrita.
5. Colar o prompt de implementação (abaixo) no Claude Code e aprovar o plano antes do código.
6. Criar os produtos de assinatura nas duas lojas e o projeto no RevenueCat quando 25.1 estiver respondida.
7. Inscrever-se no Small Business Program da Apple e no programa equivalente da Play.

---

## 28. Roadmap: próximas releases

### 28.1 Login social
Google e Apple. O código Flutter tem as duas implementações completas, desligadas por `if (false)`. Google no iOS/web usa o client ID `833008919249-25qfc6nhgictelrhnu1vjou8eopar6n0.apps.googleusercontent.com` e o server client ID `833008919249-3v13pebnj10fm365ch4ego9vnm4i48t6.apps.googleusercontent.com`; no Android o client resolve pelo `google-services.json`. Apple no mobile gera nonce aleatório, envia o SHA-256 no credential e faz `signInWithIdToken` com o nonce cru. **A Apple exige Sign in with Apple sempre que houver outro login social** — os dois entram juntos ou nenhum entra. No fluxo Apple, usuário autenticado sem registro em `profissionais` vai para Nova conta em vez de receber erro (o app atual já faz isso só nesse fluxo).

### 28.2 Push notifications
Nada a portar: `profissionais.fcm_token` existe, a tabela `notifications` existe com 0 linhas, a Edge Function `sendpushnotification` está publicada — mas o app Flutter nunca teve `firebase_messaging`. É implementação nova. Decisão principal: **o token do Expo não é o token FCM**. Ou se adiciona `expo_push_token` a `profissionais` e migra na primeira abertura, ou se configura FCM direto no `expo-notifications` e reaproveita a coluna e a Edge Function — a segunda opção evita mexer no que já está publicado. Primeiros casos de uso já mapeados: lembrete de fim de mês usando os dados de sessão, e convite a lançar despesa para quem tem receita e nenhuma despesa no mês.

### 28.3 Melhorias de funil
Com base no que os dados mostram: receita estimada do mês a partir de `precos_paciente` e da agenda fixa (o usuário vê quanto deveria entrar antes de entrar); resumo de fim de mês; e a campanha de reengajamento de despesas que hoje roda por e-mail no n8n, trazida para dentro do app.

### 28.4 Exportação
CSV e PDF de sessões, pagamentos e despesas por período. Formato definido em 14.

### 28.5 Exclusão real de dados
Ver pergunta 25.4 e riscos 23.6 e 23.11.

### 28.6 Fila de escrita offline
Registrar sessão e pagamento sem rede, sincronizando depois. Faz sentido para quem atende em sala com sinal ruim. Exige resolução de conflito e id gerado no cliente.

### 28.7 Moderação dentro do app
Tela administrativa para aprovar local e comentário, e para marcar feedback como tratado. Só quando o volume justificar — e depende de 28.8 estar de volta.

### 28.8 Locais de atendimento (cortado do MVP na v1.1)

Diretório comunitário de consultórios, coworkings e clínicas para locação, com busca, comentários e sugestão pela própria comunidade. Estava especificado por inteiro na v1.0 e saiu do MVP porque foi um teste que quase não foi usado: **12 locais e zero comentários** em toda a base. O detalhe abaixo está preservado para que a volta não precise de nova especificação.

**Estado no banco.** As duas tabelas continuam lá, com dados, documentadas em 7.2. Suas policies são corrigidas na migration 0004 mesmo sem tela (6.5) — RLS permissiva não deixa de ser um buraco porque a interface sumiu. A view `view_locais_atendimento_cards` (que filtra `status = 'aprovado'` e calcula `total_comentarios_aprovados`) segue publicada.

**As 4 telas, como estavam no inventário:**

| Tela | Tipo | Mostra | Lê | Escreve |
|---|---|---|---|---|
| Locais de atendimento | aba | busca por cidade e bairro, cartões com nome, bairro, `Cidade, UF`, tipo, contagem de comentários e site | `view_locais_atendimento_cards` | — |
| Sugerir local | folha modal | nome (máx. 35), cidade, bairro, estado (2 letras maiúsculas), tipo, site | — | `locais_atendimento` |
| Comentários do local | tela cheia | comentários aprovados, com data | `comentarios_locais_atendimento` | — |
| Novo comentário | folha modal | texto até 2000 caracteres | — | `comentarios_locais_atendimento` |

**Regras de escrita.** Local entra com `status = 'pendente'` (default do banco) e `origem = 'comunidade'`; comentário entra com `status = 'aprovado'` explicitamente, ou seja, sem moderação prévia — a assimetria é intencional ou acidental, e continua sem resposta (era parte da pergunta 25.3). `tipo_local` aceita exatamente `consultorio`, `coworking`, `clinica`. `contexto_uso` existe no schema e nunca foi usado.

**Os três defeitos que voltam junto** (itens 8, 9 e 20 de 11.9): o filtro `ILIKE` incondicional sobre `bairro` nulável, que esconde da lista todo local sem bairro preenchido; a tela de comentários mostrando todos os status enquanto o cartão conta só os aprovados, gerando números divergentes; e o rótulo da aba escrito "Pacientes" por erro de cópia. Mais os erros de texto `atedimento`, `Comentarios`, `Novo  comentário` (dois espaços) e `Local cadastrado com sucesso Obrigado...` sem pontuação.

**Eventos de analytics existentes:** `psi_nova_sugestao_lugar` e `psi_novo_comentario_lugar`. O segundo hoje envia o **texto integral do comentário** ao PostHog — se o módulo voltar, ele passa a enviar só o `local_atendimento_id` (regra de 20.4).

**Copy dos estados vazios:** `Nenhum local encontrado para essa busca.` e `Este local ainda não tem comentários. Seja o primeiro.`

**O que precisa acontecer antes de voltar:** evidência de que alguém quer isso. Um punhado de pedidos no feedback, ou uma pergunta direta a alguns usuários ativos. Enquanto forem 12 locais e zero comentários, o módulo custa uma aba da navegação e não devolve nada.

---

## 29. Protocolo de mudanças incrementais

Depois do v1 pronto, ajuste pequeno não pode virar reescrita do app. O procedimento:

1. **Commit de checkpoint** antes de qualquer mudança, para ter um `git diff` confiável.
2. **Não colar este spec inteiro de novo.** Colar só o trecho novo ou alterado, ou um spec adicional só da feature.
3. Escrever a instrução **como diff**, não como recomeço: o projeto já existe e funciona.
4. **Delimitar nominalmente o que não deve mudar.**
5. Pedir a **lista de arquivos** que serão criados ou alterados **antes do código**, e aprovar.
6. Revisar o `git diff` contra o plano aprovado. Arquivo que passou do escopo volta atrás, e o pedido é refeito mais específico.
7. Exigir a atualização do `DOCUMENTACAO-TECNICA.md` **no mesmo commit**.

**Modelo de prompt para colar:**

```
O projeto Agenda Psi (Expo + Supabase) já está implementado e funcionando.
Preciso de UMA mudança pontual:

<descreva a mudança em uma ou duas frases>

Contexto: seção <N> do docs/spec.md.

NÃO altere: <liste os módulos que devem ficar intactos>.

Antes de escrever qualquer código, me mostre:
1. a lista de arquivos que você vai criar ou alterar, com uma linha do porquê de cada um;
2. se precisa de migration no banco, o SQL dela.

Espere minha aprovação. Depois de implementar, atualize o
DOCUMENTACAO-TECNICA.md no mesmo commit.
```

---

## Anexo — Fontes

**Fontes primárias (lidas diretamente, 13/09/2026)**
- Código Dart exportado do FlutterFlow: `Agenda Psi/Versao em FlutterFlow/agenda_psi/` — 124 arquivos, 30.822 linhas, **29 telas e 1 componente** (`celula_agenda`), 31 bindings de tabela/view.
- Schema vivo do Supabase, projeto `tocytpjtupbbxwgamtxq`: 15 tabelas, 23 views, 68 policies, 17 funções, 3 triggers, 331 colunas (125 de tabela, 206 de view).
- Dados de uso em produção: 365 contas em `auth.users`, 362 profissionais, 195 fundadores, 1.065 pacientes, 1.178 sessões, 451 pagamentos, 98 despesas, 844 SMS registrados, 13 tipos de despesa, 12 locais, 0 comentários; faturas do Bird em `custos_sms_mensal`.
- Verificação cruzada de toda a seção 7 e da seção 11.9 contra o código e o banco, em 13/09/2026.

**Pesquisa web (13/09/2026)**
- [Expo SDK 57 — changelog](https://expo.dev/changelog/sdk-57) — lançado em 30/06/2026, React Native 0.86, React 19.2.
- [RevenueCat — instalação com Expo](https://www.revenuecat.com/docs/getting-started/installation/expo) — exige development build; `react-native-purchases` + `react-native-purchases-ui`.
- [RevenueCat — The 15% App Store Fee: A Guide for Developers (2026)](https://www.revenuecat.com/blog/engineering/small-business-program) — Apple Small Business Program: 15% para quem fatura abaixo de US$ 1 mi/ano, valendo desde o primeiro ano também em assinaturas. Google Play: 15% sobre assinaturas desde o primeiro dia; a regra do primeiro US$ 1 mi por ano-calendário é separada e vale para compras em geral.
- [Tecnoblog — Apple ainda poderá cobrar taxas no Brasil; veja alíquotas](https://tecnoblog.net/noticias/apple-ainda-podera-cobrar-taxas-no-brasil-veja-aliquotas/) — acordo com o CADE (dez/2025) permitindo compra externa e lojas alternativas; alíquotas em detalhamento.
- [MacMagazine — Apple permitirá compras externas e lojas alternativas à App Store no Brasil](https://macmagazine.com.br/post/2025/12/23/apple-permitira-compras-externas-e-lojas-alternativas-a-app-store-no-brasil/)
- [Expo — Using in-app purchases](https://docs.expo.dev/guides/in-app-purchases/)
