// Datos inventados para las pruebas de Pagos (nunca datos reales de dinero en el repo).
const C = require('../src/copia-hojas');
const MAESTRO = C.LIBROS.maestro.id;
const pre = [['Rosanta'], [''], ['']];   // el encabezado del maestro esta en la fila 4
const FEL_H = ['Fecha', 'Tipo_DTE', 'Serie', 'Numero_DTE', 'NIT_Emisor', 'Nombre_Emisor', 'Establecimiento', 'Estado', 'Moneda', 'Gran_Total', 'IVA', 'Año_ISO', 'Semana_ISO', 'Categoría', 'Es_Personal', 'Mes'];
const fel = (fecha, dte, nit, nombre, total, cat, estado) => [fecha, 'FACT', 'A', dte, nit, nombre, nombre, estado || 'Vigente', 'GTQ', total, 0, 2026, 40, cat, 'No', 10];
const PAG_H = ['AREA', 'PROVEEDOR', 'DTE', 'FECHA DE PAGAR', 'FECHA PAGADO', 'CANTIDAD PAGADA', 'ESTATUS DE PAGO', 'NIT', 'DETALLE', 'ESCRITO POR', 'REGISTRADO', 'ID'];

function libros() {
  return {
    [MAESTRO]: {
      '01_FEL_Maestro': pre.concat([FEL_H,
        fel(new Date(2026, 9, 1), '1001', '111', 'VERDURAS DOÑA MINA', 500, 'ALIMENTOS'),
        fel(new Date(2026, 9, 2), '1002', '111', 'VERDURAS DOÑA MINA', 300, 'ALIMENTOS'),
        fel(new Date(2026, 9, 3), '2001', '222', 'LICORES LA NACIONAL', 800, 'LICORES'),
        fel(new Date(2026, 9, 4), '2002', '222', 'LICORES LA NACIONAL', 999, 'LICORES', 'Anulado')]),
      '03_Banco_Industrial': pre.concat([['Fecha', 'Docto', 'Descripción', 'Débito', 'Crédito', 'Saldo', 'Categoría', 'Es_Personal', 'Año', 'Mes', 'Semana']]),
      '04_Banco_BAC': pre.concat([['Fecha', 'Referencia', 'Codigo', 'Descripción', 'Débito', 'Crédito', 'Balance', 'Categoría', 'Es_Personal', 'Año', 'Mes', 'Semana']]),
      '05_Tarjeta_Credito_BAC': pre.concat([['Fecha', 'Descripción', 'Quetzales', 'Dólares', 'Categoría', 'Es_Personal', 'Año', 'Mes', 'Semana']])
    },
    CFG: { PAGOS_PROVEEDORES: [PAG_H.slice()], FEL_CORREO: [], BANCO_CORREO: [] },
    [C.LIBROS.compras.id]: {}
  };
}
module.exports = { MAESTRO, libros, PAG_H, FEL_H };
