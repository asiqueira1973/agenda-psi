# Épico 7 — ChatGPT, README e documentação

Seção 8.7. Feito direto, com autorização do Alexandre de 15/11/2026.

## Entregue
- `mcp-server/README.md`:
  - como rodar localmente: Inspector, basic-host com `dev:proxy` e `dev:token`;
  - como fazer o deploy;
  - o checklist 6.5;
  - como conectar no Claude e no ChatGPT;
  - o roteiro de teste manual de cada ferramenta: as 9 leituras, os 6 registros, as 9 edições e exclusões, e o fallback.
- `DOCUMENTACAO-TECNICA.md`, seção 7 "Servidor MCP", com os seis itens da seção 19:
  - tabelas;
  - relacionamentos;
  - policies por nome;
  - mapa ferramenta → tabelas;
  - lógica;
  - divergências.
- `CLAUDE.md`: uma linha no mapa de pastas, com o comando de teste.

## ChatGPT
Não há código específico. A detecção de MCP Apps (`suporteAUi`) cobre os três casos:
- o cliente anuncia MCP Apps: só formulários;
- diz que não tem: só os `registrar_*`;
- não diz nada: os dois.

**O teste no ChatGPT (modo desenvolvedor) fica com o Alexandre**, porque depende da conta dele.

## Pendente
- Teste no Claude web, no desktop e no ChatGPT com a conta de teste (DoD).
- Pergunta 25.3: a política de privacidade precisa citar o conector?
- `CLAUDE.md` e o spec 21 escrevem `agenda_psi_novapaciente`; o certo é `novopaciente`. Não corrigi, porque o épico só autoriza uma linha no `CLAUDE.md`.
