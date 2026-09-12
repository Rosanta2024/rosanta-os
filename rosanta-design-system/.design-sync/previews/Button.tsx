import { Button } from 'rosanta-design-system';

export const Primary = () => <Button variant="primary">Reservar mesa</Button>;

export const Ghost = () => <Button variant="ghost">Ver la carta</Button>;

export const Inverse = () => (
  <div style={{ background: '#4E6D5A', padding: 24, borderRadius: 14 }}>
    <Button variant="inverse">Reservar mesa</Button>
  </div>
);

export const Disabled = () => (
  <Button variant="primary" disabled style={{ opacity: 0.45, cursor: 'not-allowed' }}>
    Sin disponibilidad
  </Button>
);
