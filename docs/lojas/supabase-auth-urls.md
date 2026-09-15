# Auth: as URLs de retorno do e-mail

Problema visto no primeiro teste em TestFlight, 14/09/2026: pedir "esqueci minha
senha" manda um e-mail que aponta para **`app.agendapsi…`** — o app web antigo,
do FlutterFlow — em vez de abrir o aplicativo.

## Por que acontece

O app manda o `redirectTo` certo. `urlDeRetornoDaSenha()` devolve
`agendapsi://nova-senha` no build de produção, que casa com o `scheme` do
`app.json`.

O que falha é do outro lado: **o Supabase só honra um `redirectTo` que esteja na
lista de URLs permitidas.** Quando não está, ele não dá erro nenhum — troca
silenciosamente pelo *Site URL* do projeto, que hoje aponta para o app web
antigo. O sintoma é exatamente o que apareceu: e-mail chega, link funciona, e
leva ao lugar errado.

## O conserto

Painel do Supabase → **Authentication → URL Configuration**:

1. Em **Redirect URLs**, acrescente:

   ```
   agendapsi://**
   ```

   O `**` cobre `agendapsi://nova-senha` e qualquer rota futura. Sem ele, cada
   nova tela alcançável por e-mail precisaria de uma entrada nova — e o
   esquecimento se manifesta como este mesmo bug.

2. Em **Site URL**, troque o endereço do app web antigo. Ele é o destino padrão
   de qualquer link sem `redirectTo` válido, então deixá-lo apontando para o
   FlutterFlow mantém a armadilha armada para os outros e-mails (convite,
   confirmação).

   Enquanto o app antigo estiver no ar e houver usuário nele, avalie com calma
   antes de trocar: mudar o Site URL muda o destino de TODOS os e-mails, não só
   o de recuperação.

3. Para desenvolvimento, acrescente também o esquema do dev client, senão o
   mesmo teste falha na sua máquina:

   ```
   exp+agenda-psi://**
   ```

## Como conferir que ficou certo

Peça a recuperação pelo app e olhe o link do e-mail: ele tem de conter
`redirect_to=agendapsi%3A%2F%2Fnova-senha`. Se contiver o endereço do app web, a
URL ainda não está na lista — não adianta mexer no app.
