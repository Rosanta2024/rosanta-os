# Rosanta · Design System (React)

Paquete de design system de **Rosanta — La Segunda Cosecha**, listo para alimentar **Claude Design** por la vía de mayor fidelidad.

## Cómo cargarlo en Claude Design

1. En Claude Design → **Design systems → Set up design system → Add a design system**.
2. Elige **"Create using Claude Code"** (*Best fidelity*).
3. Apunta Claude Code a esta carpeta (`rosanta-design-system/`). Los componentes de `src/components/` y los tokens de `src/tokens.js` le enseñan la marca.

> Alternativa sin código: **"Create here" → upload assets**, y sube la carpeta `assets/` (logo, flor, fuentes) junto con `../Rosanta_Brand_Kit_Maestro.md`.

## Qué hay aquí

```
rosanta-design-system/
├─ tokens.css            Variables CSS + @font-face (Peskia, Playfair)
├─ src/
│  ├─ tokens.js          Color, tipografía, radios y reglas de marca
│  ├─ App.jsx            Showcase de la marca y los componentes
│  └─ components/        Logo, Flor, Statement, Card, Pill, Button, Swatches, Typography
└─ assets/
   ├─ logo/              Wordmark verde/crema/blanco/negro
   ├─ graficos/          La flor (botánica + 4 pétalos, variantes)
   └─ fonts/             Peskia (ES), Playfair Display
```

## Reglas que no se rompen

- **Color:** verde y crema/negro mandan; **lila es la única chispa**, siempre pequeña. **Nunca** el mostaza `#FABF52`.
- **Tipografía:** **Peskia solo en títulos hero** (mayúsculas, grande, 2–3 palabras). Playfair para el resto. Avenir/Lato cuerpo.
- **Forma:** diseño plano, **sin sombras**. La flor y las formas son definidas, **nunca blobs**.
- **Voz:** segunda persona, el comensal es el protagonista; sin "nuestro", sin empezar con "En Rosanta...".

El brief completo está en `../Rosanta_Brand_Kit_Maestro.md`.
