# Agenda Psi

App de gestão de consultório para psicólogos autônomos brasileiros. Pacientes,
sessões, pagamentos, despesas, agenda de horários fixos e lembrete por SMS.

Reescrita do app anterior, feito em FlutterFlow, para **React Native com Expo**.
O banco não foi reescrito: é o mesmo Supabase, com os mesmos usuários.

- **Spec do produto:** [`docs/spec.md`](docs/spec.md) — manda em tudo
- **Como o sistema ficou:** [`DOCUMENTACAO-TECNICA.md`](DOCUMENTACAO-TECNICA.md)
- **O que não pode ser quebrado:** [`CLAUDE.md`](CLAUDE.md)
- **Schema do banco:** [`docs/schema.md`](docs/schema.md) — arquivo gerado
- **Decisões tomadas fora do spec:** [`docs/decisoes-e-divergencias.md`](docs/decisoes-e-divergencias.md)

---

## Antes de começar

| Ferramenta | Versão | Para quê |
|---|---|---|
| Node | 22+ | tudo |
| Xcode | 26.1.1 | build de iOS |
| CocoaPods | 1.17+ | idem |
| Docker (colima serve) | qualquer | banco local e `supabase db dump` |
| Supabase CLI | 2.117+ | migrations, tipos, deploy das functions |
| EAS CLI | 22+ | build e submit nas lojas |

⚠️ **A pasta do projeto não pode ter espaço no nome.** O script do React Native
0.83 que baixa dependências pré-compiladas falha em caminho com espaço, e a
mensagem de erro aponta para o lugar errado. Clone em `agenda-psi`, não em
`Agenda Psi`.

---

## Rodando

```bash
cd app
cp .env.example .env      # e preencha, ver abaixo
npm install
npx expo run:ios          # compila e abre no simulador
```

Depois do primeiro build, o ciclo é só `npx expo start` — o dev client já está
instalado e o JavaScript recarrega sozinho.

O app usa **development build**, não Expo Go: o RevenueCat exige módulo nativo.

---

## Variáveis de ambiente

Todas em `app/.env`, e todas `EXPO_PUBLIC_*` — ou seja, **embutidas no bundle e
legíveis por quem abrir o IPA ou o APK**. São públicas por design.

| Variável | O que é | Obrigatória |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL do projeto | sim |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave publicável, inútil sem passar pela RLS | sim |
| `EXPO_PUBLIC_VISAODEPRODUTO_URL` | endpoint de ingestão de eventos | não |
| `EXPO_PUBLIC_VISAODEPRODUTO_KEY` | chave de ingestão, só escrita. Sem ela o app roda e não emite evento | não |
| `EXPO_PUBLIC_RC_IOS_KEY` / `EXPO_PUBLIC_RC_ANDROID_KEY` | chaves de cliente do RevenueCat | só no épico 8.11 |

**Nenhum segredo de verdade vive aqui.** `service_role`, `N8N_WEBHOOK_SECRET` e
`RC_WEBHOOK_SECRET` existem apenas nos secrets das Edge Functions.

Para os builds do EAS, as mesmas variáveis estão cadastradas no projeto
(`eas env:list`), nos três ambientes.

---

## Banco

O schema é versionado em `supabase/migrations` e aplicado **por comando, nunca
pela interface**.

```bash
supabase link --project-ref tocytpjtupbbxwgamtxq
supabase db push --linked          # aplica o que falta em produção
supabase db reset --local          # reconstrói o banco local do zero
supabase test db --local           # roda a suíte pgTAP
```

Depois de qualquer DDL: **rode `get_advisors`**, de segurança e de performance.

Os tipos do TypeScript são gerados do banco real e devem ser regerados a cada
migration:

```bash
supabase gen types typescript --linked > app/src/lib/supabase/database.types.ts
```

### Migrations retidas

Duas existem, estão revisadas e **não** estão em `supabase/migrations`, de
propósito — `db push` aplica tudo que encontra lá. Estão em
[`supabase/migrations-pendentes/`](supabase/migrations-pendentes/README.md), com
a condição de entrada de cada uma.

---

## Edge Functions

Quatro, em `supabase/functions`. As três primeiras substituem webhooks que hoje
rodam **sem autenticação nenhuma**.

```bash
supabase functions deploy agente-psi
supabase functions deploy analise-financeira
supabase functions deploy notifica-admin
supabase functions deploy rc-webhook
```

Secrets necessários:

```bash
supabase secrets set N8N_AGENTE_URL=... N8N_ANALISE_URL=... N8N_MEAVISA_URL=... \
                     N8N_WEBHOOK_SECRET=... RC_WEBHOOK_SECRET=...
```

---

## Testes

```bash
cd app && npx tsc --noEmit    # typecheck
cd app && npx jest            # unitários: formatação, validação, literais do banco
supabase test db --local      # pgTAP: paywall, contador, RLS
```

O teste de RLS autentica como dois psicólogos diferentes e verifica que um não
lê nem escreve dado do outro, **em todas as tabelas**. É o que protege dado de
saúde, e roda sempre.

---

## Build e publicação

```bash
cd app
eas build --profile development --platform ios    # dev client
eas build --profile preview --platform all        # TestFlight e faixa interna
eas build --profile production --platform all
eas submit --profile production --platform ios
```

O app está publicado nas duas lojas com o identificador
`com.dablab.agendapsi`. **Não é primeira publicação em nenhuma das duas** — é
atualização, e a base instalada é preservada.

⚠️ **A atualização desloga todo mundo.** O app anterior guarda a sessão em
`SharedPreferences` e este guarda no Keychain. É por construção, não é defeito.
Avise os usuários ativos antes de publicar.

---

## Licença

Software proprietário. Dab Lab.
