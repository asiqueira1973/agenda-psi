# Backlog

O que ficou combinado para depois. O mais urgente no topo. Ao fazer um item,
apague daqui no mesmo commit.

## Próxima versão (5.0.3)

### Teclado cobre campos nos formulários do Android 15

No Android 15 (API 35) o app é obrigatoriamente edge-to-edge, e o
`adjustResize` do manifesto deixa de encolher a tela quando o teclado abre. Os
campos do fim do formulário e o botão do rodapé ficam atrás do teclado.

- Já está corrigido na tela do agente (commit 44b30db): `behavior="padding"` no
  KeyboardAvoidingView, nas duas plataformas.
- Faltam 17 telas com `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`:
  `patients/novo`, `patients/[id]/preco`, `patients/[id]/editar`,
  `settings/feedback`, `settings/perfil`, `settings/apagar-conta`,
  `payments/novo`, `payments/[id]`, `expenses/nova`, `expenses/[id]`,
  `schedule/novo`, `schedule/[id]`, `sessions/nova`, `sessions/[id]`,
  `(auth)/login`, `(auth)/nova-senha`, `(auth)/nova-conta`.
- Testar cada uma no emulador `agendapsi_pixel` (API 35), tocando no último
  campo. Atenção ao login: há um travamento conhecido no Android Fabric
  ("addViewAt: view already has a parent") que não pode piorar.
- Não é regressão: o defeito já estava na versão 5.0.1. Decidido em 02/11/2026
  deixar fora da 5.0.2 porque exige testar as 17 telas.

## Depois

- **Custo do agente.** Cerca de US$ 0,03 por pergunta, quase todo das
  definições de ferramentas reenviadas a cada chamada. Cache de prompt da
  Anthropic corta boa parte. Conferir também o preço real do Sonnet 5 em
  `supabase/functions/agente/auditoria.ts` (hoje US$ 3 / US$ 15 por milhão,
  valor de gerações anteriores).
- **Esqueleto infinito** quando uma aba é aberta sem sessão (link direto que
  passa por fora da proteção de rota).
- **Sessões com data futura** (~25% das registradas) contam como realizadas e
  provavelmente inflam os números do mês. Ver docs/agente-plano.md, item 3.
- **Compra de ponta a ponta nunca testada** em nenhuma das lojas (sandbox do
  iOS e teste de licença do Play).
- **Travamento do login no Android** ("addViewAt") — a correção de 15/09 não
  foi provada. Conferir em Play Console → Falhas e ANRs.
- **Imagem de destaque do Play** (1024 × 500).
- **Funções `agentpsi_*`** estão fechadas à API desde a 0017, mas existem.
  Apagar de vez quando tiver certeza de que nenhum fluxo do n8n as usa.
