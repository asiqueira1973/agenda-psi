#!/bin/bash
# Impede editar uma migration já versionada; mudança de schema vira migration nova e aprovada.
# Implementa a seção 7 do mcp-server/spec.md.
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Rode brew install jq antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

case "$path" in
  */supabase/migrations/*|*/supabase/migrations-pendentes/*) ;;
  *) exit 0 ;;
esac

rel="${path#"$CLAUDE_PROJECT_DIR"/}"
if git -C "$CLAUDE_PROJECT_DIR" ls-files --error-unmatch "$rel" >/dev/null 2>&1; then
  echo "Bloqueado: $rel já está versionada. Crie uma migration nova e mostre ao Alexandre antes de aplicar (spec seção 7)." >&2
  exit 2
fi
exit 0
