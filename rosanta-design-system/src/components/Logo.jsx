// Rosanta wordmark. The O is a solid filled circle — the brand icon.
// Pick the variant by background: dark bg -> crema/white, light bg -> verde/black.
import React from 'react';
// Wordmarks are imported (not string paths) so the bundler inlines them as
// data URIs — the DS ships self-contained, no external asset requests.
import wordmarkVerde from '../../assets/logo/rosanta-wordmark-verde.png';
import wordmarkCrema from '../../assets/logo/rosanta-wordmark-crema.png';
import wordmarkWhite from '../../assets/logo/rosanta-wordmark-white.png';
import wordmarkBlack from '../../assets/logo/rosanta-wordmark-black.png';

const SRC = {
  verde: wordmarkVerde,
  crema: wordmarkCrema,
  white: wordmarkWhite,
  black: wordmarkBlack,
};

/**
 * @param {'verde'|'crema'|'white'|'black'} variant
 * @param {number} width  min ~120px; below that use the O isotype instead
 */
export default function Logo({ variant = 'verde', width = 220, style }) {
  return (
    <img
      src={SRC[variant]}
      alt="ROSANTA"
      width={width}
      // Clear space: keep empty space around the logo of at least the height of the O.
      style={{ display: 'block', height: 'auto', ...style }}
    />
  );
}
// Never: stretch, rotate, add shadows/outlines/gradients, recolor off-palette, or fill the O.
