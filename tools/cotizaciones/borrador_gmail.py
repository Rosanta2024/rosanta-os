#!/usr/bin/python3
# -*- coding: utf-8 -*-
"""
Rosanta · Borrador de Gmail con la cotización adjunta (22-oct-2026).

Por qué existe: el conector de Gmail de Claude (create_draft) pide el adjunto en base64
DENTRO de la llamada. Un PDF de 2.9 MB son ~3.9 MB de texto y Claude no puede escribirlo,
así que los borradores salían sin PDF y Juanma lo adjuntaba a mano. Este script lee el PDF
del disco (o de Drive) y crea el borrador directo con la API de Gmail: el PDF nunca pasa
por el chat.

SOLO CREA O ACTUALIZA BORRADORES. No envía nada: no hay ninguna llamada a "send" en este
archivo y no se debe agregar. El correo lo envía Juanma desde Gmail.

Uso (normalmente vía cot.sh):
  borrador_gmail.py <thread_id|nuevo> <pdf|drive:FILE_ID> <texto.txt|texto.html>
                    [--para correo] [--cc correo ...] [--asunto "..."]
                    [--actualizar DRAFT_ID] [--ensayo]

- thread_id: el hilo del cliente. El borrador va como respuesta al último correo del
  cliente en ese hilo (In-Reply-To/References), "Para" = quien escribió (Reply-To o From)
  y asunto "Re: ...". "nuevo" = correo nuevo fuera de hilo (exige --para y --asunto).
- pdf: ruta local (Drive para escritorio sirve: ~/My Drive/...) o drive:<id de archivo>.
- texto: SOLO el cuerpo del correo, en UTF-8. .html = correo con formato; si no, texto plano.
- --actualizar: reemplaza el contenido de un borrador que ya existe (por ejemplo, el que
  se creó antes sin PDF), en vez de crear otro.
- --ensayo: muestra lo que haría, sin tocar Gmail.

Revisión de marca: si el PDF es una cotización o propuesta (cotiz|quote|propuesta en el
nombre), exige el sello vigente ~/.rosanta-revisiones/<pdf>.ok (lo crea el flujo del
revisor-marca; este script nunca lo crea). Excepción: borradores dirigidos solo a
restaurante@rosanta.rest (pruebas internas).

Credenciales: secreto gmail-restaurante-oauth (Secret Manager, proyecto rosanta-apps-script;
cliente OAuth "Rosanta nube escritorio", permisos gmail.modify + drive.readonly). Se lee con
gcloud como restaurante@ y no se guarda en disco.

Salida: una línea JSON {"ok":true, "draftId", "messageId", "threadId", "para", "cc",
"asunto", "adjunto", "kb", "verificado", "url", ...} o {"ok":false,"error":...}.
"""
import argparse
import base64
import json
import mimetypes
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from email.message import EmailMessage
from email.utils import getaddresses

CUENTA = "restaurante@rosanta.rest"
PROYECTO = "rosanta-apps-script"
SECRETO = "gmail-restaurante-oauth"
GCLOUD = os.environ.get("GCLOUD") or os.path.expanduser("~/google-cloud-sdk/bin/gcloud")
SELLOS = os.path.expanduser("~/.rosanta-revisiones")
API = "https://gmail.googleapis.com/gmail/v1/users/me"
UPLOAD = "https://gmail.googleapis.com/upload/gmail/v1/users/me"
MAX_BYTES = 24 * 1024 * 1024   # Gmail acepta 25 MB por correo, con margen


class Falla(Exception):
    pass


def salir(obj, codigo=0):
    print(json.dumps(obj, ensure_ascii=False))
    sys.exit(codigo)


