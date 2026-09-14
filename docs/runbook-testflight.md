# Runbook — primeira versão de TestFlight com assinatura

Escrito em 14/09/2026, para o teste da compra na Apple.

A ordem importa: as URLs de notificação só podem ser cadastradas depois que as
Edge Functions existirem, e o produto só aparece no app depois de existir no App
Store Connect. Seguindo de cima para baixo, nada fica esperando.

---

## 0. Antes de tudo: o que é sandbox e o que não é

**Compra feita por build de TestFlight é sempre sandbox.** Não se cobra nada, o
mês de assinatura dura minutos em vez de 30 dias, e a Apple manda as
notificações para a **URL de sandbox**, que é cadastrada separada da de
produção. Se só a de produção estiver preenchida, nenhuma notificação chega e o
Pro nunca é liberado — sem erro visível em lugar nenhum.

Para comprar em sandbox é preciso uma **conta de testador de sandbox** (App
Store Connect → Users and Access → Sandbox → Test Accounts). Não use o seu Apple
ID de verdade. No aparelho: Ajustes → App Store → conta de sandbox, no fim da
tela.

---

## 1. Subir as Edge Functions

```bash
supabase functions deploy apple-notificacoes
supabase functions deploy play-notificacoes
```

Os segredos que a da Apple precisa (a do Google pode esperar, o teste agora é só
iOS):

```bash
supabase secrets set APPLE_BUNDLE_ID=com.dablab.agendapsi
```

`APPLE_APP_ID` é opcional; se você preencher, o verificador confere também o id
numérico do app, o que é uma checagem a mais.

Confira que subiu:

```bash
supabase functions list
```

A URL fica em `https://tocytpjtupbbxwgamtxq.supabase.co/functions/v1/apple-notificacoes`.

---

## 2. Criar a assinatura no App Store Connect

App Store Connect → o app → **Subscriptions**.

1. Criar um **grupo de assinatura** (pode se chamar `Pro`). O grupo é o que
   permite trocar de plano depois sem perder o histórico — mesmo tendo só um
   plano hoje, ele é obrigatório.
2. Dentro dele, criar a assinatura:

| Campo | Valor |
|---|---|
| **Product ID** | `com.dablab.agendapsi.pro.mensal` |
| Duração | 1 mês |
| Preço | R$ 9,90 (Brasil) |
| Teste gratuito | **nenhum** |

⚠️ O Product ID precisa ser **exatamente** esse. Ele está fixo em
`app/src/features/purchases/produtos.ts`; um caractere diferente e o app não
acha o produto — o paywall abre mostrando o preço de referência e a compra
falha, que foi o que você viu no simulador.

3. Preencher nome de exibição e descrição (a Apple exige) e salvar. Para
   testar em sandbox **não** é preciso enviar para revisão; basta o produto
   existir e estar "Ready to Submit".

---

## 3. Cadastrar as URLs de notificação

App Store Connect → o app → **App Information** → *App Store Server
Notifications*.

| Campo | Valor |
|---|---|
| Production Server URL | `https://tocytpjtupbbxwgamtxq.supabase.co/functions/v1/apple-notificacoes` |
| **Sandbox Server URL** | a mesma URL |
| Version | **Version 2** |

A mesma função atende os dois: ela lê o ambiente de dentro do payload e escolhe
a cadeia de certificados certa. As duas caixas precisam estar preenchidas.

Há um botão de mandar notificação de teste. Mande: a função responde 200 e
ignora (`TEST` não muda plano), e isso já prova que a URL está certa e que a
validação de assinatura passou.

---

## 4. Gerar e enviar o build

```bash
cd app && npx eas build --platform ios --profile production --auto-submit
```

O `appVersionSource` é remoto e o perfil de produção tem `autoIncrement`, então
o número do build sobe sozinho — não mexa nele à mão.

Depois de processado no App Store Connect (leva de 5 a 20 minutos), o build
aparece no TestFlight.

---

## 5. O teste que importa

Instale pelo TestFlight, entre na sua conta do app, abra o paywall e compre com
a conta de sandbox.

O certo é: o botão vira "Confirmando…", e em poucos segundos a tela de
confirmação aparece. **A confirmação não vem da Apple — vem do nosso banco.** O
app pergunta ao servidor em intervalos crescentes por até dois minutos.

Confira no banco:

```sql
select profissional_id, plano, status, expira_em, rc_customer_id, rc_entitlement
from assinaturas
order by atualizado_em desc
limit 5;
```

O que olhar, em ordem de importância:

1. **Existe uma linha nova?** Se não existe, a notificação não chegou — volte ao
   passo 3 e confira a URL de sandbox.
2. **`rc_customer_id` é o seu `usuario_id`?** Se estiver nulo, a compra foi feita
   sem o carimbo `appAccountToken`. Esse é o defeito mais grave possível aqui: o
   dinheiro entra e o Pro não, e nenhum teste automatizado pega. O log da função
   vai ter `apple: notificação sem appAccountToken`.
3. `plano = 'pro'` e `status = 'ativo'`.

Log da função, se algo não bater:

```bash
supabase functions logs apple-notificacoes --limit 50
```

---

## 6. O que testar depois que a compra funcionar

- **Cancelar** pela conta de sandbox: o `status` vira `cancelado` e o Pro
  **continua** até `expira_em` (regra 11.6). Não pode cortar na hora.
- **Renovação**: em sandbox o mês dura minutos, então dá para ver o `DID_RENEW`
  chegar sozinho.
- **Restaurar compras** em outro aparelho, ou depois de apagar e reinstalar.
- **Expiração**: deixe a assinatura de sandbox correr até o fim das renovações
  (a Apple renova 6 vezes e para) e confira que volta para `free`.

---

## O que NÃO está testado

As duas funções de loja nunca foram exercitadas contra a Apple nem contra o
Google. Passam em `deno check` e a lógica de ambiente tem teste
(`supabase/functions/_shared/apple-ambiente.test.ts`), mas isso é código
revisado, não verificado. Este runbook é justamente o que transforma um no
outro.

O lado do Google continua inteiramente por testar, e precisa ainda da conta de
serviço e do tópico Pub/Sub.
