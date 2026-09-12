#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Conversor de punteros de Google a archivos reales — Rosanta OS

Un `.gdoc` / `.gsheet` / `.gslides` no es un archivo: es un JSON de ~180 bytes
con el ID del documento en Google. Cowork y Claude no lo pueden leer.

Esta herramienta exporta el documento real **al lado del puntero**, con el
nombre `AAAA-MM-DD_<nombre original>.docx` (la fecha es la de la conversión).
**Nunca borra el puntero.**

Uso:
    # un puntero
    python3 convertir.py "ruta/al/Documento.gdoc"

    # una carpeta entera (no recursivo)
    python3 convertir.py "ruta/a/la/carpeta"

    # una carpeta y todo lo que cuelga de ella
    python3 convertir.py --recursivo "ruta/a/la/carpeta"

    # ver qué haría, sin escribir nada
    python3 convertir.py --seco "ruta/a/la/carpeta"

    # solo cierto tipo
    python3 convertir.py --solo gdoc --recursivo "Rosanta OS/02_Management_OS"

La primera vez pide autorizar en el navegador (scope `drive.readonly`, solo
lectura). El token queda en `~/.rosanta-drive-token.json` y se renueva solo.
"""

import argparse
import datetime as dt
import http.server
import json
import os
import secrets
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
import webbrowser

HOME = os.path.expanduser("~")
CLIENT_FILE = os.path.join(HOME, "Dev", "Rosanta", "clasp-creds.json")
TOKEN_FILE = os.path.join(HOME, ".rosanta-drive-token.json")
SCOPE = "https://www.googleapis.com/auth/drive.readonly"

EXPORT = {
    ".gdoc": ("application/vnd.openxmlformats-officedocument"
              ".wordprocessingml.document", ".docx"),
    ".gsheet": ("application/vnd.openxmlformats-officedocument"
                ".spreadsheetml.sheet", ".xlsx"),
    ".gslides": ("application/vnd.openxmlformats-officedocument"
                 ".presentationml.presentation", ".pptx"),
    # .gform no tiene export a Office: Drive devuelve 403. Se salta a propósito.
}

LOG = []


def log(linea):
    print(linea)
    LOG.append(linea)


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------

def cliente():
    if not os.path.exists(CLIENT_FILE):
        sys.exit("No encuentro %s (client_id/client_secret de OAuth)."
                 % CLIENT_FILE)
    d = json.load(open(CLIENT_FILE))
    c = d.get("installed") or d.get("web")
    if not c:
        sys.exit("%s no tiene bloque `installed` ni `web`." % CLIENT_FILE)
    return c["client_id"], c["client_secret"]


def _post_token(campos):
    body = urllib.parse.urlencode(campos).encode()
    req = urllib.request.Request("https://oauth2.googleapis.com/token", data=body)
    try:
        return json.load(urllib.request.urlopen(req, timeout=30))
    except urllib.error.HTTPError as e:
        sys.exit("Error de OAuth %s: %s" % (e.code, e.read().decode()[:400]))


def autorizar():
    """Flujo de consentimiento por loopback. Una sola vez."""
    cid, csec = cliente()
    estado = secrets.token_urlsafe(16)
    codigo = {}

    class H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            if q.get("state", [None])[0] == estado and "code" in q:
                codigo["v"] = q["code"][0]
                cuerpo = b"Listo. Ya podes cerrar esta pestania y volver a la terminal."
            else:
                cuerpo = b"Fallo la autorizacion. Volve a la terminal."
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(cuerpo)

        def log_message(self, *a):
            pass

    srv = http.server.HTTPServer(("127.0.0.1", 0), H)
    redirect = "http://127.0.0.1:%d/" % srv.server_address[1]
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id": cid, "redirect_uri": redirect, "response_type": "code",
        "scope": SCOPE, "state": estado, "access_type": "offline",
        "prompt": "consent",
    })
    print("\nAbriendo el navegador para autorizar la lectura de Drive.")
    print("Entra con restaurante@rosanta.rest.")
    print("Si no se abre solo, pega esta URL:\n\n%s\n" % url)
    threading.Thread(target=srv.handle_request, daemon=False).start()
    try:
        webbrowser.open(url)
    except Exception:
        pass
    srv.socket.settimeout(300)
    while not codigo:
        import time
        time.sleep(0.3)

    tok = _post_token({"client_id": cid, "client_secret": csec,
                       "code": codigo["v"], "grant_type": "authorization_code",
                       "redirect_uri": redirect})
    tok["client_id"], tok["client_secret"] = cid, csec
    with open(TOKEN_FILE, "w") as fh:
        json.dump(tok, fh)
    os.chmod(TOKEN_FILE, 0o600)
    print("Autorización guardada en %s" % TOKEN_FILE)
    return tok["access_token"]


def access_token():
    if not os.path.exists(TOKEN_FILE):
        return autorizar()
    tok = json.load(open(TOKEN_FILE))
    if not tok.get("refresh_token"):
        return autorizar()
    nuevo = _post_token({"client_id": tok["client_id"],
                         "client_secret": tok["client_secret"],
                         "refresh_token": tok["refresh_token"],
                         "grant_type": "refresh_token"})
    return nuevo["access_token"]


# --------------------------------------------------------------------------
# Conversión
# --------------------------------------------------------------------------

def leer_puntero(path):
    try:
        d = json.load(open(path, encoding="utf-8"))
    except (ValueError, OSError) as e:
        return None, "no es un puntero legible (%s)" % e
    doc_id = d.get("doc_id")
    if not doc_id:
        return None, "el JSON no trae doc_id"
    return doc_id, None


def exportar(doc_id, mime, token):
    url = ("https://www.googleapis.com/drive/v3/files/%s/export?%s"
           % (doc_id, urllib.parse.urlencode({"mimeType": mime})))
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
    try:
        return urllib.request.urlopen(req, timeout=120).read(), None
    except urllib.error.HTTPError as e:
        cuerpo = e.read().decode("utf-8", "replace")
        if e.code == 403 and "exportSizeLimitExceeded" in cuerpo:
            return None, "pasa el límite de export de Drive (~10 MB)"
        if e.code == 403:
            return None, "403 sin permiso — revisar el scope: %s" % cuerpo[:160]
        if e.code == 404:
            return None, "404 el documento ya no existe o cambió de dueño"
        return None, "HTTP %s: %s" % (e.code, cuerpo[:160])
    except Exception as e:  # red, timeout
        return None, "fallo de red: %s" % e


def destino_para(puntero, ext_destino, fecha):
    carpeta = os.path.dirname(puntero)
    base = os.path.splitext(os.path.basename(puntero))[0].strip()
    return os.path.join(carpeta, "%s_%s%s" % (fecha, base, ext_destino))


def recolectar(entradas, recursivo, solo):
    punteros = []
    for e in entradas:
        if os.path.isfile(e):
            punteros.append(e)
            continue
        if not os.path.isdir(e):
            log("SALTA   %s — no existe" % e)
            continue
        if recursivo:
            for dp, dn, fn in os.walk(e, followlinks=False):
                dn[:] = [d for d in dn if not d.startswith(".tmp.drive")]
                punteros += [os.path.join(dp, n) for n in fn]
        else:
            punteros += [os.path.join(e, n) for n in sorted(os.listdir(e))]
    filtrados = []
    for p in punteros:
        ext = os.path.splitext(p)[1].lower()
        if ext not in EXPORT:
            continue
        if solo and ext.lstrip(".") not in solo:
            continue
        filtrados.append(p)
    return sorted(set(filtrados))


def main():
    ap = argparse.ArgumentParser(
        description="Convierte punteros de Google (.gdoc/.gsheet/.gslides) "
                    "en archivos reales, al lado del puntero.")
    ap.add_argument("entradas", nargs="+", help="punteros o carpetas")
    ap.add_argument("--recursivo", action="store_true")
    ap.add_argument("--seco", action="store_true",
                    help="imprime qué haría, sin escribir nada")
    ap.add_argument("--solo", default=None,
                    help="tipos a convertir, separados por coma: gdoc,gsheet,gslides")
    ap.add_argument("--rehacer", action="store_true",
                    help="reconvierte aunque ya exista el archivo de hoy")
    ap.add_argument("--log", default=None, help="ruta del log (default: al lado)")
    args = ap.parse_args()

    solo = set(x.strip().lstrip(".") for x in args.solo.split(",")) if args.solo else None
    fecha = dt.date.today().isoformat()
    punteros = recolectar(args.entradas, args.recursivo, solo)

    if not punteros:
        sys.exit("No encontré punteros convertibles en lo que me pasaste.")

    log("Conversor de punteros — %s" % fecha)
    log("%d punteros a convertir" % len(punteros))
    log("")

    if args.seco:
        for p in punteros:
            ext = os.path.splitext(p)[1].lower()
            _, ext_dest = EXPORT[ext]
            log("HARÍA   %s\n   ->   %s" % (p, destino_para(p, ext_dest, fecha)))
        log("")
        log("Corrida en seco: no se escribió nada.")
        return

    token = access_token()
    ok = fallo = saltado = 0

    for p in punteros:
        ext = os.path.splitext(p)[1].lower()
        mime, ext_dest = EXPORT[ext]
        destino = destino_para(p, ext_dest, fecha)
        nombre = os.path.basename(p)

        if os.path.exists(destino) and not args.rehacer:
            log("SALTA   %s — ya existe %s" % (nombre, os.path.basename(destino)))
            saltado += 1
            continue

        doc_id, err = leer_puntero(p)
        if err:
            log("FALLO   %s — %s" % (nombre, err))
            fallo += 1
            continue

        datos, err = exportar(doc_id, mime, token)
        if err:
            log("FALLO   %s — %s" % (nombre, err))
            fallo += 1
            continue

        tmp = destino + ".parcial"
        with open(tmp, "wb") as fh:
            fh.write(datos)
        os.replace(tmp, destino)
        log("OK      %s — %s (%d bytes)"
            % (nombre, os.path.basename(destino), len(datos)))
        ok += 1

    log("")
    log("%d convertidos · %d saltados · %d fallidos" % (ok, saltado, fallo))
    log("Los punteros originales quedaron intactos.")

    destino_log = args.log or os.path.join(
        os.path.dirname(os.path.abspath(punteros[0])),
        "%s_Conversion_punteros.log" % fecha)
    try:
        with open(destino_log, "a", encoding="utf-8") as fh:
            fh.write("\n".join(LOG) + "\n")
        print("\nLog: %s" % destino_log)
    except OSError as e:
        print("\nNo pude escribir el log (%s)" % e)

    sys.exit(1 if fallo else 0)


if __name__ == "__main__":
    main()