# ------------------------------------------------------------------ credenciales
def token_de_acceso():
    try:
        raw = subprocess.run(
            [GCLOUD, "secrets", "versions", "access", "latest", "--secret", SECRETO,
             "--project", PROYECTO], capture_output=True, text=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError) as e:
        raise Falla("no se pudo leer el secreto %s con gcloud (%s)" % (SECRETO, e))
    cred = json.loads(raw)
    datos = urllib.parse.urlencode({
        "client_id": cred["client_id"], "client_secret": cred["client_secret"],
        "refresh_token": cred["refresh_token"], "grant_type": "refresh_token",
    }).encode()
    try:
        r = json.load(urllib.request.urlopen("https://oauth2.googleapis.com/token", datos))
    except urllib.error.HTTPError as e:
        raise Falla("Google no renovó el acceso (%s): %s" % (e.code, e.read().decode()[:300]))
    permisos = r.get("scope", "")
    if not re.search(r"gmail\.(modify|compose)|mail\.google\.com", permisos):
        raise Falla("el permiso de Gmail no alcanza para borradores: " + permisos)
    return r["access_token"]


def pedir(token, metodo, url, cuerpo=None, tipo="application/json"):
    req = urllib.request.Request(url, data=cuerpo, method=metodo)
    req.add_header("Authorization", "Bearer " + token)
    if cuerpo is not None:
        req.add_header("Content-Type", tipo)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            dat = resp.read()
            return json.loads(dat) if dat else {}
    except urllib.error.HTTPError as e:
        raise Falla("Gmail/Drive respondió %s en %s: %s"
                    % (e.code, url.split("?")[0], e.read().decode()[:400]))


# ------------------------------------------------------------------ piezas
def leer_pdf(token, origen):
    if origen.startswith("drive:"):
        fid = origen[6:]
        meta = pedir(token, "GET", "https://www.googleapis.com/drive/v3/files/%s?fields=name,"
                     "size,mimeType&supportsAllDrives=true" % urllib.parse.quote(fid))
        req = urllib.request.Request("https://www.googleapis.com/drive/v3/files/%s?alt=media"
                                     "&supportsAllDrives=true" % urllib.parse.quote(fid))
        req.add_header("Authorization", "Bearer " + token)
        with urllib.request.urlopen(req, timeout=120) as resp:
            return meta["name"], resp.read(), None
    ruta = os.path.abspath(os.path.expanduser(origen))
    if not os.path.isfile(ruta):
        raise Falla("no existe el PDF: " + ruta)
    with open(ruta, "rb") as f:
        return os.path.basename(ruta), f.read(), ruta


def revisar_sello(nombre, ruta_local, destinatarios):
    """Mismo criterio que ~/.claude/hooks/revisor-cotizaciones.py."""
    if not re.search(r"(cotiz|quote|propuesta).*\.pdf$", nombre, re.I):
        return "no aplica"
    if destinatarios and all(d.lower() == CUENTA for d in destinatarios):
        return "no hace falta (solo a %s)" % CUENTA
    sello = os.path.join(SELLOS, nombre + ".ok")
    if not os.path.exists(sello):
        raise Falla("%s no tiene sello de revisor-marca (%s). Primero el revisor; solo con "
                    "veredicto SALE existe el sello." % (nombre, sello))
    if ruta_local and os.path.getmtime(sello) < os.path.getmtime(ruta_local):
        raise Falla("el sello de %s es más viejo que el PDF: el PDF cambió después de la "
                    "revisión. Volver a pasarlo por el revisor-marca." % nombre)
    return "vigente"


def encabezados(msg):
    return {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}


