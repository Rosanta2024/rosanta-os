# Arreglar el `cwd` de las tareas programadas

## El problema

Cada tarea programada de Claude Code guarda un campo `cwd` en
`~/Library/Application Support/Claude/claude-code-sessions/<a>/<b>/scheduled-tasks.json`.

Ese `cwd` **se hereda de la sesión que creó la tarea y queda congelado**: ni
`create_scheduled_task` ni `update_scheduled_task` lo exponen, así que no hay forma de
cambiarlo desde una sesión.

Las nueve tareas se crearon el 23-sep-2026 desde `Projects/Rosanta 03 Finanzas`, que dejó de
ser la carpeta buena con el renombrado de S39. La carpeta vieja **sigue existiendo, vacía**,
así que nada falla con "no existe": las corridas simplemente trabajan desde un directorio sin
nada adentro.

**El efecto que sí se nota:** la carpeta de memoria de una sesión se deriva del `cwd`
(`~/.claude/projects/<cwd con guiones>/memory`). Con el `cwd` viejo, cada memoria que escribe
una routine cae en un balde huérfano que ningún proyecto lee. El 25-sep-2026 había 47
memorias repartidas en seis baldes así, entre ellas las de los eventos de Krystal y Geraldine.

## Cómo se usa

**Con la app de Claude cerrada** — si está abierta puede reescribir el archivo desde su copia
en memoria y pisar el cambio:

```bash
python3 ~/Dev/Rosanta/tools/arreglar-cwd-routines/arreglar_cwd.py            # simulación
python3 ~/Dev/Rosanta/tools/arreglar-cwd-routines/arreglar_cwd.py --aplicar  # escribe
```

La simulación no toca nada. Al aplicar deja un respaldo con sello de tiempo al lado del
archivo, y no reemplaza el original hasta comprobar que el JSON nuevo parsea.

Después: abrir la app y confirmar que las nueve tareas siguen con su horario.

## Qué NO arregla

Las rutas escritas dentro de cada `SKILL.md`. Esas son absolutas y se corrigieron a mano el
25-sep (tablero, venv del reporte semanal y mensual, y la carpeta de la auditoría de Meta Ads,
que apuntaba a `Projects/Rosanta Pauta` y tampoco existía).

## Regla que deja

Renombrar una carpeta de proyecto no avisa a nada: ni a las tareas programadas, ni a sus
`SKILL.md`, ni a los baldes de memoria. Después de un renombrado hay que barrer los tres.
