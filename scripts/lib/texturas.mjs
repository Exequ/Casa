// Texturas procedurales pequeñas para los modelos del catálogo: veta de madera
// y tejido. Son imágenes en escala de grises (claras, de 0,8 a 1) que
// multiplican el color del material, así que el tono lo sigue poniendo el
// color; la textura solo añade la veta o la trama. Repetibles sin costuras.
//
// Se guardan como PNG dentro de cada .glb (pocos KB) con un codificador PNG
// mínimo (solo zlib de Node), sin dependencias.

import { deflateSync } from 'node:zlib';

// --- PNG en escala de grises -------------------------------------------------------

const TABLA_CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLA_CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function bloque(tipo, datos) {
  const t = Buffer.from(tipo, 'ascii');
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, datos])));
  return Buffer.concat([largo, t, datos, crc]);
}
/** PNG de 8 bits en escala de grises a partir de valores 0–255 (fila a fila). */
export function pngGris(ancho, alto, valores) {
  const cab = Buffer.alloc(13);
  cab.writeUInt32BE(ancho, 0);
  cab.writeUInt32BE(alto, 4);
  cab[8] = 8; cab[9] = 0; cab[10] = 0; cab[11] = 0; cab[12] = 0;
  const filas = Buffer.alloc((ancho + 1) * alto);
  for (let y = 0; y < alto; y++) {
    filas[y * (ancho + 1)] = 0;
    for (let x = 0; x < ancho; x++) filas[y * (ancho + 1) + 1 + x] = valores[y * ancho + x];
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloque('IHDR', cab), bloque('IDAT', deflateSync(filas, { level: 9 })), bloque('IEND', Buffer.alloc(0)),
  ]);
}

// --- Ruido repetible ---------------------------------------------------------------

function aleatorio(semilla) {
  let s = semilla >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
/** Ruido de valor suave que se repite cada `cx` × `cy` celdas (u, v en 0–1). */
function ruido(cx, cy, semilla) {
  const r = aleatorio(semilla);
  const rejilla = Array.from({ length: cx * cy }, r);
  const suave = (t) => t * t * (3 - 2 * t);
  return (u, v) => {
    const x = (((u % 1) + 1) % 1) * cx, y = (((v % 1) + 1) % 1) * cy;
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = suave(x - x0), fy = suave(y - y0);
    const g = (i, j) => rejilla[((j % cy) * cx) + (i % cx)];
    const a = g(x0, y0), b = g(x0 + 1, y0), c = g(x0, y0 + 1), d = g(x0 + 1, y0 + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

// --- Texturas ------------------------------------------------------------------------

/**
 * Veta de madera: bandas a lo largo de U (la veta), algo onduladas, con
 * fibras finas. Devuelve { png, media } (media = brillo medio, 0–1).
 */
export function texturaMadera(n = 128, semilla = 7) {
  const onda = ruido(3, 2, semilla), fibra = ruido(4, 96, semilla + 1), mancha = ruido(6, 6, semilla + 2);
  const valores = new Uint8Array(n * n);
  let suma = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n, v = y / n;
      const d = v * 11 + onda(u, v) * 0.7;
      const banda = Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * d), 3);
      const f = 0.86 + 0.06 * banda + 0.06 * fibra(u, v) + 0.03 * mancha(u, v);
      const valor = Math.max(0, Math.min(255, Math.round(f * 255)));
      valores[y * n + x] = valor;
      suma += valor;
    }
  }
  return { png: pngGris(n, n, valores), media: suma / (n * n) / 255 };
}

/** Tejido: trama de hilos cruzados muy sutil con algo de ruido. */
export function texturaTela(n = 64, semilla = 11) {
  const grano = ruido(32, 32, semilla), nube = ruido(4, 4, semilla + 1);
  const hilos = 16; // hilos por lado de la textura
  const valores = new Uint8Array(n * n);
  let suma = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n, v = y / n;
      const a = Math.sin(2 * Math.PI * u * hilos), b = Math.sin(2 * Math.PI * v * hilos);
      // Hilos que pasan por encima y por debajo alternando (tafetán)
      const cruce = (Math.floor(u * hilos) + Math.floor(v * hilos)) % 2 === 0 ? Math.abs(a) : Math.abs(b);
      const f = 0.88 + 0.06 * cruce + 0.04 * grano(u, v) + 0.03 * nube(u, v);
      const valor = Math.max(0, Math.min(255, Math.round(f * 255)));
      valores[y * n + x] = valor;
      suma += valor;
    }
  }
  return { png: pngGris(n, n, valores), media: suma / (n * n) / 255 };
}

/** Texturas disponibles: generador y metros que ocupa una repetición (a lo largo y a lo ancho de la veta). */
export const TEXTURAS = {
  madera: { crear: () => texturaMadera(), tamano: [0.9, 0.45] },
  tela: { crear: () => texturaTela(), tamano: [0.12, 0.12] },
};
