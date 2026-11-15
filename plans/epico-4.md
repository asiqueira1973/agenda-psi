# Épico 4 — Ferramentas de leitura

## Contexto
Seção 8.4 do `mcp-server/spec.md`: as 9 ferramentas de leitura do agente interno, com os mesmos nomes, descrições, entradas e saídas de `supabase/functions/agente/ferramentas.ts` (13.2). Há duas exceções: nenhuma resposta traz `observacoes` (P5), e nenhuma traz ids internos. `consultar_despesas` já existe desde o épico 1; faltam oito.

## Ferramentas (porta direta do agente, regra 24.3: copiar, não compartilhar)

| Ferramenta | Entrada | Lê | Diferença em relação ao agente |
|---|---|---|---|
| `buscar_paciente` | `nome` | `v_pacientes_cartao`, `view_agenda_semana_padrao` | **sem `observacoes`** no select e na resposta; descrição sem "observações" |
| `historico_do_paciente` | `nome`, `desde?`, `ate?` | `pacientes`, `sessoes`, `pagamentos` | — |
| `listar_pacientes` | `status?`, `receber_sms?` | `v_pacientes_cartao` | — |
| `consultar_periodo` | `desde`, `ate` (AAAA-MM) | `v_financeiro_mensal`, `despesas`, `sessoes` | — |
| `consultar_mes` | `mes` | `v_financeiro_mensal`, `sessoes` | — |
| `agenda_do_dia` | `data` | `view_agenda_semana_padrao` | usa `diaDaSemanaDoBanco` de `rules/` (pegadinha 7) |
| `agenda_da_semana` | `data` | `view_agenda_semana_padrao` | usa `diasDaSemanaDe` de `rules/` |
| `listar_pendencias` | — | `v_pendencias_por_paciente`, `v_pacientes_cartao` | — |

Todas são visíveis ao modelo, com `readOnlyHint: true`, `.describe()` em português e sem `usuario_id` (P1). Todas filtram `.eq('usuario_id', sub)` como segunda tranca (5). Os números vêm das views, e só se soma o que o agente já soma (seção 11, "o que não é automático"). Erro vira `isError: true` com o texto curto do agente.

**Descrição de `buscar_paciente`:** a do agente cita "telefone, e-mail, observações". Removo só a palavra "observações", porque P5 a tira da resposta e uma descrição que promete o campo faria o modelo inventá-lo. É a única descrição que não é cópia literal.

**Visibilidade de despesas:** as leituras são registradas para qualquer cliente, com UI ou sem UI.

## Arquivos
| Arquivo | O que faz |
|---|---|
| `src/tools/read/descricoes.ts` | As descrições, copiadas do agente (byte a byte, menos a palavra de P5), com teste que lê `ferramentas.ts` como texto |
| `src/tools/read/pacientes.ts` | `buscar_paciente`, `historico_do_paciente`, `listar_pacientes` |
| `src/tools/read/financeiro.ts` | `consultar_periodo`, `consultar_mes`, `listar_pendencias`, e `mesesDoPeriodo` (portado, com teto de 36) |
| `src/tools/read/agenda.ts` | `agenda_do_dia`, `agenda_da_semana` |
| `src/tools/read/index.ts` | Registra as 9 (inclui a `consultar_despesas` existente) |
| `src/tools/index.ts` | Passa a chamar o registro de leitura |
| `test/tools/read-*.test.ts` | Banco simulado por tabela: filtros, cortes (30 no histórico, 5 na busca, `pode_haver_mais`), datas inválidas, erro do banco curto, dia 1–7 (domingo = 7) |
| `test/tools/p5.test.ts` | Percorre as 9 com dados simulados que **contêm** `observacoes` e falha se a chave aparecer na saída (8.4, 20) |
| `test/schemas.test.ts` | Já percorre o `tools/list` (sem `usuario_id`, sem `anyOf`); passa a ver as 9 |

