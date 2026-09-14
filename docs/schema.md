# Schema do banco — Agenda Psi

> **Arquivo gerado. Não edite à mão.**
>
> Produzido por `scripts/gerar-schema.sql` + `scripts/gerar-schema.mjs`,
> lidos do catálogo do Postgres. Regerar depois de toda migration.
>
> Gerado em 2026-09-14, a partir do banco local reconstruído pelas migrations
> deste repositório. A contagem de linhas não aparece porque o banco local
> não tem dados — para volume de produção, ver o DOCUMENTACAO-TECNICA.md.

A convenção é **português, `snake_case`**, em tabelas, colunas, funções,
triggers e policies (spec 18). O código TypeScript é em inglês, e os tipos
gerados mantêm os nomes em português: não há camada de tradução.

## Resumo

| | |
|---|---|
| Tabelas | 17 |
| Views | 24 |
| Funções | 16 |
| Triggers | 3 |
| Policies de RLS | 70 |

## Tabelas

### `agenda_semana_padrao`

| Coluna | Tipo | Nulo | Padrão |
|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` |
| `usuario_id` | uuid | não | — |
| `paciente_id` | uuid | não | — |
| `dia_semana` | smallint | não | — |
| `hora_inicio` | time without time zone | não | — |
| `hora_fim` | time without time zone | não | — |
| `observacoes` | text | sim | — |
| `criado_em` | timestamp with time zone | não | `now()` |

### `assinaturas`

> Plano vigente de cada profissional. Fonte da verdade do paywall (spec 11.6). Escrita somente pelas Edge Functions apple-notificacoes e play-notificacoes, com service_role; o app nunca grava aqui (spec 5 e 12.1).

| Coluna | Tipo | Nulo | Padrão |
|---|---|---|---|
| `profissional_id` | uuid | não | — |
| `plano` | text | não | `'free'::text` |
| `status` | text | não | `'ativo'::text` |
| `store` | text | sim | — |
| `rc_customer_id` | text | sim | — |
| `rc_entitlement` | text | sim | — |
| `inicio_em` | timestamp with time zone | não | `now()` |
| `expira_em` | timestamp with time zone | sim | — |
| `atualizado_em` | timestamp with time zone | não | `now()` |

### `comentarios_locais_atendimento`

| Coluna | Tipo | Nulo | Padrão |
|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` |
| `local_atendimento_id` | uuid | não | — |
| `comentario` | text | não | — |
| `contexto_uso` | text | sim | — |
| `status` | text | não | `'pendente'::text` |
| `criado_por_usuario_id` | uuid | não | — |
| `criado_em` | timestamp with time zone | não | `now()` |

### `config_app`

| Coluna | Tipo | Nulo | Padrão |
|---|---|---|---|
| `chave` | text | não | — |
| `valor` | uuid | sim | — |

### `custos_sms_mensal`

> Custo real de SMS por mes, vindo da fatura do Bird. Fonte da verdade para as views de custo. Inserir uma linha por mes quando a fatura fechar.

| Coluna | Tipo | Nulo | Padrão |
|---|---|---|---|
| `mes` | date | não | — |
| `valor_eur` | numeric(12,2) | não | — |
| `cambio_eur_brl` | numeric(12,4) | não | — |
| `mensagens_bird` | integer | sim | — |
| `fatura_numero` | text | sim | — |
| `fechado` | boolean | não | `true` |
| `observacao` | text | sim | — |
| `atualizado_em` | timestamp with time zone | não | `now()` |

### `despesas`

