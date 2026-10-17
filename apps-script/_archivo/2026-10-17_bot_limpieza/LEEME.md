# Limpieza del bot (17-oct-2026, pedida por Juanma)

Salieron del proyecto vivo porque ya no se usan. Nada se borró: queda aquí.

| Qué | Por qué sobra |
|---|---|
| `PruebaModelo.js` (`probarModeloBot`) | La reemplaza `PruebaEscaladas.js` (15 casos, ES/EN). |
| `testBot` | Prueba vieja de junio; además escribía una fila "PRUEBA" en Leads. |
| `probarConversaciones` | Prueba de junio que escribía filas falsas en Conversaciones. |
| `rvProbar` | Creaba una reserva REAL en Wix. Peligrosa. |
| `activarWhatsApp`, `activarMessenger`, `obtenerPageToken` | Instalación de canales y tokens, hecha en junio-julio. |
| `crearTriggerRespuestas`, `crearTriggerTokenIG` | Creaban activadores que ya existen; los activadores se crean a mano en el editor. |
| `archivarSalientesAhora` | Atajo manual; el archivo de Salientes sigue corriendo solo. |

Se quedan a propósito (se corren a mano): `btApagar` / `btAbrirATodos` / `btModoPrueba` (botones), `correoEncender` / `correoApagar` (canal de correo), `probarEscaladas` (prueba), `resumenDiarioBot` (activador).
