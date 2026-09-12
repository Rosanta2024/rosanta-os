// Rosanta · Design System — tokens (La Segunda Cosecha)
// Single source of truth for color, type, radii. Import into components.

export const colors = {
  verde: '#4E6D5A',        // Verde Bosque — brand anchor, bg, logo, titles on light
  verdeMedio: '#57A77F',   // Verde Medio — accent / CTA / title flourish / eyebrows
  lila: '#AEAAE2',         // Lila — the ONLY spark, never a main surface
  crema: '#F2EEEB',        // Crema — most-used light background
  negro: '#000000',        // Negro — statements, emotional/impact content
  blanco: '#FFFFFF',       // Blanco — print
  // support
  verdeTint: '#EEF4EF',
  lilaTint: '#F2F0F8',
  panel: '#141414',
  line: '#2A2A2A',
  muted: '#B7B5AD',
};

// Discarded on purpose — do NOT reintroduce. Breaks the one-spark rule.
export const DO_NOT_USE = { mostaza: '#FABF52' };

export const fonts = {
  hero: "'Peskia', 'Playfair Display', serif",   // HERO ONLY — uppercase, 80-90pt, 2-3 words
  title: "'Playfair Display', serif",            // all other titles/subtitles, weight 800
  body: "'Avenir', 'Lato', system-ui, sans-serif",
  label: "'Poppins', system-ui, sans-serif",     // eyebrows, pills, footers — uppercase, wide tracking
};

export const radii = { card: 14, pill: 20, chip: 9 };

// Design rules encoded for tooling:
export const rules = {
  shadows: 'none',                 // flat design, never shadows
  lila: 'accent only, small',      // never a background
  peskia: 'hero titles only, UPPERCASE, large, 2-3 words',
  voice: '2nd person, guest is the hero, never start with "En Rosanta...", no em dashes',
  photo: 'warm light, real textures, garden & grill; never cold stock',
};
