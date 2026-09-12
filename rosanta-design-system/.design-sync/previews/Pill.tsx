import { Pill } from 'rosanta-design-system';

export const Verde = () => <Pill>Fresco</Pill>;

export const Lila = () => <Pill tone="lila">Fuego</Pill>;

export const Group = () => (
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
    <Pill>Fresco</Pill>
    <Pill>De temporada</Pill>
    <Pill>Del huerto</Pill>
    <Pill tone="lila">Fuego</Pill>
  </div>
);