## Critérios (8.4) e como serão mostrados
1. **Resultado igual ao do agente para a mesma pergunta:** os testes comparam a forma da saída com a do agente. Ao vivo, chamo cada ferramenta pelo servidor local (token da conta de teste, só leitura) e comparo com a mesma consulta feita direto nas views. O roteiro "mesma pergunta no app e no Claude" vai para o README (épico 7).
2. **Nenhuma resposta com `observacoes`:** `test/tools/p5.test.ts`, com as 9.
3. **Tetos e `pode_haver_mais`:** histórico com 30 linhas e `pode_haver_mais`; busca com 5. Mesmos números do agente, com teste.

Fecho com os comandos 22.1, o `verifier`, o commit e o seu push. Depois disso, uma pergunta de leitura no Claude ("quanto gastei este mês?", "qual a minha agenda de amanhã?") confere o fim a fim.

## Fora deste épico
Escritas (épicos 5 e 6), README (épico 7) e o backlog do Cancelar.

---

## Execução (15/11/2026)

**Aprovado** pelo Alexandre em 15/11/2026, sem ajustes.

### O que saiu
- `src/tools/read/descricoes.ts` foi **gerado** a partir de `ferramentas.ts` do agente (extração por script, para a cópia ser byte a byte), com o teste lendo o arquivo do agente.
- `pacientes.ts`, `financeiro.ts` e `agenda.ts` portam as 8 leituras que faltavam. `read/index.ts` registra as 9 numa tabela só (`LEITURAS`), com o mesmo helper; o registro antigo de `consultar_despesas` saiu.
- **P5, segunda tranca:** o teste da seção 22 (dados simulados **com** `observacoes`) falhou primeiro em 4 leituras que repassam linhas do banco, porque elas dependiam só do `select` não pedir o campo. `executar` agora passa toda resposta por `semCamposClinicos`, que remove `observacoes` em qualquer nível. Fiz com `fix-mode`. O teste também confere que nenhum `select` pede o campo.
- Os testes de `tools/list` do épico 2, que fixavam a lista exata, passaram a incluir as 9 leituras (mudança de contrato do plano, feita fora do `fix-mode`).

### Prova ao vivo (servidor local, token da conta de teste, só leitura)
```
buscar_paciente        ok   | sem observacoes | {"total_encontrado": 9, ...}
historico_do_paciente  ok   | sem observacoes | {"varios_pacientes": [...]}      ← "a" casa com vários: devolve nomes, não escolhe
listar_pacientes       ok   | sem observacoes | {"total": 9, ...}
consultar_periodo      ok   | sem observacoes | {"periodo": "2026-09 a 2026-11", "total": {"recebido": 1950, "pendente": 0, "despesas": 3790, "saldo": -1840, "sessoes_realizadas": 2}, ...}
consultar_mes          ok   | sem observacoes | {"mes": "2026-11", "recebido": 1250, "pendente": 0, "sessoes_realizadas": 1}
agenda_do_dia          ok   | sem observacoes | {"data": "2026-11-16", "dia_da_semana": "Segunda", ...}
agenda_da_semana       ok   | sem observacoes | {"dias": [{"dia": "Segunda", "data": "2026-11-16", ...}
listar_pendencias      ok   | sem observacoes | {"pagamentos_pendentes": [], "sessoes_nao_pagas": []}
consultar_despesas     ok   | sem observacoes | {"quantidade": 4, "total": 2290, ...}
### conferência direta nas views (mesmo token, sem o servidor MCP)
[{"recebido":1250,"pendente":0}]          ← igual ao consultar_mes
pacientes ativos na view: 9               ← igual ao listar_pacientes
```
O roteiro "mesma pergunta no agente do app e no Claude" vai para o README (épico 7), como previsto.

### Comandos 22.1 (em `mcp-server/`)
```
 Test Files  20 passed (20)
      Tests  197 passed (197)
EXIT test=0
EXIT typecheck=0
EXIT build=0
```

### Verifier: PRONTO
Sem impedimentos. Comentário de `descricoes.ts` corrigido (citava um teste com nome errado). Ficam registradas:
- o critério 1 foi comparado com as views, não com o agente do app; o roteiro "mesma pergunta nos dois" vai para o README (épico 7);
- a validação de entrada é mais estrita que a do agente (o zod recusa `status` fora do enum), com a mesma entrada declarada;
- caso raro aceito: um tipo de despesa chamado literalmente "observacoes" sumiria do `total_por_tipo`, por causa da segunda tranca de P5. Prefiro o filtro largo.
