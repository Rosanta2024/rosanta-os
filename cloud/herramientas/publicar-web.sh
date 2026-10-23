#!/bin/bash
# Publica rosanta-web (o una version de prueba) con el sitio al dia. 23-oct-2026.
#
#   cloud/herramientas/publicar-web.sh prueba   rosanta-web-ensayo     (base rosanta_ensayo; sitio servido por el servicio)
#   cloud/herramientas/publicar-web.sh sv       rosanta-web-sv-ensayo  (prueba de la segunda vuelta; PUBLIC_SEGUNDA_VUELTA=si)
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
  produccion) SERVICIO=rosanta-web;           VARS="" ;;
  *) echo "Uso: $0 prueba|sv|produccion"; exit 1 ;;
esac
cd "$SITIO"
echo "1/5 reseñas"; npm run resenas
echo "2/5 construir ($VARS)"; env $VARS npm run build
echo "3/5 pruebas del sitio"
if [ "$DESTINO" = "sv" ]; then npm run probar-sv; env $VARS npm run build; else npm test; fi
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
