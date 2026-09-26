#!/usr/bin/env python3
"""
Corrige el campo `cwd` de las tareas programadas de Claude Code.

POR QUE HACE FALTA: el cwd de una tarea se hereda de la sesion que la creo y queda
congelado; ni create_scheduled_task ni update_scheduled_task lo exponen. Las tareas se
crearon el 23-sep-2026 desde `Projects/Rosanta 03 Finanzas`, que dejo de ser la carpeta
buena con el renombrado de S39. Efecto: cada corrida escribe sus memorias en un balde
huerfano (~/.claude/projects/<cwd con guiones>/memory) que ningun proyecto lee.

CORRER CON LA APP DE CLAUDE CERRADA. Si esta abierta, la app puede reescribir el archivo
desde su copia en memoria y pisar este cambio.

    python3 ~/Dev/Rosanta/tools/arreglar-cwd-routines/arreglar_cwd.py          # simulacion
    python3 ~/Dev/Rosanta/tools/arreglar-cwd-routines/arreglar_cwd.py --aplicar
"""
import json, os, shutil, sys, datetime, glob

APLICAR = "--aplicar" in sys.argv
P = "/Users/juanmalemus/Documents/Claude/Projects"

DESTINO = {
    "morning-brief-juanma":               f"{P}/03_Finance_Data_OS",
    "rosanta-cierre-semanal":             f"{P}/03_Finance_Data_OS",
    "rosanta-reporte-semanal":            f"{P}/03_Finance_Data_OS",
    "rosanta-reporte-mensual":            f"{P}/03_Finance_Data_OS",
    "rosanta-cerebro-mantenimiento":      f"{P}/02_Management_OS",
    "rosanta-latido-repo":                f"{P}/02_Management_OS",
    "auditoria-meta-ads-rosanta-mensual": f"{P}/05_Marketing_OS/Workspace_Pauta",
    "rosanta-latido-reservas-web":        f"{P}/05_Marketing_OS/Workspace_Pauta",
    "rosanta-seguimiento-offsite":        f"{P}/05_Marketing_OS/Workspace_Pauta",
}

patron = ("/Users/juanmalemus/Library/Application Support/Claude/"
          "claude-code-sessions/*/*/scheduled-tasks.json")
archivos = glob.glob(patron)
if not archivos:
    sys.exit("No encontre ningun scheduled-tasks.json en:\n  " + patron)

for f in archivos:
    if os.path.getsize(f) < 1000:
        print(f"(salto, parece legado) {f}"); continue
    print(f"\n=== {f}")
    d = json.load(open(f))
    tareas = d if isinstance(d, list) else (d.get("tasks") or list(d.values())[0])
    items = tareas if isinstance(tareas, list) else list(tareas.values())

    cambios = 0
    for x in items:
        if not isinstance(x, dict): continue
        tid = x.get("id") or x.get("taskId")
        if tid not in DESTINO: 
            print(f"  --  {tid:<36} sin regla, se deja en {x.get('cwd')}")
            continue
        viejo, nuevo = x.get("cwd"), DESTINO[tid]
        if viejo == nuevo:
            print(f"  ok  {tid:<36} ya estaba bien")
        elif not os.path.isdir(nuevo):
            print(f"  !!  {tid:<36} DESTINO NO EXISTE: {nuevo}  (no se toca)")
        else:
            print(f"  ->  {tid:<36} {viejo}\n      {'':<36} => {nuevo}")
            if APLICAR: x["cwd"] = nuevo
            cambios += 1

    if not APLICAR:
        print(f"\n  SIMULACION: {cambios} cambio(s). Volvé a correrlo con --aplicar.")
        continue
    if not cambios:
        print("\n  Nada que cambiar."); continue

    sello = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    resp = f"{f}.respaldo-{sello}"
    shutil.copy2(f, resp)
    tmp = f + ".tmp"
    with open(tmp, "w") as fh: json.dump(d, fh, indent=2, ensure_ascii=False)
    json.load(open(tmp))                      # no reemplazar con un JSON invalido
    os.replace(tmp, f)
    print(f"\n  APLICADO: {cambios} cambio(s).")
    print(f"  Respaldo: {resp}")

print("\nListo. Abrí la app y comprobá que las tareas siguen en su lugar y con su horario.")
