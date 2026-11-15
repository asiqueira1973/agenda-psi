# Épico 6 — Agenda, edições e exclusões

Seção 8.6 e tabela 13.3. Nove ações: `troca_horario`, `remocao_horario`, `edicao_paciente`, `edicao_sessao`, `exclusao_sessao`, `edicao_pagamento`, `exclusao_pagamento`, `edicao_despesa` e `exclusao_despesa`.

**Modo de trabalho:** em 15/11/2026, o Alexandre autorizou fazer os épicos 6 e 7 direto, sem parar para aprovar o plano. Os textos novos ficam listados no fim, para a aprovação dele no fechamento.

## Desenho
**Um motor genérico** (`src/tools/records/`). Cada ação declara:
- como ler os registros candidatos (até 40, os mais recentes primeiro);
- como filtrar pelo que a frase disse;
- os campos do formulário (valor atual + valor pedido);
- a validação e a gravação.

O motor registra, para cada ação:
- `abrir_formulario_<acao>` (modelo);
- `salvar_<acao>` (app);
- `registrar_<acao>` (fallback com prévia, 13.4).

E uma vez só:
- `listar_registros` (app): recarrega os candidatos quando a pessoa escolhe o paciente no formulário.

**Um formulário genérico** (`ui/record/`), compartilhado pelas nove ações. Ele desenha os campos a partir da descrição que o servidor manda. Isso troca as cinco ferramentas de opções da tabela 13.3 (`listar_sessoes_do_paciente` etc.) por uma (`listar_registros`); a divergência fica registrada em `DOCUMENTACAO-TECNICA.md`.

## Regras (como o agente e os hooks do app)
- **Candidatos:** como `escolherAlvo` do agente.
  - Um registro casa com a frase: vem escolhido.
  - Vários casam: até 6 para escolher.
  - Nenhum casa: os 6 mais recentes.
  - Nunca escolhe sozinho entre dois.
- **Antes e depois:** cada campo pedido mostra "Antes: <valor atual>" (texto do cartão do agente).
- **Somente leitura:** a data da sessão e a competência de pagamento e despesa. O aviso é o do agente: "A data não se altera. Para mudar, apague e registre de novo."
- **Observações (P5):** nunca são lidas nem mostradas, em nenhuma das ações, inclusive na despesa. Isso é mais estrito que a 13.3 e segue o DoD ("nenhuma resposta com `observacoes`"). Os `update` não incluem a coluna, então o valor atual fica como está sem passar pelo servidor (8.6).
- **Edição de paciente:**
  - `update` com nome, telefone, e-mail, status e SMS, como `useEditarPaciente`. Evento `agenda_psi_paciente_editado`.
  - Preço diferente: linha nova em `precos_paciente`, como `useAtualizarPreco`. Evento `agenda_psi_atualizacao_preco`.
- **Sessão:** `update` de pagamento, modalidade, duração e cobrada (`useEditarSessao`).
- **Pagamento:** `update` de valor e tipo.
- **Despesa:** `update` de tipo, valor e descrição (`useEditarDespesa`).
- **Exclusões:** `delete` por id. Sem evento, como o app.
  - Segundo clique "Excluir definitivamente" no formulário; o fallback exige `token_previa`.
  - Zero linhas apagadas e `demo_uid() = sub`: "Esta conta de demonstração não permite excluir registros.".
  - Zero linhas apagadas sem ser a conta demo: "Registro não encontrado ou sem permissão.".
- **Troca de horário:** grava o novo (`inserirHorario`), depois apaga o antigo, como o cartão do agente. Se só a saída falhar, a tela mostra `trocaParcial` do agente, e o próximo Salvar só tenta tirar o antigo.
- **Remoção de horário:** `delete` em `agenda_semana_padrao`.

## Textos
Do app, byte a byte, com teste: "Sessão atualizada.", "Sessão excluída.", "Pagamento atualizado.", "Pagamento excluído.", "Despesa atualizada.", "Despesa excluída.", "Horário excluído.", "`<nome>` atualizado.", "Novo preço de `<valor>` vigente a partir de hoje.", as perguntas de confirmação ("Excluir esta sessão? Não dá para desfazer." etc.), os botões "Excluir sessão" etc., "Nenhuma sessão registrada ainda.", "Nenhum pagamento registrado ainda." e os rótulos de cada tela.

Do cartão do agente: "Antes: …", o aviso da data, o aviso do preço, "Horário atual", "Novo horário", o aviso da troca, a troca parcial, o aviso da remoção, "Tirar da agenda", "Registro" e os títulos.

Do spec: "Excluir definitivamente", "Horário alterado." (15, com ponto, como no épico 5), "Nada mudou no registro" e os erros da 12.

**Novos, para aprovação no fechamento:** "Nenhuma despesa registrada ainda." e "Nenhum horário fixo na agenda." (no padrão dos dois do app), mais os textos lidos só pelo modelo.
