# App Store Connect — versão 5.0.0

Só os campos que mudam numa atualização. O resto da ficha já está preenchido.

---

## Description  (pt-BR)

Ordem que importa: o que o app FAZ primeiro, a assinatura depois, os links no
fim. Foi a inversão disso que quase virou uma ficha abrindo com cobrança antes
de dizer para que serve o app.

Os dois links no fim atendem a diretriz 3.1.2, e são a causa da recusa de
15/09/2026. Junto com eles, a mesma diretriz exige título, duração e preço da
assinatura no texto — é o que o bloco SOBRE A ASSINATURA faz.

```
O Agenda Psi ajuda profissionais de psicologia e psicanálise a organizar o
consultório: cadastre pacientes, registre sessões, defina o preço de cada um e
acompanhe pagamentos. Tudo de forma rápida, segura e sem complicações.

Feito para quem atende por conta própria, sem secretária e sem sistema de
clínica.

O QUE VOCÊ FAZ NO APP

• Pacientes — cadastro, telefone, primeira consulta e o preço vigente de cada
  um, com histórico de reajustes.
• Agenda — o horário fixo semanal de cada paciente, sem remontar a semana toda
  segunda-feira.
• Sessões — registre entre um atendimento e outro: data, duração, presencial ou
  remota, e se foi paga.
• Pagamentos — por sessão ou mensal, com o valor já preenchido a partir do preço
  do paciente.
• Despesas — aluguel da sala, supervisão, análise pessoal, impostos e o resto do
  custo real do consultório.
• Início — sessões, recebimentos, despesas, lucro e margem do mês, com a
  comparação com o mês anterior.
• Lembretes por SMS — o paciente é avisado do horário da sessão.

SOBRE A ASSINATURA

Agenda Psi Pro é uma assinatura mensal de renovação automática de R$ 9,90 por
mês, que libera lembretes por SMS ilimitados para os seus pacientes. No plano
gratuito o limite é de 10 lembretes por mês. Todo o restante do app é gratuito e
não depende da assinatura.

A assinatura renova automaticamente ao fim de cada mês, a menos que seja
cancelada até 24 horas antes do fim do período vigente. A cobrança é feita na sua
conta da App Store, e o cancelamento é feito nos ajustes da conta, a qualquer
momento.

Política de privacidade: https://app.notion.com/p/POL-TICA-DE-PRIVACIDADE-APLICATIVOS-DA-DAB-LAB-2bd4305f24e180c395cdda41879cf567
Termos de Uso (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
```

## What's New in This Version  (pt-BR)

```
O Agenda Psi foi reconstruído do zero.

Visual novo, nativo do iOS — telas mais claras, tipografia maior e um modo
escuro de verdade, daqueles que ficam pretos no OLED em vez de cinza. O app
abre mais rápido, rola mais liso e ocupa menos espaço no aparelho.

O que você vai notar primeiro:

• Um novo Início, que mostra o mês inteiro em uma tela: sessões, recebimentos,
  despesas, lucro e margem — e a comparação com o mês anterior.
• Agenda semanal redesenhada, com o horário fixo de cada paciente.
• Registrar sessão e pagamento ficou mais curto: o valor já vem preenchido com
  o preço vigente do paciente.
• Busca de pacientes que ignora acento e maiúscula.
• Voltar visível em todas as telas.

Também corrigimos mais de vinte falhas herdadas da versão anterior — entre elas
o valor do pagamento que era apagado ao editar, o preço que não atualizava na
tela do paciente e os totais que não recarregavam depois de salvar.

Novo: assinatura Agenda Psi Pro, com lembretes por SMS ilimitados para os seus
pacientes. O plano gratuito continua com 10 lembretes por mês. Todo o resto do
app segue livre de cobrança.

É a mesma conta de sempre. Vai ser preciso entrar de novo nesta atualização.
```

⚠️ **A última linha não é detalhe.** Esta atualização desloga toda a base — a
versão anterior guardava a sessão de um jeito e esta guarda de outro. Sem esse
aviso, a primeira reação de quem atualizar é achar que perdeu os dados.

---

## Sign-In Information (conta de demonstração)

| Campo | Valor |
|---|---|
| Sign-in required | **Sim** |
| User name | `alexandre.silva.siqueira+psiteste@gmail.com` |
| Password | definida em 14/09/2026, direto no painel — **não fica escrita aqui** |

Esta conta foi populada em 14/09/2026 com dados fictícios: 8 pacientes, agenda
semanal, sessões dos dois últimos meses, pagamentos e despesas. Nenhum dado de
paciente real. O login com a senha nova foi testado no app e funciona.

Senha nenhuma é versionada neste repositório. Se a conta for perdida, o caminho é
Authentication → Users → Reset password, não procurar aqui.

Ela **não** é conta fundadora, então o paywall aparece normalmente — que é o que
o revisor precisa ver. Não troque para uma conta fundadora: nelas o Pro já vem
concedido e a tela de assinatura some.

---

## App Review Notes  (em inglês, como a Apple espera)

```
Agenda Psi is a practice-management app for self-employed psychologists and
psychoanalysts in Brazil. The interface is in Portuguese only; this note is in
English for the review team.

ACCOUNT IS REQUIRED
There is no guest mode. Please use the demo account provided in the Sign-In
Information section. It is pre-loaded with fictional patients and financial
records — no real patient data is present.

HOW TO REACH THE IN-APP PURCHASE
1. Sign in with the demo account.
2. Tap "Ajustes" (Settings) in the bottom tab bar.
3. Tap "Meu plano" (My plan).
4. The subscription screen "Agenda Psi Pro" opens, showing the monthly plan and
   the "Assinar o Pro" (Subscribe) button.

WHAT THE SUBSCRIPTION UNLOCKS
Agenda Psi Pro is an auto-renewing monthly subscription. It removes the limit on
SMS appointment reminders sent to the user's patients. The free tier includes 10
reminders per month; Pro makes them unlimited. Every other feature of the app —
scheduling, session records, payments, expenses, monthly figures — is free and
not gated by the subscription. There is no free trial.

The reminders are sent by our server on the user's behalf; the app itself never
sends SMS and requests no messaging permission from the device.

ABOUT THIS UPDATE
This version is a complete rewrite of the app. The previous version was built on
a different framework. The backend and all user data are unchanged, but the way
the session is stored on the device changed, so existing users will be signed out
once and will need to sign in again. This is expected and is stated in the
release notes.

PRIVACY
The app stores the professional's own records: patient names, phone numbers,
session dates and amounts. It does not access the device address book, camera,
microphone, or location. No data is sold or shared with third parties. Analytics
events never carry names, amounts, or any text typed by the user.

Thank you for reviewing.
```

---

## Capturas de tela

Fonte em `docs/lojas/telas-iphone/`, capturadas de um build **Release** — sem o
balãozinho do dev client, que apareceria num build de desenvolvimento.

As imagens finais de marketing saem do Claude Design, pelo prompt em
`prompt-claude-design-iphone.md`, em 1242 × 2688.

As de iPad, 2064 × 2752, ficam para depois: são só as telas, sem texto.
