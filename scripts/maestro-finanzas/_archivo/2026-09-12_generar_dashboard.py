#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera el dashboard HTML autocontenido de Rosanta a partir del documento maestro
(Rosanta_Reporte_Maestro_v2_2026.xlsx). Lee la serie semanal cruda (POS + FEL) y la
semana seleccionada en 04_Reporte_Semanal para los KPIs y el P&L de la semana.

Uso:  python3 generar_dashboard.py [ruta_al_espejo] [--datos CARPETA]
Salida: Rosanta_Dashboard.html, en la carpeta Maestro de Drive (ver rutas.py)
"""
import openpyxl, datetime, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rutas

# El codigo vive en ~/Dev/Rosanta; los datos siguen en Drive. Ver rutas.py.
DATOS = rutas.datos()

# Fuente de verdad: el Google Sheet nativo "Rosanta_Reporte_Maestro_v2_2026"
# (id 1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk, carpeta Maestro).
# Un Apps Script en ese Sheet exporta cada lunes el espejo .xlsx que este
# script lee. NO editar el espejo a mano: se sobrescribe en cada corrida.
ESPEJO = os.path.join(DATOS, "Rosanta_Maestro_ESPEJO.xlsx")
LEGACY = os.path.join(DATOS, "Rosanta_Reporte_Maestro_v2_2026.xlsx")

def _resolver_maestro():
    import sys, datetime as _dt
    if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
        return sys.argv[1]
    if os.path.exists(ESPEJO):
        edad = (_dt.datetime.now() - _dt.datetime.fromtimestamp(os.path.getmtime(ESPEJO))).days
        if edad > 9:
            print(f"AVISO: el espejo tiene {edad} dias. Reviso si el Apps Script del Sheet sigue corriendo.")
        return ESPEJO
    if os.path.exists(LEGACY):
        print("AVISO: usando el .xlsx legacy; el espejo del Sheet no existe todavia.")
        return LEGACY
    raise SystemExit("No encuentro el maestro. Esperaba " + ESPEJO)

MAESTRO = _resolver_maestro()
SALIDA  = os.path.join(DATOS, "Rosanta_Dashboard.html")

COGS_CATS = {"ALIMENTOS", "BEBIDAS", "COCTELERIA", "COCTELERÍA"}
# Compras puntuales grandes que NO son gasto operativo recurrente
ONEOFF_CATS = {"ALQUILERES"}
# Etiquetas legibles para el P&L
CAT_LABEL = {
    "ALIMENTOS": "Alimentos (FEL)",
    "ALIMENTOS_EFECTIVO": "Alimentos · mercado (efectivo)",
    "BEBIDAS": "Bebidas",
    "COCTELERIA": "Coctelería",
}
def catlabel(c):
    return CAT_LABEL.get(str(c).upper(), str(c).title())

def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0

def es_personal(v):
    return str(v).strip().lower() in ("sí", "si", "yes", "x", "true")

def monday_of_isoweek(year, week):
    return datetime.date.fromisocalendar(year, week, 1)

def rango_label(year, week):
    lun = monday_of_isoweek(year, week)
    dom = lun + datetime.timedelta(days=6)
    meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"]
    if lun.month == dom.month:
        return f"{lun.day}–{dom.day} {meses[dom.month-1]}"
    return f"{lun.day} {meses[lun.month-1]}–{dom.day} {meses[dom.month-1]}"

def cargar():
    wb = openpyxl.load_workbook(MAESTRO, data_only=True)

    # ---- Serie semanal de VENTAS (POS) — header en fila 4, datos desde fila 5
    ws = wb["02_Ventas_Maestro"]
    sales = {}  # wk -> dict
    year = 2026
    for r in ws.iter_rows(min_row=5, values_only=True):
        wk = r[13]  # Semana_ISO
        if not isinstance(wk, (int, float)):
            continue
        wk = int(wk)
        yr = r[12]
        if isinstance(yr, (int, float)):
            year = int(yr)
        # Excluir anticipos de eventos futuros (ingreso diferido, no venta operativa)
        prod = str(r[11] or "")
        if "anticipo" in prod.lower():
            continue
        d = sales.setdefault(wk, {"ventas":0.0, "comensales":0, "tickets":0, "eventos":0.0, "eventos_n":0})
        # Eventos privados: ingreso adicional, fuera del servicio de restaurante
        if "evento" in prod.lower() or "evento" in str(r[7] or "").lower():
            d["eventos"] += num(r[4])
            d["eventos_n"] += 1
            continue
        d["ventas"] += num(r[4])           # TotalFinal
        # Comensales. Google Sheets exporta los enteros como float (2 -> 2.0),
        # asi que no se puede usar isdigit(): hay que castear.
        try:
            com = r[8]
            if com is not None and str(com).strip() != "":
                v = int(float(str(com).strip().replace(",", "")))
                if v > 0:
                    d["comensales"] += v
        except (TypeError, ValueError):
            pass
        d["tickets"] += 1

    # ---- Serie semanal de COMPRAS (FEL) — header fila 4, datos desde fila 5
    ws = wb["01_FEL_Maestro"]
    fel = {}  # wk -> {"cogs":{cat:Q}, "opex":{cat:Q}, "oneoff":{cat:Q}}
    for r in ws.iter_rows(min_row=5, values_only=True):
        wk = r[12]  # Semana_ISO
        if not isinstance(wk, (int, float)):
            continue
        wk = int(wk)
        if es_personal(r[14]):             # Es_Personal -> se excluye
            continue
        cat = (str(r[13]).strip().upper() if r[13] else "SIN_CATEGORIA")  # Categoría
        monto = num(r[9])                  # Gran_Total
        d = fel.setdefault(wk, {"cogs":{}, "opex":{}, "oneoff":{}})
        if cat in COGS_CATS:
            key = "COCTELERIA" if cat.startswith("COCTEL") else cat
            d["cogs"][key] = d["cogs"].get(key, 0.0) + monto
        elif cat in ONEOFF_CATS:
            d["oneoff"][cat] = d["oneoff"].get(cat, 0.0) + monto
        else:
            d["opex"][cat] = d["opex"].get(cat, 0.0) + monto

    # ---- Compras de mercado en EFECTIVO (Banco Industrial: ALIMENTOS_EFECTIVO)
    # Son retiros ATM/Bancared para comprar al mercado; nunca tienen FEL, por eso
    # no entran en 01_FEL y hay que sumarlos al COGS de alimentos.
    ws = wb["03_Banco_Industrial"]
    bhr = None
    for i, row in enumerate(ws.iter_rows(min_row=1, max_row=8, values_only=True), 1):
        if row and any(isinstance(c, str) and c.strip() == "Categoría" for c in row):
            bhr = i
            break
    if bhr:
        H = [(str(c.value).strip() if c.value else "") for c in ws[bhr]]
        def bi(name):
            for j, h in enumerate(H):
                if h.lower() == name.lower():
                    return j
            return None
        ci, deb, wi, pi = bi("Categoría"), bi("Débito"), bi("Semana"), bi("Es_Personal")
        for r in ws.iter_rows(min_row=bhr + 1, values_only=True):
            cat = r[ci] if ci is not None else None
            if not cat or str(cat).strip().upper() != "ALIMENTOS_EFECTIVO":
                continue
            if pi is not None and es_personal(r[pi]):
                continue
            wk = r[wi] if wi is not None else None
            if not isinstance(wk, (int, float)):
                continue
            wk = int(wk)
            monto = num(r[deb]) if deb is not None else 0.0
            d = fel.setdefault(wk, {"cogs": {}, "opex": {}, "oneoff": {}})
            d["cogs"]["ALIMENTOS_EFECTIVO"] = d["cogs"].get("ALIMENTOS_EFECTIVO", 0.0) + monto

    # ---- Semana seleccionada actual
    sel = wb["04_Reporte_Semanal"]
    sel_year = int(sel["B3"].value or year)
    sel_week = int(sel["D3"].value or max(sales))

    # ---- Construir serie ordenada
    semanas = []
    for wk in sorted(sales):
        s = sales[wk]
        f = fel.get(wk, {"cogs":{}, "opex":{}, "oneoff":{}})
        cogs_total = sum(f["cogs"].values())
        opex_total = sum(f["opex"].values())
        oneoff_total = sum(f["oneoff"].values())
        ventas = s["ventas"]
        com = s["comensales"]
        margen = ventas - cogs_total
        semanas.append({
            "wk": wk,
            "label": f"S{wk}",
            "rango": rango_label(sel_year, wk),
            "ventas": round(ventas, 2),
            "comensales": com,
            "tickets": s["tickets"],
            "ticket_prom": round(ventas/com, 2) if com else 0,
            "cogs": round(cogs_total, 2),
            "cogs_pct": round(cogs_total/ventas*100, 1) if ventas else 0,
            "opex": round(opex_total, 2),
            "oneoff": round(oneoff_total, 2),
            "margen": round(margen, 2),
            "margen_pct": round(margen/ventas*100, 1) if ventas else 0,
            "eventos": round(s.get("eventos", 0.0), 2),
            "eventos_n": s.get("eventos_n", 0),
            "ingreso_total": round(ventas + s.get("eventos", 0.0), 2),
        })

    # ---- Detalle P&L de la semana seleccionada (FEL)
    cur = next((x for x in semanas if x["wk"] == sel_week), semanas[-1])
    fcur = fel.get(sel_week, {"cogs":{}, "opex":{}, "oneoff":{}})
    pl = {
        "cogs": [{"cat":k, "monto":round(v,2)} for k,v in sorted(fcur["cogs"].items(), key=lambda x:-x[1])],
        "opex": [{"cat":k, "monto":round(v,2)} for k,v in sorted(fcur["opex"].items(), key=lambda x:-x[1]) if v>0],
        "oneoff": [{"cat":k, "monto":round(v,2)} for k,v in sorted(fcur["oneoff"].items(), key=lambda x:-x[1]) if v>0],
    }

    # delta vs semana previa con datos
    prev = None
    idx = next((i for i,x in enumerate(semanas) if x["wk"]==sel_week), len(semanas)-1)
    if idx > 0:
        prev = semanas[idx-1]

    return {
        "generado": datetime.datetime.now().strftime("%d/%m/%Y %H:%M"),
        "year": sel_year,
        "sel_week": sel_week,
        "cur": cur,
        "prev": prev,
        "pl": pl,
        "semanas": semanas,
    }

def fmtQ(n):
    return "Q" + format(round(n), ",d")

def delta_html(cur, prev, key, invert=False, pct=False):
    if not prev or not prev.get(key):
        return '<span class="delta neutral">—</span>'
    c, p = cur[key], prev[key]
    if p == 0:
        return '<span class="delta neutral">—</span>'
    ch = (c - p) / abs(p) * 100
    up = ch >= 0
    good = (not up) if invert else up
    cls = "up" if good else "down"
    arrow = "▲" if up else "▼"
    return f'<span class="delta {cls}">{arrow} {abs(ch):.0f}% vs S{prev["wk"]}</span>'

def render(data):
    cur, prev = data["cur"], data["prev"]
    GREEN="#456B50"; CREAM="#F0EDE6"; LILAC="#A89DC8"; INK="#2c2a26"; MUT="#7d7a72"

    # KPIs
    kpis = [
        ("Ventas restaurante", fmtQ(cur["ventas"]), delta_html(cur,prev,"ventas")),
        ("Eventos privados",
         f'{fmtQ(cur.get("eventos",0))} · {cur.get("eventos_n",0)} evento(s)' if cur.get("eventos") else "—",
         delta_html(cur,prev,"eventos")),
        ("Ingreso total", fmtQ(cur.get("ingreso_total", cur["ventas"])), delta_html(cur,prev,"ingreso_total")),
        ("Comensales", str(cur["comensales"]), delta_html(cur,prev,"comensales")),
        ("Ticket promedio", fmtQ(cur["ticket_prom"]), delta_html(cur,prev,"ticket_prom")),
        ("COGS total", f'{fmtQ(cur["cogs"])} · {cur["cogs_pct"]}%', delta_html(cur,prev,"cogs",invert=True)),
        ("Margen contribución", f'{fmtQ(cur["margen"])} · {cur["margen_pct"]}%', delta_html(cur,prev,"margen")),
        ("Tickets cobrados", str(cur["tickets"]), delta_html(cur,prev,"tickets")),
    ]
    kpi_html = "".join(
        f'<div class="kpi"><div class="kpi-label">{l}</div>'
        f'<div class="kpi-value">{v}</div>{d}</div>'
        for l,v,d in kpis
    )

    # P&L tabla
    def pl_rows(items, cls=""):
        out=""
        for it in items:
            pct = it["monto"]/cur["ventas"]*100 if cur["ventas"] else 0
            out += (f'<tr class="{cls}"><td>{catlabel(it["cat"])}</td>'
                    f'<td class="num">{fmtQ(it["monto"])}</td>'
                    f'<td class="num mut">{pct:.1f}%</td></tr>')
        return out
    cogs_total = sum(i["monto"] for i in data["pl"]["cogs"])
    opex_total = sum(i["monto"] for i in data["pl"]["opex"])
    oneoff_total = sum(i["monto"] for i in data["pl"]["oneoff"])

    pl_html = '<table class="pl"><thead><tr><th>Concepto</th><th class="num">Q</th><th class="num">% ventas</th></tr></thead><tbody>'
    pl_html += f'<tr class="sec"><td colspan="3">COGS (FEL)</td></tr>'
    pl_html += pl_rows(data["pl"]["cogs"])
    pl_html += (f'<tr class="tot"><td>Total COGS</td><td class="num">{fmtQ(cogs_total)}</td>'
                f'<td class="num">{cogs_total/cur["ventas"]*100 if cur["ventas"] else 0:.1f}%</td></tr>')
    pl_html += (f'<tr class="hl"><td>Margen de contribución</td><td class="num">{fmtQ(cur["ventas"]-cogs_total)}</td>'
                f'<td class="num">{(cur["ventas"]-cogs_total)/cur["ventas"]*100 if cur["ventas"] else 0:.1f}%</td></tr>')
    if data["pl"]["opex"]:
        pl_html += '<tr class="sec"><td colspan="3">Gastos operativos (FEL)</td></tr>'
        pl_html += pl_rows(data["pl"]["opex"])
        pl_html += (f'<tr class="tot"><td>Total gastos operativos</td><td class="num">{fmtQ(opex_total)}</td>'
                    f'<td class="num">{opex_total/cur["ventas"]*100 if cur["ventas"] else 0:.1f}%</td></tr>')
    if data["pl"]["oneoff"]:
        pl_html += '<tr class="sec"><td colspan="3">Compras puntuales (no recurrentes)</td></tr>'
        pl_html += pl_rows(data["pl"]["oneoff"], cls="oneoff")
        pl_html += (f'<tr class="tot"><td>Total puntuales</td><td class="num">{fmtQ(oneoff_total)}</td>'
                    f'<td class="num">{oneoff_total/cur["ventas"]*100 if cur["ventas"] else 0:.1f}%</td></tr>')
    pl_html += '</tbody></table>'

    labels = [s["label"] for s in data["semanas"]]
    ventas_s = [s["ventas"] for s in data["semanas"]]
    com_s = [s["comensales"] for s in data["semanas"]]
    tp_s = [s["ticket_prom"] for s in data["semanas"]]
    cogs_pct_s = [s["cogs_pct"] for s in data["semanas"]]
    rangos = [s["rango"] for s in data["semanas"]]

    data_json = json.dumps({
        "labels":labels,"ventas":ventas_s,"com":com_s,"tp":tp_s,"cogs_pct":cogs_pct_s,"rangos":rangos
    }, ensure_ascii=False)

    html = f"""<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rosanta · Dashboard semanal</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.js" integrity="sha384-iU8HYtnGQ8Cy4zl7gbNMOhsDTTKX02BTXptVP/vqAWIaTfM7isw76iyZCsjL2eVi" crossorigin="anonymous"></script>
