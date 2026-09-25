'use strict';
const H = { Authorization: process.env.WIX_API_KEY, 'wix-site-id': process.env.WIX_SITE_ID, 'Content-Type': 'application/json' };
const U = 'https://www.wixapis.com/translation-content/v1/contents';
(async () => {
  for (const id of ['f929fce5-2e0a-4dd5-8211-b475ad56700c', 'a94f0a25-7ec3-4fba-99c8-f07c3d4560ce', '0b9ef3ed-328b-48e0-97bc-bd062ce0eaea', '329d8241-647f-4014-af1f-5d01e530d14b']) {
    const j = await (await fetch(U + '/' + id, { headers: H })).json();
    const c = j.content;
    console.log(c.entityId + ' · parent: ' + c.parentEntityId + ' · creado: ' + c.createdDate.slice(0, 10) + ' · actualizado: ' + c.updatedDate.slice(0, 10));
  }
  const home = await (await fetch('https://www.rosanta.rest/?v=' + Date.now(), { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
  const n = (s) => home.split(s).length - 1;
  console.log('\nEn la HOME publicada:');
  console.log('  "Every detail you find here":', n('Every detail you find here'));
  console.log('  "Cooking that is born from the land":', n('Cooking that is born from the land'));
  console.log('  "coordinates of Antigua":', n('coordinates of Antigua'));
  console.log('  "COOKING WITH PURPOSE":', n('COOKING WITH PURPOSE'));
  console.log('  "THE JOY OF HONEST COOKING":', n('THE JOY OF HONEST COOKING'));
  console.log("  \"Much of what you'll taste\":", n('Much of what you'));
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
