#!/bin/bash
# Publica rosanta-web (o una version de prueba) con el sitio al dia. 23-oct-2026.
#
#   cloud/herramientas/publicar-web.sh prueba   rosanta-web-ensayo     (base rosanta_ensayo; sitio servido por el servicio)
#   cloud/herramientas/publicar-web.sh sv       rosanta-web-sv-ensayo  (prueba de la segunda vuelta; PUBLIC_SEGUNDA_VUELTA=si)
#   cloud/herramientas/publicar-web.sh v3       rosanta-web-v3-ensayo  (rediseño visual v3; rama claude/web-v3; PUBLIC_V3=si)
#   cloud/herramientas/publicar-web.sh produccion                     (rosanta-web; el sitio va aparte a Firebase Hosting)
#
# Pasos (siempre en este orden; si uno falla, se corta):
#   1. Reseñas: `npm run resenas` las lee de la base (solo lectura) → web/sitio/data/resenas.json
#   2. Construir el sitio con las variables de cada destino
#   3. Pruebas del sitio (npm test; en sv, probar-sv)
#   4. Prueba: copiar web/sitio/dist a cloud/app/sitio-prueba. Produccion: BORRAR cloud/app/sitio-prueba
#   5. Sellar (bateria de la nube) y publicar con gcloud
# La PRIMERA publicacion de cada servicio va con el comando completo del guion (cuenta, variables y secretos);
# este script solo actualiza el codigo de un servicio que ya existe (mantiene su configuracion).
# Nunca en las ventanas prohibidas del guion (lun 26 7:00-10:00; jue 29 y mie 5-nov 7:30-10:30).
set -euo pipefail
DESTINO="${1:-}"
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
SITIO="$RAIZ/web/sitio"; APP="$RAIZ/cloud/app"
export CLOUDSDK_PYTHON="${CLOUDSDK_PYTHON:-/Library/Frameworks/Python.framework/Versions/3.14/bin/python3}"
GCLOUD="${GCLOUD:-$HOME/google-cloud-sdk/bin/gcloud}"
case "$DESTINO" in
  prueba)     SERVICIO=rosanta-web-ensayo;    VARS="PUBLIC_PRUEBA=si PUBLIC_API_BASE=/api/reservas" ;;
  sv)         SERVICIO=rosanta-web-sv-ensayo; VARS="PUBLIC_PRUEBA=si PUBLIC_API_BASE=/api/reservas PUBLIC_SEGUNDA_VUELTA=si PUBLIC_LISTA_ESPERA=si" ;;
  v3)         SERVICIO=rosanta-web-v3-ensayo; VARS="PUBLIC_PRUEBA=si PUBLIC_API_BASE=/api/reservas PUBLIC_V3=si" ;;
  produccion) SERVICIO=rosanta-web;           VARS="" ;;
  *) echo "Uso: $0 prueba|sv|v3|produccion"; exit 1 ;;
esac
cd "$SITIO"
echo "1/5 reseñas"; npm run resenas   # cambia data/resenas.json: hacer commit despues de publicar (si no, frena el merge de otras ramas)
# Las pruebas del sitio van sobre la construccion normal (la de produccion: con medicion); la de prueba se construye despues.
echo "2/5 pruebas del sitio (construccion normal)"; npm run build && npm test
if [ "$DESTINO" = "sv" ]; then npm run probar-sv; fi
echo "3/5 construir para $DESTINO ($VARS)"; env $VARS npm run build
if [ "$DESTINO" = "v3" ]; then npm run test:v3; fi
if [ "$DESTINO" = "produccion" ]; then
  rm -rf "$APP/sitio-prueba"
  echo "4/5 produccion: el sitio (web/sitio/dist) se publica en Firebase Hosting aparte (guion del 30-oct)"
else
  rm -rf "$APP/sitio-prueba"; cp -R "$SITIO/dist" "$APP/sitio-prueba"; echo "4/5 sitio copiado a cloud/app/sitio-prueba"
fi
echo "5/5 sellar y publicar $SERVICIO"
cd "$APP" && python3 ../herramientas/sellar-nube.py --servicio "$SERVICIO"
cd "$RAIZ" && "$GCLOUD" run deploy "$SERVICIO" --source cloud/app --region northamerica-south1 --project=rosanta-apps-script \
  --set-build-env-vars GOOGLE_ENTRYPOINT="node src/server-web.js"
