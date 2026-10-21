#!/usr/bin/env node
/**
 * Ver o mover un interruptor de la tabla `interruptores` de la base (dia unico, 21-oct-2026).
 * (Los de la intranet viven en PARAMETROS de Rosanta_Intranet_Config y se cambian en la hoja.)
 *
 *   node cloud/herramientas/interruptor.js                      → lista todos
 *   node cloud/herramientas/interruptor.js hooks_reserva base   → lo pone en base (y dice como estaba)
 * Modos validos por modulo: hooks_* puente|base · web_* sombra|base|apagado. Entra como postgres (la cuenta app
 * solo LEE la tabla). Anota quien y cuando (columna por). Los servicios lo releen en <= 30 s.
 */
const path = require('path');
const { execFileSync } = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const { OAuth2Client } = require(path.join(APP, 'node_modules', 'google-auth-library'));
const { crearPool, cerrarPool } = require(path.join(APP, 'src', 'db'));
const GCLOUD = path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');
const ENV = Object.assign({}, process.env, { CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3' });
const g = (a) => execFileSync(GCLOUD, a.concat(['--project', 'rosanta-apps-script']), { env: ENV, encoding: 'utf8' }).trim();
const VALIDOS = { hooks_: ['puente', 'base'], web_: ['sombra', 'base', 'apagado'] };
const [modulo, modo] = process.argv.slice(2);
const BASE = process.env.BASE || 'rosanta';

(async () => {
  const auth = new OAuth2Client(); auth.setCredentials({ access_token: g(['auth', 'print-access-token']) });
  const pool = await crearPool({ usuario: 'postgres', clave: g(['secrets', 'versions', 'access', 'latest', '--secret', 'db-postgres-root']), base: BASE, auth });
  try {
    if (modulo) {
      const pref = Object.keys(VALIDOS).find((p) => modulo.startsWith(p));
      if (!pref || !/^[a-z_]{3,40}$/.test(modulo)) throw new Error('Modulo desconocido: ' + modulo);
      if (!modo || !VALIDOS[pref].includes(modo)) throw new Error('Modo invalido para ' + modulo + ': usar ' + VALIDOS[pref].join('|'));
      const antes = (await pool.query('SELECT modo FROM interruptores WHERE modulo = $1', [modulo])).rows[0];
      await pool.query(`INSERT INTO interruptores (modulo, modo, cambiado, por) VALUES ($1, $2, now(), $3)
        ON CONFLICT (modulo) DO UPDATE SET modo = EXCLUDED.modo, cambiado = now(), por = EXCLUDED.por`, [modulo, modo, 'interruptor.js · ' + (process.env.USER || '?')]);
      console.log(modulo + ': ' + (antes ? antes.modo : '(sin fila)') + ' → ' + modo + '   (los servicios lo releen en <= 30 s)');
    }
    const r = await pool.query("SELECT modulo, modo, to_char(cambiado AT TIME ZONE 'America/Guatemala', 'YYYY-MM-DD HH24:MI') AS cuando, por FROM interruptores ORDER BY modulo");
    console.table(r.rows);
  } finally { await cerrarPool(pool); }
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