| Coluna | Tipo | Nulo | Padrão |
|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` |
| `usuario_id` | uuid | não | — |
| `tipo_despesa_id` | uuid | não | — |
| `descricao` | text | sim | — |
| `valor_despesa` | integer | não | — |
| `data_competencia` | date | sim | `CURRENT_DATE` |
| `pago_em` | timestamp with time zone | sim | — |
| `status` | text | não | `'pendente'::text` |
| `metodo` | text | sim | — |
| `observacoes` | text | sim | — |
| `criado_em` | timestamp with time zone | não | `now()` |

### `feedback`

| Coluna | Tipo | Nulo | Padrão |
|---|---|---|---|
| `id` | bigint | não | — |
| `created_at` | timestamp with time zone | não | `now()` |
| `email` | text | sim | — |
| `mensagem` | text | sim | — |
| `handle_at` | timestamp without time zone | sim | — |
| `app_name` | text | sim | `'agenda_psi'::text` |

### `locais_atendimento`

| Coluna | Tipo | Nulo | Padrão |
|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` |
| `nome` | text | não | — |
| `cidade` | text | não | — |
| `bairro` | text | sim | — |
| `estado` | text | não | — |
| `tipo_local` | text | não | — |
| `url_contato` | text | sim | — |
| `origem` | text | não | — |
| `status` | text | não | `'pendente'::text` |
| `criado_por_usuario_id` | uuid | sim | — |
| `criado_em` | timestamp with time zone | não | `now()` |

### `notifications`

| Coluna | Tipo | Nulo | Padrão |
|---|---|---|---|
| `id` | bigint | não | — |
| `created_at` | timestamp with time zone | não | `now()` |
| `title` | text | não | — |
| `body` | text | não | — |
| `recipient_usuario_id` | uuid | não | — |
| `is_read` | boolean | não | `false` |

### `pacientes`

| Coluna | Tipo | Nulo | Padrão |
|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` |
| `profissional_id` | uuid | sim | — |
| `nome_completo` | text | não | — |
| `telefone` | text | sim | — |
| `email` | text | sim | — |
| `status` | text | não | `'ativo'::text` |
| `observacoes` | text | sim | — |
| `criado_em` | timestamp with time zone | não | `now()` |
| `primeira_consulta` | date | sim | — |
| `usuario_id` | uuid | não | — |
| `receber_sms` | boolean | não | `false` |

### `pagamentos`

| Coluna | Tipo | Nulo | Padrão |
|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` |
| `profissional_id` | uuid | sim | — |
| `paciente_id` | uuid | não | — |
| `valor_pagamento` | integer | não | — |
| `vencimento_em` | date | sim | — |
| `pago_em` | timestamp with time zone | sim | — |
| `status` | text | não | `'pendente'::text` |
| `metodo` | text | sim | — |
| `observacoes` | text | sim | — |
| `criado_em` | timestamp with time zone | não | `now()` |
| `usuario_id` | uuid | não | — |
| `data_competencia` | date | sim | `CURRENT_DATE` |
| `tipo` | text | sim | — |

### `precos_paciente`

| Coluna | Tipo | Nulo | Padrão |
|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` |
| `profissional_id` | uuid | sim | — |
| `paciente_id` | uuid | não | — |
| `preco` | integer | não | — |
| `vigencia_desde` | date | não | `CURRENT_DATE` |
| `observacoes` | text | sim | — |
| `criado_em` | timestamp with time zone | não | `now()` |
| `usuario_id` | uuid | não | — |

### `profissionais`

| Coluna | Tipo | Nulo | Padrão |
|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` |
| `usuario_id` | uuid | não | — |
| `nome` | text | não | — |
| `email` | text | não | — |
| `telefone` | text | sim | — |
| `linkedin` | text | sim | — |
| `instagram` | text | sim | — |
| `criado_em` | timestamp with time zone | não | `now()` |
| `ativo` | boolean | sim | `true` |
| `fcm_token` | text | sim | — |
| `usuario_fundador` | boolean | não | `false` |

### `sessoes`

