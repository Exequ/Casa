// Lote 7: tres alfombras shaggy más, a partir de las fotos de producto del
// encargo: de cuadros verde y blanco crudo, de cuadros rojo óxido y blanco
// crudo, y lisa verde. Como la del lote 6: alfombras (debajo de los muebles),
// 1 cm de grosor, categoría Alfombras y cinco medidas a elegir.
//
// Uso:  npm run catalogo:lote7                 (no toca las medidas ya corregidas a mano)
//       npm run catalogo:lote7 -- --reiniciar  (vuelve a las medidas de este script)
//
// Mismo método que los lotes anteriores (ver catalogo-lote1.mjs y
// lib/alfombras.mjs): un .glb por medida y un .json por alfombra en
// catalogo/alfombras/, y su tabla en docs/OBJETOS.md.

import { procesarLote } from './lib/lote.mjs';
import { alfombraCuadros, alfombraLisa, MEDIDA_POR_DEFECTO, tamanosAlfombra, textoCasillas } from './lib/alfombras.mjs';

/** Casilla de las de cuadros: 11 × 11 casillas en la foto de 200 × 200 cm (unos 18 cm). */
const CASILLA = 0.182;

/**
 * Colores del modelo. Los de la foto (media de cada color medida en ella) se
 * oscurecen o se saturan para que, con la luz de la app y el pelo largo
 * (textura 'borrego'), se vean como en la foto (comprobado midiendo la vista
 * desde arriba: ver docs/ESTADO.md).
 */
const COLOR = {
  verde: 0x474c47, // foto: #6b736a
  crudoVerde: 0xded7b1, // foto: #e5e3d4
  oxido: 0x61392c, // foto: #915341
  crudoOxido: 0xeed4a8, // foto: #eae1cf
  lisaVerde: 0x33362f, // foto: #464a40
};

/** De cuadros: el color oscuro en la esquina de atrás a la izquierda (en las cuatro, como en las fotos de 11 × 11). */
const cuadros = (nombre, oscuro, claro) => (ancho, fondo) => alfombraCuadros(nombre, ancho, fondo, {
  casilla: CASILLA,
  colores: [oscuro, claro],
  textura: 'borrego',
});
const verde = cuadros('alfombra-shaggy-cuadros-verde', ['shaggy-verde', COLOR.verde], ['shaggy-blanco-crudo', COLOR.crudoVerde]);
const rojo = cuadros('alfombra-shaggy-cuadros-rojo', ['shaggy-rojo-oxido', COLOR.oxido], ['shaggy-blanco-crudo', COLOR.crudoOxido]);
const lisa = (ancho, fondo) => alfombraLisa('alfombra-shaggy-lisa-verde', ancho, fondo, { material: 'shaggy-verde-oscuro', color: COLOR.lisaVerde, textura: 'borrego' });

const COMUN = 'Las cinco medidas pedidas (80 × 150, 120 × 170, 140 × 200, 160 × 230 y 200 × 250 cm); al añadirla, 140 × 200. Grosor de 1 cm, como la del lote 6.';

// ---------------------------------------------------------------------------
const OBJETOS = [
  {
    ruta: 'alfombras/alfombra-shaggy-cuadros-verde', construir: () => verde(...MEDIDA_POR_DEFECTO),
    tamanos: tamanosAlfombra(verde),
    ficha: { nombre: 'Alfombra shaggy de cuadros verde y blanco crudo', categoria: 'Alfombras', alfombra: true },
    como: `${COMUN} Casillas de unos 18 cm, como en la foto (11 × 11 en 200 × 200): ${textoCasillas(CASILLA)}.`,
    fotos: 'Cuadros verde grisáceo y blanco crudo de pelo largo (textura de borreguito), verde en las esquinas; colores medidos en la foto. Sin el pelo suelto de los bordes.',
  },
  {
    ruta: 'alfombras/alfombra-shaggy-cuadros-rojo', construir: () => rojo(...MEDIDA_POR_DEFECTO),
    tamanos: tamanosAlfombra(rojo),
    ficha: { nombre: 'Alfombra shaggy de cuadros rojo óxido y blanco crudo', categoria: 'Alfombras', alfombra: true },
    como: `${COMUN} Casillas de unos 18 cm, como en la foto (11 × 11 en 200 × 200): ${textoCasillas(CASILLA)}.`,
    fotos: 'Cuadros rojo óxido (teja) y blanco crudo de pelo largo, rojo en las esquinas; colores medidos en la foto. Sin el pelo suelto de los bordes.',
  },
  {
    ruta: 'alfombras/alfombra-shaggy-lisa-verde', construir: () => lisa(...MEDIDA_POR_DEFECTO),
    tamanos: tamanosAlfombra(lisa),
    ficha: { nombre: 'Alfombra shaggy lisa verde', categoria: 'Alfombras', alfombra: true },
    como: COMUN,
    fotos: 'Verde oliva oscuro liso de pelo largo (textura de borreguito); color medido en la foto. Sin las aguas de luz del pelo.',
  },
];

await procesarLote(OBJETOS, {
  reiniciar: process.argv.includes('--reiniciar'),
  seccion: 'lote7',
  titulo: 'Lote 7: tres alfombras shaggy y medidas a elegir',
  introduccion: `Hechas a partir de las fotos de producto del encargo. Como la del lote 6:
**alfombras** (\`"alfombra": true\`, debajo de los muebles), 1 cm de grosor
(**estimado**) y categoría *Alfombras*. Todas las alfombras (también la del
lote 6) tienen **cinco medidas a elegir** (\`"tamanos"\` en la ficha): 80 × 150,
120 × 170, 140 × 200 (la que se pone al añadirla), 160 × 230 y 200 × 250 cm, con
el desplegable «Medida» del objeto seleccionado. Cada medida tiene su .glb: en
las de cuadros la casilla mantiene su tamaño y cambia el número de casillas.
Solo están en el catálogo: no se colocan en la casa.`,
});
