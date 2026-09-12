// Palette reference. Verde + crema/negro rule the system; lila is the only spark.
import React from 'react';
import { colors, fonts } from '../tokens';

const SWATCHES = [
  ['Verde Bosque', colors.verde, '#4E6D5A'],
  ['Verde Medio', colors.verdeMedio, '#57A77F'],
  ['Lila Lavanda', colors.lila, '#AEAAE2'],
  ['Crema', colors.crema, '#F2EEEB'],
  ['Negro', colors.negro, '#000000'],
  ['Blanco', colors.blanco, '#FFFFFF'],
];

export default function Swatches() {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {SWATCHES.map(([name, hex, label]) => (
        <div key={name} style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ height: 56, borderRadius: 9, background: hex, border: '1px solid #0000001a' }} />
          <div style={{ fontFamily: fonts.label, fontWeight: 600, fontSize: 9, textTransform: 'uppercase',
            letterSpacing: '0.04em', marginTop: 5 }}>{name}</div>
          <div style={{ fontFamily: fonts.label, fontSize: 8.5, color: '#8b8578' }}>{label}</div>
        </div>
      ))}
    </div>
  );
}
