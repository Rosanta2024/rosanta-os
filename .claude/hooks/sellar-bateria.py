#!/usr/bin/env python3
# Escribe el sello de la batería de la intranet (~/.rosanta-sellos/bateria-intranet.json).
# SOLO con el resultado REAL de ?page=pruebas: el conteo que Juanma reporta o que se lee
# en su Chrome. Nunca inventado, nunca "se ve en verde". Ver candado-clasp.py.
#
#   python3 .claude/hooks/sellar-bateria.py --ok 175 --fallas 0 --avisos 1 --saltadas 3 \
#       --fuente "Juanma en el chat, 14-oct" [--hora "2026-10-14 15:30"]
#
# Mirar el conteo, no el color: si el total baja respecto de la última batería registrada,
# se rechaza salvo --acepto-conteo-menor "motivo" (con el motivo que dé Juanma).
import argparse
import json
import os
import sys
from datetime import datetime

SELLOS = os.path.expanduser(os.environ.get("ROSANTA_SELLOS_DIR", "~/.rosanta-sellos"))
SELLO = os.path.join(SELLOS, "bateria-intranet.json")
HISTORIAL = os.path.join(SELLOS, "bateria-intranet-historial.jsonl")

ap = argparse.ArgumentParser(description="Sella la batería de la intranet con su conteo real.")
ap.add_argument("--ok", type=int, required=True)
ap.add_argument("--fallas", type=int, required=True)
ap.add_argument("--avisos", type=int, required=True)
ap.add_argument("--saltadas", type=int, required=True)
ap.add_argument("--fuente", required=True, help="quién reportó el resultado y por dónde")
ap.add_argument("--hora", help="hora en que corrió la batería (AAAA-MM-DD HH:MM). Por defecto, ahora")
ap.add_argument("--acepto-conteo-menor", metavar="MOTIVO")
a = ap.parse_args()

if min(a.ok, a.fallas, a.avisos, a.saltadas) < 0 or a.ok == 0:
    sys.exit("Conteo inválido: OK tiene que ser mayor que 0 y nada negativo.")

hora = datetime.fromisoformat(a.hora) if a.hora else datetime.now()
hora = hora.astimezone() if hora.tzinfo is None else hora
if hora > datetime.now().astimezone():
    sys.exit("La hora de la batería no puede estar en el futuro.")
total = a.ok + a.fallas + a.avisos + a.saltadas

anterior = 0
try:
    with open(HISTORIAL) as f:
        for linea in f:
            try:
                anterior = max(anterior, json.loads(linea).get("total", 0))
            except ValueError:
                pass
except OSError:
    pass
if total < anterior and not a.acepto_conteo_menor:
    sys.exit("Rechazado: la batería revisó %d pruebas y la mayor registrada tenía %d. "
             "Una batería que revisa menos de lo que debía es un fallo. Pregúntale a Juanma por "
             "qué bajó y, si hay motivo, repite con --acepto-conteo-menor \"motivo\"." % (total, anterior))

sello = {
    "fecha_bateria": hora.isoformat(timespec="seconds"),
    "registrado": datetime.now().astimezone().isoformat(timespec="seconds"),
    "ok": a.ok, "fallas": a.fallas, "avisos": a.avisos, "saltadas": a.saltadas, "total": total,
    "fuente": a.fuente,
}
if a.acepto_conteo_menor:
    sello["conteo_menor_motivo"] = a.acepto_conteo_menor

os.makedirs(SELLOS, exist_ok=True)
with open(HISTORIAL, "a") as f:
    f.write(json.dumps(sello, ensure_ascii=False) + "\n")
tmp = SELLO + ".tmp"
with open(tmp, "w") as f:
    json.dump(sello, f, ensure_ascii=False, indent=2)
os.replace(tmp, SELLO)

if a.fallas:
    print("Registrado, pero NO desbloquea: %d falla(s). Con fallas no se publica." % a.fallas)
else:
    print("Sello escrito: %d OK · 0 fallas · %d avisos · %d saltadas (%d pruebas). "
          "Vale hasta el próximo clasp push." % (a.ok, a.avisos, a.saltadas, total))
