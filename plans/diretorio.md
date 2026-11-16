# Agenda Psi no Connectors Directory do Claude

Preparado em 16/11/2026, enquanto o Alexandre estava fora ("faça o máximo que puder"). Depois, com o "pode seguir e fazer tudo" do Alexandre, o código ficou pronto, mas o commit e o push para a `main` foram barrados pela proteção automática do Claude Code: ficam com o Alexandre. As anotações mudam as permissões no Claude, então ainda falta testar se aparece confirmação extra no Salvar.

Fontes:
- [Submit a connector](https://claude.com/docs/connectors/building/submission)
- [Pre-submission checklist](https://claude.com/docs/connectors/building/review-criteria.md)
- [Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)

## 0. Atualização de 16/11/2026: Alexandre: "pode seguir e fazer tudo; depois melhoramos os textos"
- **2.1 Títulos:** em uso como estão. A melhorar depois.
- **2.2 Texto de abertura:** trocado pela proposta, que só descreve o estado. Há teste contra "Responda"/"nada mais".
- **2.3 Política:** seção "Agenda Psi" acrescentada ao fim da política padrão da Dab Lab no Notion, em 5 itens, cobrindo o app, o assistente interno, o SMS, a assinatura e o conector. Revisar o trecho "Apagar minha conta" (hoje desativa; a exclusão definitiva é por e-mail).
- **Documentação pública:** `mcp-server/CONECTOR.md` (inglês e português), que serve de URL de documentação no portal: https://github.com/asiqueira1973/agenda-psi/blob/main/mcp-server/CONECTOR.md
- **Falta o commit e o push** (com o Alexandre), para a produção e o diretório verem as ferramentas já anotadas. Testar no Claude se aparece confirmação extra no Salvar.
- **Falta (só você):** prints do carrossel, ícone, a pergunta de dados de saúde (2.4) e o envio em claude.ai/directory/manage.

## 1. O que já foi feito no código
- **Toda ferramenta (58) tem `title` e a dica certa.** Leitura: as 9 consultas, as listas de opções e os `abrir_formulario_*`, que não gravam. Escrita (`destructiveHint: true`): todo `salvar_*` e `registrar_*`, porque o diretório pede a dica para tudo que "modify or delete data".
- Tudo isso fica num lugar só (`src/tools/anotacoes.ts`). Uma ferramenta nova sem título quebra o registro, e o teste do `tools/list` confere as 58.

**Precisa de teste no Claude:** com `destructiveHint`, o Claude pode pedir uma confirmação a mais quando o formulário chama o `salvar_*`. Se isso acontecer e ficar ruim, as opções são:
- (a) manter assim (duas confirmações);
- (b) perguntar à Anthropic (`mcp-review@anthropic.com`) como tratar ferramentas só do app, que o modelo não vê.

## 2. Decisões que são suas

### 2.1 Títulos novos (aparecem na interface do Claude)
As consultas e listas:
- "Buscar paciente", "Histórico do paciente", "Listar pacientes";
- "Consultar período", "Consultar mês";
- "Agenda do dia", "Agenda da semana";
- "Listar pendências", "Consultar despesas";
- "Tipos de despesa", "Pacientes para o formulário", "Agenda para o formulário", "Registros para o formulário".

Os de escrita seguem um padrão: "Salvar <ação>" e "Registrar <ação> sem formulário", por exemplo "Salvar exclusão de sessão".

Os títulos dos `abrir_formulario_*` são os do app e do cartão do agente.

### 2.2 Texto de abertura do formulário (risco na revisão)
Hoje o resultado de `abrir_formulario_*` diz ao modelo: *Responda exatamente "Abri o formulário de X." e nada mais…*. A revisão rejeita ferramentas que "tell Claude how to behave". A regra fala da *descrição* da ferramenta, mas um revisor pode aplicá-la ao resultado.
- Proposta: "Formulário de X aberto para a pessoa conferir. Nada foi gravado: só grava quando ela clicar em Salvar, e o formulário avisa quando isso acontecer."
- Risco da troca: voltar o problema do épico 3, o Claude descrevendo o formulário embaixo do "Despesa registrada.".
- **Trocado em 16/11/2026** (seção 0). Também saíram da descrição das ferramentas outras três ordens ao modelo, apontadas pelo verifier: "você não deve dizer que registrou" (despesa), "não chame de novo" (paciente) e "Não prometa prazo nem correção" (feedback).

As descrições dos `registrar_*` dizem "Nunca envie confirmar=true sem mostrar a prévia à pessoa…". Isso descreve o uso correto da própria ferramenta, e acho que passa. Se o revisor reclamar, a frase pode virar "Grava só com o token_previa da primeira chamada, depois de a pessoa concordar com a prévia.".

### 2.3 Política de privacidade (a 25.3 vira obrigatória)
O diretório exige a URL de uma política que cubra coleta, uso, armazenamento, compartilhamento com terceiros, retenção e contato. "Missing or incomplete privacy policies result in immediate rejection."

Rascunho de seção para acrescentar à política do Agenda Psi (Notion):

> **Conector para assistentes de IA (Claude e ChatGPT).** Se você conectar o Agenda Psi a um assistente de IA, o assistente passa a consultar e registrar, a seu pedido, dados da sua agenda e do seu financeiro: nomes de pacientes, telefone e e-mail, horários, sessões realizadas, pagamentos, preços e despesas. Esses dados trafegam pelo provedor do assistente escolhido (Anthropic ou OpenAI) e ficam sujeitos também à política dele. As anotações clínicas (observações) nunca são lidas nem enviadas pelo conector. Nenhuma gravação acontece sem a sua confirmação no formulário. O conector não guarda cópia dos dados nem do conteúdo das conversas: ele lê e grava direto no seu Agenda Psi, com o seu login, e registra só a contagem de uso, sem nome nem valor. Você desconecta quando quiser, nas configurações do assistente. Dúvidas: <contato>.

### 2.4 Pergunta de dados de saúde (passo 7 do portal)
O portal pergunta se o conector "handles personal health data".
- O Agenda Psi é gestão de **agenda e custos**: não guarda nem expõe prontuário, e o conector nunca lê observações.
- Mas o nome de uma pessoa ligado a atendimento psicológico pode ser lido como dado de saúde, e pela LGPD conta como dado sensível.
- A resposta é sua. Recomendo responder "sim", com a explicação acima na descrição: se o revisor entender o contrário depois, o risco é a retirada da ficha.
- A política do diretório pede "human-in-the-loop" e aviso ao usuário em casos sensíveis. O formulário com confirmação cumpre o primeiro; a seção de privacidade acima, o segundo.

## 3. Rascunho da ficha (passo 3 do portal)
- **Nome:** Agenda Psi
- **Uma linha (≤200):** Consulte e organize a agenda e o financeiro do seu consultório de psicologia: horários, sessões, pagamentos, pendências e despesas, com formulário de confirmação.
- **Descrição (≤2000):**

  > O Agenda Psi é o app de gestão de consultório para psicólogos autônomos: agenda semanal, sessões, pagamentos, preços por paciente e despesas. Com o conector, você pergunta e registra pela conversa.
  >
  > Consultas: a agenda do dia ou da semana, quem está com pagamento pendente, quanto recebeu no mês ou num período, o histórico financeiro de um paciente, as despesas por tipo.
  >
  > Registros: sessões, pagamentos, despesas, pacientes novos com preço e horários fixos, troca e remoção de horário, correção e exclusão de lançamentos. Toda gravação abre um formulário já preenchido com o que você disse; nada é gravado sem você conferir e clicar em Salvar. Exclusões pedem uma segunda confirmação.
  >
  > Privacidade: o Agenda Psi não é prontuário. O conector nunca lê nem envia anotações clínicas. Ele entra com o seu login do app, e cada pessoa só vê os próprios dados.
  >
  > É preciso ter conta no Agenda Psi (iOS e Android).

- **Categorias (1–5):** Productivity, Finance, Health (escolha no portal entre as disponíveis)
- **Documentação:** https://github.com/asiqueira1973/agenda-psi/blob/main/mcp-server/CONECTOR.md
- **Suporte:** o contato da Dab Lab.
- **Ícone:** o do app.

## 4. Casos de uso (passo 4)
- **Uso principal:** consultar a agenda e o financeiro; registrar sessões, pagamentos e despesas; ajustar horários e cadastros.
- **Pré-requisito:** conta no Agenda Psi.
- **Lê e grava:** os dois.

## 5. Autenticação (passo 6)
- Login obrigatório, por OAuth 2.0 (o OAuth Server do Supabase, com registro dinâmico de cliente).
- Não é preciso cadastrar client ID nem secret no portal: o Claude se registra sozinho.
- Callback do Claude: `https://claude.ai/api/mcp/auth_callback`. Com o registro dinâmico, o cliente cadastra o dele.

## 6. Dados (passo 7)
- **API:** própria (Supabase do Agenda Psi).
- **Saúde:** ver 2.4.
- **Conteúdo patrocinado:** não.

## 7. Compliance (passo 9), conferido contra o código
- Não transfere dinheiro: "pagamento" só registra um valor recebido.
- Não gera imagem, áudio nem vídeo.
- Não coleta dados da conversa além dos argumentos de cada ferramenta.
- Não lê memória, histórico nem arquivos do Claude.
- Os logs guardam só nome da ferramenta, tempo e hash do usuário.
- As descrições das ferramentas não mandam o Claude chamar outras ferramentas nem buscar instruções fora. Ver 2.2.

## 8. Prints para o carrossel (MCP App: 3 a 5 PNG, ≥1000 px de largura, só a resposta, sem a pergunta)
1. "Atendi a Beatriz e o Caio hoje; a Beatriz pagou": formulário de sessões com duas linhas.
2. "Paguei 1450 de aluguel hoje": formulário de despesa preenchido.
3. "Cadastra a Laura Mendes, 11 91234-5678, 200 por sessão, quartas às 10h": formulário de paciente com horário.
4. "O Caio passou de quinta 9h para sexta 10h": troca de horário com "Antes".
5. "Apaga o pagamento duplicado da Beatriz": exclusão na tela de "Excluir definitivamente".

Use a **conta de teste**, com nomes fictícios. Template no Figma: "MCP Apps for Claude" (link na página de submissão).

## 9. Ordem sugerida
1. Testar no Claude, numa conversa nova e com o conector reconectado.
2. Decidir 2.1, 2.2 e 2.4.
3. Publicar a seção de privacidade e a página de documentação.
4. Tirar os prints.
5. Enviar em claude.ai/directory/manage (plano pago).
6. Se vier a revisão "Verified", passar a conta de teste por e-mail ao revisor. Nunca ponha credencial no portal.
