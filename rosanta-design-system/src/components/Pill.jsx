// Label / tag. Poppins uppercase. Verde-medio by default; lila as an occasional spark.
import React from 'react';
import { colors, fonts, radii } from '../tokens';

export default function Pill({ children, tone = 'verde' }) {
  const bg = tone === 'lila' ? colors.lila : colors.verdeMedio;
  const fg = tone === 'lila' ? '#1a1726' : '#08120c';
  return (
    <span style={{
      display: 'inline-block',
      background: bg, color: fg,
      fontFamily: fonts.label, fontWeight: 700,
      fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
      padding: '4px 12px', borderRadius: radii.pill, margin: '2px 4px 2px 0',
    }}>{children}</span>
  );
}
