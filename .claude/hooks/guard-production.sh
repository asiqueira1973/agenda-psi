#!/bin/bash
# Nada sai para produção sem o Alexandre. O servidor MCP mora na Vercel, então nenhuma
# Edge Function é publicada nesta branch: `supabase functions deploy` sem nome republica
# TODAS, inclusive o agente, que é muito usado. `supabase config push` sobrescreveria a
# auth de produção com o config.toml local. Na Vercel, produção, variáveis e domínios
# são do Alexandre. Implementa a regra 6.5 e a decisão 25.4 do mcp-server/spec.md.
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Rode brew install jq antes de continuar." >&2; exit 2; }
input=$(cat)
tool=$(echo "$input" | jq -r '.tool_name // empty')

block() { echo "Bloqueado: $1 Pare e peça ao Alexandre (spec 6.5 e 25.4)." >&2; exit 2; }

case "$tool" in
  *__deploy_edge_function) block "deploy de Edge Function. O servidor MCP roda na Vercel; nenhuma função do Supabase é publicada nesta branch." ;;
  *__apply_migration)      block "migration via MCP do Supabase. Este trabalho não muda o banco." ;;
  # MCP da Vercel (acrescentado em 15/11/2026): o mesmo que a CLI abaixo, pelo outro
  # caminho. Projeto, variáveis e domínio foram criados uma vez, com ordem explícita do
  # Alexandre; daqui em diante, qualquer mudança desse tipo volta a passar por ele.
  *__create_deployment|*__request_promote|*__request_rollback|*__assign_alias|*__start_rolling_release|*__approve_rolling_release_stage|*__complete_rolling_release)
    block "deploy, promoção, rollback ou alias de produção na Vercel pelo MCP." ;;
  *__create_project_env|*__edit_project_env|*__add_project_domain|*__verify_project_domain|*__update_project|*__create_project|*__create_git_project|*__pause_project|*__unpause_project)
    block "mudança de projeto, variáveis ou domínio na Vercel pelo MCP." ;;
  *__buy_domain|*__create_or_transfer_domain|*__create_record|*__update_record|*__replace_domain_dns_records|*__update_firewall_config|*__put_firewall_config|*__update_project_protection_bypass)
    block "domínio, DNS, firewall ou proteção na Vercel pelo MCP." ;;
esac

cmd=$(echo "$input" | jq -r '.tool_input.command // empty')
has() { echo "$cmd" | grep -qE "$1"; }

has '\bsupabase[[:space:]]+functions[[:space:]]+(deploy|delete)\b' && block "'supabase functions deploy/delete'. Sem nome, o deploy republica todas as funções, inclusive o agente."
has '\bsupabase[[:space:]]+config[[:space:]]+push\b'  && block "'supabase config push' sobrescreve a configuração de auth de produção."
has '\bsupabase[[:space:]]+db[[:space:]]+push\b'      && block "'supabase db push' aplica migrations em produção."
has '\bsupabase[[:space:]]+secrets[[:space:]]+(set|unset)\b' && block "'supabase secrets' altera segredos de todas as funções do projeto."
has '\bvercel\b.*(--prod\b|[[:space:]]promote\b|[[:space:]]rollback\b)' && block "deploy de produção na Vercel. Produção sai pelo push na Production Branch, com o Alexandre."
has '\bvercel[[:space:]]+(env|domains|dns|alias|certs|project[[:space:]]+rm|remove|rm)\b' && block "mudança de variáveis, domínio ou projeto na Vercel."
exit 0
