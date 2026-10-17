#!/bin/bash
# Copia a cloud/app/intranet/ los archivos de la intranet que usa el servidor nuevo (17-oct-2026):
#   LISTA.txt         el codigo que corre el motor de Pagos (PagosProveedores.js y lo que necesita)
#   LISTA-VISTAS.txt  la pantalla de Pagos, el aviso de guardado, la paleta y los errores en español
#   LISTA-CAJA.txt, LISTA-EVENTOS.txt, LISTA-VISTAS-F2.txt  la sombra 2 (rosanta-nube-sombra2, 17-oct-2026):
#                     Caja chica, Compras en efectivo y Clientes › Eventos. Su version va en VERSION-F2.txt.
# Son COPIAS EXACTAS: la prueba "El motor usa los mismos archivos que la intranet" falla si se separan.
# Correrlo cada vez que cambie uno de estos archivos en apps-script/rosanta-intranet, antes de sellar.
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
ORIGEN="$RAIZ/apps-script/rosanta-intranet"
DESTINO="$RAIZ/cloud/app/intranet"
ARCHIVOS=$(cat "$DESTINO/LISTA.txt" "$DESTINO/LISTA-VISTAS.txt")
for f in $ARCHIVOS; do cp "$ORIGEN/$f" "$DESTINO/$f"; done
git -C "$RAIZ" log -1 --format='%h %cs %s' -- $(for f in $ARCHIVOS; do echo "apps-script/rosanta-intranet/$f"; done) > "$DESTINO/VERSION.txt"
echo "Copiados $(echo "$ARCHIVOS" | wc -w | tr -d ' ') archivos · $(cat "$DESTINO/VERSION.txt")"

# Sombra 2 (17-oct-2026, rama claude/nube-fase2-mkt). Aparte para no mover el VERSION.txt de Pagos.
F2=$(cat "$DESTINO/LISTA-CAJA.txt" "$DESTINO/LISTA-EVENTOS.txt" "$DESTINO/LISTA-VISTAS-F2.txt" | sort -u)
for f in $F2; do cp "$ORIGEN/$f" "$DESTINO/$f"; done
git -C "$RAIZ" log -1 --format='%h %cs %s' -- $(for f in $F2; do echo "apps-script/rosanta-intranet/$f"; done) > "$DESTINO/VERSION-F2.txt"
echo "Sombra 2: $(echo "$F2" | wc -w | tr -d ' ') archivos · $(cat "$DESTINO/VERSION-F2.txt")"
