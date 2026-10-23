// cloud/herramientas/sembrar-contenido.js: solo en una base de ensayo; siembra el borrador y publica la version 1.
// Corre sobre el almacen en memoria (ninguna base real). Lee web/sitio/data/contenido-capturado.json sin tocarlo.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const S = require('../../herramientas/sembrar-contenido');
const A = require('../src/almacen-web');
const EJEMPLO = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../web/contenido/ejemplo-contenido.json'), 'utf8'));

test('sembrar-contenido rechaza produccion ("rosanta") y cualquier base que no sea rosanta_<algo>', () => {
  for (const b of ['rosanta', '', undefined, ' rosanta ', 'Rosanta', 'rosanta-ensayo', 'postgres', 'rosanta_', 'otra_rosanta_ensayo', 'rosanta_ensayo; DROP']) {
    assert.throws(() => S.revisarBase(b), /SOLO en una base de ensayo/, String(b));
  }
  assert.strictEqual(S.revisarBase('rosanta_ensayo'), 'rosanta_ensayo');
  // el script lo revisa antes de conectar y otra vez con current_database()
  const src = fs.readFileSync(path.join(__dirname, '../../herramientas/sembrar-contenido.js'), 'utf8');
  assert.match(src, /const BASE = revisarBase\(arg\('--base'\)\);/);
  assert.match(src, /SELECT current_database\(\)[\s\S]*revisarBase\(real\)/);
  assert.doesNotMatch(src, /reconstruirPorUrl|SITIO_RECONSTRUIR/, 'no dispara la reconstruccion del sitio');
});

test('siembra el borrador y lo publica como version 1; una segunda vez no hace nada', async () => {
  const al = A.crearAlmacenMemoria();
  const r = await S.sembrarYPublicar(al, EJEMPLO, { quien: 'semilla' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.version, 1);
  assert.strictEqual(r.reconstruccion, 'sin_gancho');
  assert.strictEqual(r.sembrado.paginas, Object.keys(EJEMPLO.paginas).length);
  const v = await al.lista('web_versiones');
  assert.strictEqual(v.length, 1);
  assert.strictEqual(v[0].contenido.paginas.inicio.bloques['heroe.titulo'].es, EJEMPLO.paginas.inicio.bloques['heroe.titulo'].es);
  assert.match(v[0].nota, /^Semilla/);
  const otra = await S.sembrarYPublicar(al, EJEMPLO, { quien: 'semilla' });
  assert.deepStrictEqual(otra, { ok: false, motivo: 'Esta base ya tiene versiones publicadas: no se siembra encima.' });
  assert.strictEqual((await al.lista('web_versiones')).length, 1);
  assert.deepStrictEqual(await S.sembrarYPublicar(A.crearAlmacenMemoria(), { formato: 9 }), { ok: false, motivo: 'El archivo no tiene el formato 1 (web/contenido/FORMATO.md).' });
});

test('el contenido capturado de Wix (web/sitio/data/contenido-capturado.json) se siembra entero y queda publicado', async (t) => {
  if (!fs.existsSync(S.ARCHIVO_DEFECTO)) return t.skip('no esta el archivo capturado en esta rama');
  const capturado = JSON.parse(fs.readFileSync(S.ARCHIVO_DEFECTO, 'utf8'));
  const al = A.crearAlmacenMemoria();
  const r = await S.sembrarYPublicar(al, capturado, { quien: 'semilla' });
  assert.strictEqual(r.ok, true, r.motivo);
  assert.strictEqual(r.version, 1);
  assert.strictEqual(r.sembrado.paginas, Object.keys(capturado.paginas).length);
  assert.strictEqual(r.sembrado.platos, capturado.menu.reduce((n, s) => n + s.platos.length, 0));
  assert.strictEqual(r.sembrado.faq, capturado.faq.length);
  const pub = (await al.lista('web_versiones'))[0].contenido;
  assert.deepStrictEqual(Object.keys(pub.paginas).sort(), Object.keys(capturado.paginas).sort());
  assert.ok(!('blog' in pub), 'el capturado no trae blog');
});
