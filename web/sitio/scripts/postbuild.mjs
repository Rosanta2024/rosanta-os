// Después de "astro build": genera robots.txt, sitemaps, llms.txt y el mapa de 301 (firebase.json
// lo lee de data/redirecciones.json). Ver scripts/lib/salida.mjs.
// Y los tamaños chicos de las fotos (scripts/variantes.mjs), que las páginas piden con srcset.
import { generarTodo } from './lib/salida.mjs';
import { generarVariantes } from './variantes.mjs';
await generarTodo();
console.log(`postbuild: ${await generarVariantes()} tamaños de foto`);
