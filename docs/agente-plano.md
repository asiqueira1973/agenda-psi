# Agente — diagnóstico e plano

Escrito em 02/11/2026, a partir do uso real dos últimos 30 dias.

Uma tela de agente já existiu (a do FlutterFlow, órfã e só de consulta) e saiu do
produto em 14/09/2026. Esta é a segunda tentativa, agora com escrita.

## Diagnóstico

### 1. O uso é muito concentrado

Nos últimos 30 dias, 18 pessoas registraram sessão. Uma delas fez 240 das 452
(53%); as cinco maiores fizeram 400 (88%). O agente precisa funcionar primeiro
para esse grupo.

### 2. Quase ninguém registra a sessão no dia em que ela acontece

| Quando registram | Sessões |
|---|---|
| no mesmo dia | 106 (23%) |
| 1 a 3 dias depois | 121 |
| 4 a 30 dias depois | 95 |
| mais de 30 dias depois | 16 |
| antes de acontecer (data futura) | ~114 |

O comportamento dominante é lançar em lote, atrasado. Os picos confirmam: 107
sessões gravadas em 30/10, 76 em 05/10, 32 em 28/10 com sessões desde julho.

É o caso em que linguagem natural rende mais: uma frase como "semana passada:
segunda Beatriz e Caio pagaram, terça Helena não pagou, quarta todos no mensal"
substitui dezenas de toques.

Mas o lote não é o único caso. O registro unitário — uma sessão, um pagamento, um
paciente novo, um horário fixo na agenda — tem de funcionar tão bem quanto,
porque é o que acontece no dia a dia de quem registra na hora.

### 3. Achado à parte: sessões com data futura

Cerca de 25% das sessões são registradas antes de acontecer. Algumas pessoas usam
"sessão" como agenda, e o banco grava essas linhas como `realizada`. Isso
provavelmente infla "Sessões no mês" e "sessões não pagas" no Início. Investigar
separado do agente.

### 4. O lado financeiro quase não é alimentado

14 pessoas registram pagamento; 6 registram despesa. O Início promete lucro e
margem, mas para quase todo mundo esses números estão vazios. "Paguei 1.450 de
aluguel" é a frase mais fácil de traduzir e a que mais destrava esses números.

## Desenho

**O cartão de confirmação é a regra para toda escrita.** A IA traduz a frase e
monta um cartão com o que vai gravar — paciente, data, valor, se pagou. A pessoa
confere e confirma. Campo ambíguo vem destacado e editável no próprio cartão.

O mesmo cartão serve aos dois casos: num registro unitário, uma linha; num lote,
uma tabela com N linhas e um único Confirmar.

**Um cartão, uma coisa do app.** O app separa coisas que a fala mistura, e o
agente respeita a separação:

| Coisa | Tabela | O que é | Exemplo de frase |
|---|---|---|---|
| Paciente | `pacientes` (+ preço em `precos_paciente`) | o cadastro: nome, telefone, e-mail, primeira consulta, preço | "cadastra a Laura Mendes, 11 98888-0000, R$ 250" |
| Horário na agenda | `agenda_semana_padrao` | a semana-padrão do profissional: dia, início, fim, paciente — é dela que saem os lembretes de SMS | "põe a Laura na agenda toda quarta às 10h" |
| Sessão | `sessoes` | o atendimento que aconteceu, numa data | "atendi a Beatriz hoje" |
| Pagamento | `pagamentos` | o dinheiro que entrou | "a Beatriz pagou 280" |
| Despesa | `despesas` | o dinheiro que saiu | "paguei 1.450 de aluguel" |

Se uma frase toca duas coisas ("paciente nova, Laura, quartas 10h"), são **duas
funções diferentes**: `propor_paciente` e `propor_horario`, cada uma com o seu
rascunho e a sua gravação, pelos mesmos hooks das telas. Para a pessoa, isso pode
aparecer mascarado como um passo só — um cartão com duas seções (Paciente /
Agenda) e um único Confirmar. Por baixo, o app grava na ordem da dependência: o
paciente primeiro, o horário depois, com o id do paciente recém-criado. Se a
segunda gravação falhar, a primeira fica (paciente cadastrado sem horário é um
estado válido do app) e o cartão diz o que faltou.

