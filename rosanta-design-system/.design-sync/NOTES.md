# Rosanta design-sync — notes for future syncs

This repo is a **source-only** React DS (no dist, no Storybook, no TypeScript). It's synced via the package shape in **synth-entry mode**, with adaptations recorded below.

## Environment
- **No Node.js was installed on this machine.** A local Node 20 (arm64) was downloaded into the session scratchpad and put on PATH. A future sync on a machine without node must do the same (`curl` from nodejs.org works; sandbox allows it). npm/node are `#!/usr/bin/env node` scripts, so PATH must include the node bin dir on every shell call.
- **React is pinned to 18** (`package.json`). Do NOT bump to 19: `lib/emit.mjs`'s `vendorReact` reads `react/umd/react.development.js`, and React 19 removed the `umd/` builds. The preview cards would fail to load React.
- **Render check uses the system Google Chrome**, not a Playwright-downloaded browser. Install only the `playwright` npm lib (with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`) in `.ds-sync/`, then run validate/capture with `DS_CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.

## Build invocation
```
node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --entry ./src/index.js --out ./ds-bundle
DS_CHROMIUM_PATH=<system Chrome> node .ds-sync/package-validate.mjs ./ds-bundle
```
`--entry ./src/index.js` + full `componentSrcMap` is required (no dist, no .d.ts → discovery has nothing to enumerate otherwise). `dtsPropsFor` hand-writes every `<Name>Props` since there are no shipped types.

## Repo adaptations made for bundleability
- **`src/index.js`** is a barrel that named-re-exports every component (incl. the default-export ones) so they all land on `window.Rosanta`. A plain `export *` synth entry would drop the defaults.
- **`Logo.jsx` / `Flor.jsx`** were changed from string-literal image `src` paths to `import` statements, so esbuild inlines the PNGs as data URIs. (The original strings — `../assets/...` from `src/components/` — were also just wrong; correct depth is `../../assets/`.)

## Fonts
- Peskia + Playfair Display ship from the repo (`tokens.css` @font-face, `.ttf`).
- **Poppins (400/500/600/700) and Lato (400/700) were fetched from Google Fonts** (SIL OFL, embeddable) into `assets/fonts/`, wired via `cfg.extraFonts → assets/fonts/brand-fonts.css`. Re-fetch script: `scratchpad/fetch-fonts.mjs` (not committed).
- **Avenir is intentionally NOT shipped** (proprietary). It's the first entry in the body font stack and falls back to the shipped Lato. `[FONT_MISSING] "Avenir"` on every validate is **expected and accepted** — not a new warn.

## Known render warns (accepted)
- `[FONT_MISSING] "Avenir"` — proprietary, falls back to Lato. Accepted by the user on the 2026-07-03 first sync.

## Overrides
- `Statement` uses `cardMode: "column"` — it's a 432×540 social poster, wider than a grid cell.

## Re-sync risks (what can silently go stale)
- **`dtsPropsFor` is hand-maintained.** If a component's real props change in source, the `.d.ts` won't follow automatically — update `dtsPropsFor` when editing a component's signature. New components need a `componentSrcMap` entry AND a `dtsPropsFor` entry or their contract is empty.
- **Google-fetched fonts** live in `assets/fonts/` (committed). If deleted, re-run the fetch (Poppins + Lato, latin subset). The Google woff2 URLs rotate, so pin the local copies.
- **The barrel + image-import edits** are load-bearing. If someone regenerates `src/` or reverts `Logo.jsx`/`Flor.jsx` to string paths, images break in the bundle.
- **Node/Chrome are environment-provided**, not in the repo. A fresh clone re-does the local-node download and relies on system Chrome being present.
