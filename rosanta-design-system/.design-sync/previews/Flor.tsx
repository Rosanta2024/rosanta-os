import { Flor } from 'rosanta-design-system';

export const Botanica = () => <Flor kind="botanica" width={140} />;

export const GrandeVerde = () => <Flor kind="grande" fill="verde" width={180} />;

export const GrandeLila = () => <Flor kind="grande" fill="lila" width={180} />;

export const GrandeCrema = () => (
  <div style={{ background: '#4E6D5A', padding: 24 }}>
    <Flor kind="grande" fill="crema" width={180} />
  </div>
);
