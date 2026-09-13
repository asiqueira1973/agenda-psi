# Handoff: Agenda Psi — app de gestão de consultório

## Overview

Agenda Psi é um app mobile nativo (iOS e Android) de gestão de consultório para psicólogos
autônomos brasileiros. Um único perfil de usuário: o psicólogo autenticado, que vê e edita
apenas os próprios dados. Não existe tela de administração, não há conteúdo de outros usuários
em lugar nenhum do app, e a assinatura é sempre a própria.

Dois momentos definem o desenho:

1. **Entre sessões** — cinco minutos, de pé, celular numa mão. É quando ela registra que a
   sessão aconteceu e que o paciente pagou. O caminho Pacientes → busca → Detalhe do paciente →
   Registrar sessão → Registrar pagamento é o mais curto do app: as duas ações são as duas
   primeiras linhas da tela de detalhe.
2. **Fim do mês** — sentada, com tempo, querendo saber quanto entrou, quanto saiu e quanto
   sobrou. É quando ela olha o dashboard (tela Início).

Todo o texto do app é em português do Brasil e é final, não placeholder. A única exceção são
os preços do plano na tela de paywall, marcados como `[placeholder: preço mensal]` e
`[placeholder: preço anual]`.

## About the Design Files

Os arquivos deste pacote são **referências de design feitas em HTML** — protótipos que mostram
a aparência e o comportamento pretendidos, não código de produção para copiar.

A tarefa é **recriar estes designs no ambiente do codebase de destino** (React Native com Expo,
no caso do Agenda Psi), usando os componentes e padrões já estabelecidos lá. Onde o codebase
ainda não tiver um componente equivalente, crie-o seguindo as medidas e os tokens
documentados abaixo.

O HTML usa CSS custom properties para as cores porque isso permitiu montar os dois temas de
uma vez. No app, use a paleta semântica nativa da plataforma — `UIColor.system*` no iOS,
o equivalente Material no Android — e não hex codes cravados. Os hex codes na seção Design
Tokens existem para você conferir qual token é qual, não para colar no código.

## Fidelity

**Alta fidelidade.** Cores, tipografia, espaçamento, alturas de linha e copy estão finais.
Recrie a UI fielmente. As telas foram desenhadas na largura de 390pt (iPhone 14/15) e altura
de 844pt; o conteúdo que passa dessa altura rola.

O que **não** está no pacote e precisa de decisão sua: os ícones. O HTML usa SVGs desenhados à
mão como marcadores de posição. No app, use **SF Symbols** no iOS e **Material Symbols** no
Android, nos tamanhos indicados (21pt em linha de lista, 24pt em barra de navegação).

---

## Direção visual

### A regra de ouro

Antes de construir qualquer tela, pergunte: "esta tela caberia dentro do app Ajustes, do Saúde
ou do Lembretes da Apple?" Se a resposta for não, está errada.

### iOS é lista, não cartão

O app inteiro é feito de **inset grouped lists**. Um container arredondado por grupo, com
linhas de 44pt dentro, separadas por hairline de 0,5pt que começa no inset do texto (não
sangra até a borda do container). O título do grupo fica **fora** do container, acima dele,
em 13pt na cor de texto secundário, alinhado à margem de 16pt.

Todo par rótulo/valor é uma linha: rótulo à esquerda em texto primário, valor à direita em
texto secundário. Chevron só em linha que navega.

Número grande (34pt) existe em **um** lugar do app inteiro: o cartão `Pacientes Ativos` no topo
da Home. Em tela de detalhe, nunca.

### Botões

No máximo **um** botão preenchido por tela, e ele vive no rodapé, largura total, ou não existe.
Ações que no web seriam botão viram linha de lista com o texto na cor de destaque e o ícone
tintado à esquerda — como "Adicionar conta" no Ajustes do iOS.

### Cor

A cor de destaque é o **azul do sistema**. O app não tem cor de marca própria.

| Onde | Cor |
|---|---|
| Texto de linha de ação, ícone dessa linha, botão de voltar, controle selecionado, aba ativa, botão preenchido | systemBlue |
| Valor monetário positivo no dashboard (`Pagamentos no mês`, `Lucro no mês`), ícone de confirmação de assinatura, toggle ligado | systemGreen |
| Aviso de limite de SMS chegando (um uso no app inteiro) | systemOrange |
| Ação destrutiva (`Excluir`, `Apagar a minha conta`, `Sair`), valor de despesa, lucro negativo, erro de campo, barra de consumo cheia | systemRed |
| Todo o resto: status, metadados, rótulos, valores neutros, placeholders | label / secondaryLabel / tertiaryLabel / systemGray |

