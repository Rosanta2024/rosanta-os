#!/usr/bin/env bash
# Clona los proyectos Apps Script de Rosanta y lista sus deployments.
# Requiere sesión de clasp:  clasp login   (OAuth en navegador, lo corre el dueño)
#
#   ./bootstrap.sh
#
# Sólo lee. No hace push, no despliega, no toca producción.

set -uo pipefail
cd "$(dirname "$0")"

if ! clasp show-authorized-user 2>&1 | grep -qi "logged in as"; then
  echo "clasp no responde. Corré 'clasp login' primero."; exit 1
fi

# Verificación real: show-authorized-user no golpea la API y dice "logged in"
# aunque el token esté muerto. Sólo una llamada real revela el invalid_grant.
#
# Esto importa más de lo que parece: con la sesión vencida, clasp reporta
# CUALQUIER fallo de auth como "Invalid script ID.". Verificado — un ID bueno
# y uno de basura dan el mismo mensaje. Si ves eso, el ID está bien: es la sesión.
if clasp list-scripts 2>&1 | grep -q "invalid_grant"; then
  echo "❌ La sesión de clasp está vencida (invalid_rapt). Corré:  clasp login"
  exit 1
fi

clonar () {  # <carpeta> <scriptId> <etiqueta>
  local dir="$1" id="$2" label="$3"
  echo ""
  echo "──── $label"
  mkdir -p "$dir"
  ( cd "$dir" && clasp clone "$id" 2>&1 | sed 's/^/   /' )
  echo "   deployments:"
  clasp list-deployments "$id" 2>&1 | sed 's/^/     /'
}

clonar marketing-os   1quGqCLOam-crmOoj0ALklql1bLhm7wgVZTe67ilALJQEjRXrQgz26Dhr "Rosanta Marketing OS"
clonar crm            1CsmOemdbayLh4pSg2lN0tSBMlyJox_iHJ_iocg1DeRpJf4Rftgpvo-gt "Rosanta CRM"
clonar consola        15kFYyQbVh_Oeb33RLakuTLs5zLMwsdBF3v73-2mnz7rRxMUyody8_Jpf "Consola de respuestas"
clonar bot-readonly   1XNbCMcGg4uoK2wvzxtUY0jLFxBmCBUHLAoS3MV7ycE6L04kwgpJja4tI "Bot Rosanta (NO TOCAR)"
clonar resenas        17zjCFCUgChVo4MbGIAHe0FW0cGBk-dJogHn66uj3g0YdUfpiUpabGnay "Panel de Reseñas"
clonar intranet-en-vivo 1eVphVfUKVlwdoM7wRhN5rKo-FzksYSv3QNqjUSVDcFQTa22L4KToqh42 "Rosanta Intranet"

echo ""
echo "Listo. Lo que sigue:"
echo "  1. Las URLs /exec viven en intranet-en-vivo/Config.js (CONSOLA_URL, RESENAS_URL)."
echo "     Ya estan puestas; solo tocarlas si se crea un deployment nuevo."
echo "  2. Revisar si el doGet de CRM/Consola/Reseñas trae setXFrameOptionsMode(ALLOWALL)"
echo "     -> sin eso el iframe no carga y el portal muestra el fallback:"
echo "        grep -rn 'XFrameOptions' crm consola resenas"
echo "  3. Ver qué hay en intranet-en-vivo para decidir si es el hogar del portal"
