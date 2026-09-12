// Rosanta signature flower. Two expressions — always DEFINED organic shapes, never blobs.
//  - 'botanica'  : lila bell + green leaves + thin stems. Medium/small accent.
//  - 'grande'    : symmetric 4-petal silhouette. Huge / full-bleed background, text in the center.
import React from 'react';
// Imported (not string paths) so the bundler inlines them as data URIs.
import florBotanica from '../../assets/graficos/rosanta-flor.png';
import florGrandeCrema from '../../assets/graficos/rosanta-flor-grande-crema.png';
import florGrandeVerde from '../../assets/graficos/rosanta-flor-grande-verde.png';
import florGrandeLila from '../../assets/graficos/rosanta-flor-grande-lila.png';

const SRC = {
  botanica: florBotanica,
  grandeCrema: florGrandeCrema,
  grandeVerde: florGrandeVerde,
  grandeLila: florGrandeLila,
};

/**
 * @param {'botanica'|'grande'} kind
 * @param {'crema'|'verde'|'lila'} fill  only applies to kind="grande" (follow the background)
 */
export default function Flor({ kind = 'botanica', fill = 'verde', width = 160, opacity = 1, style }) {
  const src = kind === 'botanica'
    ? SRC.botanica
    : SRC[`grande${fill[0].toUpperCase()}${fill.slice(1)}`];
  return <img src={src} alt="" aria-hidden width={width} style={{ opacity, ...style }} />;
}
