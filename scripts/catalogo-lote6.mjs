// Lote 6: alfombra de cuadros rosa claro y rojo (140 × 200 cm), a partir de la
// foto de producto del encargo.
//
// Uso:  npm run catalogo:lote6                 (no toca las medidas ya corregidas a mano)
//       npm run catalogo:lote6 -- --reiniciar  (vuelve a las medidas de este script)
//
// Mismo método que los lotes anteriores (ver catalogo-lote1.mjs): un .glb y un
// .json por objeto en catalogo/<categoria>/ y su tabla en docs/OBJETOS.md.

import { Modelo } from './lib/modelo3d.mjs';
import { procesarLote } from './lib/lote.mjs';

/** Grosor de la alfombra (pelo corto): 1 cm. */
const GROSOR = 0.01;

/**
 * Alfombra de cuadros: 5 columnas × 7 filas (casillas de 28 × 28,6 cm), con
 * rosa claro en las cuatro esquinas, como en la foto. Tejido con trama (textura
 * 'tela'). Cada casilla es una pieza de todo el grosor: las caras de arriba
 * quedan enrasadas y las de los lados, tapadas por las casillas vecinas.
 */
function alfombra() {
  const W = 1.4, D = 2.0, H = GROSOR;
  const columnas = 5, filas = 7;
  const m = new Modelo('alfombra-cuadros', { ancho: W, fondo: D, alto: H });
  const rosa = m.material('lana-rosa-claro', { color: 0xf09a8a, rugosidad: 1, textura: 'tela' });
  const rojo = m.material('lana-rojo', { color: 0x67222a, rugosidad: 1, textura: 'tela' });
  const cw = W / columnas, cd = D / filas;
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      const x = -W / 2 + cw * (c + 0.5), z = -D / 2 + cd * (f + 0.5);
      m.caja((f + c) % 2 === 0 ? rosa : rojo, [cw, H, cd], [x, H / 2, z]);
    }
  }
  return m;
}

// ---------------------------------------------------------------------------
const OBJETOS = [
  {
    ruta: 'alfombras/alfombra-cuadros-rosa-rojo', construir: alfombra,
    // Alfombra: va debajo de los muebles y no choca con nada; lo que queda encima sigue en el suelo
    ficha: { nombre: 'Alfombra de cuadros rosa claro y rojo', categoria: 'Alfombras', alfombra: true },
    como: 'Las del encargo: 140 × 200 cm (140 de ancho y 200 de fondo). Mío: 1 cm de grosor (pelo corto).',
    fotos: 'Tablero de 5 × 7 casillas casi cuadradas (28 × 28,6 cm), rosa claro y rojo burdeos alternos, con rosa claro en las cuatro esquinas; colores tomados de la foto, tejido con trama. Sin flecos.',
  },
];

await procesarLote(OBJETOS, {
  reiniciar: process.argv.includes('--reiniciar'),
  seccion: 'lote6',
  titulo: 'Lote 6: alfombra de cuadros',
  introduccion: `Hecha a partir de la foto de producto del encargo, con sus medidas
(140 × 200 cm); el grosor (1 cm) es **estimado**. Es una **alfombra**
(\`"alfombra": true\`): va en el suelo, debajo de los muebles, sin chocar con
nada; los muebles y objetos se ponen y se mueven libremente encima (siguen en
el suelo y no se mueven con ella). Solo está en el catálogo: no se coloca en
la casa.`,
});
