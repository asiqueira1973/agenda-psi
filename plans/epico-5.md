# Épico 5 — Demais criações

## Contexto
Seção 8.5 e tabela 13.3: sessões (várias), pagamento (vários), paciente (com preço e horários), horário e feedback. O molde é o da despesa: `abrir_formulario_*` (modelo), opções (app), `salvar_*` (app), `registrar_*` (fallback com prévia) e o formulário MCP Apps. Cada ação grava **como o hook do app grava** (P4). Levantamento completo do app e do agente em 15/11/2026; resumo abaixo.

## Primeiro: extrair o que é comum (sem mudar o comportamento da despesa)
Cinco formulários a mais tornam o molde copiado caro. Extraio:
- **Servidor** (`src/tools/shared/`): registro do recurso com **endereço versionado** por formulário; o fallback genérico (normaliza → prévia + `token_previa` → confirma), já testado na despesa; a resposta do salvar; `buscar_pacientes_opcoes` (só app): `id`, `nome`, `preco_referencia` (de `v_pacientes_cartao.preco_vigente`) e `ativo`, para o autocomplete e o valor sugerido.
- **Formulário** (`ui/shared/`): bootstrap do `App` (handlers antes do `connect`, tema do host), memória de "já salvo/cancelado", Cancelar, campos com erro embaixo, lista de linhas (várias sessões ou pagamentos) e o seletor de paciente com busca, que mostra a ambiguidade como escolha e nunca resolve sozinho.
- `embed-ui.ts` e `vite.config.ts` passam a montar N formulários.

A despesa passa a usar as peças comuns; os testes dela continuam passando sem mudança.

## Por ação: o que é gravado (igual ao app)
| Ação | Tabela e colunas | Padrões | Validação (servidor e tela) | Evento (21) |
|---|---|---|---|---|
| **Sessões** (várias) | `sessoes`: `usuario_id`, `paciente_id`, `ocorreu_em_dia`, `modalidade`, `duracao_minutos`, `pagamento`, `devesercobrada`, `observacoes: null` (P5). Sem `status` e sem `ocorreu_em` (padrão do banco) | pagamento `pagamento mensal`, modalidade `presencial`, duração 50, cobrada `true` (11.9) | paciente resolvido (11.14), data real (11.3), duração inteira 1–600 (11.8), literais 11.4 | `agenda_psi_novasessao`, tela `mcp_sessoes`, um por sessão |
| **Pagamentos** (vários) | `pagamentos`: `usuario_id`, `paciente_id`, `valor_pagamento`, `data_competencia`, `pago_em` agora, `status: 'pago'`, `tipo`, `observacoes: null` | tipo `mensal`; valor sugerido = `preco_vigente` da view (11.11), nunca calculado | paciente, valor inteiro > 0 até 1.000.000 (11.1/11.2), data, `tipo` ∈ {`mensal`, `por sessão`} | `agenda_psi_novopagamento`, tela `mcp_pagamento` |
| **Paciente** | `pacientes`: `nome_completo` (trim), `telefone` (só trim, **sem normalizar**: 11.13 conferido), `email` (trim ou null), `observacoes: null` (P5), `receber_sms`, `status: 'ativo'`; **depois** `precos_paciente`: `preco` (append-only, 11.17); **depois** cada horário | `receber_sms` = sim (11.12) | nome, telefone, e-mail válido se houver, preço 11.1; horários com dia 1–7 e fim > início, fim padrão +50 min até 23:59 (11.7) | `agenda_psi_novopaciente` (tela `mcp_paciente`) e um `agenda_psi_novoagendamento` por horário |
| **Horário** | `agenda_semana_padrao`: `paciente_id`, `dia_semana` 1–7, `hora_inicio`, `hora_fim`, `observacoes: null` | fim padrão +50 min | paciente, dia, horas válidas, fim > início; **sobreposição = aviso**, não bloqueio (11.19, `conflitosDoHorario`) | `agenda_psi_novoagendamento`, tela `mcp_horario` |
| **Feedback** | `feedback`: `mensagem`, `email` (do token), `app_name: 'agenda_psi'`; depois chama `notifica-admin` com o **JWT do usuário**, `{ tipo: 'feedback', referencia }`, como o app faz (só invoca, não publica nada) | — | mensagem obrigatória até 2000; categoria ∈ {problema, sugestão, elogio} (11.21) | nenhum (o app não emite) |