| Coluna | Tipo | Nulo | Padrão |
|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` |
| `profissional_id` | uuid | sim | — |
| `paciente_id` | uuid | não | — |
| `ocorreu_em` | timestamp with time zone | não | `now()` |
| `status` | text | não | `'realizada'::text` |
| `modalidade` | text | sim | — |
| `duracao_minutos` | integer | sim | — |
| `observacoes` | text | sim | — |
| `criado_em` | timestamp with time zone | não | `now()` |
| `usuario_id` | uuid | não | — |
| `ocorreu_em_dia` | date | não | `CURRENT_DATE` |
| `pagamento` | text | sim | — |
| `devesercobrada` | boolean | sim | `true` |

### `sms_lembretes_enviados`

| Coluna | Tipo | Nulo | Padrão |
|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` |
| `agenda_id` | uuid | não | — |
| `ocorrencia_inicio` | timestamp with time zone | não | — |
| `ocorrencia_data` | date | não | — |
| `enviado_em` | timestamp with time zone | não | `now()` |
| `provider_message_id` | text | sim | — |

### `tipos_despesa`

| Coluna | Tipo | Nulo | Padrão |
|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` |
| `nome` | text | não | — |
| `ativo` | boolean | não | `true` |
| `criado_em` | timestamp with time zone | não | `now()` |

### `uso_mensal`

> Contador materializado de SMS por profissional e mês. Alimentado pelo trigger fn_uso_mensal_incrementa (spec 7.4), nunca pelo app. Reconstruível a partir de sms_lembretes_enviados pela função recontar_uso_mensal (spec 7.3).

| Coluna | Tipo | Nulo | Padrão |
|---|---|---|---|
| `profissional_id` | uuid | não | — |
| `mes` | date | não | — |
| `sms_enviados` | integer | não | `0` |
| `atualizado_em` | timestamp with time zone | não | `now()` |

## Views

- `v_adesao_usuarios`
- `v_admin_dashboard_usuarios`
- `v_campanha_despesas`
- `v_custo_sms_mensal`
- `v_custo_sms_mensal_por_profissional`
- `v_dashboard_payload_json`
- `v_dashboard_resumo`
- `v_despesas_ultimas_10`
- `v_despesas_ultimas_30`
- `v_feedback_email`
- `v_feedback_email_aggregated`
- `v_financeiro_mensal`
- `v_meu_plano`
- `v_minha_adesao`
- `v_pacientes_cartao`
- `v_pacientes_sms_ativos_resumo`
- `v_pendencias_por_paciente`
- `v_preco_vigente_paciente`
- `v_precos_paciente`
- `v_profissional_atual`
- `v_sms_base_mensal`
- `v_sms_lembretes_pendentes`
- `view_agenda_semana_padrao`
- `view_locais_atendimento_cards`

## Funções

- `agentpsi_consultar_paciente(p_usuario_id uuid, p_nome_paciente text)`
- `agentpsi_criar_paciente(p_usuario_id uuid, p_nome_completo text, p_telefone text, p_email text, p_observacoes text, p_primeira_consulta date)`
- `agentpsi_dashboard(p_usuario_id uuid)`
- `agentpsi_listar_despesas_ultimas_30(p_usuario_id uuid)`
- `agentpsi_listar_pacientes_ativos(p_usuario_id uuid)`
- `agentpsi_listar_pagamentos_ultimos_30(p_usuario_id uuid)`
- `agentpsi_registrar_despesa(p_usuario_id uuid, p_nome_tipo_despesa text, p_valor_despesa numeric, p_data_competencia date, p_descricao text, p_metodo text, p_observacoes text)`
- `agentpsi_registrar_pagamento(p_usuario_id uuid, p_nome_paciente text, p_valor_pagamento integer, p_data_pagamento date, p_metodo text, p_observacoes text, p_tipo text)`
- `agentpsi_registrar_sessao(p_usuario_id uuid, p_nome_paciente text, p_ocorreu_em timestamp with time zone, p_modalidade text, p_duracao_minutos integer, p_observacoes text, p_gerar_pagamento boolean, p_valor_pagamento integer, p_metodo text, p_tipo text)`
- `current_profissional_id()`
- `demo_uid()`
- `fn_pacientes_sync_ids()`
- `fn_precos_sync_ids()`
- `fn_uso_mensal_incrementa()`
- `limite_sms_do_plano(p_profissional_id uuid)`
- `recontar_uso_mensal(p_mes date)`

## Triggers

| Trigger | Tabela |
|---|---|
| `trg_pacientes_sync_ids` | `pacientes` |
| `trg_precos_sync_ids` | `precos_paciente` |
| `trg_uso_mensal_incrementa` | `sms_lembretes_enviados` |

## Policies de RLS


**`agenda_semana_padrao`**

- `Delete only own rows` — DELETE
- `Insert only own rows` — INSERT
- `Select only own rows` — SELECT
- `Update only own rows` — UPDATE
- `select agenda via view` — SELECT

**`assinaturas`**

- `assinaturas_select_proprio` — SELECT

**`comentarios_locais_atendimento`**

- `comentarios_locais_delete_proprio` — DELETE
- `comentarios_locais_insert_proprio` — INSERT
- `comentarios_locais_select_aprovado` — SELECT
- `comentarios_locais_update_proprio` — UPDATE

**`custos_sms_mensal`**

- `custos_sms_mensal_admin_read` — SELECT

**`despesas`**

- `despesas_delete` — DELETE
- `despesas_insert` — INSERT
- `despesas_select` — SELECT
- `despesas_update` — UPDATE

**`feedback`**

- `feedback_insert_public` — INSERT
- `feedback_select_authenticated` — SELECT

**`locais_atendimento`**

- `locais_atendimento_delete_proprio` — DELETE
- `locais_atendimento_insert_proprio` — INSERT
- `locais_atendimento_select_auth` — SELECT
- `locais_atendimento_update_proprio` — UPDATE

**`notifications`**

- `notifications_delete` — DELETE
- `notifications_insert` — INSERT
- `notifications_select` — SELECT
- `notifications_update` — UPDATE

**`pacientes`**

- `Pacientes visíveis pelo dono` — SELECT
- `pacientes_delete_own` — DELETE
- `pacientes_insert_own` — INSERT
- `pacientes_rls` — ALL
- `pacientes_select_own` — SELECT
- `pacientes_update_own` — UPDATE
- `select own pacientes` — SELECT

**`pagamentos`**

- `Pagamentos visíveis pelo dono` — SELECT
- `pag_delete_own` — DELETE
- `pag_insert_own` — INSERT
- `pag_select_own` — SELECT
- `pag_update_own` — UPDATE
- `pagamentos_delete_own` — DELETE
- `pagamentos_insert_own` — INSERT
- `pagamentos_rls` — ALL
- `pagamentos_select_own` — SELECT
- `pagamentos_update_own` — UPDATE

**`precos_paciente`**

- `Preços visíveis pelo dono` — SELECT
- `precos_delete_own` — DELETE
- `precos_insert_own` — INSERT
- `precos_paciente_rls` — ALL
- `precos_select_own` — SELECT
- `precos_update_own` — UPDATE

**`profissionais`**

- `Profissionais visíveis pelo dono` — SELECT
- `prof_delete_own` — DELETE
- `prof_insert_own` — INSERT
- `prof_select_own` — SELECT
- `prof_update_own` — UPDATE
- `profissionais_delete_own` — DELETE
- `profissionais_insert_own` — INSERT
- `profissionais_select_own` — SELECT
- `profissionais_select_self` — SELECT
- `profissionais_update_own` — UPDATE

**`sessoes`**

- `Sessões visíveis pelo dono` — SELECT
- `sessoes_delete_own` — DELETE
- `sessoes_insert_own` — INSERT
- `sessoes_rls` — ALL
- `sessoes_select_own` — SELECT
- `sessoes_update_own` — UPDATE

**`sms_lembretes_enviados`**

- `sms_lembretes_delete_auth` — DELETE
- `sms_lembretes_insert_auth` — INSERT
- `sms_lembretes_select_auth` — SELECT
- `sms_lembretes_update_auth` — UPDATE

**`tipos_despesa`**

- `tipos_despesa_select` — SELECT

**`uso_mensal`**

- `uso_mensal_select_proprio` — SELECT
