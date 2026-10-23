// Menú del encabezado (Juanma, 23-oct): 6 pestañas a la vista, ordenadas por lo que más ayuda a reservar,
// y el resto en "Más" / "More". Igual en EN y ES. Para cambiar qué se ve, se mueve la línea de una lista a la otra.
// Las anclas de la portada son los id de sección de la copia de Wix (los mismos del menú de Wix).
const SEC = { cocina: 'comp-lgv2q4wf2', menu: 'comp-mszglxqs', galeria: 'comp-mstjttj6', contacto: 'comp-lhjc19fq' };

export const NAVEGACION = {
  es: {
    principales: [
      { texto: 'GALERÍA', href: `/es#${SEC.galeria}` },   // Juanma, 23-oct: en lugar de ROSANTA (el logo lleva al inicio)
      { texto: 'MENÚ', href: '/es/full-menu' },
      { texto: 'EVENTOS', href: '/es/events-1' },
      { texto: 'IDEAS PARA REGALAR', href: '/es/gift-ideas' },
      { texto: 'CONTACTO', href: `/es#${SEC.contacto}` },
    ],
    reservar: { texto: 'RESERVA TU MESA', corto: 'RESERVAR', href: '/es/reservas' },
    mas: { texto: 'MÁS', items: [
      { texto: 'Cocina honesta', href: `/es#${SEC.cocina}` },
      { texto: 'Ubicación', href: `/es#mapa` },
      { texto: 'Preguntas frecuentes', href: '/es/preguntas-frecuentes' },
      { texto: 'Política de privacidad', href: '/es/política-de-privacidad' },
    ] },
  },
  en: {
    principales: [
      { texto: 'GALLERY', href: `/#${SEC.galeria}` },
      { texto: 'MENU', href: '/full-menu' },
      { texto: 'EVENTS', href: '/events-1' },
      { texto: 'GIFT IDEAS', href: '/gift-ideas' },
      { texto: 'CONTACT', href: `/#${SEC.contacto}` },
    ],
    reservar: { texto: 'BOOK A TABLE', corto: 'BOOK', href: '/reservas' },
    mas: { texto: 'MORE', items: [
      { texto: 'Honest cooking', href: `/#${SEC.cocina}` },
      { texto: 'Location', href: `/#mapa` },
      { texto: 'FAQ', href: '/preguntas-frecuentes' },
      { texto: 'Privacy policy', href: '/política-de-privacidad' },
    ] },
  },
};

/** Las palabras del menú de Wix que el rediseño cambió o movió, y "open" de "OPEN HOURS" (ahora "HOURS", revisor de marca)
 *  (para la prueba de "texto sin JavaScript"). */
export const PALABRAS_MENU_WIX = ['honest', 'cooking', 'menu', 'gallery', 'reservaciones', 'reservations', 'eventos', 'events',
  'ideas', 'para', 'regalar', 'gift', 'preguntas', 'frecuentes', 'faq', 'política', 'de', 'privacidad', 'privacy', 'policy',
  'contact', 'location', 'rosanta', 'open', 'galería', 'galeria'];
