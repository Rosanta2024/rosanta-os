// Web v3 (rediseño visual, 24-oct-2026). Textos de la portada, menú a pantalla completa, pie y la carta por pestañas.
// Todo lo que ve el cliente está en este archivo, en ES y EN, para revisarlo en un solo lugar (revisor de marca).
// Los textos marcados "(sitio)" ya están publicados hoy; los demás son nuevos.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { datos } from './sitio.mjs';

const RAIZ = process.env.ROSANTA_SITIO_RAIZ || process.cwd();
let _cap;
const capturado = () => (_cap ||= JSON.parse(readFileSync(path.join(RAIZ, 'data', 'contenido-capturado.json'), 'utf8')));
/** Texto ya publicado en la portada (data/contenido-capturado.json, por id de bloque). */
const sitio = (id, l) => String(capturado().paginas.inicio.bloques[id]?.[l] || '').trim();
const parrafos = (id, l) => sitio(id, l).split('\n').map((p) => p.trim()).filter(Boolean);

export const RUTAS = {
  es: { inicio: '/es', carta: '/es/full-menu', reservar: '/es/reservas', eventos: '/es/events-1', regalos: '/es/gift-ideas', faq: '/es/preguntas-frecuentes', privacidad: '/es/política-de-privacidad', terminos: '/es/términos-y-condiciones' },
  en: { inicio: '/', carta: '/full-menu', reservar: '/reservas', eventos: '/events-1', regalos: '/gift-ideas', faq: '/preguntas-frecuentes', privacidad: '/política-de-privacidad', terminos: '/términos-y-condiciones' },
};

/** Las 4 pestañas de la carta (Ni-Fu Ni-Fa) y las secciones de la carta de hoy que van en cada una. */
export const PESTANAS = [
  { id: 'para-compartir', es: 'Para compartir', en: 'To share', secciones: [1] },
  { id: 'del-fuego', es: 'Del fuego', en: 'From the fire', secciones: [4, 3, 5] },
  { id: 'del-jardin', es: 'Del jardín', en: 'From the garden', secciones: [2] },
  { id: 'la-barra', es: 'La barra', en: 'The bar', secciones: 'resto' },
];

