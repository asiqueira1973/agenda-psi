# Agenda Psi connector for Claude and ChatGPT

*Versão em português abaixo.*

Agenda Psi is a scheduling and cost-management app for independent psychologists and psychoanalysts in Brazil: weekly schedule, sessions held, payments, per-patient prices and practice expenses. It is **not** an electronic health record. The connector lets you query and update your own Agenda Psi data from a conversation.

## Connect
- **URL:** `https://app.agendapsi.app.br/mcp`
- **Sign-in:** OAuth. You log in with your Agenda Psi e-mail and password and approve access. Each person only sees their own data (database row-level security).
- **Requirement:** an Agenda Psi account (iOS or Android).

## How it works
- **Reads** answer right away: today's or this week's schedule, who has pending payments, how much was received in a month or period, a patient's financial history, expenses by type.
- **Every write opens a form** inside the conversation (in clients that support MCP Apps, such as Claude), pre-filled with what you said. Clients without forms get a preview first and save only after you confirm it in the chat. Nothing is saved until you review it and click **Salvar** (Save). Deletions need a second click, **Excluir definitivamente** (Delete permanently).
- **Clinical notes are never read or sent** by the connector.

## Try it in 10 minutes (prompts are in Portuguese, as the app is)
| Prompt | What happens |
|---|---|
| "Qual a minha agenda da semana?" (*What's my schedule this week?*) | Lists fixed appointments by day |
| "Quem não me pagou?" (*Who hasn't paid me?*) | Patients with pending sessions and totals |
| "Quanto recebi este mês?" (*How much did I receive this month?*) | Received and pending for the month |
| "Atendi a Beatriz hoje e ela pagou" (*I saw Beatriz today and she paid*) | Opens the session form; then **Salvar** |
| "Paguei 1450 de aluguel hoje" (*I paid 1,450 rent today*) | Opens the expense form |
| "Cadastra a Laura Mendes, 11 91234-5678, 200 por sessão, quartas às 10h" | Opens the new-patient form with price and a weekly slot |
| "O Caio passou de quinta 9h para sexta 10h" | Opens the schedule-change form with before/after |
| "Apaga o pagamento duplicado da Beatriz" | Lists candidates; delete needs two clicks |

## Privacy and support
- Privacy policy (section "Agenda Psi"): https://app.notion.com/p/POL-TICA-DE-PRIVACIDADE-APLICATIVOS-DA-DAB-LAB-2bd4305f24e180c395cdda41879cf567
- Support: alexandre@dablab.com.br (Dab Lab)
- Disconnect anytime in your assistant's connector settings.

---

# Conector do Agenda Psi para Claude e ChatGPT

O Agenda Psi é um app de gestão de agenda e custos para psicólogos e psicanalistas autônomos: horários fixos, sessões, pagamentos, preços por paciente e despesas. Não é prontuário. Com o conector, você consulta e registra pela conversa.

- **Endereço:** `https://app.agendapsi.app.br/mcp`.
- **Como conectar:** no Claude, Configurações → Conectores → Adicionar conector personalizado. No ChatGPT, modo desenvolvedor. Depois, entre com o seu e-mail e senha do Agenda Psi e clique em Permitir.
- **Registros:** consultas respondem na hora. Todo registro abre um formulário já preenchido (em clientes com MCP Apps, como o Claude), e nada é gravado antes de você clicar em Salvar. Sem formulário, aparece uma prévia, e só grava quando você confirmar. Exclusões pedem a confirmação "Excluir definitivamente".
- **Observações dos pacientes:** o conector nunca as lê nem as envia.
- **Exemplos:** as frases da tabela acima.
- **Privacidade e suporte:** os links acima.
