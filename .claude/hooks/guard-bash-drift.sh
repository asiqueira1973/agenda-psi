#!/bin/bash
# Fecha a brecha dos hooks de Write/Edit: um comando Bash (sed -i, cat >) também edita
# arquivos. Depois de cada Bash, confere se algo mudou em app/ ou supabase/ e se entrou
# credencial privilegiada em mcp-server/. Roda depois do comando, então avisa, não impede.
# Implementa a regra de escopo 4.2, a decisão 25.4 e P1 do mcp-server/spec.md.
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Rode brew install jq antes de continuar." >&2; exit 2; }
cd "$CLAUDE_PROJECT_DIR" || exit 0
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
case "$branch" in feature/mcp-server*) ;; *) exit 0 ;; esac

drift=$(git status --porcelain -- app/ supabase/)
if [ -n "$drift" ]; then
  echo "ALERTA: o último comando alterou app/ ou supabase/, o que é proibido nesta branch (spec 4.2 e 25.4):" >&2
  echo "$drift" >&2
  echo "Pare. Desfaça (git checkout -- <arquivo> ou rm do arquivo novo) e explique ao Alexandre." >&2
  exit 2
fi

# `sb_secret_` só conta seguido de caracteres de chave: o supabase-js embutido nas páginas
# do site (public/) tem o PREFIXO como texto, numa checagem de formato, sem chave nenhuma.
# Ajuste autorizado pelo Alexandre em 15/11/2026 (épico 3).
leak=$(grep -rlE 'service_role|SERVICE_ROLE|sb_secret_[A-Za-z0-9]|N8N_WEBHOOK_SECRET|PLAY_PUSH_TOKEN' mcp-server \
  --exclude=spec.md --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.vercel 2>/dev/null)
if [ -n "$leak" ]; then
  echo "ALERTA: credencial privilegiada em: $leak. O servidor MCP usa só o JWT do usuário e a chave publicável (P1). Remova e explique ao Alexandre." >&2
  exit 2
fi
exit 0
