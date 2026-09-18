# A conta de serviço e o Pub/Sub do Play

O que falta para a compra no Android funcionar de ponta a ponta. Escrito em
17/09/2026.

## Por que o Android precisa disso e o iOS não

A diferença é de desenho, não de esforço:

| | Apple | Google |
|---|---|---|
| O que a notificação traz | o **estado inteiro**, num JWS assinado | só **"o token X mudou"** |
| Como se confia nela | validando a cadeia de certificados | perguntando à API do Play |
| O que o servidor precisa | nada além do bundle id | **uma conta de serviço** |

Por isso o iOS ficou pronto em cinco minutos e o Android não. Sem a conta de
serviço, a `play-notificacoes` recebe o aviso e não consegue descobrir o que
mudou — o mesmo desfecho de não receber aviso nenhum.

## O que já está pronto

- `play-notificacoes` no ar, respondendo `401 nao_autorizado` a chamada sem
  token, que é o comportamento correto;
- `PLAY_PACKAGE_NAME` e `PLAY_PUSH_TOKEN` configurados;
- o token e a URL completa de push em `~/keys/agendapsi-play-push-token.txt`.

## O que falta

### 1. Conta de serviço com acesso à API do Play

Play Console → **Users and permissions** (ou *Setup → API access*, o nome muda)
→ vincular um projeto do Google Cloud → criar conta de serviço.

Depois, **duas concessões separadas**, e esquecer a segunda é o erro comum:

- no **Google Cloud**, gerar uma chave JSON para a conta de serviço;
- no **Play Console**, conceder a essa conta permissão de **ver informações
  financeiras e gerenciar pedidos e assinaturas** para o app.

A conta existir no Cloud não basta: sem a permissão no Play Console, a consulta
volta 401 e a função não tem como saber.

### 2. Tópico Pub/Sub

No Google Cloud → Pub/Sub → criar tópico (ex.: `agendapsi-rtdn`).

Dar ao publicador do Google Play permissão de publicar nele:

```
google-play-developer-notifications@system.gserviceaccount.com
```
com o papel **Pub/Sub Publisher**. Sem isso o Google não consegue publicar e as
notificações somem sem erro visível.

### 3. Subscription de push

Ainda no Pub/Sub, criar uma **subscription do tipo push** no tópico, apontando
para a URL que está em `~/keys/agendapsi-play-push-token.txt` — a função com
`?token=...` no fim.

### 4. Ligar no Play Console

Play Console → **Monetize with Play → Monetization setup** → campo do tópico
Pub/Sub → o nome completo do tópico:

```
projects/<id-do-projeto>/topics/agendapsi-rtdn
```

Há um botão de **enviar notificação de teste**. Mande: a função responde
`{"ok":true,"ignorado":"teste"}` e isso já prova o caminho inteiro.

### 5. Os dois segredos que faltam

Do JSON da conta de serviço saem dois campos:

```bash
supabase secrets set --project-ref tocytpjtupbbxwgamtxq \
  PLAY_SERVICE_ACCOUNT_EMAIL="<client_email do JSON>" \
  PLAY_SERVICE_ACCOUNT_PRIVATE_KEY="<private_key do JSON>"
```

⚠️ A `private_key` do JSON vem com `\n` literais. A função já trata isso
(`chaveBruta.replace(/\\n/g, '\n')`), então **cole como está**, sem converter as
quebras de linha à mão.

⚠️ O JSON é segredo: não entra no repositório. O `.gitignore` da raiz já bloqueia
`*service-account*.json`, mas o lugar dele é `~/keys`.

## Como saber que funcionou

O teste real é comprar pela trilha interna e conferir no banco:

```sql
select plano, status, store, rc_customer_id, expira_em
  from assinaturas
 where profissional_id = 'a37da846-ed65-47e9-8355-e4df3d40941a';
```

`store = 'play_store'` e `rc_customer_id` com o `usuario_id` significam que o
`obfuscatedAccountId` sobreviveu a todo o caminho. Nulo ali é o pior desfecho:
dinheiro entra, Pro não. Nenhum teste automatizado pega isso.

Log, se algo não bater:

```bash
supabase functions logs play-notificacoes --project-ref tocytpjtupbbxwgamtxq
```
