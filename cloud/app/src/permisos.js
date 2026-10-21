/**
 * Matriz de accesos (sesion C, 17-oct-2026).
 *
 * La matriz vive en UNA sola parte: la tabla `permisos` de la base (migracion
 * db/migraciones/020_permisos.sql). Este archivo no repite ningun permiso: solo sabe
 * leer la tabla y contestar "¿puede?". Las pruebas leen el mismo archivo .sql.
 *
 * Nada de esto esta enchufado todavia: cada modulo lo usa cuando pasa a "vivo".
 *
 * Acciones que se preguntan:
 *   'ver'       — entrar y mirar
 *   'ingresar'  — anotar algo nuevo
 *   'corregir'  — corregir, anular o borrar (borrado logico) un registro ya anotado
 *   una clave de acciones_solo_dueno ('confirmar_banco', 'precio_venta', ...) — solo el dueño
 */
const fs = require('fs');
const path = require('path');
const { normalizarRol } = require('./usuarios');

const MIGRACION = path.join(__dirname, '../../db/migraciones/020_permisos.sql');

/** Filas de la tabla en memoria: { permisos: Map('rol|parte' → fila), soloDueno: Set }. */
function armar(filasPermisos, filasSoloDueno) {
  const permisos = new Map();
  for (const f of filasPermisos) permisos.set(f.rol + '|' + f.parte, f);
  return { permisos, soloDueno: new Set(filasSoloDueno.map((f) => f.accion)) };
}

async function cargarDeBase(pool) {
  const p = await pool.query('SELECT rol, seccion, parte, nivel, area FROM permisos');
  const d = await pool.query('SELECT accion FROM acciones_solo_dueno');
  return armar(p.rows, d.rows);
}

/** Lee los INSERT de la migracion (para las pruebas, sin base). */
function cargarDeMigracion(archivo) {
  const sql = fs.readFileSync(archivo || MIGRACION, 'utf8').replace(/--[^\n]*/g, '');
  const bloque = (tabla) => {
    const m = sql.match(new RegExp('INSERT INTO ' + tabla + ' \\(([^)]*)\\) VALUES([\\s\\S]*?\\))\\s*;'));
    if (!m) throw new Error('La migracion no trae los INSERT de ' + tabla);
    const cols = m[1].split(',').map((c) => c.trim());
    return [...m[2].matchAll(/\(([^()]*)\)/g)].map((t) => {
      const vals = [...t[1].matchAll(/'((?:[^']|'')*)'/g)].map((v) => v[1].replace(/''/g, "'"));
      if (vals.length !== cols.length) throw new Error('Fila mal armada en ' + tabla + ': ' + t[1]);
      return Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
    });
  };
  let permisos = bloque('permisos');
  const soloDueno = bloque('acciones_solo_dueno');
  // Sin archivo explicito: aplica encima las migraciones posteriores del rango (022 en adelante), con
  // los mismos tres tipos de sentencia que usan: DELETE por rol y parte, UPDATE de nota e INSERT.
  if (!archivo) {
    const dir = path.dirname(MIGRACION);
    fs.readdirSync(dir).filter((f) => /^02[2-9]_.*\.sql$/.test(f)).sort().forEach((f) => {
      const s2 = fs.readFileSync(path.join(dir, f), 'utf8').replace(/--[^\n]*/g, '');
      for (const m of s2.matchAll(/DELETE FROM permisos WHERE rol = '(\w+)' AND parte = '(\w+)';/g)) {
        permisos = permisos.filter((x) => !(x.rol === m[1] && x.parte === m[2]));
      }
      for (const m of s2.matchAll(/UPDATE permisos SET nota = '((?:[^']|'')*)' WHERE parte = '(\w+)';/g)) {
        permisos.filter((x) => x.parte === m[2]).forEach((x) => { x.nota = m[1]; });
      }
      const ins = s2.match(/INSERT INTO permisos \(([^)]*)\) VALUES([\s\S]*?\))\s*;/);
      if (ins) {
        const cols = ins[1].split(',').map((c) => c.trim());
        [...ins[2].matchAll(/\(([^()]*)\)/g)].forEach((t) => {
          const vals = [...t[1].matchAll(/'((?:[^']|'')*)'/g)].map((v) => v[1]);
          permisos.push(Object.fromEntries(cols.map((c, i) => [c, vals[i]])));
        });
      }
      if (/\b(ALTER|DROP|TRUNCATE)\b/i.test(s2)) throw new Error(f + ' trae una sentencia que este lector no sabe aplicar.');
    });
  }
  return armar(permisos, soloDueno);
}

/**
 * ¿Puede el usuario hacer `accion` en `parte`?
 * reg (opcional): { area, escrito_por } del registro que se toca. escrito_por se compara con el
 * correo y con el nombre del usuario (la intranet de hoy anota el nombre en ESCRITO POR).
 * Devuelve { ok, motivo }.
 */
function puede(M, usuario, parte, accion, reg) {
  const no = (motivo) => ({ ok: false, motivo });
  if (!usuario) return no('No pude identificarte.');
  const rol = normalizarRol(usuario.rol);
  if (M.soloDueno.has(accion)) return rol === 'dueno' ? { ok: true } : no('Eso solo lo hace el dueño.');
  const f = M.permisos.get(rol + '|' + parte);
  if (!f) return no('Tu cuenta no tiene ' + parte + '.');
  if (accion === 'ver') return { ok: true };
  if (accion !== 'ingresar' && accion !== 'corregir') return no('Acción desconocida: ' + accion);
  if (f.nivel === 'ver') return no('En ' + parte + ' solo podés ver.');
  const area = String((reg && reg.area) || '').toLowerCase();
  if (f.area !== '*' && area && area !== f.area) return no('Eso es de ' + area + '.');
  if (accion === 'ingresar' || rol === 'dueno') return { ok: true };
  if (f.nivel === 'todo') return { ok: true };
  // nivel "ingresar": corregir o borrar solo lo propio, en cualquier momento
  const por = String((reg && reg.escrito_por) || '').trim().toLowerCase();
  const yo = [usuario.email, usuario.nombre].map((x) => String(x || '').trim().toLowerCase()).filter(Boolean);
  if (por && yo.indexOf(por) !== -1) return { ok: true };
  return no('Eso lo anotó ' + ((reg && reg.escrito_por) || 'otra persona') + ': solo el dueño lo puede corregir.');
}

module.exports = { MIGRACION, armar, cargarDeBase, cargarDeMigracion, puede };