**Sessão "paga" e pagamento são coisas diferentes, como nas telas.** "Atendi a
Beatriz e ela pagou" grava **só a sessão**, com o campo de pagamento da sessão
marcado como pago. Não cria registro em `pagamentos`. Depois de confirmada a
sessão, o agente pode oferecer, numa linha, "Registrar também o pagamento de
R$ 280?" — e só cria o pagamento se a pessoa aceitar, com cartão próprio, em que
o valor já vem preenchido e pode ser alterado.

No sentido inverso, "a Beatriz pagou 280" é pagamento, não sessão: o agente não
cria sessão por conta própria.

A tradução é o caminho principal; o cartão só garante que nada é gravado sem a
pessoa ver. Um "Helena pagou" gravado na Helena errada é pior que nenhum agente.

**Arquitetura:**

- Uma Edge Function `agente`, com Claude usando ferramentas. A IA nunca escreve
  SQL; chama um conjunto fechado: `buscar_paciente`, `propor_sessoes`,
  `propor_pagamentos`, `propor_despesa`, `propor_paciente`, `propor_horario`,
  `consultar_resumo`, `listar_nao_pagas`. As ferramentas `propor_*` aceitam uma
  lista — um item é só uma lista de tamanho um, sem caminho separado.
- As ferramentas `propor_*` não gravam: devolvem um rascunho. Quem grava é o app,
  quando a pessoa confirma, pelos mesmos hooks das telas — mesmas validações,
  mesma invalidação de cache.
- Tudo roda com o JWT do usuário, nunca com service_role. A RLS garante que o
  agente só enxerga e altera os dados de quem está usando.
- O valor sugerido vem do banco, não da IA: é o preço vigente em
  `precos_paciente`. Ele é **referência, não regra** — o campo de valor é sempre
  editável no cartão, porque a pessoa pode ter cobrado diferente naquela sessão.
  Se a frase já diz o valor ("pagou 250"), vale o da frase, e o cartão mostra o
  preço de cadastro ao lado só para a pessoa notar a diferença.
- Nomes resolvidos no banco com o `unaccent` que já existe. Duas "Ana", o cartão
  pergunta qual.

## Interface (decidido em 02/11/2026)

**O agente É o Início.** O resumo de 13 indicadores sai: é pouco lido, e lucro,
margem e break-even dependem de despesa, que quase ninguém registra. Os números
continuam disponíveis — por pergunta ("quanto recebi em outubro?"), lidos da
mesma `v_dashboard_resumo`, que fica no banco.

- **Ao abrir:** título, campo "Pergunte ou registre algo…" no topo, quatro
  sugestões tocáveis e o aviso de limite de SMS quando houver. Cada sugestão
  mexe numa coisa só: "Atendi a Beatriz e o Caio hoje", "Quem não pagou este
  mês?", "Cadastrar paciente: Laura Mendes, R$ 250", "Pôr a Laura na agenda
  toda quarta às 10h".
- **Depois da primeira frase:** o Início vira a conversa. O campo desce para o
  rodapé ("Continuar…"), as respostas e os cartões de confirmação ficam no fio,
  e um cartão confirmado fica marcado como "Registrado". "Nova conversa" no topo
  limpa e volta ao estado inicial.
- A conversa vive só na memória do app — não se grava histórico no banco.
- **Com o sinalizador `agente` desligado:** o Início mostra o resumo antigo. Por
  isso o código do resumo só é apagado depois que o agente estiver estável.

Alternativa descartada: tela de conversa separada. Um toque a mais justamente no
registro rápido, que é o caso de uso mais forte.

## Fases

| Fase | O que entra | Por quê |
|---|---|---|
| 1 | Só consultas: "quem não pagou este mês?", "quanto recebi em outubro?" — com os eventos de uso do agente | Risco zero de escrita; valida se as pessoas usam |
| 2 | Escrita, unitária e em lote, com cartão de confirmação: sessão, pagamento, paciente, horário fixo, despesa | Cobre tanto quem registra na hora quanto quem lança atrasado |
| 3 | Voz | Entre atendimentos, falar é mais natural; o ditado do teclado já resolve boa parte sem código |

## Como medir

- quantas sessões passam a entrar pelo agente;
- se o atraso médio de registro cai;
- taxa de cartões confirmados contra cancelados;
- quanto do que o agente gravou é editado ou apagado depois — a medida de que a
  tradução está certa.
