#!/usr/bin/env node
/**
 * Quita el término prohibido "signature" de la descripción EN del menú
 * ("our signature cocktail list" → "our cocktail list"), aprobado por Juanma
 * el 20-ago-2026. Registro de deshacer + verificación leyendo de vuelta.
 * PATCH del menú = enviar el objeto completo con su revision.
 */
'use strict';
const fs = require('fs');
const H = { Authorization: process.env.WIX_API_KEY, 'wix-site-id': process.env.WIX_SITE_ID, 'Content-Type': 'application/json' };
const URL_MENU = 'https://www.wixapis.com/restaurants/menus/v1/menus/d4c6af0b-a216-46b0-ac39-9348d870a023';

const BUSCA = 'our signature cocktail list';
const PONE = 'our cocktail list';

(async () => {
  const antes = (await (await fetch(URL_MENU, { headers: H })).json()).menu;
  if (!antes.description.includes(BUSCA)) {
    console.log('El texto "' + BUSCA + '" ya no está en la descripción. Nada que hacer.');
    console.log('Descripción actual:\n' + antes.description);
    return;
  }

  const nueva = antes.description.replace(BUSCA, PONE);
  const cuerpo = { menu: {
    id: antes.id,
    revision: antes.revision,
    name: antes.name,
    description: nueva,
    visible: antes.visible,
    sectionIds: antes.sectionIds,
    urlQueryParam: antes.urlQueryParam
  } };
  if (antes.businessLocationId) cuerpo.menu.businessLocationId = antes.businessLocationId;
  // NO se envía extendedFields: contiene seoData, que esta API key no puede escribir
  // (HTTP 400 WRITE_PERMISSION_DENIED). Omitirlo lo deja intacto.

  const r = await fetch(URL_MENU, { method: 'PATCH', headers: H, body: JSON.stringify(cuerpo) });
  const t = await r.text();
  if (!r.ok) { console.log('FALLÓ: HTTP ' + r.status + ' ' + t.slice(0, 400)); process.exit(1); }
  const despues = JSON.parse(t).menu;

  const arch = 'fix-signature-' + Date.now() + '.json';
  fs.writeFileSync(__dirname + '/' + arch, JSON.stringify({
    fecha: new Date().toISOString(),
    que: 'descripción EN del menú: quitado "signature"',
    menuId: antes.id,
    revisionAnterior: antes.revision,
    descripcionAnterior: antes.description,
    descripcionNueva: nueva
  }, null, 2), 'utf8');

  console.log('PATCH ok · revision ' + antes.revision + ' → ' + despues.revision);
  console.log('Registro de deshacer: ' + arch);

  // verificación leyendo de vuelta
  const ver = (await (await fetch(URL_MENU, { headers: H })).json()).menu;
  console.log('\n--- VERIFICACIÓN ---');
  console.log('¿contiene "signature"?: ' + ver.description.toLowerCase().includes('signature'));
  console.log('nombre intacto: ' + JSON.stringify(ver.name));
  console.log('secciones intactas: ' + (ver.sectionIds || []).length);
  console.log('visible: ' + ver.visible + ' · urlQueryParam: ' + JSON.stringify(ver.urlQueryParam));
  console.log('\ndescripción final:\n' + ver.description);
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
