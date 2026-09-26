# Harness de la intranet en Node

Corre el CODIGO REAL de `apps-script/rosanta-intranet` en Node, con mocks minimos de
Apps Script (SpreadsheetApp, CacheService, PropertiesService, Utilities, Session,
LockService), sobre el espejo del maestro. Nacio el 25-sep-2026 para probar el tablero
global sin `clasp` (la autorizacion estaba vencida y solo Juanma puede renovarla).

1. `python3 dump_datos.py` (escribe `maestro.json` desde el espejo de Drive).
2. `inventarios.json`: exportar las dos hojas de inventario (o pegar el JSON a mano).
3. `CINCO_JSON=<ruta a cinco.json del generador> node harness.js`

Lo que imprime: los campos nuevos del motor mes a mes contra el Python, el estado de
cierre de inventarios, las altas del CRM (sinteticas), los parametros, los seis
pilares del tablero, la guarda de dueño y las pruebas nuevas del grupo 8.

No escribe nada: cualquier setValue tira. La planilla no esta (Sheet externo), asi que
la nomina sale del respaldo en codigo, igual que en `generar_finanzas.py`.
