#!/bin/bash
# Copia a cloud/bot/bot-rosanta/ el codigo del bot (19-oct-2026). Son COPIAS EXACTAS de apps-script/bot-rosanta:
# la prueba "Las copias del bot son exactas" falla si se separan.
# Correrlo SOLO despues de que la sesion del bot publique una version nueva (clasp create-version + update-deployment),
# y anotar esa version en VERSION.txt (primera linea: "@N · <hora ISO de publicacion> · <commit>"): la comparacion de
# la sombra vale para los mensajes desde esa hora. Despues: sellar (--servicio rosanta-bot-sombra) y publicar.
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
ORIGEN="$RAIZ/apps-script/bot-rosanta"
DESTINO="$RAIZ/cloud/bot/bot-rosanta"
n=0
for f in "$ORIGEN"/*.js; do cp "$f" "$DESTINO/"; n=$((n+1)); done
echo "Copiados $n archivos del bot. Ultimo commit del bot: $(git -C "$RAIZ" log -1 --format='%h %ci %s' -- apps-script/bot-rosanta)"
echo "Ahora: actualizar la primera linea de cloud/bot/bot-rosanta/VERSION.txt con la version publicada."
