# Intranet: limpieza del 17-oct-2026 (sesión C, accesos y limpieza)

Aprobado por Juanma el 17-oct ("hazlo tú"). Nada se borró: el código está en `funciones_archivadas.js`.

| Función | Archivo | Por qué |
|---|---|---|
| `evGuardarRevision_` | EventosDatos.js | Nadie la llama: las revisiones diarias de cotizaciones las escribe el hook del Marketing OS (`cot.sh revision`). |
| `habilitarModulosDueno` (+ `DUENO_`, `MODULOS_NUEVOS_`) | Setup.js | De una vez (sep-2026): dio de alta marketing, crm, consola y reseñas al dueño. Ya corrida. |

Se verificó con grep que ninguna otra función, vista, prueba ni arnés las usa. Batería de la intranet antes de publicar: ver el commit.
