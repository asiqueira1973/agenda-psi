# Criar a assinatura no Play Console

Escrito em 15/09/2026, na primeira vez que se fez isso neste projeto.

## Links diretos, para não caçar menu

A navegação do Play Console mudou e caminho de memória erra. Estes links são
montados a partir dos identificadores da conta e do app, e não dependem de onde
o Google resolveu pôr o menu este mês.

- conta Dab Lab Developer: `8846956815821113643`
- app Agenda Psi: `4975046642989361560`

```
BASE=https://play.google.com/console/u/0/developers/8846956815821113643/app/4975046642989361560
```

| Página | Caminho |
|---|---|
| Assinaturas | `$BASE/subscriptions` |
| Teste interno | `$BASE/tracks/internal-testing` |
| Produção | `$BASE/tracks/production` |

⚠️ **A página de assinatura de apps NÃO tem link direto que funcione** — as duas
tentativas (`/app-signing` e `/app-integrity/app-signing`) caem no painel
principal. Segundo a documentação do Google, o caminho é pelo menu:

**Protected with Play → Play Store protection → Manage → Manage Play app signing**

É o segundo card da página "Protected with Play", não o primeiro ("Automatic
protection"), que é onde é fácil errar.

## Antes de tudo: o Google tem TRÊS níveis, a Apple tem um

É o que mais confunde quem vem do App Store Connect.

```
Assinatura  (o produto — carrega o ID que o app procura)
└── Plano base  (a periodicidade e o PREÇO — tem ID próprio)
    └── Oferta  (opcional: teste grátis, desconto de entrada)
```

Na Apple, "a assinatura" tem preço e duração. No Google, a assinatura é só um
guarda-chuva: **quem tem preço e periodicidade é o plano base**.

## ⚠️ Crie UM plano base e NENHUMA oferta

Não é preferência, é exigência do nosso código.

O app pede a compra passando só o identificador do produto, sem dizer qual
oferta quer:

```ts
google: { skus: [PRODUTO_PRO_MENSAL], obfuscatedAccountId: usuarioId }
```

A biblioteca converte isso em `subscriptionOffers = null` e deixa a camada do
Play Billing escolher. Com um plano base e nenhuma oferta, só há uma escolha
possível e ela é a certa. Com duas, a escolha passa a ser da biblioteca — e a
pessoa pode acabar comprando um plano que você não pretendia vender.

Se um dia houver mais de um plano, o código precisa mudar junto: ler as ofertas
com `fetchProducts` e passar o `offerToken` explicitamente.

## Pré-requisito que costuma travar

O Play só libera produtos dentro do app depois que existe **um AAB enviado a
alguma trilha** — vale a de teste interno — contendo a permissão
`com.android.vending.BILLING`.

A versão publicada hoje (versionCode 18, a do FlutterFlow) não tem a permissão,
porque não havia assinatura. A nossa tem: o plugin do `expo-iap` a injeta, e
está verificada no manifesto gerado.

⚠️ **E há um problema de assinatura de pacote a resolver antes.** O build local
de release é assinado com a chave de DEBUG — serve para o emulador e não serve
para o Play. Para enviar é preciso a chave de upload original do app, a mesma
usada no versionCode 18. Se ela não estiver à mão, o caminho é o EAS
(`eas build --platform android --profile production`), e, se o EAS gerar uma
chave nova, o Play vai recusar até que se peça a **redefinição da chave de
upload** ao Google — que leva alguns dias. Vale descobrir isso ANTES de precisar.

## Estado em 15/09/2026: esperando o Google

**Pedido de redefinição da chave de upload enviado em 15/09/2026.** Prazo
estimado pelo Google: um a dois dias úteis.

Por que foi preciso: a chave que assinou o versionCode 18 foi gerada e guardada
pelo **FlutterFlow** — o controle "Upload Keystore" no painel deles está
DESLIGADO, ou seja, nunca se enviou uma chave própria. Ela não está nesta
máquina, não veio no export e não é recuperável de lá.

Confirmado na página do Play app signing que **"Releases signed by Play"** está
ativo. É o que torna isso um contratempo e não um desastre: com o Play App
Signing, a chave de upload é só o crachá de entrada e pode ser trocada. Sem ele,
perder a chave significaria nunca mais poder atualizar o app.

A chave nova está em `~/keys/agendapsi-upload.jks` — RSA 2048, válida até 2054,
SHA-1 `22:DF:A6:FE:38:0C:74:E6:59:98:CA:85:5F:AC:B5:52:F0:2E:8A:A3`.

**A partir da aprovação, só a chave nova funciona.** Como não se publica mais
pelo FlutterFlow, isso é ganho: a chave passa a ser de fato nossa, ao lado das
dos outros apps.

### O que essa espera bloqueia, em cascata

```
chave aprovada → AAB assinado → trilha de teste interno
                                 → produtos liberados → assinatura cadastrada
                                                        → teste de compra
                                                           → produção
```

### O que NÃO depende dela

- a conta de serviço e o tópico Pub/Sub da `play-notificacoes`;
- o feature graphic e o resto da ficha da loja;
- as capturas do Android, que já estão em `telas-android/`.

## O passo a passo

### 1. Criar a assinatura

Play Console → o app → **Monetizar** → **Produtos** → **Assinaturas** →
**Criar assinatura**.

| Campo | Valor |
|---|---|
| **ID do produto** | `agendapsi_pro_mensal` |
| Nome | `Agenda Psi Pro` |

⚠️ O ID do produto é **imutável** e precisa ser exatamente esse — está fixo em
`app/src/features/purchases/produtos.ts`. Errar um caractere não dá erro de
compilação: dá paywall sem preço, porque a loja devolve lista vazia.

O nome aparece para o usuário na tela de assinaturas do Android.

### 2. Preencher os detalhes da assinatura

- **Benefícios**: até quatro itens curtos. Um basta:
  `Lembretes por SMS ilimitados para os seus pacientes`.
- **Descrição**: o que o Pro faz. Sem exclamação, sem emoji.

### 3. Criar o plano base

Dentro da assinatura, **Adicionar plano base**.

| Campo | Valor |
|---|---|
| **ID do plano base** | `mensal` |
| Tipo | **Renovação automática** |
| Período de faturamento | **1 mês** |
| Período de carência | recomendado: **7 dias** |
| Renovação em atraso | ativar |

Sobre o **período de carência**: nosso servidor já trata. A
`play-notificacoes` mapeia `SUBSCRIPTION_STATE_IN_GRACE_PERIOD` para
`plano=pro, status=em_atraso`, ou seja, o acesso continua enquanto o Google
tenta cobrar de novo. Sem carência configurada, cartão recusado vira corte
imediato — e o motivo mais comum de recusa é limite, não desistência.

### 4. Preço

No plano base, **Definir preço** → Brasil → **R$ 9,90**.

O Google oferece converter para os outros países automaticamente. Como o app é
só em português e a cobrança de SMS é no Brasil, dá para deixar só o Brasil
disponível — menos superfície para manter.

### 5. Ativar

O plano base nasce inativo. **Ative-o**, senão o app não o enxerga e o paywall
mostra o preço de referência do código em vez do preço real.

### 6. Testadores de licença

**Configuração** → **Teste de licença**: acrescente a conta Google que vai
testar. Contas dessa lista compram sem ser cobradas e com renovação acelerada —
o mês passa em minutos, o que permite ver a renovação acontecer.

Isso é da CONTA de desenvolvedor, não do app: vale para todos os apps da Dab Lab.

## Depois do cadastro

Falta ligar o servidor, que é o que de fato concede o Pro:

1. **Monetizar → Configuração de monetização** → tópico do Pub/Sub apontando
   para `.../functions/v1/play-notificacoes?token=<PLAY_PUSH_TOKEN>`;
2. conta de serviço com acesso à API do Play, e os segredos
   `PLAY_SERVICE_ACCOUNT_EMAIL`, `PLAY_SERVICE_ACCOUNT_PRIVATE_KEY`,
   `PLAY_PACKAGE_NAME` e `PLAY_PUSH_TOKEN` nas Edge Functions.

⚠️ Lembrando que a `play-notificacoes` **nunca foi exercitada contra o Google**.
Passa em `deno check`, o que não é a mesma coisa que funcionar.

## O primeiro teste, quando chegar lá

O mesmo da Apple: comprar e conferir no banco se `rc_customer_id` veio com o
`usuario_id`. Nulo ali significa compra sem o carimbo `obfuscatedAccountId` —
o dinheiro entra e o Pro não. Nenhum teste automatizado pega isso.
