import { Logo } from 'rosanta-design-system';

export const OnLight = () => (
  <div style={{ background: '#F2EEEB', padding: 28 }}>
    <Logo variant="verde" width={200} />
  </div>
);

export const OnDark = () => (
  <div style={{ background: '#141414', padding: 28 }}>
    <Logo variant="crema" width={200} />
  </div>
);

export const OnGreen = () => (
  <div style={{ background: '#4E6D5A', padding: 28 }}>
    <Logo variant="white" width={200} />
  </div>
);

export const Black = () => (
  <div style={{ background: '#FFFFFF', padding: 28 }}>
    <Logo variant="black" width={200} />
  </div>
);
