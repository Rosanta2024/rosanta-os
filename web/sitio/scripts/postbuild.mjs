// Después de "astro build": genera robots.txt, sitemaps, llms.txt y el mapa de 301 (firebase.json
// lo lee de data/redirecciones.json). Ver scripts/lib/salida.mjs.
import { generarTodo } from './lib/salida.mjs';
await generarTodo();
