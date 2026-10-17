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
