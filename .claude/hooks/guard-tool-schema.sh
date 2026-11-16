#!/bin/bash
# Impede declarar usuario_id como argumento de ferramenta MCP: o usuário vem do JWT.
# Implementa P1 do mcp-server/spec.md e a pegadinha 3 do CLAUDE.md.
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Rode brew install jq antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')

case "$path" in
  */mcp-server/src/tools/*) ;;
  *) exit 0 ;;
esac
# Procura usuario_id como chave de schema zod ou propriedade de entrada.
if echo "$content" | grep -qE 'usuario_id\s*:\s*z\.|["'\'']usuario_id["'\'']\s*:\s*\{'; then
  echo "Bloqueado: usuario_id declarado como entrada de ferramenta em $path. O usuário vem do JWT (sub), nunca do argumento (P1, pegadinha 3)." >&2
  exit 2
fi
exit 0
