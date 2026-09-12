// Type scale reference. Peskia = HERO ONLY (uppercase, huge). Playfair = all other titles.
// Avenir/Lato = body. Poppins = eyebrows/labels. Signature gesture: verde-medio italic tail.
import React from 'react';
import { colors, fonts } from '../tokens';

export function Hero({ children }) {
  return <h1 style={{ fontFamily: fonts.hero, textTransform: 'uppercase', fontSize: 72,
    lineHeight: 0.94, letterSpacing: '0.01em', margin: 0, color: colors.negro }}>{children}</h1>;
}

export function Title({ children, flourish }) {
  return (
    <h2 style={{ fontFamily: fonts.title, fontWeight: 800, fontSize: 27, lineHeight: 1.1, margin: 0, color: colors.negro }}>
      {children}{' '}
      {flourish && <em style={{ color: colors.verdeMedio, fontStyle: 'italic' }}>{flourish}</em>}
    </h2>
  );
}

export function Eyebrow({ children }) {
  return <div style={{ fontFamily: fonts.label, fontWeight: 600, letterSpacing: '0.3em',
    textTransform: 'uppercase', fontSize: 11, color: colors.verdeMedio }}>{children}</div>;
}

export function Body({ children }) {
  return <p style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 1.58, color: '#2a2a2a' }}>{children}</p>;
}