export function textos(l) {
  const es = l === 'es';
  const r = RUTAS[l];
  const coord = '14° N · 91° W'; // forma oficial, igual en los dos idiomas (guía de marca)
  // Videos con texto en español: solo en la página en español (en inglés va su versión en inglés o una toma limpia).
  const v = (enEs, enEn) => (es ? enEs : enEn);
  return {
    coord,
    menu: {
      abrir: es ? 'Menú' : 'Menu',
      cerrar: es ? 'Cerrar menú' : 'Close menu',
      reservar: es ? 'Reservar' : 'Book',
      principales: [
        { texto: es ? 'Reservar' : 'Book', href: r.reservar },
        { texto: es ? 'Comer' : 'Eat', href: `${r.carta}#para-compartir` },
        { texto: es ? 'Beber' : 'Drink', href: `${r.carta}#la-barra` },
        { texto: es ? 'Eventos' : 'Events', href: r.eventos },
        { texto: es ? 'Regalos' : 'Gifts', href: r.regalos },
      ],
      secundarios: [
        { texto: es ? 'La carta completa' : 'Full menu', href: r.carta },
        { texto: es ? 'Cómo llegar' : 'Find us', href: `${r.inicio}#como-llegar` },
        { texto: es ? 'Preguntas frecuentes' : 'FAQ', href: r.faq },
      ],
      fotos: ['/v3/espacios/pergola.webp', '/v3/platos/arroz-meloso.webp', '/v3/espacios/fogata.webp', '/v3/platos/bok-choy.webp', '/v3/espacios/jardin.webp', '/v3/platos/lomito-de-la-casa.webp'],
    },
    barra: {
      reservar: es ? 'Reservar mesa' : 'Book a table',
      whatsapp: es ? 'Escribir por WhatsApp' : 'Message us on WhatsApp',
      resenas: es ? 'reseñas' : 'reviews',
    },
    portada: {
      etiqueta: `Antigua Guatemala · ${coord}`,
      titulo: es ? 'FRESCO Y FUEGO' : 'FRESH & FIRE',
      bajada: es
        ? 'Cocina del jardín, parrilla abierta y cocteles que se sientan a la mesa.'
        : 'Garden cooking, an open grill and cocktails that take a seat at the table.',
      cuando: es ? '¿Cuándo vienes?' : 'When are you coming?',
      dias: es ? ['Hoy', 'Mañana', 'Sábado', 'Otra fecha'] : ['Today', 'Tomorrow', 'Saturday', 'Other date'],
      cuantos: es ? '¿Cuántos son?' : 'How many?',
      personas: ['1', '2', '3', '4', '5+'],
      boton: es ? 'Ver mesas libres' : 'See open tables',
      resenas: es ? 'reseñas en Google' : 'Google reviews',
      video: es ? 'Video: el volcán sobre Antigua, la entrada de Rosanta, la parrilla encendida y una mesa con velas.' : 'Video: the volcano over Antigua, the Rosanta entrance, the grill lit and a candlelit table.',
    },
    manifiesto: {
      etiqueta: es ? 'FRESCO Y FUEGO.' : 'FRESH & FIRE.',
      titulo: es ? 'TODO COMIENZA EN LA TIERRA' : 'IT ALL STARTS IN THE SOIL',
      lineas: sitio('comp-mszgypvv', l).split('\n').map((x) => x.trim()).filter(Boolean), // (sitio) JARDÍN, COSECHA, MESA…
      texto: parrafos('comp-mszh3qyb', l)[0], // (sitio)
      video: v('tierra-es', 'cocina'),
      alt: v('Video: "Todo comienza en la tierra". Manos que siembran en el huerto.', 'Video: hands finishing a dish with seeds and sauce.'),
      fila: v(['sostenible-es', 'compartir', 'fuego', 'barra'], ['compartir', 'fuego', 'cocina', 'barra']),
      filaAlt: es ? 'Videos cortos: gastronomía sostenible en el huerto, queso horneado, platos de la parrilla y un coctel.' : 'Short videos: baked cheese, dishes from the grill, a dish finished at the table and a cocktail.',
      boton: es ? 'Reservar mesa' : 'Book a table',
    },
    nuevos: {
      etiqueta: es ? 'NUEVO EN LA CARTA.' : 'NEW ON THE MENU.',
      titulo: es ? 'RECIÉN LLEGADOS' : 'JUST IN',
      video: v('nuevo-es', 'nuevo-en'),
      alt: es ? 'Video: los platos nuevos, del huerto a la parrilla.' : 'Video: the new dishes, from the garden to the grill.',
      completa: es ? 'Ver la carta completa' : 'See the full menu',
    },
    bloques: [
      {
        id: 'del-jardin', fondo: 'verde', video: 'cocina', lado: 'izq',
        etiqueta: coord + '.',
        titulo: es ? 'DEL JARDÍN' : 'FROM THE GARDEN',   // nombre propio en lugar de "Honest Cooking"
        entrada: sitio('comp-mszh26e7', l), // (sitio)
        texto: es
          ? 'Lo que el huerto no da lo traen productores de cerca, que siembran según la temporada.'
          : "What the garden doesn't grow comes from nearby producers who plant by the season.",
        enlace: { texto: es ? 'Ver platos del jardín →' : 'See garden dishes →', href: `${r.carta}#del-jardin` },
        alt: es ? 'Video: manos terminando un plato con semillas y salsa.' : 'Video: hands finishing a dish with seeds and sauce.',
      },
      {
        id: 'del-fuego', fondo: 'carbon', video: 'fuego', lado: 'der',
        etiqueta: es ? 'DEL FUEGO.' : 'FROM THE FIRE.',
        titulo: es ? 'PARRILLA ABIERTA' : 'OPEN GRILL',
        entrada: es ? 'La parrilla está a la vista, y se nota.' : 'The grill is in plain sight, and you can taste it.',
        texto: es
          ? 'Carne, pesca responsable y vegetales pasan por la parrilla y llegan a tu mesa con el humo todavía encima.'
          : 'Meat, responsibly caught fish and vegetables go over the grill and reach your table with the smoke still on them.',
        enlace: { texto: es ? 'Ver platos del fuego →' : 'Dishes from the fire →', href: `${r.carta}#del-fuego` },
        alt: es ? 'Video: platos recién servidos con cocteles a la luz de las velas.' : 'Video: freshly plated dishes with cocktails by candlelight.',
      },
      {
        id: 'la-barra', fondo: 'crema', video: 'barra', lado: 'izq',
        etiqueta: es ? 'GASTROCOCTELERÍA.' : 'GASTRO COCKTAILS.',
        titulo: es ? 'LA BARRA' : 'THE BAR',
        entrada: es ? 'El coctel se sienta a la mesa.' : 'The cocktail gets a seat at the table.',
        texto: parrafos('comp-mszh3qyb', l)[1], // (sitio) "La barra cuenta la misma historia…"
        enlace: { texto: es ? 'Ver la barra →' : 'See the bar →', href: `${r.carta}#la-barra` },
        alt: es ? 'Video: un bartender sirve y termina un coctel con cáscara de naranja.' : 'Video: a bartender pours and finishes a cocktail with orange peel.',
      },
    ],
    reservarMesa: es ? 'Reservar mesa' : 'Book a table',
    carta: {
      etiqueta: es ? 'LA CARTA.' : 'THE MENU.',
      titulo: es ? '¿QUÉ SE TE ANTOJA?' : 'WHAT ARE YOU CRAVING?',
      tarjetas: [
        { id: 'para-compartir', texto: es ? 'Para compartir' : 'To share', img: '/v3/platos/tabla-jamones-quesos.webp', alt: es ? 'Tabla de jamones y quesos con encurtidos y fruta' : 'Charcuterie and cheese board with pickles and fruit' },
        { id: 'del-fuego', texto: es ? 'Del fuego' : 'From the fire', img: '/v3/platos/lomito-de-la-casa.webp', alt: es ? 'Lomito de la casa con puré de espinaca y zanahorias' : 'House tenderloin with spinach purée and carrots' },
        { id: 'del-jardin', texto: es ? 'Del jardín' : 'From the garden', img: '/v3/platos/bol-mediterraneo.webp', alt: es ? 'Bol mediterráneo con huevo, garbanzos, pepino y tomate' : 'Mediterranean bowl with egg, chickpeas, cucumber and tomato' },
        { id: 'la-barra', texto: es ? 'La barra' : 'The bar', img: '/v3/carta-barra.webp', alt: es ? 'Coctel con hielo recién servido en la barra de Rosanta' : 'A freshly poured cocktail on ice at the Rosanta bar' },
      ],
    },
    experiencias: {
      etiqueta: es ? 'EXPERIENCIAS.' : 'EXPERIENCES.',
      titulo: es ? 'ALREDEDOR DE LA MESA' : 'AROUND THE TABLE',
      entrada: es ? 'La mejor mesa es la sobremesa.' : 'The best seat is the one after dinner.',
      tarjetas: [
        es
          ? { video: 'romantica-es', titulo: 'Cena romántica', texto: 'Una mesa para dos, con velas y sin prisa.', cta: 'Ver la cena romántica →', href: `${r.regalos}#comp-m5mon9bd`, alt: 'Video: "Momentos que enamoran". Una pareja llega a una mesa con velas y pétalos.' }
          : { foto: '/v3/espacios/fogata.webp', titulo: 'Romantic dinner', texto: 'A table for two, candlelit and unhurried.', cta: 'See the romantic dinner →', href: `${r.regalos}#comp-m5mon9bd`, alt: 'The firepit lit at night in the Rosanta garden' },
        { video: v('mesa-es', 'eventos'), titulo: es ? 'Eventos privados' : 'Private events', texto: es ? 'Cumpleaños, cenas de equipo y celebraciones en el jardín.' : 'Birthdays, team dinners and celebrations in the garden.', cta: es ? 'Cotiza tu evento →' : 'Request a quote →', href: r.eventos, alt: v('Video: "Lo mejor pasa alrededor de la mesa". Una mesa compartida en el jardín.', 'Video: a table set with shared plates.') },
        { foto: '/v3/espacios/pergola.webp', titulo: es ? 'Regala una noche' : 'Gift an evening', texto: es ? 'Hay regalos que terminan en un cajón. Una noche aquí se queda.' : 'Some gifts end up in a drawer. A night here stays with you.', cta: es ? 'Ideas para regalar →' : 'Gift ideas →', href: r.regalos, alt: es ? 'La pérgola con luces colgantes y mesas llenas de noche' : 'The pergola with string lights and full tables at night' },
      ],
    },
    resenas: { etiqueta: es ? 'LO QUE DICEN.' : 'WHAT GUESTS SAY.' },
    reserva: {
      etiqueta: es ? 'TU MESA TE ESPERA.' : 'YOUR TABLE IS WAITING.',
      titulo: es ? 'VEN COMO ERES' : 'COME AS YOU ARE',
      texto: es ? 'No necesitas arreglarte para comer bien. Eliges día, hora y cuántos son, y listo.' : 'No need to dress up to eat well. Pick the day, the time and how many, and you are set.',
      boton: es ? 'Reservar mesa' : 'Book a table',
      grupos: es ? '¿Son más de 10? Escríbenos por WhatsApp' : 'More than 10? Message us on WhatsApp',
      video: v('reserva-es', 'portada'),
      alt: v('Video: "Reserva tu mesa". Mesas, platos y la esquina de la Alameda Santa Rosa.', 'Video: the volcano over Antigua, the entrance, the grill lit and a candlelit table.'),
    },
    llegar: {
      etiqueta: es ? 'CÓMO LLEGAR.' : 'FIND US.',
      titulo: es ? 'EN LA ALAMEDA' : 'ON THE ALAMEDA',
      texto: es ? '1a Calle Oriente 15, en la esquina del parque de la Alameda Santa Rosa, Antigua Guatemala.' : '1a Calle Oriente 15, on the corner of the Alameda Santa Rosa park, Antigua Guatemala.',
      video: v('ubicacion-es', 'ubicacion-en'),
      alt: v('Video: la ubicación de Rosanta, 1a Calle Oriente 15, Antigua Guatemala.', 'Video: how to get to Rosanta, along the Alameda Santa Rosa in Antigua.'),
      maps: 'Google Maps',
      horarios: es ? 'Horarios' : 'Hours',
      mapa: es ? 'Mapa: Rosanta, 1a Calle Oriente 15, Antigua Guatemala' : 'Map: Rosanta, 1a Calle Oriente 15, Antigua Guatemala',
    },
    pie: {
      lema: es ? 'COCINA CON CARISMA' : 'COCINA CON CARISMA',
      direccion: es ? 'Dirección' : 'Address',
      horarios: es ? 'Horarios' : 'Hours',
      contacto: es ? 'Contacto' : 'Contact',
      como: es ? 'Cómo llegar' : 'Directions',
      telefono: es ? 'Teléfono' : 'Phone',
      correo: es ? 'Correo' : 'Email',
      legales: [
        { texto: es ? 'Preguntas frecuentes' : 'FAQ', href: r.faq },
        { texto: es ? 'Privacidad' : 'Privacy', href: r.privacidad },
        { texto: es ? 'Términos' : 'Terms', href: r.terminos },
      ],
    },
    cartaPagina: {
      etiqueta: coord + '.',
      titulo: es ? 'LA CARTA' : 'THE MENU',
      bajada: es
        ? 'Cambia con la temporada. Si un plato te llama la atención, pregunta de dónde viene. Muchos traen su coctel sugerido.'
        : 'It changes with the season. If a dish catches your eye, ask where it comes from. Many come with a suggested cocktail.',
      pestanas: es ? 'Categorías de la carta' : 'Menu categories',
      nota: es ? 'Precios en quetzales (GTQ).' : 'Prices in quetzales (GTQ).',
      maridaje: es ? 'maridaje sugerido' : 'suggested pairing',
      reservar: es ? 'Reservar mesa' : 'Book a table',
      foto: es ? 'Ver foto' : 'See photo',
      nuevos: es ? 'NUEVO EN LA CARTA' : 'NEW ON THE MENU',
    },
  };
}

