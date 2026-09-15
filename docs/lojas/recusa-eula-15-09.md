# Recusa de 15/09/2026 — link dos Termos de Uso

> The submission offers auto-renewable subscriptions, such as Assinatura Pro
> Mensal, but does not include a functional link to the Terms of Use (EULA) in
> the app metadata that appears on the app's App Store product page.

## O que a Apple exige, e são DUAS coisas

A diretriz 3.1.2 cobra o link dos Termos de Uso em dois lugares diferentes:

1. **Na ficha da loja** — na App Description, ou como EULA personalizado
   cadastrado no App Store Connect. **É esta que foi recusada.**
2. **Dentro do app, no ponto da compra** — junto com título, duração e preço da
   assinatura. Esta não foi citada na recusa, mas é exigida, e é a causa mais
   comum da segunda rodada de recusa de quem conserta só a primeira.

As duas foram atendidas em 15/09/2026.

## 1. A ficha — conserto de metadados, sem build novo

**Acrescente ao FIM da App Description**, em App Store Connect → a versão 5.0.0
→ Description:

```

────────────────

Agenda Psi Pro é uma assinatura mensal de renovação automática de R$ 9,90 por
mês, que libera lembretes por SMS ilimitados para os seus pacientes. No plano
gratuito o limite é de 10 lembretes por mês; o restante do app não tem cobrança.

A assinatura é renovada automaticamente ao fim de cada mês, a menos que seja
cancelada até 24 horas antes do fim do período vigente. A cobrança é feita na sua
conta da App Store, e o cancelamento é feito nos ajustes da conta, a qualquer
momento.

Política de privacidade: https://dablab.notion.site/Pol-tica-de-Privacidade-Agenda-Psi
Termos de Uso (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
```

⚠️ **Confira a URL da política de privacidade acima** — eu não tenho como
validá-la daqui. Use a mesma que já está no campo Privacy Policy URL da ficha.
Link quebrado nesse parágrafo é nova recusa, pela mesma diretriz.

Usamos o **EULA padrão da Apple**, e não um personalizado, porque um EULA próprio
precisa ser cadastrado e revisado, e não há no produto cláusula que o padrão não
cubra.

**Isto sozinho já permite reenviar.** Mudança de metadados não exige binário novo:
salve a Description e use *Submit for Review* de novo, com o mesmo build 3.

## 2. O app — precisa de build novo

O paywall não mostrava nem os termos nem a política. Agora mostra, abaixo do
botão de assinar:

- a condição da renovação em texto — mensal, automática, cancelável até 24h
  antes;
- **Termos de Uso**, que abre o EULA padrão da Apple no navegador;
- **Política de privacidade**, que abre a tela que já existe no app.

Título, duração e preço já estavam visíveis, que é o resto do que a 3.1.2 pede.

## Qual caminho seguir

| | Prazo | Risco |
|---|---|---|
| **Só a ficha, reenviar o build 3** | hoje | Se o revisor também cobrar o app, volta — e são mais 24h |
| **Ficha + build 4** | hoje, depois do processamento | Fecha as duas pontas de uma vez |

Recomendação: **build 4**. A recusa de hoje foi automática, de triagem; a próxima
passa por revisor humano, que abre o app e olha o paywall. Uma hora esperando o
processamento custa menos do que mais um dia de fila.
