// Prueba de CONTRATO rosanta-web → rosanta-clientes (Fase 2). Lo que mandan nuestros ganchos REALES (motor y Adventures)
// tiene que pasar los validadores de Fase 2 copiados tal cual de su commit (test/fixturas/contrato-clientes-d7733d8.js).
// Si Fase 2 cambia su contrato: volver a copiar sus validadores y correr esto. Sin red.
const test = require('node:test');
const assert = require('node:assert');
const F2 = require('./fixturas/contrato-clientes-d7733d8');
const { baseLista } = require('./reservas-base');
const { crearMotor } = require('../src/reservas/motor');
const C = require('../src/reservas/comun');
const P = require('../src/permisos');
const PW = require('../src/permisos-web');
const A = require('../src/almacen-web');
const W = require('../src/contenido-web');
const AV = require('../src/adventures');
const AD = require('../src/adaptadores-web');

const AHORA = C.instante('2026-11-03', '10:00').getTime();

test('crm-reserva y capi: lo que manda el motor pasa los validadores de Fase 2 (crear, cambiar, cancelar)', async () => {
  const b = await baseLista({ ahora: AHORA });
  const crm = [], capi = [];
  const motor = crearMotor({ pool: b.pool, reloj: () => AHORA, registrar: () => {},
    ganchos: { crm: async (p) => { crm.push(p); }, capi: async (p) => { capi.push(p); } } });
  const r = await motor.crear({ nombre: 'Cliente', apellido: 'Contrato', email: 'Cliente.Contrato@Ejemplo.Test', telefono: '55551234', origen: 'web', canal: 'web', optin: true,
    inicio: C.instante('2026-11-04', '19:00'), personas: 2 }, { canal: 'web' });
  assert.ok(r.ok);
  await motor.cambiar(r.reserva.id, { inicio: C.instante('2026-11-04', '20:00') }, { canal: 'equipo', quien: 'sala' });
  await motor.cambiarEstado(r.reserva.id, 'cancelada', { quien: 'cliente:enlace' });
  // y una sin optin ni telefono
  const r2 = await motor.crear({ nombre: 'Otra', email: 'otra@ejemplo.test', origen: 'web', canal: 'web', inicio: C.instante('2026-11-05', '13:00'), personas: 3 }, { canal: 'web' });
  assert.ok(r2.ok);
  await motor.esperarGanchos();
  assert.ok(crm.length >= 4);
  for (const p of crm) assert.deepStrictEqual(F2.limpiarReserva(p).error, undefined, JSON.stringify(p));
  assert.ok(capi.length >= 1);
  for (const p of capi) assert.deepStrictEqual(F2.limpiarCapi(p).error, undefined, JSON.stringify(p));
});

test('pipeline-adventure: la consulta real (con cena) pasa el validador de Fase 2, con id entero aunque la base lo devuelva como texto', async () => {
  const juanma = { email: 'restaurante@rosanta.rest', rol: 'Dueño' };
  const M = PW.conPropuesta(P.cargarDeMigracion());
  const ahora = new Date('2026-11-10T16:00:00Z');
  const almacen = A.crearAlmacenMemoria({ ahora: () => ahora });
  // imitar a pg: el bigserial vuelve como texto
  const ins = almacen.insertar.bind(almacen);
  almacen.insertar = async (t, f) => { const x = await ins(t, f); return t === 'leads_adventures' ? Object.assign({}, x, { id: String(x.id) }) : x; };
  const Cw = W.crearContenidoWeb({ almacen, matriz: M, fotos: AD.fotosDoble(), reconstruir: AD.reconstruirDoble(), ahora: () => ahora });
  const enviados = [];
  const S = AV.crearAdventures({ almacen, matriz: M, contenido: Cw, ahora: () => ahora, ganchos: {
    pipeline: async (x) => { enviados.push(x); return { id: 'adventure-x' }; }, avisarJuanma: async () => ({}), crearReserva: async () => ({ id: 'r1', pendiente: false }) } });
  const op = await Cw.crear(juanma, 'operadores', { nombre: 'Operador Ejemplo', codigo_referido: 'op-01' });
  await Cw.editar(juanma, 'operadores', op.id, { licencia_inguat: 'INGUAT-0000', licencia_vence: '2027-12-05', seguro_aseguradora: 'Aseg', seguro_poliza: 'P1', seguro_vence: '2027-06-30',
    comision_tipo: 'porcentaje', comision_valor: 10, requisitos: { inguat_registro: true, seguro_rc_accidentes: true } });
  await Cw.activar(juanma, 'operadores', op.id, true);
  await Cw.crear(juanma, 'experiencias', { slug: 'acatenango-ejemplo', operador_id: op.id, titulo_es: 'Acatenango de ejemplo', titulo_en: 'Sample', descripcion_es: 'x', descripcion_en: 'x',
    duracion_es: '2 días', duracion_en: '2 days', dificultad: 'dificil', idiomas: ['es', 'en'], precio_ref_q: 600 });
  await S.consulta({ experiencia: 'acatenango-ejemplo', nombre: 'Ana', email: 'ana@ejemplo.test', idioma: 'en', fecha: '2026-11-20', personas: 2, mensaje: 'Hola',
    cena: { fecha: '2026-11-21', hora: '19:00', personas: 2 }, origen: { utm_source: 'chatgpt.com', canal: 'IA' } });
  await S.consulta({ experiencia: 'acatenango-ejemplo', nombre: 'Beto', email: 'beto@ejemplo.test', idioma: 'es' });   // lo minimo
  assert.strictEqual(enviados.length, 2);
  for (const x of enviados) {
    const l = F2.limpiarAdventure(x);
    assert.deepStrictEqual(l.error, undefined, JSON.stringify(x));
  }
  assert.strictEqual(typeof enviados[0].id, 'number');
});
