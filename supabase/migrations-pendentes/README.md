# Migrations escritas, revisadas e **ainda não aplicadas**

Estas duas não estão em `supabase/migrations/` de propósito. `supabase db push`
aplica tudo que encontra lá; migration que tem hora certa para entrar não pode
ficar no caminho de um comando automático.

Quando chegar a hora, mova o arquivo para `supabase/migrations/` com prefixo de
timestamp (`AAAAMMDDHHMMSS_`) maior que o da última aplicada, e rode o push.

| Arquivo | Entra quando | Por quê esperar |
|---|---|---|
| `0005_trigger_notification_vault.sql` | assim que você guardar a `service_role` atual no Vault (passo 1 do runbook no cabeçalho do arquivo) | A migration tira a chave do catálogo do Postgres, mas **não rotaciona nada** — rotacionar é ação sua no painel e quebra todo fluxo n8n que use a chave antiga. Impacto de aplicar hoje: nenhum na prática, `notifications` tem 0 linhas e o push nunca foi implementado (spec 28.2) |
| `0008_paywall_corte_sms.sql` | junto com o épico 8.11, com o app publicado mostrando consumo, avisando e vendendo | É a migration que de fato corta SMS de gente real. Em 13/09/2026 havia 2 profissionais não-fundadores já acima de 10 SMS no mês. Aplicar antes da tela é cortar sem explicar (spec 8.11 e fluxo 9.3) |

A numeração 0001–0008 é a do spec e está no cabeçalho de cada arquivo. A ordem de
execução é a do timestamp, não a do número: a 0005 espera decisão sua e por isso
entra depois da 0006 e da 0007, que não dependem dela.