/** Foto de cada plato que la tiene (solo fotos que corresponden sin duda al plato). Clave = nombre en español. */
export const FOTOS_PLATOS = {
  'Brócoli con Nduja': 'brocoli-nduja',
  'Vegetales Fermentados': 'vegetales-fermentados',
  'Arroz Meloso': 'arroz-meloso',
  'Bok Choy a la Parrilla': 'bok-choy',
  'Lomito de la Casa': 'lomito-de-la-casa',
  'Estofado de Rabo': 'estofado-de-rabo',
  'Pescado del Día': 'pescado-del-dia',
  'Pollo en Salsa de Tamarindo': 'pollo-tamarindo',
  'Tabla de Jamones y Quesos': 'tabla-jamones-quesos',
  'Bol Mediterráneo': 'bol-mediterraneo',
  'La Linda': 'la-linda',
};
/** Cabecera de cada pestaña de la carta: foto o video. */
export const CABECERAS = {
  'para-compartir': { foto: '/v3/platos/tabla-jamones-quesos.webp' },
  'del-fuego': { video: 'fuego' },
  'del-jardin': { foto: '/v3/platos/cab-jardin.webp' },
  'la-barra': { video: 'barra' },
};


/** Horarios del pie, desde el schema del restaurante (data/restaurante.json). */
export function horarios(l) {
  const es = l === 'es';
  const dias = es
    ? { Monday: 'Lunes', Tuesday: 'Martes', Wednesday: 'Miércoles', Thursday: 'Jueves', Friday: 'Viernes', Saturday: 'Sábado', Sunday: 'Domingo' }
    : { Monday: 'Monday', Tuesday: 'Tuesday', Wednesday: 'Wednesday', Thursday: 'Thursday', Friday: 'Friday', Saturday: 'Saturday', Sunday: 'Sunday' };
  const lista = datos().restaurante.openingHoursSpecification.map((h) => {
    const d = [].concat(h.dayOfWeek).map((x) => dias[x]);
    return { dias: d.length > 1 ? `${d[0]} ${es ? 'y' : '&'} ${es ? d[d.length - 1].toLowerCase() : d[d.length - 1]}` : d[0], horas: `${h.opens} - ${h.closes}` };
  });
  // Lunes y martes tienen el mismo horario: se juntan en una línea.
  const out = [];
  for (const h of lista) {
    const prev = out[out.length - 1];
    if (prev && prev.horas === h.horas && !prev.dias.includes(es ? ' y ' : ' & ')) prev.dias = `${prev.dias} ${es ? 'y' : '&'} ${es ? h.dias.toLowerCase() : h.dias}`;
    else out.push({ ...h });
  }
  return out;
}

