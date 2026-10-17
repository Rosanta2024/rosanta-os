# Proyectos chicos: funciones de un solo uso (17-oct-2026, sesión C)

Aprobado por Juanma el 17-oct ("archívalos"). El código sacado está en un `.js` por proyecto. Ninguna la llama otro código ni un activador (verificado con grep).

| Proyecto | Función | Por qué |
|---|---|---|
| consola-de-respuestas-rosanta | `include` | Ningún HTML la usa |
| consola-de-respuestas-rosanta | `autorizarDrive` | "Correr UNA vez" para autorizar Drive: ya corrida |
| panel-de-reseas-de-google | `instalarTriggers` | De una vez. Ojo: **borraba TODOS los activadores** del proyecto antes de crear los suyos |
| panel-de-reseas-de-google | `imprimirIds` | De una vez: mostraba ACCOUNT_ID y LOCATION_ID, ya guardados en Propiedades |
| rosanta-encuesta | `pruebaInsertar` | Insertaba una fila de ejemplo en la hoja REAL de la encuesta |
| rosanta-maestro | `_revisar` | Diagnóstico; su mensaje remitía a `revisar()` y `revisarUltimaSemana()`, que ya no existen |
| rosanta-maestro | `instalarCargaAutomatica` | La versión sin ventana; la vigente es `instalarCargaAutomaticaAcotada` |
| (de `_informes/`) | `2026-09-23_p187_arreglar_precios_bot.js` | Código suelto de un solo uso, ya corrido |
