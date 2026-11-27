// Lote 6: alfombra de cuadros rosa claro y rojo, a partir de la foto de
// producto del encargo (140 × 200 cm), en cinco medidas a elegir.
//
// Uso:  npm run catalogo:lote6                 (no toca las medidas ya corregidas a mano)
//       npm run catalogo:lote6 -- --reiniciar  (vuelve a las medidas de este script)
//
// Mismo método que los lotes anteriores (ver catalogo-lote1.mjs): un .glb y un
// .json por objeto en catalogo/<categoria>/ y su tabla en docs/OBJETOS.md.
// Las alfombras (medidas, grosor y diseños) están en lib/alfombras.mjs; las
// de los lotes 6 y 7 se pueden poner en las cinco medidas de MEDIDAS_ALFOMBRA.

import { procesarLote } from './lib/lote.mjs';
import { alfombraCuadros, MEDIDA_POR_DEFECTO, tamanosAlfombra, textoCasillas } from './lib/alfombras.mjs';

/** Casilla de la foto: 5 × 7 casillas en 140 × 200 cm (unos 28 cm). */
const CASILLA = 0.28;

/**
 * Alfombra de cuadros rosa claro y rojo burdeos, con rosa claro en la esquina
 * de atrás a la izquierda (en 140 × 200, en las cuatro, como en la foto).
 * Tejido con trama (textura 'tela').
 */
const alfombra = (ancho, fondo) => alfombraCuadros('alfombra-cuadros', ancho, fondo, {
  casilla: CASILLA,
  colores: [['lana-rosa-claro', 0xf09a8a], ['lana-rojo', 0x67222a]],
  textura: 'tela',
});

// ---------------------------------------------------------------------------
const OBJETOS = [
  {
    ruta: 'alfombras/alfombra-cuadros-rosa-rojo', construir: () => alfombra(...MEDIDA_POR_DEFECTO),
    tamanos: tamanosAlfombra(alfombra),
    // Alfombra: va debajo de los muebles y no choca con nada; lo que queda encima sigue en el suelo
    ficha: { nombre: 'Alfombra de cuadros rosa claro y rojo', categoria: 'Alfombras', alfombra: true },
    como: `Las del encargo: 140 × 200 cm (140 de ancho y 200 de fondo), la que se pone al añadirla. Mío: 1 cm de grosor (pelo corto). Casillas de unos 28 cm en cada medida (${textoCasillas(CASILLA)}).`,
    fotos: 'Tablero de casillas casi cuadradas (5 × 7 de 28 × 28,6 cm en 140 × 200), rosa claro y rojo burdeos alternos, con rosa claro en las cuatro esquinas; colores tomados de la foto, tejido con trama. Sin flecos.',
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
el suelo y no se mueven con ella). Se puede elegir su medida (80 × 150,
120 × 170, 140 × 200, 160 × 230 o 200 × 250 cm; ver «Lote 7»). Solo está en
el catálogo: no se coloca en la casa.`,
});
