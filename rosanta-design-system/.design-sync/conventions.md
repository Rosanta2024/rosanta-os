# Rosanta — building with this design system

Rosanta ("La Segunda Cosecha") is a restaurant brand. Warm, editorial, garden-and-grill. Build every screen from the components below — don't hand-roll lookalikes.

## Setup — no provider needed

Components are self-styling (inline styles driven by the exported tokens). There is **no context provider to wrap** — render a component and it's styled. The one requirement: `styles.css` must be loaded, because that's what ships the brand `@font-face` rules (Peskia, Playfair Display, Poppins, Lato). Without it, headings fall back to system fonts and the brand breaks.

## The styling idiom — props + tokens, NOT CSS classes

There is **no utility-class vocabulary and no `className` API**. You style in two ways:

1. **Component props** carry the design language. Learn each component's `variant` / `tone` / `kind` / `fill` from its `.d.ts` and `.prompt.md` — those enums ARE the brand's sanctioned looks. `Logo` and `Button` also accept a `style` prop for spacing.
2. **For your own layout glue** (page backgrounds, grids, sections), use the tokens — either the CSS custom properties or the exported JS token objects. Both are real and identical:

| CSS variable | JS token | Value | Use |
|---|---|---|---|
| `--rosanta-verde` | `colors.verde` | `#4E6D5A` | brand anchor, bg, titles on light |
| `--rosanta-verde-medio` | `colors.verdeMedio` | `#57A77F` | accent / CTA / the italic flourish |
| `--rosanta-lila` | `colors.lila` | `#AEAAE2` | the ONLY spark — always small |
| `--rosanta-crema` | `colors.crema` | `#F2EEEB` | most-used light background |
| `--rosanta-negro` | `colors.negro` | `#000000` | statements / impact |
| `--rosanta-font-hero` | `fonts.hero` | Peskia | HERO titles only |
| `--rosanta-font-title` | `fonts.title` | Playfair | all other titles |
| `--rosanta-font-body` | `fonts.body` | Avenir/Lato | body copy |
| `--rosanta-font-label` | `fonts.label` | Poppins | eyebrows, pills, buttons |
| `--rosanta-radius-pill` / `--rosanta-radius-card` | `radii.pill` (20) / `radii.card` (14) | | pills / cards |

Full palette, tints, spacing scale (`--rosanta-space-1..8`) and the machine-readable `rules` object are in `_ds/rosanta-design-system/tokens.css` and on `window.Rosanta.rules`. Read them before styling.

## Rules that never break (the brand depends on these)

- **Color:** verde + crema/negro rule. **Lila is the only spark — always small, never a surface.** Never the discarded mustard `#FABF52`.
- **Type:** **Peskia only on hero titles** (`<Hero>`, uppercase, 2–3 words). Playfair (`<Title>`) for everything else. The signature gesture is the verde-medio *italic* tail (`flourish` prop on `Title` / `Statement`).
- **Shape:** flat design, **no shadows, ever**. The flower (`<Flor>`) and shapes are always defined — never blobs.
- **Voice:** second person, the guest is the hero. No "nuestro", don't open with "En Rosanta…", no em dashes.

## Which component

`Hero` big uppercase display · `Title` section headings (+`flourish`) · `Eyebrow` kickers · `Body` copy · `Button` (`primary`/`inverse`/`ghost`) · `Pill` tags (`tone` verde/lila) · `Card` (`tone` light/dark/green) · `Logo` wordmark (`variant` verde/crema/white/black — pick by background) · `Flor` flower (`kind` botanica/grande, `fill`) · `Swatches` palette · `Statement` the hero social poster.

## Idiomatic snippet

```jsx
import { Eyebrow, Title, Body, Button, Pill } from 'rosanta-design-system';

<section style={{ background: 'var(--rosanta-crema)', padding: 48 }}>
  <Eyebrow>La Segunda Cosecha</Eyebrow>
  <Title flourish="comer bien">No necesitas arreglarte para</Title>
  <Body>Venís como sos, te sentás en el jardín y te quedás hasta la sobremesa.</Body>
  <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
    <Button variant="primary">Reservar mesa</Button>
    <Pill tone="lila">Fuego</Pill>
  </div>
</section>
```
