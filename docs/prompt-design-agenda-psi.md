# Prompt de design — Agenda Psi (React Native / Expo)

Cole o bloco abaixo no Claude Design. Ele cobre as 29 telas do inventário (seção 10 do `spec.md`, versão 1.1), os estados de cada uma (seção 8), a copy final (seção 15) e a direção visual (seção 16).

*(O módulo de Locais de atendimento saiu do MVP — as 4 telas dele e a aba correspondente foram removidas deste prompt. Elas voltam com a seção 28.8 do spec.)*

---

```
Desenhe as telas de um app mobile nativo chamado **Agenda Psi**, um app de gestão
de consultório para psicólogos autônomos brasileiros. iOS e Android, React Native
com Expo. Todo o texto em português do Brasil.

## Quem usa

Uma psicóloga autônoma, 30–50 anos, não técnica, que atende entre 8 e 30 pacientes
por semana. Dois momentos definem o desenho:

1. **Entre sessões** — cinco minutos, de pé, celular numa mão. É quando ela registra
   que a sessão aconteceu e que o paciente pagou. Se custar mais que três toques,
   ela não faz. Esse caminho (Pacientes → busca → Detalhe → Registrar sessão →
   Registrar pagamento) precisa ser o mais curto do app.
2. **Fim do mês** — sentada, com tempo, querendo saber quanto entrou, quanto saiu e
   quanto sobrou. É quando ela olha o dashboard.

## DIREÇÃO VISUAL

Referência: **Human Interface Guidelines da Apple**, com os apps nativos do iOS como
modelo — Ajustes, Saúde, Lembretes. Legibilidade acima de personalidade, tipografia
fazendo o trabalho da hierarquia, cor só onde significa alguma coisa. Sem sombra:
separação por cor de superfície e hairline de 0,5pt.

Navegação por **abas na base** (5 abas: Início, Agenda, Pacientes, Despesas, Configurações). NÃO use menu lateral — é app de consumidor.

### Cor — paleta do sistema iOS, nada inventado

NÃO existe cor de marca neste app. A cor de destaque é o **azul do sistema**,
como em Ajustes, Lembretes, Telefone e Mail. Paleta autoral dessaturada é o que
faz um app parecer template — as cores da Apple são vivas e específicas.

| Papel | Token | Claro | Escuro |
|---|---|---|---|
| Destaque / ação | systemBlue | #007AFF | #0A84FF |
| Texto primário | label | #000000 | #FFFFFF |
| Texto secundário | secondaryLabel | #3C3C43 a 60% | #EBEBF5 a 60% |
| Texto terciário | tertiaryLabel | #3C3C43 a 30% | #EBEBF5 a 30% |
| Fundo da tela | systemGroupedBackground | #F2F2F7 | #000000 |
| Superfície de lista | secondarySystemGroupedBackground | #FFFFFF | #1C1C1E |
| Separador | opaqueSeparator | #C6C6C8 | #38383A |
| Cinza de controle | systemGray | #8E8E93 | #8E8E93 |
| Positivo | systemGreen | #34C759 | #30D158 |
| Atenção | systemOrange | #FF9500 | #FF9F0A |
| Destrutivo / negativo | systemRed | #FF3B30 | #FF453A |

Onde cada uma aparece, e SÓ aí:
- **Azul**: texto de linha de ação, ícone dessa linha, botão de voltar, controle
  selecionado. Nunca como fundo de bloco grande.
- **Verde**: valor monetário positivo no dashboard. Nada mais. Não é status de
  paciente, não é "Pagou".
- **Laranja**: só o aviso de limite de SMS.
- **Vermelho**: ação destrutiva, despesa, lucro negativo, erro de campo.
- **Cinza**: todo o resto — status, metadados, rótulos, valores neutros.

Conte as cores de cada tela fora de preto, branco e cinza. Se passar de duas,
está errada. A maioria deve ter UMA: o azul.

Status NÃO é pílula colorida preenchida. Paciente ativo não recebe marcação
nenhuma; inativo recebe a palavra `Inativo` em cinza à direita da linha.
`Pagou` / `Não pagou` é texto secundário cinza, não semáforo.

### Tipografia

Fonte do sistema (SF Pro no iOS, Roboto no Android), com Dynamic Type ativo.
Large title 34/bold (título de aba, colapsa ao rolar) · Title 2 22/bold (número
principal de cartão) · Headline 17/semibold (nome do paciente) · Body 17/regular ·
Subheadline 15/regular · Footnote 13/regular (rótulo de cartão) · Caption 12/regular.

**Número financeiro em variante tabular** — sem isso a coluna de valores dança.

### Espaçamento e forma

Grade de 4pt: 4, 8, 12, 16, 20, 24, 32. Margem lateral 16. Raio: 10 em cartão,
12 em folha modal, 8 em botão. Área mínima de toque 44×44pt.

### Modo escuro

Obrigatório, nas duas versões de cada tela.

### Multiplataforma

Mostre as telas principais nas duas plataformas: mesmo espaçamento, mesma hierarquia,
mesma estrutura — mudando tipografia, ícones (SF Symbols vs Material Symbols),
cabeçalho (large title vs top app bar) e modal (sheet com detentes vs bottom sheet).
Um app que parece iOS puro rodando no Android é rejeitado pelos usuários.

## FORMATAÇÃO (use nos mockups, não invente)

Dinheiro: `R$ 1.234` — sem centavos, com separador de milhar. Nulo vira `R$ 0`.
Percentual: `42,5%`. Data: `05/03/2026` com zero à esquerda. Hora: `14:30`.
Telefone: `+55 21 99999-9999`.

## COMPONENTES — a linguagem é LISTA, não cartão

Antes de desenhar qualquer tela: ela caberia dentro do app Ajustes, do Saúde ou
do Lembretes? Se não, está errada.

ERRADO: vários cartões brancos independentes empilhados sobre cinza, cada um com
título em negrito preto dentro e padding grande.
CERTO: **inset grouped list** — UM container arredondado por grupo, linhas de
44pt dentro, separadas por hairline de 0,5pt que começa no inset do texto (não
sangra até a borda). Título do grupo FORA do container, acima, 13pt cinza,
sentença normal, alinhado à margem de 16pt.

**Linha de lista** — o átomo do app. Rótulo à esquerda em texto primário, valor à
direita em cinza secundário, chevron só quando navega. Altura 44pt, inset 16pt.
Todo par rótulo/valor é uma linha, nunca um bloco.

**Linha de ação** — SF Symbol azul à esquerda, texto azul, sem chevron. É assim
que "Registrar sessão" e "Registrar pagamento" aparecem no detalhe do paciente:
duas linhas no primeiro grupo, como "Adicionar conta" no Ajustes. NÃO dois botões
preenchidos lado a lado no topo.

**Botão** — no máximo UM preenchido por tela, largura total, no rodapé, e só onde
há ação de conclusão (Entrar, Criar conta, Salvar em modal, Assinar). Fora isso,
ação é linha de lista ou item da navigation bar.

**Cartão de indicador (Home)** — é a ÚNICA tela onde número grande é permitido.
Rótulo em footnote, valor em title 2, SF Symbol discreto. Sem borda, sem sombra.
Em tela de detalhe, número grande não existe: `Preço atual` … `R$ 200` é linha.

**Lista de pacientes** — nome em headline, metadados em subheadline cinza, linha
inteira tocável com chevron. Excluir por DESLIZE, nunca botão sobre o item.

**Folha modal** — título centralizado, `Cancelar` à esquerda, ação primária à
direita em azul. Conteúdo rolável, teclado empurrando a folha.

**Estado vazio** — SF Symbol grande em cinza claro, título em headline, uma frase
em body secundário, uma ação em azul. Nunca área em branco.

**Grade da agenda** — coluna de horas à esquerda em footnote tabular cinza,
blocos à direita. Hora vazia com altura reduzida e hairline. Seletor de dia como
segmented control de 7 posições.

## NÃO FAÇA, em hipótese alguma

gradiente · sombra · borda em cartão · dois botões preenchidos na mesma tela ·
pílula colorida preenchida como status · número acima de 28pt fora da Home ·
cartão dentro de cartão · título de seção em negrito preto dentro do container ·
ícone dentro de círculo colorido · emoji · qualquer cor fora da tabela acima

## PERMISSÕES

Há um único perfil de usuário: o psicólogo autenticado. Ele vê e edita **apenas os
próprios dados**. Não existe tela de administração e não há conteúdo de outros
usuários em lugar nenhum do app. Assinatura: ele só gerencia a própria; não há como
conceder plano a ninguém.

## FLUXO PRINCIPAL (respeite a sequência, não desenhe telas soltas)

Login → Home (vazia, se não tem paciente) → Cadastrar paciente → Lista → Detalhe do
paciente → Registrar sessão → Registrar pagamento → Home com números → Agenda →
Criar horário fixo (é o que liga o lembrete por SMS).

E o fluxo do paywall: Home com aviso de limite → Meu plano → Paywall → compra →
confirmação.

---

## AS TELAS

### Autenticação (sem abas, tela cheia)

1. **Login** — e-mail, senha com olho de visibilidade, botão `Entrar`,
   link `Esqueci minha senha`, link `Não tem uma conta? Crie uma conta aqui`,
   link para a política de privacidade, assinatura da Dab Lab no rodapé.
   Título `Seja bem-vindo(a)`, subtítulo `Vamos começar preenchendo as informações abaixo`.
   Estados: carregando (botão com spinner, desabilitado), erro
   `E-mail ou senha incorretos.`, conta desativada (alerta bloqueante).

2. **Nova conta** — nome, e-mail, senha, confirmação. Botão `Criar conta`,
   link `Já tem uma conta? Entre aqui`. Erro de senha: `As senhas não são iguais.`

3. **Confirme seu e-mail** — símbolo de envelope, título, corpo
   `Enviamos um link de confirmação para {email}. Abra o e-mail e toque no link
   para ativar sua conta.`, botão secundário de reenviar.

4. **Nova senha** (abre por link do e-mail) — senha, confirmação, botão salvar.

### Aba 1 — Início

5. **Início (dashboard)** — large title `Agenda Psi`, ícone de atalho para o Agente Psi
   no cabeçalho. Um cartão de largura total (`Pacientes Ativos`, número grande) e
   12 cartões em pares: `Sessões no mês`, `Sessões mês −1`, `Pagamentos no mês`,
   `Pagamentos mês −1`, `Despesas no mês`, `Despesas mês −1`, `Lucro no mês`,
   `Lucro mês −1`, `Custo médio/paciente`, `Receita média/paciente`, `Margem do mês`,
   `Break-even (sessões)`. Abaixo, botão `Análise com IA` e um cartão de resultado
   com quatro seções: Resumo, Riscos, Oportunidades, Ações prioritárias.

   Desenhe **quatro versões**:
   - **carregando** — esqueleto nos cartões, não zeros;
   - **vazia (sem pacientes)** — em vez dos 13 cartões:
     `Comece cadastrando seu primeiro paciente.` + botão `Cadastrar paciente`;
   - **normal** com números reais;
   - **com aviso de limite de SMS** — faixa em cor de atenção acima dos cartões:
     `Faltam 2 lembretes no seu plano gratuito deste mês.` com o caminho para o plano.
     E a variante em cor negativa: `Seus lembretes por SMS pausaram até 01/10/2026`.

   Análise com IA: desenhe o estado processando (botão desabilitado + progresso) e o
   estado de erro `Não foi possível carregar. Toque para tentar de novo.`

### Aba 2 — Agenda

6. **Agenda semanal** — segmented control de 7 dias (abre no dia de hoje), grade de
   08:00 a 21:00. Hora ocupada mostra `14:30 - Fernanda Souza` com chevron.
   Botão `+` para novo agendamento. Estado vazio do dia:
   `Nenhum horário fixo em segunda-feira.` + `Adicionar horário`.
   Mostre também um agendamento marcado como "SMS pausado" quando o limite estourou.

7. **Novo agendamento** (folha modal) — paciente (seletor com busca), dia da semana,
   hora início, hora fim, notas. Botões `Cancelar` / `Salvar`. Mostre o estado de erro
   de validação em campo (`Escolha o paciente`, hora fim antes da hora início).

8. **Detalhe do agendamento** (folha modal) — nome do paciente, dia e horas em leitura,
   notas editáveis. Botões `Salvar`, `Excluir` (vermelho), `Cancelar`. Rodapé com dica:
   `Para alterar o dia ou a hora, exclua este horário e crie um novo.`
   Mostre o alerta de confirmação da exclusão.

### Aba 3 — Pacientes

9. **Pacientes** — large title, campo de busca, cartões. Cada cartão: nome em headline,
   badge de status (`Ativo` em verde / `Inativo` em cinza), telefone, e-mail,
   `12 sessões realizadas`, `Valor atual: R$ 200`, `Última sessão: 05/03/2026`,
   `Sessões não pagas: 2`. Botão `+` no cabeçalho.
   Estados: carregando (esqueleto de cartões), vazio
   (`Você ainda não tem pacientes cadastrados.` + botão), busca sem resultado
   (`Nenhum paciente encontrado para "ana".`), e o gesto de deslizar revelando `Excluir`.

10. **Novo paciente** — nome, telefone, e-mail, observações (multilinha),
    preço da consulta, checkbox `Enviar SMS minutos antes da sessão`.
    Erros: `O nome é obrigatório`, `O telefone é obrigatório`,
    `Informe um valor inteiro, sem centavos. Ex: 200`.

11. **Detalhe do paciente** — no topo, dois botões grandes lado a lado:
    `Registrar sessão` e `Registrar pagamento`. Abaixo, cartão de dados cadastrais
    (nome, badge de status, telefone, e-mail, primeira consulta, botão `Editar`);
    cartão `Preço atual` com o valor em destaque, `Total de sessões` e
    `Valor total pago`, e botão `Atualizar o preço`; e três cartões de histórico:
    `Histórico de sessões`, `Histórico de pagamentos`, `Histórico de preços`.
    Estados vazios de cada histórico: `Nenhuma sessão registrada ainda.`,
    `Nenhum pagamento registrado ainda.`

12. **Editar paciente** — os mesmos campos do cadastro mais o seletor de status
    (Ativo / Inativo). Sem campo de preço.

13. **Atualizar preço** (folha modal) — `Preço atual: R$ 200` em leitura,
    campo `Novo preço` (`Ex: 500`), observações.

14. **Registrar sessão** (folha modal) — data (padrão hoje), modalidade
    (Presencial / Remota, padrão Presencial), pagamento (Pagou / Não pagou /
    Pagamento mensal, padrão Pagamento mensal), checkbox `Sessão será cobrada`
    (marcado), duração em minutos, observações.

15. **Detalhe da sessão** (folha modal) — os mesmos campos, data em leitura.
    Botões `Salvar`, `Excluir`, `Cancelar`. Rodapé:
    `Caso queira mudar a data, exclua a sessão e crie novamente com a data correta.`

16. **Registrar pagamento** (folha modal) — tipo (Mensal / Por sessão),
    `Mês de competência` (padrão hoje), valor **já preenchido com o preço vigente do
    paciente** (mostre isso no mockup: campo com `200` e uma dica discreta
    `preço atual do paciente`), observações.

17. **Detalhe do pagamento** (folha modal) — tipo, competência em leitura, valor,
    observações. `Salvar`, `Excluir`, `Cancelar`.

### Aba 4 — Despesas

18. **Despesas** — large title, botão `Registrar despesa`, cabeçalho
    `Últimas 30 despesas`, itens com descrição, nome do tipo e valor em cor negativa.

    **O estado vazio desta tela é o mais importante do app** — é a feature de menor
    adesão. Desenhe com cuidado: símbolo grande, título
    `Você acompanha quanto entra. E quanto sai?`, corpo
    `Aluguel de sala, supervisão, transporte, material. Registrar as despesas é o
    que mostra o seu lucro de verdade, não só o faturamento.` e botão primário
    `Registrar primeira despesa`.

19. **Registrar despesa** (folha modal) — data, tipo (seletor obrigatório),
    descrição (`Ex: Uber até o consultório`), valor, observações.
    Mostre o botão `Salvar` desabilitado enquanto o tipo não é escolhido, e o erro
    `Escolha o tipo da despesa`.

20. **Detalhe da despesa** (folha modal) — os mesmos campos, competência em leitura.

### Aba 5 — Configurações

21. **Configurações** — lista agrupada estilo Ajustes do iOS:
    - Grupo CONTA: `Meu perfil`, `Trocar senha`
    - Grupo PLANO: `Meu plano` (com o plano atual à direita: `Gratuito` ou `Pro`)
    - Grupo SOBRE: `Dar feedback sobre o app`, `Política de privacidade`
    - Grupo (destrutivo): `Sair` e `Apagar a minha conta` em vermelho

22. **Meu perfil** (folha modal) — nome, telefone, LinkedIn, Instagram.

23. **Trocar senha** (folha modal) — e-mail em leitura, texto
    `Um e-mail para trocar a senha será enviado para o endereço abaixo`,
    botões `Enviar` / `Cancelar`.

24. **Meu plano** — desenhe **três versões**:
    - **Plano gratuito com consumo**: `Plano gratuito — 10 lembretes por SMS por mês`,
      uma barra de progresso com `Você usou 7 de 10 lembretes por SMS neste mês.`,
      lista de benefícios do Pro e botão `Ver o plano Pro`.
    - **Limite atingido**: a mesma tela com a barra cheia em cor negativa e o aviso
      `Seus lembretes por SMS pausaram até 01/10/2026`.
    - **Plano Pro ativo**: selo, `Lembretes ilimitados`, data da próxima cobrança,
      link discreto para gerenciar na loja.
    - E uma quarta, curta: **fundador** —
      `Você é um dos fundadores do Agenda Psi. Seus lembretes são ilimitados,
      sem mensalidade.`

25. **Paywall** (folha modal) — título `Agenda Psi Pro`, corpo
    `Lembretes por SMS sem limite, para todos os seus pacientes, todo mês.
    Cancela quando quiser, direto na sua conta da App Store.`,
    opções de plano (mensal e anual como cartões selecionáveis — use
    `[placeholder: preço mensal]` e `[placeholder: preço anual]`, o preço ainda não
    está definido), botão primário de assinar, link `Restaurar compras`, e o aviso
    em caption: `Assinando agora, os lembretes voltam a sair a partir do próximo
    horário agendado. Os lembretes que não saíram neste mês não são reenviados.`
    Desenhe também o estado `Estamos confirmando sua assinatura. Isso leva alguns
    segundos.` e a confirmação `Pronto. Seus lembretes estão liberados.`

26. **Feedback** (folha modal) — `Deixe sua mensagem abaixo com sugestões ou problemas
    que você encontrou no app.`, campo multilinha, botão `Enviar` desabilitado
    enquanto vazio.

27. **Apagar minha conta** (folha modal) — aviso em cor negativa,
    `Essa operação é irreversível. Para confirmar, digite QUERO DELETAR no campo
    abaixo.`, campo de texto **editável**, botão `Deletar` em vermelho, desabilitado
    até o texto bater.

28. **Política de privacidade** — tela de texto longo rolável, cabeçalho com voltar.

### Fora das abas

29. **Agente Psi** — chegada pelo ícone no cabeçalho da Home, com botão de voltar.
    Título `Agente Psi`, instrução `Escreva o que você quer registrar ou perguntar,
    do seu jeito.`, quatro chips de exemplo tocáveis:
    `Registre uma despesa de estacionamento de 30 reais hoje`,
    `Registre a sessão da Fernanda hoje, remota, 50 minutos`,
    `O João pagou 400 reais hoje no pix`,
    `Quanto foi o último pagamento da Fernanda?`.
    Conversa em bolhas (usuário à direita, agente à esquerda, resposta em Markdown
    renderizado), campo de entrada na base com botão de enviar.
    Estados: vazio (só os exemplos), pensando (`Pensando...` com indicador),
    erro (`Não consegui responder agora. Tente de novo em alguns instantes.`).

## ALERTAS DE CONFIRMAÇÃO (desenhe pelo menos estes dois)

- **Excluir paciente** — título `Excluir Fernanda Souza?`, corpo
  `Isso apaga também todas as sessões, pagamentos, preços e horários desse paciente.
  Não dá para desfazer. Se você só quer parar de atender, mude o status para Inativo.`,
  botões `Cancelar` / `Excluir` (destrutivo).
- **Sair** — `Sair da sua conta?` com `Cancelar` / `Sair`.

## ENTREGA

Para cada tela, entregue modo claro e modo escuro. Para as telas 5, 9, 11, 18 e 24,
entregue também as variantes de estado descritas acima. Para as telas 5, 9 e 11,
mostre a versão iOS e a versão Android lado a lado.

Toda a copy acima é **final**, não placeholder — use literalmente. As únicas exceções
marcadas como placeholder são os preços do plano na tela 25.
```
