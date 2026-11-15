#!/bin/bash
# Bloqueia credencial privilegiada no app (bundle) e em qualquer arquivo do servidor MCP.
# Implementa P1 e a seção 20 do mcp-server/spec.md, e a pegadinha 4 do CLAUDE.md.
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Rode brew install jq antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')

case "$path" in
  */app/src/*|*/app/app/*|*/mcp-server/*) ;;
  *) exit 0 ;;
esac
# O próprio spec cita os nomes para proibi-los; ele não é código.
case "$path" in
  */mcp-server/spec.md|*/plans/*) exit 0 ;;
esac

if echo "$content" | grep -qE 'service_role|SERVICE_ROLE|N8N_WEBHOOK_SECRET|PLAY_PUSH_TOKEN|sb_secret_'; then
  echo "Bloqueado: credencial privilegiada em $path. O servidor MCP usa só o JWT do usuário e a chave publicável (spec seção 0, P1, e seção 20). Se a operação parece exigir service_role, pare e pergunte ao Alexandre." >&2
  exit 2
fi
exit 0