**Gravação de várias linhas e do paciente:** em ordem, como o app. Se uma falhar, as gravadas ficam, e o formulário mostra o que faltou e deixa tentar de novo **só** o que faltou (8.5). Para o paciente: se o **preço** falhar depois do paciente criado, o formulário tranca e avisa, sem permitir "tentar de novo" o cadastro inteiro. É uma correção do defeito do cartão do agente, que duplicaria o paciente.

**Sessão marcada "Pagou" não cria pagamento (11.18).** Depois de salvar, se alguma sessão foi marcada Pagou, o formulário mostra um botão que manda uma mensagem na conversa (`sendMessage` do ext-apps). O modelo então abre o formulário de pagamento, já preenchido com o preço de referência de cada paciente (mesma regra de `ofertaDePagamento`: tipo `por sessão`, data da sessão).

**Entradas para o modelo:** espelham `propor_sessoes`, `propor_pagamentos`, `propor_paciente`, `propor_horarios` e `propor_feedback` do agente, com tudo opcional e sem `anyOf`. As descrições são adaptadas: "Abre o formulário…" no lugar de "Monta um rascunho… num cartão".

## Textos: preciso da sua aprovação
Regra da 15: se o texto existe no app, vale o do app (como em "Despesa registrada.").
1. **Sucesso:** "Sessão registrada." (app) e, para várias, "Sessões registradas." (spec 15, com ponto); "Pagamento registrado." (app) e "Pagamentos registrados." para vários; "`<nome>` cadastrado." (app); "Horário criado." (app; o spec dizia "Horário adicionado"); "Obrigado. Sua mensagem chegou." (app).
2. **Rótulos:** os do app (`copy.ts` de sessões, pagamentos, pacientes, agenda e ajustes), byte a byte, com teste.
3. **Oferta de pagamento:** botão "Registrar também o pagamento" (o spec traz com interrogação; sem ela, porque é um botão) e a mensagem que o botão manda na conversa: "Quero registrar o pagamento destas sessões: Beatriz Nogueira (14/11/2026), Caio Lemos (14/11/2026)."
4. **Falha parcial:**
   - várias linhas: "Estas não foram gravadas: `<lista>`. As outras foram.";
   - paciente com horários: "Paciente cadastrado, mas estes horários não foram gravados: `<lista>`. Adicione pelo app ou peça de novo.";
   - preço: "Paciente cadastrado sem preço. Defina o preço no app."
5. **Feedback:** o texto gravado leva o prefixo do agente, com a origem trocada: `[Problema · via conector] <mensagem>` (o agente usa `via assistente`). Dá para distinguir no painel o que veio do Claude ou do ChatGPT.
6. **Conflito de horário (aviso):** "Este horário coincide com: Laura (10:00–10:50)." (literal do agente do app).
7. **Para o modelo, na abertura** de cada formulário: o mesmo padrão aprovado na despesa, "Abri o formulário de `<sessão|pagamento|paciente|horário|feedback>`."

## Ordem e entregas
1. Extração do comum + despesa migrada (testes da despesa intactos).
2. Sessões → 3. Pagamentos (com a oferta vinda das sessões) → 4. Paciente com horários → 5. Horário → 6. Feedback.
Cada ação tem testes de validação, de gravação (colunas exatas do app, com o banco simulado), do fallback e do estado do formulário. Ao vivo: basic-host local com a conta de teste, uma gravação por ação, que fica no banco (decisão de 15/11/2026). No fim: comandos 22.1, verifier, commit e o seu push, e o teste no Claude numa conversa nova.

## Fora deste épico
Edições, exclusões e troca de horário (épico 6); README (épico 7).
