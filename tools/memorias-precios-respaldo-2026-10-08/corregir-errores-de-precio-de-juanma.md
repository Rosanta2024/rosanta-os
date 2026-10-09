---
name: corregir-errores-de-precio-de-juanma
description: "Si Juanma da un precio que contradice el catálogo vigente, se cotiza con el catálogo y se le avisa del error; no se usa su número a ciegas"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 660fb70a-cb26-4d00-99d2-5736977bc46c
  modified: 2026-10-02T16:51:03.940Z
---

Si Juanma dicta un precio que no coincide con el catálogo vigente (lista 2027 de la skill `rosanta-cotizador`), **se corrige solo, se cotiza con el precio del catálogo y se le avisa** del error que cometió, en una línea.

**Why:** el 2-oct-2026 pidió el paquete de bebidas de Vania Rodas a Q150 (precio 2026); la lista 2027 dice Q165. Se cotizó a Q150 con un aviso y hubo que rehacer PDF, borrador y tablero. Juanma: "Si te percatas de estos errores corrígelos tú mismo y avísame del error que he cometido."

**How to apply:** comparar todo precio que dé Juanma contra el catálogo antes de generar. Si difiere y no hay una razón explícita (descuento, cortesía, cliente especial), usar el del catálogo y decirle: "Usé QX, el precio vigente; me pasaste QY." Si él da una razón explícita, manda su precio. Relacionado: [[pendientes-eventos]], [[tono-correos-clientes]].
