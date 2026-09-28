# scripts/maestro-finanzas

Herramientas de un solo uso sobre el espejo del maestro (`Rosanta_Maestro_ESPEJO.xlsx`).
Ninguna alimenta una pantalla: los números del pilar de Finanzas viven en la intranet
(`FinanzasDatos.js`), que lee el Sheet nativo en vivo.

- `extraer_proveedores.py`: maestro de proveedores con código interno (p161).
- `medir_doble_conteo.py`: medición del doble conteo FEL contra pagos (14-sep-2026).
- `p96_2026-09-15/`: puente de CMV real contra teórico.

## El cotejo A/B se retiró el 27-sep-2026

`generar_finanzas.py` repetía en Python el cálculo de la intranet para compararlos.
Juanma decidió retirarlo: era un segundo motor, cada regla nueva había que programarla
dos veces y casi nunca se corría completo. La comprobación de los números queda en la
batería de la intranet (`?page=pruebas`). El script, `rutas.py` y el README viejo con la
última referencia medida (23-sep) están en `_archivo/2026-09-27_cotejo_AB_retirado/`.
No revivirlo sin una decisión nueva.
