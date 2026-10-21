#!/bin/bash
# Copia a cloud/app/maestro/ los archivos del maestro financiero (apps-script/rosanta-maestro) que corre el
# proceso del maestro en la nube (proc-maestro.js, 21-oct-2026):
#   LISTA.txt   cargador.js (cargarUltimasSemanas: POS, FEL emitidas/recibidas y BANCO_BI de "Reportes 2026").
#               Su version va en VERSION.txt.
# Code.js (generarEspejo, el xlsx espejo) NO se copia: el espejo sigue en Apps Script por ahora.
# Son COPIAS EXACTAS: la prueba "El proceso del maestro usa el mismo cargador que Apps Script" falla si se
# separan. Correrlo cada vez que cambie cargador.js en apps-script/rosanta-maestro, antes de sellar.
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
ORIGEN="$RAIZ/apps-script/rosanta-maestro"
DESTINO="$RAIZ/cloud/app/maestro"
ARCHIVOS=$(cat "$DESTINO/LISTA.txt")
for f in $ARCHIVOS; do cp "$ORIGEN/$f" "$DESTINO/$f"; done
git -C "$RAIZ" log -1 --format='%h %cs %s' -- $(for f in $ARCHIVOS; do echo "apps-script/rosanta-maestro/$f"; done) > "$DESTINO/VERSION.txt"
echo "Copiados $(echo "$ARCHIVOS" | wc -w | tr -d ' ') archivos · $(cat "$DESTINO/VERSION.txt")"
