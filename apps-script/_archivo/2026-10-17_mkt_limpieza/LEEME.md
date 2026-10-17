# Marketing OS: funciones de un solo uso y de prueba (17-oct-2026, sesión C)

Aprobado por Juanma el 17-oct ("archívalos"). Código en `funciones_archivadas.js`. Ninguna la llama otro código ni un activador (verificado con grep).

| Función | Archivo | Por qué |
|---|---|---|
| `normalizarOptInCRM` | CRMSync.js | Decía "UNA VEZ" pero traía `SOLO_SIMULACRO = false`: si alguien la corría, reescribía la columna opt_in del CRM. Ya corrida |
| `probarReserva`, `limpiarPruebaReserva` | CRMSync.js | Escribían y borraban filas `PRUEBA-` en la pestaña `reservas` real |
| `crearPestanaReservas` | CRMSync.js | De una vez: la pestaña ya existe |
| `instalarTriggersCRM` | CRMSync.js | De una vez: los activadores ya existen |
| `instalarTriggerConsumoPendiente` | ConsumoPendiente.js | De una vez: el activador de los lunes 8:00 ya existe |

Se quedan: `ensayoCRM`, `cnProbar`, `previsualizarListaConsumoPendiente` (solo leen).

## Limpieza del CRM (corrida el 17-oct-2026, 14:46)

`ACrmLimpieza17oct.js`: script de una vez, corrido desde el editor con Claude in Chrome (decisión de Juanma: "elimina los duplicados" y "elimínalo" a Gabi). Primero en seco (3,639 filas, 36 de 36 encontradas una sola vez, 0 problemas), después aplicado: **CRM 3,639 → 3,603 filas; 36 filas copiadas enteras a la pestaña `archivo_2026-10-17`** de la misma hoja, con el motivo, la fila que queda y la fecha. A Cat (fila principal) se le anotó en `notas` el otro correo. Ninguna fila se perdió. Ya no está en el proyecto: si se volviera a correr no encontraría las filas y frenaría sin escribir.
