// Rosanta button. Flat (no shadows). Primary = verde on crema; inverse = crema on verde.
import React from 'react';
import { colors, fonts, radii } from '../tokens';

export default function Button({ children, variant = 'primary', style, ...rest }) {
  const styles = {
    primary: { background: colors.verde, color: colors.crema, border: 'none' },
    inverse: { background: colors.crema, color: colors.verde, border: 'none' },
    ghost:   { background: 'transparent', color: colors.verde, border: `1.5px solid ${colors.verde}` },
  }[variant];
  return (
    <button
      style={{
        fontFamily: fonts.label, fontWeight: 600, fontSize: 13,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        padding: '11px 22px', borderRadius: radii.pill, cursor: 'pointer',
        boxShadow: 'none', ...styles, ...style,
      }}
      {...rest}
    >{children}</button>
  );
}
