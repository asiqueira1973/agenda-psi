# Instruções de revisão — servidor MCP

## Passes
Faça três passes e marque cada achado com o passe:
- Bugs: lógica, caso de borda (fuso de São Paulo, dia 1–7, valor com centavos, paciente ambíguo), regressão.
- Segurança: só o JWT do usuário e a RLS (P1); sem service_role; usuario_id nunca como argumento; nada de observacoes (P5); nada de PII em log; fallback só grava com token_previa válido (13.4).
- Conformidade: bate com mcp-server/spec.md (épicos da seção 8, regras da seção 11, contratos da seção 13) e com o plano em plans/; app/ e supabase/ intocados; rotinas comentadas em português com a regra que implementam.

## O que é Importante
O que grava diferente do app, vaza dado ou viola o spec. Estilo é detalhe.

## Limite de detalhes
No máximo cinco detalhes por revisão; resuma o resto como contagem.

## Não reportar
Arquivos gerados (dist/, database.types.ts, .vercel/).
