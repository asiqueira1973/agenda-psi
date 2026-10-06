#!/usr/bin/env bash
#
# Arquiva o Agenda Psi para a App Store, pela linha de comando.
#
# POR QUE ESTE SCRIPT EXISTE
#
# Este é o único projeto iOS do Alexandre que NÃO se abre pelo .xcodeproj — e
# ele tem mais de dez. Como usa CocoaPods, só o .xcworkspace tem os pods
# integrados; abrir o .xcodeproj dá dezenas de "module map file does not exist",
# um por biblioteca. Aconteceu em 15/09 e de novo em 06/10.
#
# A memória muscular dele está certa para os outros projetos, então o conserto
# não é lembrar — é remover a escolha. Aqui o caminho é explícito e não há como
# pegar o container errado.
#
# USO
#   ./scripts/arquivar-ios.sh
#
# Depois, abra o Organizer do Xcode (Window > Organizer) para distribuir.
# O script NÃO envia nada: envio é decisão sua, não dele.

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WS="$RAIZ/app/ios/AgendaPsi.xcworkspace"
SAIDA="$HOME/Library/Developer/Xcode/Archives/$(date +%Y-%m-%d)"

[ -d "$WS" ] || { echo "ERRO: não achei $WS — rodou o prebuild?"; exit 1; }

VERSAO=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$RAIZ/app/ios/AgendaPsi/Info.plist")
BUILD=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$RAIZ/app/ios/AgendaPsi/Info.plist")
ARQUIVO="$SAIDA/AgendaPsi $VERSAO ($BUILD).xcarchive"

echo "Arquivando $VERSAO ($BUILD)"
echo "  workspace: $WS"
echo "  destino  : $ARQUIVO"
echo

mkdir -p "$SAIDA"
xcodebuild archive \
  -workspace "$WS" \
  -scheme AgendaPsi \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARQUIVO" \
  | grep -E "error:|warning: .*deprecated|ARCHIVE SUCCEEDED|ARCHIVE FAILED" || true

if [ -d "$ARQUIVO" ]; then
  echo
  echo "Pronto. Abra Window > Organizer no Xcode para distribuir."
  open -a Xcode
else
  echo
  echo "O archive NÃO foi criado. Rode de novo sem o filtro para ver o erro inteiro:"
  echo "  xcodebuild archive -workspace \"$WS\" -scheme AgendaPsi -configuration Release -destination 'generic/platform=iOS' -archivePath \"$ARQUIVO\""
  exit 1
fi
