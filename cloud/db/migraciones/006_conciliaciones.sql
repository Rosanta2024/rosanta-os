-- 006 · Conciliación del cierre de mes (19-oct-2026, plan acelerado de Juanma: compensación por
-- acortar la sombra a 1 semana). Al terminar el mes, el servidor compara la base contra las hojas en
-- Pagos (cuadre por proveedor y lo pagado en el mes), Caja chica (movimientos y 07_Caja_Chica del
-- maestro) y los cierres del día. Si algo no cuadra, la tarea falla y llega el correo de alerta.
CREATE TABLE conciliaciones (
  id            bigserial PRIMARY KEY,
  cuando        timestamptz NOT NULL DEFAULT now(),
  mes           text NOT NULL,          -- AAAA-MM
  ok            boolean NOT NULL,
  totales       jsonb NOT NULL,         -- {pagos: {...}, caja: {...}, cierres: {...}}, base y hoja lado a lado
  diferencias   jsonb NOT NULL,         -- [] si todo cuadra
  avisos        jsonb NOT NULL          -- lo que conviene mirar pero no es diferencia (p. ej. días sin cierre)
);

GRANT SELECT, INSERT ON conciliaciones TO app;
GRANT USAGE ON SEQUENCE conciliaciones_id_seq TO app;
