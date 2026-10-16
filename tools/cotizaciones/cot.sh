#!/bin/bash
# Pipeline de Eventos (Rosanta Marketing OS › cotizaciones), 15-oct-2026.
# Lo usa la revisión diaria de cotizaciones (tarea de la Mac) en vez de ArtifactData.
#   cot.sh list                     → {"ok":true,"filas":[...]}
#   cot.sh get <id>                 → {"ok":true,"fila":{...}}
#   cot.sh batch <archivo.json>     → el archivo es una lista [{op,id,data,if_version}]
#   cot.sh revision <archivo.json>  → el archivo es {fecha,hora,resumen,contestaron,borradores}
#   cot.sh revisiones               → {"ok":true,"revisiones":[...]}
# El token vive en ~/.rosanta-secretos/cotizaciones-token (fuera de Drive y del repo).
# Apps Script contesta un POST con un 302: se lee la respuesta con un GET a esa dirección.
set -euo pipefail
URL="https://script.google.com/macros/s/AKfycbzEv9C1gZ6-bODUyI2a5TPCtLVQGt5T-7gQs60TP8OYmDgymZTHQuv3hR-232cng7K3/exec?hook=cotizaciones"
TOKEN=$(tr -d '\n' < "$HOME/.rosanta-secretos/cotizaciones-token")
acc="${1:-}"
case "$acc" in
  list|revisiones) BODY=$(python3 -c 'import json,sys;print(json.dumps({"token":sys.argv[1],"accion":sys.argv[2]}))' "$TOKEN" "$acc") ;;
  get) BODY=$(python3 -c 'import json,sys;print(json.dumps({"token":sys.argv[1],"accion":"get","id":sys.argv[2]}))' "$TOKEN" "${2:?falta el id}") ;;
  batch) BODY=$(python3 -c 'import json,sys;print(json.dumps({"token":sys.argv[1],"accion":"batch","writes":json.load(open(sys.argv[2]))}))' "$TOKEN" "${2:?falta el archivo}") ;;
  revision) BODY=$(python3 -c 'import json,sys;print(json.dumps({"token":sys.argv[1],"accion":"revision","revision":json.load(open(sys.argv[2]))}))' "$TOKEN" "${2:?falta el archivo}") ;;
  *) echo 'uso: cot.sh list|get <id>|batch <archivo>|revision <archivo>|revisiones' >&2; exit 2 ;;
esac
DEST=$(curl -sS -o /dev/null -w '%{redirect_url}' -X POST -H 'Content-Type: application/json' --data-binary "$BODY" "$URL")
[ -n "$DEST" ] || { echo '{"ok":false,"error":"el web app no respondió con la redirección esperada"}'; exit 1; }
curl -sS "$DEST"
echo
