#!/bin/bash
# Gera os prints finais da App Store (iPhone com Dynamic Island, 1206 x 2622)
# a partir de modelo.html e das capturas cruas de ../telas-iphone/.
#
# Por que existe: até 02/11/2026 as artes com texto eram feitas no Claude Design
# e nunca foram salvas aqui. Quando a Apple mudou o tamanho pedido, não havia
# de onde tirá-las. Agora a arte sai deste script e fica versionada.
#
# Uso: ./docs/lojas/arte/gerar.sh   (precisa do Google Chrome instalado)
set -euo pipefail
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# Saída: o conjunto da 5.0.2. As outras (03 a 07) vêm das artes publicadas na
# 5.0.1 (telas-iphone-loja-5.0.1/), convertidas para 1206 x 2622.
SAIDA=../telas-iphone-5.0.2

# arquivo de saída | captura | título | subtítulo  (textos de prompt-claude-design-iphone.md)
while IFS='|' read -r saida captura titulo subtitulo; do
  [ -z "$saida" ] && continue
  [ -f "../telas-iphone/$captura" ] || { echo "sem captura: $captura (pulando $saida)"; continue; }
  html="tmp-$saida.html"
  sed -e "s|{{titulo}}|$titulo|" -e "s|{{subtitulo}}|$subtitulo|" -e "s|{{captura}}|$captura|" modelo.html > "$html"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=4000 \
    --window-size=1206,2622 --screenshot="$SAIDA/$saida" "$html" >/dev/null 2>&1
  rm -f "$html"
  echo "ok: $saida"
done <<'LISTA'
01-agente.png|00-agente.png|É só escrever o que aconteceu|O assistente prepara o registro, e você confirma.
02-agente-consulta.png|00-agente-consulta.png|Pergunte sobre o consultório|Agenda, pagamentos e pacientes, respondidos na hora.
LISTA