// ---------------- Carta ----------------
const desescapar = (s) => String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ').trim();
const clave = (s) => desescapar(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Etiquetas de cada plato en la carta publicada (las del widget de Wix: "Hecho en casa", "Pesca responsable"…). */
function etiquetasPublicadas(l) {
  const ruta = l === 'es' ? '/es/full-menu' : '/full-menu';
  const p = datos().paginas.find((x) => x.ruta === ruta);
  const mapa = new Map();
  const buscar = (bs) => bs.forEach((b) => {
    if (b.t === 'widget' && /item\.root/.test(b.html)) {
      for (const it of b.html.split('data-hook="item.root"').slice(1)) {
        const n = it.match(/data-hook="item\.name"[^>]*>([^<]*)</);
        if (!n) continue;
        const labs = [...it.matchAll(/data-hook="item\.label"[^>]*>(?:<[^>]+>)*([^<]+)/g)].map((m) => desescapar(m[1]));
        mapa.set(clave(n[1]), labs);
      }
    }
    if (b.hijos) buscar(b.hijos);
  });
  if (p) buscar(p.bloques);
  return mapa;
}

/** "Normal 75,00 GTQ · Lomito 100,00 GTQ" / "Regular GTQ 75.00" → "Normal Q75 · Lomito Q100". */
const variantes = (t) => t.replace(/(?:GTQ\s*)?(\d+)[.,]00(?:\s*GTQ)?/g, 'Q$1');
const precio = (n) => (n == null ? '' : `Q${Math.round(n)}`);

export function carta(l) {
  const es = l === 'es';
  const menu = capturado().menu;
  const etiq = etiquetasPublicadas(l);
  const usadas = new Set(PESTANAS.flatMap((p) => (Array.isArray(p.secciones) ? p.secciones : [])));
  const orden = (ids) => ids.map((id) => menu.find((s) => s.id === id)).filter(Boolean);
  const barra = (() => {
    const resto = menu.filter((s) => !usadas.has(s.id));
    const peso = (s) => (/^C[ÓO]CTELES/i.test(s.nombre.es) ? 0 : /^VINOS|^CAVA/i.test(s.nombre.es) ? 1 : 2);
    return resto.map((s, i) => [s, i]).sort((a, b) => peso(a[0]) - peso(b[0]) || a[1] - b[1]).map(([s]) => s);
  })();
  return PESTANAS.map((p) => ({
    id: p.id,
    nombre: p[l],
    grupos: (p.secciones === 'resto' ? barra : orden(p.secciones)).map((s) => {
      const [cat, sub] = s.nombre[l].split(' · ');
      return {
        titulo: sub ? sub : cat,
        categoria: sub ? cat : '',
        nota: s.nota?.[l] || '',
        platos: s.platos.map((x) => {
          let d = x.descripcion[l] || '';
          const [cuerpo, varLinea] = d.split('\n');
          let desc = cuerpo;
          let maridaje = '';
          const m = desc.match(/\s*(?:Maridaje sugerido|Suggested pairing):\s*([^·.]+?)(?:\s*·[^.]*)?\.(\s|$)/);
          if (m) { maridaje = m[1].trim(); desc = (desc.slice(0, m.index) + ' ' + desc.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim(); }
          const pub = etiq.get(clave(x.nombre[l])) || [];
          const nuevo = pub.some((t) => /new/i.test(t));
          const etiquetas = pub.filter((t) => !/new/i.test(t));
          return {
            nombre: x.nombre[l].trim(),
            precio: varLinea ? '' : precio(x.precio_q),
            variantes: varLinea ? variantes(varLinea.trim()) : '',
            desc,
            maridaje,
            etiquetas,
            nuevo: nuevo ? (es ? 'Nuevo' : 'New') : '',
            foto: FOTOS_PLATOS[x.nombre.es.trim()] || '',
          };
        }),
      };
    }),
  }));
}