Azul nunca como fundo de bloco grande, com duas exceções: o botão preenchido (um por tela) e
a bolha da própria usuária na conversa do Agente Psi (padrão do Messages).

Status **não** é pílula colorida. Paciente ativo não recebe marcação nenhuma — ativo é o
normal. Inativo aparece em um grupo separado com a palavra `Inativo` em cinza à direita da
linha. `Pagou` / `Não pagou` é texto secundário cinza, não semáforo.

Regra de sanidade: conte as cores de uma tela fora de preto, branco e cinza. Se passar de
duas, está errada. A maioria das telas tem uma: o azul.

### Densidade

Linha de 44pt, inset de 16pt, texto de 17pt. Compacto e legível, não arejado.

### Modo escuro

Obrigatório. No modo escuro o fundo da tela é **preto puro** (#000000), não cinza escuro, e a
superfície de lista é #1C1C1E. É o que faz a tela parecer profunda no OLED.

### Proibido

- gradiente, sombra, borda em cartão
- dois ou mais botões preenchidos na mesma tela
- pílula colorida preenchida como badge de status
- número em 28pt+ fora da Home
- cartão dentro de cartão
- título de seção em negrito preto dentro do container
- ícone dentro de círculo colorido
- emoji

---

## Design Tokens

### Cores

| Papel | Token iOS | Claro | Escuro |
|---|---|---|---|
| Destaque / ação | systemBlue | `#007AFF` | `#0A84FF` |
| Conteúdo sobre o destaque | — | `#FFFFFF` | `#FFFFFF` |
| Texto primário | label | `#000000` | `#FFFFFF` |
| Texto secundário | secondaryLabel | `rgba(60,60,67,.6)` | `rgba(235,235,245,.6)` |
| Texto terciário (placeholder, chevron, botão desabilitado) | tertiaryLabel | `rgba(60,60,67,.3)` | `rgba(235,235,245,.3)` |
| Cinza de controle | systemGray | `#8E8E93` | `#8E8E93` |
| Fundo da tela de lista | systemGroupedBackground | `#F2F2F7` | `#000000` |
| Superfície de lista / cartão | secondarySystemGroupedBackground | `#FFFFFF` | `#1C1C1E` |
| Separador (hairline 0,5pt) | opaqueSeparator | `#C6C6C8` | `#38383A` |
| Preenchimento de controle (segmented, busca, barra de progresso) | tertiarySystemFill | `#E9E9EB` | `#2C2C2E` |
| Positivo | systemGreen | `#34C759` | `#30D158` |
| Atenção | systemOrange | `#FF9500` | `#FF9F0A` |
| Destrutivo / negativo | systemRed | `#FF3B30` | `#FF453A` |
| Scrim de folha modal e alerta | — | `rgba(0,0,0,.4)` | `rgba(0,0,0,.6)` |

Contraste mínimo de 4,5:1 em todo texto. **Nenhuma informação transmitida só por cor** — todo
status tem rótulo textual.

### Tipografia

Fonte do sistema (SF Pro no iOS, Roboto no Android), com Dynamic Type ativo.

| Estilo | Tamanho / peso | Uso |
|---|---|---|
| Large title | 34 / bold, letter-spacing −0.02em | Título de aba e de tela; colapsa ao rolar |
| Title 2 | 22 / bold | Número principal do cartão da Home (34 no caso de `Pacientes Ativos`), título de estado vazio forte |
| Headline | 17 / semibold | Nome do paciente em lista, título de alerta, título de folha modal, rótulo de botão |
| Body | 17 / regular | Rótulo e valor de linha de lista, corpo de estado vazio |
| Subheadline | 15 / regular | Segunda linha de célula de paciente e de despesa |
| Footnote | 13 / regular | Título de grupo (em maiúsculas), rodapé de grupo, metadado, mensagem de erro, coluna de horas da agenda |
| Caption | 12 / regular | Rótulo de aba, aviso legal do paywall |

**Todo número financeiro e toda data em variante tabular** (`font-variant-numeric: tabular-nums`,
`UIFont.monospacedDigitSystemFont` no iOS). Sem isso a coluna de valores dança.

### Espaçamento e forma

Grade de 4pt: 4, 8, 12, 16, 20, 24, 32. Margem lateral 16.

| Medida | Valor |
|---|---|
| Altura de linha de lista | 44pt (56pt quando a célula tem duas linhas de texto; 64/72pt na célula de paciente com três) |
| Inset horizontal dentro do container | 16pt |
| Inset do hairline | 16pt (49pt quando a linha tem ícone à esquerda) |
| Raio do container de lista e do cartão | 10pt |
| Raio da folha modal (topo) | 12pt |
| Raio do alerta | 14pt |
| Raio do botão preenchido | 10pt |
| Altura do botão preenchido | 50pt |
| Espaço entre grupos | 24pt (título do grupo 6pt acima do container) |
| Área mínima de toque | 44×44pt |
| Toggle (UISwitch) | 51×31pt, knob 27pt |
| Barra de status | 44pt |
| Barra de navegação | 44pt |
| Barra de abas | 49pt + 34pt de home indicator |

---

## Componentes-chave

### Inset grouped list
Container: superfície de lista, raio 10, margem lateral 16, sem borda e sem sombra. Linhas de
44pt com inset de 16. Hairline de 0,5pt na cor de separador, com `margin-left` igual ao inset
do texto. Título do grupo fora, acima, em footnote maiúsculo na cor secundária. Rodapé de
grupo (quando existe) fora, abaixo, em footnote secundário.

### Linha de ação
Ícone de 21pt tintado em azul à esquerda, 12pt de gap, texto 17pt em azul. Hairline inset em
49pt para alinhar com o texto. Sem chevron — a linha executa, não navega.

### Linha de navegação
Rótulo 17pt primário à esquerda; à direita, quando houver, o valor em 17pt secundário, 8pt de
gap e o chevron (9×15pt, stroke 2pt, cor terciária).

### Linha de formulário
Rótulo 17pt primário com largura fixa à esquerda (76–96pt, alinhado no grupo), valor editável
17pt à direita do rótulo. Placeholder na cor terciária. Erro de validação: rótulo vira
vermelho e a mensagem aparece como rodapé do grupo em footnote vermelho — não borda vermelha
no campo.

### Célula de paciente
Nome em headline; segunda linha em subheadline secundário com `R$ 200 · 12 sessões · última
05/03/2026`; terceira linha, só quando houver, `2 sessões não pagas`. Chevron à direita. A
célula inteira é tocável. Exclusão por **deslize** revelando `Excluir` em vermelho ocupando
88pt à direita — nunca botão visível em cima da célula.

### Cartão de indicador (só na Home)
Superfície de lista, raio 10, padding 12/16/14. Rótulo em footnote secundário, valor em 34pt
bold tabular abaixo. Sem borda, sem sombra, sem ícone.

### Folha modal
Ocupa a parte de baixo da tela sobre um scrim, raio 12 no topo. Cabeçalho de 52pt com
`Cancelar` à esquerda em azul, título centralizado em headline e a ação primária à direita em
azul semibold — desabilitada na cor terciária quando o formulário não é válido. Conteúdo
rolável em grupos de lista. Teclado empurra a folha.

### Alerta
Largura da tela menos 48pt de cada lado, raio 14, superfície de lista. Título em headline,
corpo em footnote secundário, ambos centralizados. Hairline, depois os botões: dois lado a
lado divididos por hairline vertical, 44pt de altura; a ação destrutiva em vermelho semibold.

### Segmented control
Trilha na cor de preenchimento de controle, raio 9, padding 2. Segmento selecionado com fundo
de superfície, raio 7, texto 15pt semibold; os outros em 15pt secundário. Altura 32–34pt.

### Grade da agenda
Coluna de horas de 46pt à esquerda em footnote tabular secundário. Hora vazia: altura reduzida
(20pt) com hairline no topo da faixa da direita. Hora ocupada: célula de lista com raio 10,
`14:30 - Fernanda Souza` em 17pt e a segunda linha `até 15:20` em footnote secundário, com
chevron. Seletor de dia como segmented control de 7 posições, abrindo no dia de hoje.

### Estado vazio
Nunca uma área em branco. Símbolo grande (52–60pt) na cor systemGray com stroke fino, título em
headline, uma frase em body secundário, e — quando houver ação — **um** botão preenchido no
rodapé, largura total. Desenhado para toda lista do app.

---

## Screens / Views

As telas abaixo seguem a numeração da especificação. Cada uma existe em claro e escuro.

### Autenticação (sem abas, tela cheia)

**1. Login** — Large title `Seja bem-vindo(a)`, subtítulo `Vamos começar preenchendo as
informações abaixo`. Grupo com duas linhas de formulário: `E-mail` e `Senha` (a de senha tem o
olho de visibilidade em azul, 21pt, à direita). Botão preenchido `Entrar`. Abaixo, centralizados,
`Esqueci minha senha` e `Não tem uma conta? Crie uma conta aqui` em azul. Rodapé fixo com
`Política de privacidade` em azul 13pt e a assinatura `Dab Lab` em 13pt secundário.
- **1a carregando**: grupo com opacidade reduzida, botão a 40% com spinner e o texto `Entrando…`.
- **1b erro**: rodapé de grupo em footnote vermelho `E-mail ou senha incorretos.`
- **1c conta desativada**: alerta bloqueante `Conta desativada`, corpo `Esta conta foi
  desativada. Fale com o suporte da Dab Lab para reativar o acesso.`, um botão `OK`.

**2. Nova conta** — Botão de voltar `Entrar`. Large title `Crie sua conta`. Grupo com `Nome`,
`E-mail`, `Senha`, `Confirmação`. Botão preenchido `Criar conta`. Link `Já tem uma conta?
Entre aqui`.
- **2a**: rótulo `Confirmação` em vermelho, rodapé `As senhas não são iguais.`, botão a 40%.

**3. Confirme seu e-mail** — Símbolo de envelope 56pt, título 22pt `Confirme seu e-mail`, corpo
`Enviamos um link de confirmação para {email}. Abra o e-mail e toque no link para ativar sua
conta.` Ações em texto azul: `Reenviar o e-mail` e `Voltar para o login`. Sem botão preenchido.

**4. Nova senha** (abre por link do e-mail) — Large title `Nova senha`, subtítulo `Escolha uma
senha nova para entrar no Agenda Psi.`, grupo com `Nova senha` e `Confirmação`, botão
preenchido `Salvar a nova senha`.

### Aba 1 — Início

**5. Início (dashboard)** — Large title `Agenda Psi` com o ícone do Agente Psi (23pt, azul) à
direita na barra. Cartão de indicador `Pacientes Ativos` com `18` em 34pt. Depois três grupos:

- `ESTE MÊS`: `Sessões no mês` 64 · `Pagamentos no mês` R$ 12.400 (verde) · `Despesas no mês`
  R$ 3.150 (vermelho) · `Lucro no mês` R$ 9.250 (verde) · `Margem do mês` 74,5%
- `MÊS ANTERIOR`: `Sessões mês −1` 58 · `Pagamentos mês −1` R$ 11.200 · `Despesas mês −1`
  R$ 2.980 · `Lucro mês −1` R$ 8.220 — todos em cinza, sem cor semântica
- `MÉDIAS E METAS`: `Custo médio/paciente` R$ 175 · `Receita média/paciente` R$ 689 ·
  `Break-even (sessões)` 16

Por último, um grupo com a linha de ação `Análise com IA`.

Variantes:
- **5a carregando** — esqueleto: barras arredondadas na cor de preenchimento de controle nas
  posições de rótulo e de valor. Nunca zeros.
- **5b vazia (sem pacientes)** — no lugar dos indicadores, estado vazio com
  `Comece cadastrando seu primeiro paciente.`, corpo `Os números do mês aparecem aqui assim que
  houver sessões e pagamentos registrados.` e botão preenchido `Cadastrar paciente`.
- **5d aviso de limite** — acima do cartão, uma linha em grupo próprio com ícone de atenção
  laranja e o texto `Faltam 2 lembretes no seu plano gratuito deste mês.`, com chevron; rodapé
  do grupo `Configurações › Meu plano`.
- **5e lembretes pausados** — a mesma linha em vermelho: `Seus lembretes por SMS pausaram até
  01/10/2026`.
- **5f IA processando** — a linha `Analisando…` na cor terciária com spinner, barra de progresso
  de 4pt em azul a 42% e o rodapé `Lendo as sessões, os pagamentos e as despesas dos últimos
  dois meses.`
- **5g IA erro** — rodapé em vermelho `Não foi possível carregar. Toque para tentar de novo.`
- **5h IA resultado** — tela própria com botão de voltar `Início` e large title `Análise com
  IA`; quatro grupos: `RESUMO`, `RISCOS`, `OPORTUNIDADES` (cada um um container com um bloco de
  texto 17pt) e `AÇÕES PRIORITÁRIAS` (container com uma linha por ação).

### Aba 2 — Agenda

**6. Agenda semanal** — Large title `Agenda` com `+` azul na barra. Segmented control de 7
posições (`Dom` a `Sáb`), abrindo em hoje. Grade de 08:00 a 21:00. Hora ocupada:
`09:00 - Ana Prado` / `até 09:50`; `14:30 - Fernanda Souza` / `até 15:20`;
`16:00 - João Martins` com a segunda linha `até 16:50 · SMS pausado` em laranja.
- **6a dia vazio** — `Nenhum horário fixo em segunda-feira.`, corpo `O horário fixo é o que
  dispara o lembrete por SMS antes da sessão.`, botão preenchido `Adicionar horário`.

**7. Novo agendamento** (folha modal) — grupo com `Paciente` (linha de navegação, seletor com
busca), `Hora início`, `Hora fim`; grupo `DIA DA SEMANA` com segmented de 7 posições; grupo
`NOTAS` com campo multilinha.
- **7a erros** — `Salvar` desabilitado; rótulos em vermelho e rodapé com `Escolha o paciente` e
  `A hora fim precisa ser depois da hora início`.

**8. Detalhe do agendamento** (folha modal) — grupo em leitura com `Paciente`, `Dia`, `Horário`;
grupo `NOTAS` editável; linha `Excluir` em vermelho; rodapé `Para alterar o dia ou a hora,
exclua este horário e crie um novo.`
- **8a** — alerta `Excluir este horário?` / `O lembrete por SMS de segunda-feira, 14:30, deixa
  de ser enviado. Não dá para desfazer.` / `Cancelar` · `Excluir`.

### Aba 3 — Pacientes

**9. Pacientes** — Large title `Pacientes` com `+` azul na barra, campo de busca de 36pt.
Grupo `18 PACIENTES ATIVOS` com as células de paciente; grupo `INATIVOS` com `Inativo` em
cinza à direita.
- **9a carregando** — esqueleto de células.
- **9b vazio** — `Você ainda não tem pacientes cadastrados.`, corpo `Cadastre um paciente para
  começar a registrar sessões e pagamentos.`, botão `Cadastrar paciente`.
- **9d busca sem resultado** — barra de busca ativa com `Cancelar` ao lado;
  `Nenhum paciente encontrado para "ana".`, corpo `Tente outro nome ou cadastre um paciente
  novo.`, botão `Cadastrar paciente`.
- **9e deslize** — célula deslocada 88pt à esquerda revelando `Excluir` em vermelho.
- **9f alerta** — `Excluir Fernanda Souza?` / `Isso apaga também todas as sessões, pagamentos,
  preços e horários desse paciente. Não dá para desfazer. Se você só quer parar de atender,
  mude o status para Inativo.` / `Cancelar` · `Excluir`.

**10. Novo paciente** (folha) — grupo com `Nome`, `Telefone`, `E-mail`, `Preço`; rodapé
`Valor inteiro, sem centavos.` Grupo com a linha `Enviar SMS minutos antes da sessão` e um
toggle ligado. Grupo `OBSERVAÇÕES` multilinha.
- **10a erros** — rodapé com `O nome é obrigatório`, `O telefone é obrigatório`,
  `Informe um valor inteiro, sem centavos. Ex: 200`.

**11. Detalhe do paciente** — botão de voltar `Pacientes`, large title com o nome. Grupos:
1. duas linhas de ação: `Registrar sessão` e `Registrar pagamento`
2. `DADOS CADASTRAIS`: `Telefone`, `E-mail`, `Primeira consulta`, e a linha de navegação `Editar`
3. `ATENDIMENTO`: `Preço atual` R$ 200, `Total de sessões` 12, `Valor total pago` R$ 2.000,
   `Sessões não pagas` 2, e a linha `Atualizar o preço`
4. `HISTÓRICO`: `Sessões` 12 ›, `Pagamentos` 6 ›, `Preços` 3 ›
5. grupo destrutivo: `Excluir paciente` em vermelho

Paciente ativo não exibe status. Nenhum número acima de 17pt nesta tela.
- **11a sem histórico** — os grupos de histórico viram rodapé de grupo em footnote secundário:
  `Nenhuma sessão registrada ainda.` e `Nenhum pagamento registrado ainda.`

**12. Editar paciente** — os mesmos campos do cadastro, mais o grupo `STATUS` com segmented
`Ativo` / `Inativo`. Sem campo de preço.

**13. Atualizar preço** (folha) — linha em leitura `Preço atual` R$ 200; linha `Novo preço` com
placeholder `Ex: 500`; grupo `OBSERVAÇÕES`.

**14. Registrar sessão** (folha) — grupo com `Data` (padrão hoje), `Duração` (50 min) e a linha
`Sessão será cobrada` com toggle ligado; grupo `MODALIDADE` com segmented `Presencial` /
`Remota` (padrão Presencial); grupo `PAGAMENTO` com segmented `Pagou` / `Não pagou` / `Mensal`
(padrão Mensal); grupo `OBSERVAÇÕES`.

**15. Detalhe da sessão** (folha) — os mesmos campos com a data em leitura, linha `Excluir` em
vermelho e rodapé `Caso queira mudar a data, exclua a sessão e crie novamente com a data
correta.`

**16. Registrar pagamento** (folha) — grupo `TIPO` com segmented `Mensal` / `Por sessão`; grupo
com `Mês de competência` (padrão hoje) e `Valor` **já preenchido com o preço vigente do
paciente**, com o rodapé `Preço atual do paciente.`; grupo `OBSERVAÇÕES`.

**17. Detalhe do pagamento** (folha) — tipo, competência em leitura, valor, observações, linha
`Excluir`.

### Aba 4 — Despesas

**18. Despesas** — Large title `Despesas` com `+` azul na barra. Grupo com a linha de ação
`Registrar despesa`; grupo `ÚLTIMAS 30 DESPESAS` com células de duas linhas: descrição em 17pt,
`tipo · data` em footnote secundário, e o valor à direita em vermelho tabular.

O **estado vazio desta tela é o mais importante do app** — é a feature de menor adesão.
Símbolo de recibo 60pt em cinza, título em 22pt bold `Você acompanha quanto entra. E quanto
sai?`, corpo `Aluguel de sala, supervisão, transporte, material. Registrar as despesas é o que
mostra o seu lucro de verdade, não só o faturamento.` e botão preenchido no rodapé
`Registrar primeira despesa`.

**19. Registrar despesa** (folha) — grupo com `Data`, `Tipo` (linha de navegação, obrigatória),
`Descrição` (placeholder `Ex: Uber até o consultório`), `Valor`; grupo `OBSERVAÇÕES`.
`Salvar` fica desabilitado enquanto o tipo não é escolhido, com o rodapé
`O tipo é obrigatório para salvar.`
- **19a** — rótulo `Tipo` em vermelho e rodapé `Escolha o tipo da despesa`.

**20. Detalhe da despesa** — os mesmos campos, competência em leitura, linha `Excluir`.

### Aba 5 — Configurações

**21. Configurações** — Large title. Grupos, com ícone 21pt em cinza à esquerda de cada linha
navegável:
- `CONTA`: `Meu perfil`, `Trocar senha`
- `PLANO`: `Meu plano`, com o plano atual à direita (`Gratuito` ou `Pro`)
- `SOBRE`: `Dar feedback sobre o app`, `Política de privacidade`
- grupo destrutivo: `Sair` e `Apagar a minha conta`, ambos em vermelho
- rodapé: `Agenda Psi 1.0 · Dab Lab`

**21a** — alerta `Sair da sua conta?` / `Cancelar` · `Sair`.

**22. Meu perfil** (folha) — `Nome`, `Telefone`, `LinkedIn`, `Instagram`.

**23. Trocar senha** (folha) — rodapé de grupo `Um e-mail para trocar a senha será enviado para
o endereço abaixo`, linha `E-mail` em leitura, ações `Enviar` / `Cancelar` no cabeçalho da folha.

**24. Meu plano** — quatro versões:
- **gratuito com consumo**: cartão com `Plano gratuito — 10 lembretes por SMS por mês`, barra de
  progresso de 4pt em azul a 70% e `Você usou 7 de 10 lembretes por SMS neste mês.`; grupo
  `NO PLANO PRO` com três linhas de benefício; botão preenchido `Ver o plano Pro` no rodapé.
- **limite atingido**: a mesma tela com a barra cheia em vermelho e
  `Seus lembretes por SMS pausaram até 01/10/2026`.
- **Pro ativo**: grupo com `Plano` Agenda Psi Pro, `Lembretes` Ilimitados, `Próxima cobrança`
  01/04/2026; linha de ação `Gerenciar na App Store` com chevron; rodapé `A assinatura é
  cobrada e cancelada na sua conta da App Store.`
- **fundador**: grupo com `Plano` Fundador, `Lembretes` Ilimitados, `Mensalidade` R$ 0; rodapé
  `Você é um dos fundadores do Agenda Psi. Seus lembretes são ilimitados, sem mensalidade.`

**25. Paywall** (folha) — título `Agenda Psi Pro`, corpo `Lembretes por SMS sem limite, para
todos os seus pacientes, todo mês. Cancela quando quiser, direto na sua conta da App Store.`
Grupo `ESCOLHA O PLANO` com duas linhas de 56pt: `Mensal` com `[placeholder: preço mensal]` e
`Anual` com `[placeholder: preço anual]`; a selecionada leva um check azul de 20pt à direita.
Botão preenchido `Assinar o Pro`, link `Restaurar compras` centralizado, e o aviso em caption
secundário: `Assinando agora, os lembretes voltam a sair a partir do próximo horário agendado.
Os lembretes que não saíram neste mês não são reenviados.`
- **25a confirmando** — spinner e `Estamos confirmando sua assinatura. Isso leva alguns
  segundos.`
- **25b confirmado** — check verde 52pt e `Pronto. Seus lembretes estão liberados.`, botão
  `Continuar`.

**26. Feedback** (folha) — rodapé `Deixe sua mensagem abaixo com sugestões ou problemas que você
encontrou no app.`, campo multilinha de 160pt, `Enviar` desabilitado enquanto vazio.

**27. Apagar minha conta** (folha) — aviso em 17pt vermelho `Essa operação é irreversível. Para
confirmar, digite QUERO DELETAR no campo abaixo.`, campo de texto **editável**, linha `Deletar`
em vermelho semibold centralizada, desabilitada até o texto bater, e o rodapé `Pacientes,
sessões, pagamentos e despesas são apagados junto.`

**28. Política de privacidade** — tela de texto longo rolável, com botão de voltar
`Configurações`, título 28pt, data de atualização em footnote e seções em headline + body.

### Fora das abas

**29. Agente Psi** — chegada pelo ícone no cabeçalho da Home, com botão de voltar `Início`.
Large title `Agente Psi`, instrução em footnote `Escreva o que você quer registrar ou
perguntar, do seu jeito.`, e um grupo `EXEMPLOS` com quatro linhas tocáveis em azul:
- `Registre uma despesa de estacionamento de 30 reais hoje`
- `Registre a sessão da Fernanda hoje, remota, 50 minutos`
- `O João pagou 400 reais hoje no pix`
- `Quanto foi o último pagamento da Fernanda?`

Campo de entrada na base (36pt, raio 18) com o botão de enviar em azul, 44×44pt de área de
toque. Na conversa: bolha da usuária à direita em azul com texto branco, bolha do agente à
esquerda na cor de preenchimento, raio 18, Markdown renderizado. Estados: vazio (só os
exemplos), pensando (`Pensando...` com indicador de três pontos), erro
(`Não consegui responder agora. Tente de novo em alguns instantes.` em vermelho).

---

## Android

Mesma paleta, mesma hierarquia, mesmo espaçamento de 4pt. O que muda:

| Item | iOS | Android |
|---|---|---|
| Tipografia | SF Pro | Roboto |
| Ícones | SF Symbols | Material Symbols |
| Cabeçalho | Large title 34pt que colapsa | Top app bar de 64pt, título 22pt regular à esquerda |
| Lista | Inset grouped, container raio 10 com margem 16 | Largura total, sem container e sem raio; divisor de 1pt com inset 16 (56 quando há ícone) |
| Altura de linha | 44pt | 56pt (72pt na célula de paciente) |
| Título de grupo | Footnote maiúsculo secundário, fora do container | 14pt medium na cor de destaque, sem maiúsculas |
| Corpo de lista | 17pt | 16pt |
| Criar item | `+` na navigation bar | FAB de 56pt, raio 16, canto inferior direito |
| Navegação | Tab bar de 49pt, item ativo tintado | Navigation bar de 80pt, item ativo com indicador em pílula de 64×32pt |
| Voltar | Chevron + título da tela anterior | Seta de 24pt, sem rótulo |
| Modal | Sheet com detentes | Bottom sheet |

Um app que parece iOS puro rodando no Android é rejeitado pelos usuários.

---

## Interactions & Behavior

- **Navegação**: 5 abas na base (Início, Agenda, Pacientes, Despesas, Configurações). Sem menu
  lateral — é app de consumidor. Login, cadastro e Agente Psi ficam fora das abas.
- **Caminho crítico**: da lista de pacientes até o pagamento registrado em três toques. As
  linhas `Registrar sessão` e `Registrar pagamento` são as primeiras da tela de detalhe.
- **Registrar pagamento** já abre com o valor preenchido com o preço vigente do paciente.
- **Registrar sessão** já abre com a data de hoje, modalidade Presencial, pagamento Mensal e
  `Sessão será cobrada` marcado.
- **Exclusão de paciente** por deslize na célula, seguida de alerta de confirmação. Excluir
  paciente apaga em cascata sessões, pagamentos, preços e horários.
- **Sessão e pagamento não têm edição de data** — o rodapé da folha instrui a excluir e criar
  de novo. Vale o mesmo para dia e hora do horário fixo.
- **Horário fixo é o que liga o lembrete por SMS.** Criar horário agenda o lembrete; excluir
  cancela.
- **Limite de SMS**: plano gratuito tem 10 lembretes por mês. Ao chegar perto, a Home mostra a
  faixa laranja; ao estourar, a vermelha com a data de retomada, e os agendamentos passam a
  exibir `SMS pausado`. Assinar o Pro religa a partir do próximo horário agendado — lembretes
  que não saíram no mês não são reenviados.
- **Validação**: erro aparece como rodapé de grupo em vermelho e o rótulo do campo vira
  vermelho. A ação primária da folha fica desabilitada (cor terciária) enquanto inválida.
- **Carregamento**: esqueleto na forma do conteúdo, nunca zeros nem spinner de tela cheia.
- **Dynamic Type** ativo em todas as telas; as alturas de linha citadas são o mínimo.

## State Management

Por tela:
- **Auth**: `email`, `senha`, `confirmacao`, `carregando`, `erro`, `contaDesativada`.
- **Home**: `indicadores` (13 valores do mês e do mês anterior), `carregando`, `semPacientes`,
  `consumoSms { usados, limite, pausadoAte }`, `analiseIA { estado: idle|processando|erro|pronta,
  resumo, riscos, oportunidades, acoes }`.
- **Agenda**: `diaSelecionado` (0–6, inicia em hoje), `horarios[]`, folha aberta com
  `agendamentoEmEdicao`.
- **Pacientes**: `busca`, `pacientes[]` separados por status, `carregando`,
  `celulaDeslizada`, `alertaExclusao`.
- **Detalhe do paciente**: `paciente`, `precoAtual`, `totais { sessoes, pago, naoPagas }`,
  `historicos { sessoes[], pagamentos[], precos[] }`, e a folha ativa
  (sessão / pagamento / preço / edição).
- **Despesas**: `despesas[]` (últimas 30), `tipos[]`, folha com `despesaEmEdicao`.
- **Plano**: `plano: gratuito|pro|fundador`, `consumoSms`, `proximaCobranca`,
  `compra { estado: idle|confirmando|confirmada }`.
- **Agente Psi**: `mensagens[]`, `entrada`, `estado: vazio|pensando|erro`.

Dados: todos escopados ao usuário autenticado. Nenhuma consulta cruza contas.

## Assets

Nenhuma imagem. Os SVGs nos arquivos HTML são marcadores de posição — troque por SF Symbols no
iOS e Material Symbols no Android. Fontes: as do sistema, nada para empacotar.

## Files

Prancheta principal, que importa todas as seções:

- `Agenda Psi.dc.html` — capa, tabela de tokens e as 9 seções, cada uma em claro e escuro

Seções (cada arquivo contém as telas daquele bloco, lado a lado):

- `Auth.dc.html` — telas 1 a 4 e estados
- `Inicio.dc.html` — tela 5 e os 8 estados
- `Agenda.dc.html` — telas 6 a 8 e estados
- `Pacientes.dc.html` — telas 9, 10 e 12 e estados
- `PacienteDetalhe.dc.html` — telas 11, 14 e 16
- `Despesas.dc.html` — telas 18 a 20
- `Config.dc.html` — telas 21 a 28
- `Agente.dc.html` — tela 29 e estados
- `Android.dc.html` — telas 5, 9 e 11 em Android
- `TabBar.dc.html` — barra de abas compartilhada

Os tokens de cor e a família tipográfica ficam nas classes `.t-light` e `.t-dark` no início de
`Agenda Psi.dc.html`; as demais telas apenas consomem `var(--token)`. Abrir um arquivo de seção
isoladamente mostra a versão clara, pelos valores de fallback.
