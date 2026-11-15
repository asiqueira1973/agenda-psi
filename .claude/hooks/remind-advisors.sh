#!/bin/bash
# Depois de escrever uma migration, lembra de mostrar ao Alexandre e rodar os advisors.
# Implementa as seções 7 e 20 do mcp-server/spec.md.
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Rode brew install jq antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
case "$path" in
  */supabase/migrations/*)
    echo "Migration escrita. NÃO aplique sem a aprovação do Alexandre. Depois de aplicada, rode get_advisors (security e performance) e resolva alertas críticos (spec seção 20)." >&2
    exit 2 ;;
esac
exit 0