def datos_del_hilo(token, thread_id):
    hilo = pedir(token, "GET", "%s/threads/%s?format=metadata&metadataHeaders=From&"
                 "metadataHeaders=Reply-To&metadataHeaders=Subject&metadataHeaders=Message-ID"
                 "&metadataHeaders=References&metadataHeaders=To&metadataHeaders=Cc"
                 % (API, urllib.parse.quote(thread_id)))
    mensajes = [m for m in hilo.get("messages", []) if "DRAFT" not in m.get("labelIds", [])]
    if not mensajes:
        raise Falla("el hilo %s no tiene correos (solo borradores o no existe)" % thread_id)
    borradores = [m["id"] for m in hilo.get("messages", []) if "DRAFT" in m.get("labelIds", [])]
    # Se contesta al último correo que NO mandó Rosanta; si todos son de Rosanta (p.ej. un
    # seguimiento), al último del hilo, dirigido a sus destinatarios.
    externos = [m for m in mensajes
                if CUENTA not in encabezados(m).get("from", "").lower()]
    base = (externos or mensajes)[-1]
    h = encabezados(base)
    if externos:
        para = [a for _, a in getaddresses([h.get("reply-to") or h.get("from", "")]) if a]
    else:
        para = [a for _, a in getaddresses([h.get("to", "")]) if a]
    return {"base_id": base["id"], "message_id": h.get("message-id", ""),
            "references": h.get("references", ""), "asunto": h.get("subject", ""),
            "para": para, "borradores_en_hilo": borradores}


def armar_mensaje(para, cc, asunto, cuerpo, es_html, nombre_pdf, pdf, in_reply_to, refs):
    m = EmailMessage()
    m["From"] = CUENTA
    m["To"] = ", ".join(para)
    if cc:
        m["Cc"] = ", ".join(cc)
    m["Subject"] = asunto
    if in_reply_to:
        m["In-Reply-To"] = in_reply_to
        m["References"] = (refs + " " + in_reply_to).strip()
    if es_html:
        texto = re.sub(r"<br\s*/?>|</p>", "\n", cuerpo, flags=re.I)
        m.set_content(re.sub(r"<[^>]+>", "", texto))
        m.add_alternative(cuerpo, subtype="html")
    else:
        m.set_content(cuerpo)
    tipo = mimetypes.guess_type(nombre_pdf)[0] or "application/pdf"
    m.add_attachment(pdf, maintype=tipo.split("/")[0], subtype=tipo.split("/")[1],
                     filename=nombre_pdf)
    return m.as_bytes()


def subir_borrador(token, crudo, thread_id, draft_id=None):
    meta = {"message": {}}
    if thread_id:
        meta["message"]["threadId"] = thread_id
    if draft_id:
        meta["id"] = draft_id
    limite = "rosanta" + uuid.uuid4().hex
    cuerpo = (("--%s\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n%s\r\n"
               "--%s\r\nContent-Type: message/rfc822\r\n\r\n")
              % (limite, json.dumps(meta), limite)).encode() + crudo + \
        ("\r\n--%s--\r\n" % limite).encode()
    if draft_id:
        url = "%s/drafts/%s?uploadType=multipart" % (UPLOAD, urllib.parse.quote(draft_id))
        metodo = "PUT"
    else:
        url = "%s/drafts?uploadType=multipart" % UPLOAD
        metodo = "POST"
    return pedir(token, metodo, url, cuerpo, "multipart/related; boundary=" + limite)


def verificar(token, draft_id, nombre_pdf):
    d = pedir(token, "GET", "%s/drafts/%s?format=full" % (API, urllib.parse.quote(draft_id)))
    partes, pila = [], [d["message"].get("payload", {})]
    while pila:
        p = pila.pop()
        pila.extend(p.get("parts", []) or [])
        if p.get("filename"):
            partes.append((p["filename"], p.get("body", {}).get("size", 0)))
    ok = any(f == nombre_pdf and s > 0 for f, s in partes)
    return d, ok, partes


def url_borrador(thread_id, draft_id):
    """Mismo formato de enlace que usa el conector de Gmail (abre el borrador en su hilo)."""
    if thread_id:
        return ("https://mail.google.com/mail/?authuser=%s#all?compose=thread-f:%d%%2Bmsg-a:%s"
                % (CUENTA, int(thread_id, 16), draft_id))
    return "https://mail.google.com/mail/?authuser=%s#drafts" % CUENTA


