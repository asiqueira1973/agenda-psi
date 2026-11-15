#!/bin/bash
# Impede alterar o app e qualquer coisa do Supabase (funções, config.toml, migrations)
# enquanto o trabalho é o servidor MCP. Protege o agente, muito usado em produção.
# Implementa a regra de escopo da seção 4.2 e a decisão 25.4 do mcp-server/spec.md.
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Rode brew install jq antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
branch=$(git -C "$CLAUDE_PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null)

case "$branch" in feature/mcp-server*) ;; *) exit 0 ;; esac
case "$path" in
  */app/*|*/supabase/*)
    echo "Bloqueado: na branch $branch não se altera o app nem nada em supabase/ (spec 4.2 e 25.4). Copie a regra para mcp-server/src/rules/ com teste, ou pare e pergunte." >&2
    exit 2 ;;
esac
exit 0
