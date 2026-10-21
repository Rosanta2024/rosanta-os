/**
 * USUARIOS: quien entra y con que rol (Fase 0, 17-oct-2026).
 *
 * La hoja USUARIOS de Rosanta_Intranet_Config sigue mandando, igual que en la intranet de
 * Apps Script (Config.js › getUsuarioPorToken_). La base guarda una COPIA que se refresca
 * desde la hoja; editar un rol o revocar un enlace se sigue haciendo en la hoja.
 *
 * Columnas de la hoja (las mismas que lee Config.js):
 *   0 correo · 1 rol · 2 modulos (separados por coma) · 3 puede editar (SI/NO) · 4 nombre · 5 token
 *
 * El token NO se guarda tal cual en la base: solo su huella sha256. Quien lea la base no puede
 * armar un enlace ?u= con eso.
 */
const crypto = require('crypto');

function huellaToken(token) {
  const t = String(token || '').trim();
  if (!t) return '';
  return crypto.createHash('sha256').update(t, 'utf8').digest('hex');
}

/** Filas crudas de la hoja (con encabezado) → usuarios listos para la base. */
function usuariosDeFilas(filas) {
  const out = [];
  const vistos = new Set();
  for (let i = 1; i < (filas || []).length; i++) {
    const f = filas[i] || [];
    const email = String(f[0] || '').toLowerCase().trim();
    if (!email) continue;
    if (vistos.has(email)) throw new Error('La hoja USUARIOS repite el correo ' + email + ' (fila ' + (i + 1) + ').');
    vistos.add(email);
    out.push({
      email,
      rol: String(f[1] || '').trim(),
      modulos: String(f[2] || '').split(',').map((m) => m.trim()).filter(Boolean),
      puede_editar: String(f[3] || '').toUpperCase().trim() === 'SI',
      nombre: String(f[4] || '').trim(),
      token_huella: huellaToken(f[5])
    });
  }
  return out;
}

/** Igual que usuarioTieneModulo de la intranet: el rol dueño NO abre todo por si solo. */
function tieneModulo(usuario, modulo) {
  return !!usuario && (usuario.modulos || []).indexOf(modulo) !== -1;
}

/** "Dueño" → "dueno", como normalizar_ de la intranet. */
function normalizarRol(rol) {
  return String(rol || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/** Reemplaza la copia de usuarios en la base con lo que dice la hoja, en una transaccion. */
async function guardarUsuarios(pool, usuarios) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('DELETE FROM usuarios');
    for (const u of usuarios) {
      await c.query(
        'INSERT INTO usuarios (email, rol, modulos, puede_editar, nombre, token_huella, sincronizado) VALUES ($1,$2,$3,$4,$5,$6, now())',
        [u.email, u.rol, u.modulos, u.puede_editar, u.nombre, u.token_huella || null]
      );
    }
    await c.query('COMMIT');
    return usuarios.length;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

async function usuarioPorToken(pool, token) {
  const h = huellaToken(token);
  if (!h) return null;
  const r = await pool.query('SELECT email, rol, modulos, puede_editar, nombre FROM usuarios WHERE token_huella = $1', [h]);
  return r.rows[0] || null;
}

module.exports = { huellaToken, usuariosDeFilas, tieneModulo, normalizarRol, guardarUsuarios, usuarioPorToken };