# ------------------------------------------------------------------ principal
def main():
    ap = argparse.ArgumentParser(description="Borrador de Gmail con PDF adjunto (no envía).")
    ap.add_argument("hilo", help="threadId del cliente, o 'nuevo'")
    ap.add_argument("pdf", help="ruta del PDF o drive:<fileId>")
    ap.add_argument("texto", help="archivo con el cuerpo del correo (.txt o .html)")
    ap.add_argument("--para", action="append", default=[])
    ap.add_argument("--cc", action="append", default=[])
    ap.add_argument("--asunto")
    ap.add_argument("--actualizar", metavar="DRAFT_ID")
    ap.add_argument("--ensayo", action="store_true")
    a = ap.parse_args()

    with open(os.path.expanduser(a.texto), encoding="utf-8") as f:
        cuerpo = f.read().strip() + "\n"
    if re.match(r"\s*(\*\*)?(para|to|asunto|subject|hilo|adjunto)\s*:", cuerpo, re.I):
        raise Falla("el archivo de texto empieza con un encabezado (Para:/Asunto:/...). "
                    "Debe traer SOLO el cuerpo del correo, desde el saludo.")
    es_html = a.texto.lower().endswith((".html", ".htm"))

    token = token_de_acceso()
    nombre_pdf, pdf, ruta_local = leer_pdf(token, a.pdf)
    if not pdf.startswith(b"%PDF"):
        raise Falla("%s no parece un PDF" % nombre_pdf)
    if len(pdf) > MAX_BYTES:
        raise Falla("%s pesa %.1f MB: Gmail no lo acepta como adjunto"
                    % (nombre_pdf, len(pdf) / 1048576))

    thread_id, in_reply_to, refs, borradores = None, None, "", []
    if a.hilo != "nuevo":
        h = datos_del_hilo(token, a.hilo)
        thread_id, in_reply_to, refs = a.hilo, h["message_id"], h["references"]
        borradores = h["borradores_en_hilo"]
        para = a.para or h["para"]
        asunto = a.asunto or (h["asunto"] if re.match(r"\s*(re|aw|rv)\s*:", h["asunto"], re.I)
                              else "Re: " + h["asunto"])
    else:
        para, asunto = a.para, a.asunto
        if not para or not asunto:
            raise Falla("con 'nuevo' hay que dar --para y --asunto")
    if not para:
        raise Falla("no se encontró a quién va el correo; usar --para")

    if a.actualizar and borradores:
        actual = pedir(token, "GET", "%s/drafts/%s?format=minimal"
                       % (API, urllib.parse.quote(a.actualizar)))["message"]["id"]
        borradores = [b for b in borradores if b != actual]
    sello = revisar_sello(nombre_pdf, ruta_local, para + a.cc)
    crudo = armar_mensaje(para, a.cc, asunto, cuerpo, es_html, nombre_pdf, pdf,
                          in_reply_to, refs)
    resumen = {"para": para, "cc": a.cc, "asunto": asunto, "hilo": thread_id,
               "adjunto": nombre_pdf, "kb": round(len(pdf) / 1024), "sello": sello,
               "otros_borradores_en_el_hilo": borradores}
    if a.ensayo:
        salir(dict(ok=True, ensayo=True, **resumen))

    r = subir_borrador(token, crudo, thread_id, a.actualizar)
    d, ok, partes = verificar(token, r["id"], nombre_pdf)
    mid = d["message"]["id"]
    salir(dict(ok=ok, draftId=r["id"], messageId=mid, threadId=d["message"].get("threadId"),
               verificado="el borrador tiene el PDF adjunto" if ok else
               "OJO: Gmail no muestra el PDF en el borrador: %s" % partes,
               url=url_borrador(d["message"].get("threadId"), r["id"]), **resumen),
          0 if ok else 1)


if __name__ == "__main__":
    try:
        main()
    except Falla as e:
        salir({"ok": False, "error": str(e)}, 1)
    except (urllib.error.URLError, OSError, ValueError, KeyError) as e:
        salir({"ok": False, "error": "%s: %s" % (type(e).__name__, e)}, 1)
