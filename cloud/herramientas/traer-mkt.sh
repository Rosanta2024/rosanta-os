#!/bin/bash
# Copia a cloud/app/mkt/ los archivos de Marketing OS (apps-script/rosanta-marketing-os) que corre el
# proceso de pauta de la nube (proc-pauta.js, 20-oct-2026):
#   LISTA-PAUTA.txt   WixReservasPauta.js (reservas, comensalesReserva), PosPauta.js (comensales, ticket),
#                     ClientesNuevos.js (clientes_nuevos, repetidos). Su version va en VERSION-PAUTA.txt.
# Son COPIAS EXACTAS: la prueba "El proceso de pauta usa los mismos archivos que Marketing OS" falla si se
# separan. Correrlo cada vez que cambie uno de estos archivos en Marketing OS, antes de sellar.
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
ORIGEN="$RAIZ/apps-script/rosanta-marketing-os"
DESTINO="$RAIZ/cloud/app/mkt"
ARCHIVOS=$(cat "$DESTINO/LISTA-PAUTA.txt")
for f in $ARCHIVOS; do cp "$ORIGEN/$f" "$DESTINO/$f"; done
git -C "$RAIZ" log -1 --format='%h %cs %s' -- $(for f in $ARCHIVOS; do echo "apps-script/rosanta-marketing-os/$f"; done) > "$DESTINO/VERSION-PAUTA.txt"
echo "Copiados $(echo "$ARCHIVOS" | wc -w | tr -d ' ') archivos · $(cat "$DESTINO/VERSION-PAUTA.txt")"
