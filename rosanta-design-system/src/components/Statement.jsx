// Statement — the hero social piece (1080x1350). Black bg, Playfair headline with a
// verde italic flourish, short body, logo bottom-left, "Cocina con Carisma" bottom-right.
import React from 'react';
import { colors, fonts } from '../tokens';
import Logo from './Logo';

/**
 * @param {string} eyebrow  small Poppins kicker (verde)
 * @param {string} headline main line (Playfair, white)
 * @param {string} flourish italic tail in verde-medio (the signature gesture)
 * @param {string} body     one or two short lines
 */
export default function Statement({ eyebrow, headline, flourish, body }) {
  return (
    <div style={{
      position: 'relative', width: 432, height: 540, background: colors.negro,
      color: colors.crema, padding: '44px 40px', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', overflow: 'hidden',
    }}>
      {eyebrow && (
        <div style={{ fontFamily: fonts.label, fontWeight: 600, letterSpacing: '0.28em',
          textTransform: 'uppercase', fontSize: 11, color: colors.verdeMedio, marginBottom: 14 }}>
          {eyebrow}
        </div>
      )}
      <div style={{ fontFamily: fonts.title, fontWeight: 800, fontSize: 40, lineHeight: 1.04, color: '#fff' }}>
        {headline}{' '}
        {flourish && <em style={{ color: colors.verdeMedio, fontStyle: 'italic' }}>{flourish}</em>}
      </div>
      {body && (
        <p style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 1.55, color: colors.muted, marginTop: 18, maxWidth: 320 }}>
          {body}
        </p>
      )}
      <div style={{ position: 'absolute', left: 40, bottom: 34 }}>
        <Logo variant="crema" width={130} />
      </div>
      <div style={{ position: 'absolute', right: 40, bottom: 38, fontFamily: fonts.label,
        letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: 9, color: '#7a8a7e' }}>
        Cocina con Carisma
      </div>
    </div>
  );
}
