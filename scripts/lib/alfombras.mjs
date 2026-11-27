// Lo común a las alfombras del catálogo (lotes 6 y 7): las medidas a elegir,
// el grosor y los dos diseños (de cuadros y lisa).
//
// Todas las alfombras se pueden poner en cinco medidas (campo "tamanos" de la
// ficha; se elige con el desplegable «Medida» del objeto seleccionado). Cada
// medida tiene su propio .glb: en las de cuadros, la casilla mantiene su
// tamaño y cambia el número de casillas (no se estiran).

import { Modelo } from './modelo3d.mjs';

/** Medidas a elegir (ancho × fondo, m). La de 140 × 200 es la que se pone al añadirla. */
export const MEDIDAS_ALFOMBRA = [[0.8, 1.5], [1.2, 1.7], [1.4, 2.0], [1.6, 2.3], [2.0, 2.5]];
export const MEDIDA_POR_DEFECTO = [1.4, 2.0];

/** Grosor de todas las alfombras: 1 cm (como la primera). */
export const GROSOR_ALFOMBRA = 0.01;

/** Casillas a lo largo de un lado: las que más se acercan al tamaño de casilla (mínimo 2). */
export const casillas = (lado, casilla) => Math.max(2, Math.round(lado / casilla));

/**
 * Alfombra de cuadros de dos colores: casillas de unos `casilla` m de lado
 * (las que quepan, ajustadas para llenar la alfombra), con `colores[0]` en la
 * esquina de atrás a la izquierda. Cada casilla es una caja de todo el grosor:
 * las caras de arriba quedan enrasadas y las de los lados, tapadas por las vecinas.
 * colores: [[nombreMaterial, hex], [nombreMaterial, hex]].
 */
export function alfombraCuadros(nombre, ancho, fondo, { casilla, colores, textura }) {
  const H = GROSOR_ALFOMBRA;
  const columnas = casillas(ancho, casilla), filas = casillas(fondo, casilla);
  const m = new Modelo(nombre, { ancho, fondo, alto: H });
  const mats = colores.map(([n, color]) => m.material(n, { color, rugosidad: 1, textura }));
  const cw = ancho / columnas, cd = fondo / filas;
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      const x = -ancho / 2 + cw * (c + 0.5), z = -fondo / 2 + cd * (f + 0.5);
      m.caja(mats[(f + c) % 2], [cw, H, cd], [x, H / 2, z]);
    }
  }
  return m;
}

/** Alfombra lisa de un color (una sola pieza con la textura dada). */
export function alfombraLisa(nombre, ancho, fondo, { material, color, textura }) {
  const H = GROSOR_ALFOMBRA;
  const m = new Modelo(nombre, { ancho, fondo, alto: H });
  m.caja(m.material(material, { color, rugosidad: 1, textura }), [ancho, H, fondo], [0, H / 2, 0]);
  return m;
}

/** Las cinco medidas de una alfombra, para `tamanos` de procesarLote: construir(ancho, fondo) → Modelo. */
export const tamanosAlfombra = (construir) =>
  MEDIDAS_ALFOMBRA.map(([ancho, fondo]) => ({ ancho, fondo, construir: () => construir(ancho, fondo) }));

/** «80 × 150: 3 × 5 casillas; …» para la tabla de OBJETOS.md. */
export const textoCasillas = (casilla) => MEDIDAS_ALFOMBRA
  .map(([a, f]) => `${Math.round(a * 100)} × ${Math.round(f * 100)}: ${casillas(a, casilla)} × ${casillas(f, casilla)}`).join('; ');
