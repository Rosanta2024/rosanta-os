'use strict';
const get = async (u) => {
  const r = await fetch(u + (u.includes('?') ? '&' : '?') + 'd=' + Date.now(), { headers: { 'User-Agent': 'Mozilla/5.0', 'Cache-Control': 'no-cache' } });
  return r.ok ? await r.text() : '';
};
const sinJsonLd = (h) => h.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
const visible = (h) => sinJsonLd(h).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');

(async () => {
  const home = await get('https://www.rosanta.rest/es');
  const homeEn = await get('https://www.rosanta.rest/');
  const menu = await get('https://www.rosanta.rest/es/full-menu');

  console.log('1) HREFLANG / ALTERNATE en la home');
  for (const [nom, h] of [['EN', homeEn], ['ES', home]]) {
    const links = (h.match(/<link[^>]*>/g) || []).filter(l => /alternate|hreflang|canonical/i.test(l));
    console.log('   ' + nom + ': ' + (links.length ? '' : '(ninguno)'));
    for (const l of links) console.log('      ' + l.replace(/\s+/g, ' '));
  }

  console.log('\n2) SELECTOR DE IDIOMA en /es (contexto de EN|ES)');
  const v = home;
  for (const pal of ['>ES<', '>EN<']) {
    let i = v.indexOf(pal);
    console.log('   ' + pal + (i < 0 ? ' → no aparece' : ' → ' + JSON.stringify(v.slice(Math.max(0, i - 260), i + 20).replace(/\s+/g, ' ')).slice(-300)));
  }

  console.log('\n3) DÍAS DE LA SEMANA en el pie de /es');
  const vis = visible(home);
  for (const d of ['Monday', 'Lunes', 'Tuesday', 'Martes', 'Wed - Thru', 'Mié - Jue', 'Friday - Saturday', 'Viernes - Sábado', 'Sunday', 'Domingo']) {
    const n = vis.split(d).length - 1;
    if (n) console.log('   ' + d + ': ' + n + ' vez/veces');
  }
  const iM = vis.indexOf('Monday');
  if (iM > 0) console.log('   contexto de "Monday": ' + JSON.stringify(vis.slice(iM - 300, iM + 120).replace(/<[^>]+>/g, '|').replace(/\s+/g, ' ')));

  console.log('\n4) MENÚ /es/full-menu — inglés visible vs sólo en JSON-LD');
  const menuVis = visible(menu);
  for (const s of ['TO START', 'HEALTHY OPTIONS', 'SOMETHING STRONGER', 'Rosanta Salad', 'Mediterranean Bowl', '>Glass<', '>Bottle<', 'PARA EMPEZAR', 'Ensalada Rosanta', 'Bol Mediterráneo', '>Copa<', '>Botella<']) {
    const enTodo = menu.split(s).length - 1;
    const enVisible = menuVis.split(s).length - 1;
    console.log('   ' + s.padEnd(22) + ' total:' + enTodo + '  visible:' + enVisible + (enTodo > 0 && enVisible === 0 ? '   (sólo en JSON-LD / datos)' : ''));
  }

  console.log('\n5) /es/gift-ideas — reintento');
  try {
    const gi = await get('https://www.rosanta.rest/es/gift-ideas');
    console.log('   cargó: ' + (gi.length > 1000) + ' · IDEAS PARA REGALAR: ' + gi.includes('IDEAS PARA REGALAR') + ' · GIVE A NIGHT: ' + gi.includes('GIVE A NIGHT'));
  } catch (e) { console.log('   error: ' + e.message); }
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
