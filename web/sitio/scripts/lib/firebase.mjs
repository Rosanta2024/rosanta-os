// firebase.json para Firebase Hosting (proyecto rosanta-apps-script). NO se despliega desde aquí.
// - public: dist/ (lo que genera Astro)
// - cleanUrls: /reservas sirve dist/reservas.html; trailingSlash false: /reservas/ → 301 /reservas
// - redirects: las 301 una a una de data/redirecciones.json (nunca todo a la portada)
// - rewrites: /api/** → Cloud Run rosanta-nube (northamerica-south1)
// - headers: caché larga para imágenes, fuentes y _astro; corta para HTML, sitemaps y llms.txt

export function firebaseJson(redirecciones) {
  const redirects = [];
  for (const r of redirecciones) {
    const variantes = new Set([r.desde, encodeURI(r.desde)]); // con acento: decodificada y codificada
    for (const v of variantes) redirects.push({ source: v, destination: r.hacia, type: 301 });
  }
  return {
    hosting: {
      public: 'dist',
      cleanUrls: true,
      trailingSlash: false,
      ignore: ['firebase.json', '**/.*', '**/node_modules/**'],
      redirects,
      rewrites: [
        { source: '/api/**', run: { serviceId: 'rosanta-nube', region: 'northamerica-south1' } },
      ],
      headers: [
        { source: '**', headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ] },
        { source: '**/*.html', headers: [{ key: 'Cache-Control', value: 'public, max-age=300, s-maxage=900' }] },
        { source: '/', headers: [{ key: 'Cache-Control', value: 'public, max-age=300, s-maxage=900' }] },
        { source: '/_astro/**', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
        { source: '/img/**', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }] },
        { source: '/fonts/**', headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ] },
        { source: '/_files/**', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }] },
        { source: '/js/**', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }] },
        { source: '/@(robots.txt|llms.txt)', headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
        ] },
        { source: '/*sitemap.xml', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }] },
        { source: '/api/**', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
      ],
    },
  };
}