<style>
:root{{ color-scheme: light; --green:{GREEN}; --cream:{CREAM}; --lilac:{LILAC}; --ink:{INK}; --mut:{MUT}; }}
*{{box-sizing:border-box}}
body{{margin:0;background:#faf9f6;color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.45}}
.wrap{{max-width:1000px;margin:0 auto;padding:20px}}
header.top{{background:var(--green);color:#fff;border-radius:14px;padding:20px 24px;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:8px}}
header.top h1{{margin:0;font-family:Georgia,"Times New Roman",serif;font-size:26px;letter-spacing:.5px;font-weight:600}}
header.top .sub{{opacity:.9;font-size:14px;margin-top:4px}}
header.top .wk{{text-align:right}}
header.top .wk .big{{font-size:30px;font-weight:700;font-family:Georgia,serif}}
header.top .wk .small{{font-size:13px;opacity:.9}}
h2.section{{font-family:Georgia,serif;color:var(--green);font-size:18px;margin:26px 0 12px;border-bottom:2px solid var(--cream);padding-bottom:6px}}
.kpis{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}}
.kpi{{background:#fff;border:1px solid #ece9e2;border-radius:12px;padding:14px 16px;box-shadow:0 1px 2px rgba(0,0,0,.03)}}
.kpi-label{{font-size:12px;color:var(--mut);text-transform:uppercase;letter-spacing:.4px}}
.kpi-value{{font-size:24px;font-weight:700;margin:4px 0 2px;font-family:Georgia,serif}}
.delta{{font-size:12px;font-weight:600}}
.delta.up{{color:#2f8f5b}} .delta.down{{color:#c0563f}} .delta.neutral{{color:var(--mut)}}
.grid2{{display:grid;grid-template-columns:1.1fr 1fr;gap:20px;align-items:start}}
@media(max-width:760px){{.grid2{{grid-template-columns:1fr}}}}
.card{{background:#fff;border:1px solid #ece9e2;border-radius:12px;padding:16px}}
table.pl{{width:100%;border-collapse:collapse;font-size:14px}}
table.pl th{{text-align:left;color:var(--mut);font-size:11px;text-transform:uppercase;letter-spacing:.4px;padding:6px 8px;border-bottom:1px solid #eee}}
table.pl td{{padding:6px 8px;border-bottom:1px solid #f3f1ec}}
table.pl td.num{{text-align:right;font-variant-numeric:tabular-nums}}
table.pl td.mut{{color:var(--mut)}}
table.pl tr.sec td{{background:var(--cream);font-weight:700;color:var(--green);font-size:12px;text-transform:uppercase;letter-spacing:.4px}}
table.pl tr.tot td{{font-weight:700;border-top:1px solid #ddd}}
table.pl tr.hl td{{font-weight:700;color:var(--green);background:#f4f7f4}}
table.pl tr.oneoff td:first-child{{color:#9a6b2f}}
.chart-box{{position:relative;height:240px}}
.chart-grid{{display:grid;grid-template-columns:1fr 1fr;gap:18px}}
@media(max-width:760px){{.chart-grid{{grid-template-columns:1fr}}}}
.foot{{color:var(--mut);font-size:12px;margin-top:22px;text-align:center}}
.note{{font-size:12px;color:var(--mut);margin-top:8px}}
.pill{{display:inline-block;background:var(--cream);color:var(--green);border-radius:20px;padding:2px 10px;font-size:12px;font-weight:600}}
</style></head>
<body><div class="wrap">
<header class="top">
  <div>
    <h1>ROSANTA</h1>
    <div class="sub">Dashboard financiero semanal · CORSAGA, S.A.</div>
  </div>
  <div class="wk">
    <div class="big">Semana {data['sel_week']}</div>
    <div class="small">{cur['rango']} {data['year']}</div>
  </div>
</header>

<h2 class="section">KPIs de la semana</h2>
<div class="kpis">{kpi_html}</div>
<div class="note">Variación calculada contra la semana previa con datos. Ventas sin IVA ni propina.</div>

<h2 class="section">Detalle de la semana</h2>
<div class="grid2">
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <strong style="color:var(--green)">P&amp;L de compras (FEL)</strong>
      <span class="pill">% sobre ventas</span>
    </div>
    {pl_html}
    <div class="note">Excluye gastos personales (Es_Personal). Las líneas de banco (nómina, efectivo, comisiones) viven en el reporte completo del contador.</div>
  </div>
  <div class="card">
    <strong style="color:var(--green)">Ventas vs comensales — últimas 12 semanas</strong>
    <div class="chart-box" style="margin-top:10px"><canvas id="cMix"></canvas></div>
  </div>
</div>

<h2 class="section">Tendencia histórica ({labels[0]}–{labels[-1]})</h2>
<div class="chart-grid">
  <div class="card"><strong style="color:var(--green)">Ventas semanales (Q)</strong>
    <div class="chart-box"><canvas id="cVentas"></canvas></div></div>
  <div class="card"><strong style="color:var(--green)">Ticket promedio (Q)</strong>
    <div class="chart-box"><canvas id="cTicket"></canvas></div></div>
  <div class="card"><strong style="color:var(--green)">Comensales por semana</strong>
    <div class="chart-box"><canvas id="cCom"></canvas></div></div>
  <div class="card"><strong style="color:var(--green)">COGS como % de ventas</strong>
    <div class="chart-box"><canvas id="cCogs"></canvas></div></div>
</div>

<div class="foot">Generado automáticamente desde Rosanta_Reporte_Maestro_v2_2026.xlsx · {data['generado']}<br>
Se actualiza cada lunes con la semana cerrada.</div>
</div>

<script>
const D = {data_json};
const GREEN="{GREEN}", LILAC="{LILAC}";
Chart.defaults.font.family="-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
Chart.defaults.color="{MUT}";
const baseOpts={{responsive:true,maintainAspectRatio:false,plugins:{{legend:{{display:false}}}}}};
function tip(extra){{return {{callbacks:{{title:(it)=>"S"+D.labels[it[0].dataIndex].slice(1)+" · "+D.rangos[it[0].dataIndex]}}}}}}

new Chart(document.getElementById('cVentas'),{{type:'bar',
 data:{{labels:D.labels,datasets:[{{data:D.ventas,backgroundColor:GREEN,borderRadius:4}}]}},
 options:{{...baseOpts,plugins:{{legend:{{display:false}},tooltip:tip()}},scales:{{y:{{beginAtZero:true}}}}}}}});

new Chart(document.getElementById('cTicket'),{{type:'line',
 data:{{labels:D.labels,datasets:[{{data:D.tp,borderColor:LILAC,backgroundColor:'rgba(168,157,200,.15)',fill:true,tension:.3,pointRadius:2}}]}},
 options:{{...baseOpts,plugins:{{legend:{{display:false}},tooltip:tip()}}}}}});

new Chart(document.getElementById('cCom'),{{type:'line',
 data:{{labels:D.labels,datasets:[{{data:D.com,borderColor:GREEN,backgroundColor:'rgba(69,107,80,.12)',fill:true,tension:.3,pointRadius:2}}]}},
 options:{{...baseOpts,plugins:{{legend:{{display:false}},tooltip:tip()}}}}}});

new Chart(document.getElementById('cCogs'),{{type:'line',
 data:{{labels:D.labels,datasets:[{{data:D.cogs_pct,borderColor:'#c0563f',backgroundColor:'rgba(192,86,63,.10)',fill:true,tension:.3,pointRadius:2}}]}},
 options:{{...baseOpts,plugins:{{legend:{{display:false}},tooltip:tip()}},scales:{{y:{{ticks:{{callback:v=>v+'%'}}}}}}}}}});

// Mezcla últimas 12 semanas: ventas (barras) + comensales (línea)
const n=Math.min(12,D.labels.length), sl=a=>a.slice(a.length-n);
new Chart(document.getElementById('cMix'),{{
 data:{{labels:sl(D.labels),datasets:[
   {{type:'bar',label:'Ventas Q',data:sl(D.ventas),backgroundColor:GREEN,borderRadius:4,yAxisID:'y'}},
   {{type:'line',label:'Comensales',data:sl(D.com),borderColor:LILAC,backgroundColor:LILAC,tension:.3,pointRadius:3,yAxisID:'y1'}}
 ]}},
 options:{{responsive:true,maintainAspectRatio:false,
   plugins:{{legend:{{display:true,position:'bottom'}}}},
   scales:{{y:{{position:'left',beginAtZero:true,title:{{display:true,text:'Ventas Q'}}}},
            y1:{{position:'right',beginAtZero:true,grid:{{drawOnChartArea:false}},title:{{display:true,text:'Comensales'}}}}}}}}}});
</script>
</body></html>"""
    with open(SALIDA, "w", encoding="utf-8") as f:
        f.write(html)
    # Versión lista para el artefacto vivo (rosanta-dashboard-semanal):
    # incluye el bloque cowork-artifact-meta al inicio. Tras correr el script,
    # SIEMPRE empujar este archivo con update_artifact (id rosanta-dashboard-semanal).
    meta = ('<!DOCTYPE html>\n'
            '<script type="application/json" id="cowork-artifact-meta">\n'
            '{\n'
            '  "name": "Rosanta Dashboard Semanal",\n'
            '  "schemaVersion": 1,\n'
            '  "description": "Dashboard financiero semanal de Rosanta (CORSAGA, S.A.). KPIs, P&L FEL y tendencia historica del maestro. Se regenera cada lunes."\n'
            '}\n'
            '</script>\n')
    artifact_html = html.replace('<!DOCTYPE html>\n', meta, 1)
    artifact_path = os.path.join(DATOS, "Rosanta_Dashboard_ARTIFACT.html")
    with open(artifact_path, "w", encoding="utf-8") as f:
        f.write(artifact_html)
    print("ARTEFACTO listo -> " + artifact_path + "  (empujar con update_artifact id=rosanta-dashboard-semanal)")
    return SALIDA

if __name__ == "__main__":
    data = cargar()
    path = render(data)
    c = data["cur"]
    print(f"OK -> {path}")
    print(f"Semana seleccionada: S{data['sel_week']} ({c['rango']} {data['year']})")
    print(f"Ventas={fmtQ(c['ventas'])} Comensales={c['comensales']} Ticket={fmtQ(c['ticket_prom'])} "
          f"COGS={fmtQ(c['cogs'])} ({c['cogs_pct']}%) Margen={fmtQ(c['margen'])} ({c['margen_pct']}%)")
    print(f"Semanas en serie: {len(data['semanas'])}")
