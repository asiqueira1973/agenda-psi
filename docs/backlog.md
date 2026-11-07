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

### Agente: envio duplicado com toques muito rápidos

Dois toques quase simultâneos mandam a mesma pergunta duas vezes (visto com o
robô de pré-lançamento do Play, 02/11/2026). `enviar` em
`app/src/features/agent/use-agente.ts` confere `perguntar.isPending`, que ainda
não mudou no segundo toque. Trocar por uma ref marcada na hora. Gasta uma
pergunta do teto à toa; não grava nada em dobro (consultas só leem, e os
cartões pedem confirmação).

Obs.: a "falha ao perguntar ao agente" que aparecia no Visão do Produto NÃO era
defeito. Os eventos chegam com `sucesso: true`; a tela mostrava a descrição do
catálogo, criada em 15/09 a partir de uma falha do agente antigo.

## Depois

- **Preço do Sonnet 5.** Conferir o preço real em
  `supabase/functions/agente/auditoria.ts` (hoje US$ 3 / US$ 15 por milhão,
  valor de gerações anteriores). O cache de prompt entrou em 02/11/2026.
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

## Em avaliação

### Horário quinzenal (dois pacientes alternando no mesmo horário)

Sugestão de nicolletoigo@hotmail.com via assistente, 05/11/2026. Alexandre vai
decidir se vale: a dúvida é a usabilidade da tela da Agenda.

- Dois pacientes no mesmo horário JÁ é possível: não há trava no banco, e
  `schedule/novo` só avisa ("Já existe um horário marcado nesse dia e nessa
  hora"), sem bloquear.
- O que falta é a alternância. Hoje os dois apareceriam toda semana e — o
  problema sério — `v_sms_lembretes_pendentes` mandaria lembrete aos dois toda
  semana, inclusive na que não têm sessão.
- Desenho levantado: `agenda_semana_padrao` ganha `frequencia` (semanal |
  quinzenal) e a data de uma semana em que o horário acontece; a paridade da
  semana decide se vale. Servidor sozinho resolve SMS e agente; marcar como
  quinzenal e mostrar "quem é desta semana" na Agenda exigem versão nova (a
  Agenda hoje é uma semana-padrão sem datas).

