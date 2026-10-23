// Astro genera HTML estático: cada página se lee completa SIN JavaScript.
// build.format 'file' → dist/reservas.html, que Firebase sirve en /reservas (cleanUrls).
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.rosanta.rest',
  // ROSANTA_DIST: otra carpeta de salida (las pruebas de la segunda vuelta usan dist-sv). Sin ella, dist.
  ...(process.env.ROSANTA_DIST ? { outDir: './' + process.env.ROSANTA_DIST } : {}),
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'always', assets: '_astro' },
  compressHTML: true,
  devToolbar: { enabled: false },
  // Las direcciones de Wix llevan acentos (/política-de-privacidad): se respetan tal cual.
});
