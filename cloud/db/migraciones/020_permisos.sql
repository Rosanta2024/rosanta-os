-- 020 · Matriz de accesos (sesion C, 17-oct-2026). Rango 020–029 = accesos y roles.
-- ES LA UNICA FUENTE de la matriz de Juanma: cloud/app/src/permisos.js la lee de aca (en la base,
-- o de este archivo en las pruebas). Cambiar un permiso = migracion nueva, nunca editar esta.
-- Documento: Rosanta OS/00_Admin/Apps_Script_e_IA/2026-10-17_Accesos_y_Roles.md
--
-- nivel:  ver       = solo ve
--         ingresar  = ve, ingresa, y corrige o borra LO QUE ESA PERSONA ANOTO, en cualquier momento
--                     (ajuste de Juanma del 17-oct: los errores de facturas o bancos aparecen semanas despues)
--         todo      = todo lo de esa parte, dentro de su area (dueño: todas)
-- area:   cocina | barra | * (sin restriccion de area)
-- Sin fila = no lo ve. Las acciones de acciones_solo_dueno son del dueño aunque el nivel sea "todo".

CREATE TABLE permisos (
  rol      text NOT NULL CHECK (rol IN ('dueno', 'chef', 'sala', 'pauta', 'contador')),
  seccion  text NOT NULL CHECK (seccion IN ('operacion', 'finanzas', 'clientes', 'marketing', 'tecnico')),
  parte    text NOT NULL,
  nivel    text NOT NULL CHECK (nivel IN ('ver', 'ingresar', 'todo')),
  area     text NOT NULL DEFAULT '*' CHECK (area IN ('cocina', 'barra', '*')),
  nota     text NOT NULL DEFAULT '',
  PRIMARY KEY (rol, parte)
);

CREATE TABLE acciones_solo_dueno (
  accion   text PRIMARY KEY,
  detalle  text NOT NULL
);

INSERT INTO permisos (rol, seccion, parte, nivel, area, nota) VALUES
  -- Operacion
  ('dueno', 'operacion', 'pagos',      'todo',     '*',      ''),
  ('chef',  'operacion', 'pagos',      'ingresar', 'cocina', ''),
  ('sala',  'operacion', 'pagos',      'ingresar', 'barra',  ''),
  ('dueno', 'operacion', 'caja',       'todo',     '*',      'caja chica y retiros'),
  ('chef',  'operacion', 'caja',       'ingresar', '*',      'caja chica y retiros'),
  ('sala',  'operacion', 'caja',       'ingresar', '*',      'caja chica y retiros'),
  ('dueno', 'operacion', 'cierres',    'todo',     '*',      'cierres diarios, Llego y No vino'),
  ('sala',  'operacion', 'cierres',    'ingresar', '*',      'cierres diarios, Llego y No vino'),
  ('dueno', 'operacion', 'recetario',  'todo',     '*',      'recetario, costos y precios de insumos'),
  ('chef',  'operacion', 'recetario',  'todo',     'cocina', 'acceso total en su area, Juanma 17-oct'),
  ('sala',  'operacion', 'recetario',  'todo',     'barra',  'acceso total en su area, Juanma 17-oct'),
  ('dueno', 'operacion', 'inventario', 'todo',     '*',      ''),
  ('chef',  'operacion', 'inventario', 'ingresar', 'cocina', ''),
  ('sala',  'operacion', 'inventario', 'ingresar', 'barra',  ''),
  -- Finanzas
  ('dueno', 'finanzas',  'finanzas',        'todo', '*', 'DRE, metas, escenarios, tablero'),
  ('dueno', 'finanzas',  'reporte_semanal', 'todo', '*', ''),
  ('chef',  'finanzas',  'reporte_semanal', 'ver',  '*', ''),
  ('sala',  'finanzas',  'reporte_semanal', 'ver',  '*', ''),
  -- Clientes
  ('dueno', 'clientes',  'eventos',   'todo',     '*', 'pipeline de eventos'),
  ('sala',  'clientes',  'eventos',   'ingresar', '*', 'sala recibe e ingresa eventos'),
  ('dueno', 'clientes',  'crm',       'todo',     '*', 'CRM y ficha de cliente'),
  ('sala',  'clientes',  'crm',       'ver',      '*', ''),
  ('pauta', 'clientes',  'crm',       'ver',      '*', ''),
  ('dueno', 'clientes',  'reservas',  'todo',     '*', ''),
  ('chef',  'clientes',  'reservas',  'ver',      '*', 'para saber cuantos comensales vienen'),
  ('sala',  'clientes',  'reservas',  'ingresar', '*', 'por telefono; Llego y No vino'),
  ('pauta', 'clientes',  'reservas',  'ver',      '*', ''),
  ('dueno', 'clientes',  'carritos',  'todo',     '*', 'carritos abandonados'),
  ('pauta', 'clientes',  'carritos',  'ver',      '*', ''),
  ('dueno', 'clientes',  'resenas',   'todo',     '*', 'resenas y encuesta'),
  ('dueno', 'clientes',  'consola',   'todo',     '*', 'consola del bot'),
  -- Marketing
  ('dueno', 'marketing', 'pauta',     'todo',     '*', 'pauta y contenido'),
  ('pauta', 'marketing', 'pauta',     'ingresar', '*', 'pauta y contenido'),
  -- Tecnico
  ('dueno', 'tecnico',   'tecnico',   'todo',     '*', 'pruebas, tiempos, diagnostico');

INSERT INTO acciones_solo_dueno (accion, detalle) VALUES
  ('corregir_ajeno',       'anular, corregir o borrar lo que anoto otra persona'),
  ('corregir_dia_cerrado', 'corregir un dia o un mes ya cerrado'),
  ('confirmar_banco',      'confirmar un pago contra el banco'),
  ('no_pertenece',         'marcar un movimiento del banco como "No pertenece"'),
  ('precio_venta',         'precios de venta y del menu'),
  ('exportar_contactos',   'exportar contactos del CRM'),
  ('dar_accesos',          'dar o quitar accesos');

-- El rol "contador" esta permitido en la tabla pero SIN filas: se agrega con una migracion nueva
-- cuando Juanma lo confirme (propuesta: ver finanzas y reporte_semanal).

GRANT SELECT ON permisos, acciones_solo_dueno TO app;
