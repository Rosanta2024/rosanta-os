// Card. Flat, hairline border, radius 14. Tones: light (crema), dark (panel), green (accent).
import React from 'react';
import { colors, fonts, radii } from '../tokens';

export default function Card({ title, children, tone = 'light' }) {
  const skins = {
    light: { background: colors.blanco, border: `1px solid #e4dfd2`, color: '#1a1a1a', titleColor: colors.verde },
    dark:  { background: colors.panel, border: `1px solid ${colors.line}`, color: colors.muted, titleColor: colors.verdeMedio },
    green: { background: colors.verde, border: 'none', color: '#e7e3d8', titleColor: '#bfe6cf' },
  }[tone];
  return (
    <div style={{
      background: skins.background, border: skins.border, color: skins.color,
      borderRadius: radii.card, padding: '14px 16px', boxShadow: 'none',
    }}>
      {title && (
        <div style={{
          fontFamily: fonts.label, fontWeight: 700, fontSize: 11,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: skins.titleColor, marginBottom: 6,
        }}>{title}</div>
      )}
      <div style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}
