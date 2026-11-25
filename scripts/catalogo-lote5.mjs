// Lote 5: música. Tocadiscos y altavoces izquierdo y derecho (de fotos de producto, con
// sus medidas) y packs de 5 y 10 vinilos (diseño propio, sin foto).
//
// Uso:  npm run catalogo:lote5                 (no toca las medidas ya corregidas a mano)
//       npm run catalogo:lote5 -- --reiniciar  (vuelve a las medidas de este script)
//
// Mismo método que los lotes 1, 2 y 4 (ver catalogo-lote1.mjs): un .glb y un
// .json por objeto en catalogo/<categoria>/ y su tabla en docs/OBJETOS.md.
// Las medidas exteriores son las del encargo; las interiores, estimadas.

import * as THREE from 'three';
import { Modelo } from './lib/modelo3d.mjs';
import { MAT, procesarLote } from './lib/lote.mjs';

const PI = Math.PI;

// ---------------------------------------------------------------------------

/**
 * Tocadiscos automático negro con la tapa de metacrilato ahumado cerrada
 * (las medidas del encargo, 9,7 cm de alto, son con la tapa bajada): plato de
 * aluminio con alfombrilla de fieltro, brazo recto plateado con cápsula blanca,
 * adaptador de 45 arriba a la izquierda, selector de tamaño y, en el frontal,
 * el botón de velocidad a la izquierda y tres botones a la derecha.
 */
function tocadiscos() {
  const W = 0.358, D = 0.373, H = 0.097;
  const m = new Modelo('tocadiscos', { ancho: W, fondo: D, alto: H });
  const cuerpo = m.material('plastico-negro', { color: 0x1d1e20, rugosidad: 0.55, metalico: 0.15 });
  const frente = m.material('frontal-negro', { color: 0x2a2b2e, rugosidad: 0.45, metalico: 0.25 });
  const goma = m.material('goma', { color: 0x141414, rugosidad: 0.9 });
  const alu = m.material('aluminio', { ...MAT.plata, color: 0xd2d4d6 });
  const fieltro = m.material('fieltro', { color: 0x252526, rugosidad: 1 });
  const blanco = m.material('capsula', { color: 0xf0f0ee, rugosidad: 0.4 });
  const tapa = m.material('metacrilato-ahumado', { color: 0x55585c, rugosidad: 0.05, opacidad: 0.25 });

  // Patas redondas de goma, metidas hacia dentro de las esquinas
  const pata = 0.012;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    m.cilindro(goma, [0.026, 0.028, pata], [sx * (W / 2 - 0.05), pata / 2, sz * (D / 2 - 0.05)], undefined, 20);
  }
  // Cuerpo con las aristas algo redondeadas y una banda frontal algo más clara
  const yTapa = 0.064, altoCuerpo = yTapa - pata;
  m.cajaRedonda(cuerpo, [W, altoCuerpo, D - 0.004], 0.004, [0, pata + altoCuerpo / 2, -0.002], undefined, 2);
  m.cajaRedonda(frente, [W - 0.012, 0.03, 0.004], 0.0015, [0, pata + 0.019, D / 2 - 0.002], undefined, 2);
  // Botones del frontal: velocidad a la izquierda; inicio, parada y subir/bajar a la derecha
  const yBoton = pata + 0.019;
  const boton = (x) => m.cilindro(goma, [0.0085, 0.0085, 0.003], [x, yBoton, D / 2 - 0.0015], [PI / 2, 0, 0], 16);
  boton(-0.148);
  for (const x of [0.08, 0.112, 0.144]) boton(x);
  m.caja(alu, [0.03, 0.002, 0.001], [-0.002, yBoton, D / 2 - 0.0005]); // placa del nombre

  // Plato de aluminio con la alfombrilla de fieltro y el eje
  const cx = -0.022, cz = 0.012, rPlato = 0.148;
  m.cilindro(alu, [rPlato, rPlato - 0.002, 0.012], [cx, yTapa + 0.006, cz], undefined, 48);
  m.cilindro(fieltro, [rPlato - 0.008, rPlato - 0.008, 0.002], [cx, yTapa + 0.013, cz], undefined, 48);
  m.cilindro(alu, [0.0035, 0.0035, 0.012], [cx, yTapa + 0.02, cz], undefined, 12);
  // Adaptador de 45 arriba a la izquierda
  m.cilindro(cuerpo, [0.02, 0.022, 0.004], [-W / 2 + 0.035, yTapa + 0.002, -D / 2 + 0.035], undefined, 20);
  m.cilindro(alu, [0.007, 0.007, 0.005], [-W / 2 + 0.035, yTapa + 0.003, -D / 2 + 0.035], undefined, 12);

  // Brazo: base redonda detrás a la derecha, contrapeso, tubo recto hacia delante y cápsula blanca
  const bx = 0.137, bz = -0.095, yBrazo = yTapa + 0.022;
  m.cilindro(cuerpo, [0.032, 0.034, 0.006], [bx, yTapa + 0.003, bz], undefined, 28);
  m.cilindro(cuerpo, [0.009, 0.011, 0.018], [bx, yTapa + 0.012, bz], undefined, 14);
  m.cajaRedonda(cuerpo, [0.022, 0.018, 0.032], 0.003, [bx + 0.002, yBrazo, bz - 0.03], undefined, 2); // contrapeso
  const punta = [0.118, yBrazo - 0.002, 0.1];
  m.barra(alu, [bx, yBrazo, bz - 0.012], punta, 0.0035, 10);
  m.caja(cuerpo, [0.016, 0.006, 0.03], [punta[0] - 0.002, punta[1] - 0.001, punta[2] + 0.012], [0, 0.12, 0]); // portacápsulas
  m.caja(blanco, [0.012, 0.012, 0.016], [punta[0] - 0.002, punta[1] - 0.009, punta[2] + 0.014], [0, 0.12, 0]);
  m.caja(cuerpo, [0.004, 0.012, 0.004], [punta[0] + 0.008, punta[1] + 0.003, punta[2] + 0.026]); // uña para levantarlo
  // Reposabrazo y selector de tamaño (12"/7") a la derecha
  m.cilindro(cuerpo, [0.004, 0.004, 0.016], [0.158, yTapa + 0.008, 0.02], undefined, 10);
  m.caja(cuerpo, [0.024, 0.01, 0.014], [0.135, yTapa + 0.005, 0.135]);

  // Tapa de metacrilato ahumado, bajada: cinco paneles de 3 mm (se ve el plato a través)
  const g = 0.003, altoTapa = H - yTapa, Wt = W - 0.004, Dt = D - 0.006, zt = -0.003;
  m.caja(tapa, [Wt, g, Dt], [0, H - g / 2, zt]);
  for (const sz of [-1, 1]) m.caja(tapa, [Wt, altoTapa - g, g], [0, yTapa + (altoTapa - g) / 2, zt + sz * (Dt / 2 - g / 2)]);
  for (const sx of [-1, 1]) m.caja(tapa, [g, altoTapa - g, Dt - 2 * g], [sx * (Wt / 2 - g / 2), yTapa + (altoTapa - g) / 2, zt]);
  // Bisagras negras detrás
  for (const sx of [-1, 1]) m.caja(cuerpo, [0.04, 0.026, 0.012], [sx * 0.125, yTapa + 0.013, -D / 2 + 0.006]);
  return m;
}

/**
 * Un altavoz de estantería de la pareja de la foto (14,6 × 19,6 × 23,4 cm cada
 * uno): caja de madera clara con frontal gris oscuro.
 * - `activo = false` (el izquierdo de la foto): con la rejilla de tela gris
 *   puesta, raya plateada a media altura y plaquita abajo.
 * - `activo = true` (el derecho): sin rejilla. Tweeter arriba a la derecha,
 *   reflector y puerto de graves arriba a la izquierda, woofer abajo con
 *   cuatro tornillos, y en el costado derecho el panel de mandos con tres ruedas.
 * Posiciones medidas en la foto respecto al ancho y al alto del frontal.
 */
function altavoz(activo) {
  const W = 0.146, D = 0.196, H = 0.234;
  const m = new Modelo(activo ? 'altavoz-derecho' : 'altavoz-izquierdo', { ancho: W, fondo: D, alto: H });
  const madera = m.material('madera-clara', { color: 0xa86b33, rugosidad: 0.5, textura: 'madera' });
  const frontal = m.material('frontal-gris', { color: 0x3e4044, rugosidad: 0.5, metalico: 0.2 });
  const negro = m.material('altavoz-negro', { color: 0x1a1a1b, rugosidad: 0.7 });
  const plata = m.material('plata', MAT.plata);

  const pared = 0.007; // marco de madera alrededor del frontal
  const zB = D / 2 - 0.008; // cara del frontal; delante solo vuelan el labio de madera, la rejilla y los altavoces
  const lado = activo ? 0.004 : 0; // el activo: costado 4 mm más adentro, donde asoman las ruedas de los mandos
  const xb = W / 2 - lado, w = xb + W / 2, x0 = (xb - W / 2) / 2;
  // Caja de madera (aristas redondeadas), labio de madera delante y frontal gris dentro
  m.cajaRedonda(madera, [w, H, zB + D / 2], 0.005, [x0, H / 2, (zB - D / 2) / 2], undefined, 2);
  const labio = 0.003, zl = zB + labio / 2;
  for (const sy of [-1, 1]) m.caja(madera, [w - 0.003, pared, labio], [x0, H / 2 + sy * (H / 2 - pared / 2 - 0.0015), zl]);
  for (const sx of [-1, 1]) m.caja(madera, [pared, H - 2 * pared - 0.003, labio], [x0 + sx * (w / 2 - pared / 2 - 0.0015), H / 2, zl]);
  m.caja(frontal, [w - 2 * pared - 0.003, H - 2 * pared - 0.003, 0.003], [x0, H / 2, zB]);

  if (!activo) {
    // Rejilla de tela gris que tapa el frontal, con la raya plateada y la plaquita
    const rejilla = m.material('rejilla-tela', { color: 0x5a5c5f, rugosidad: 0.95, textura: 'tela' });
    const zR = (zB + 0.001 + D / 2) / 2, gR = D / 2 - zB - 0.001;
    m.cajaRedonda(rejilla, [w - 0.005, H - 0.005, gR], 0.0025, [x0, H / 2, zR], undefined, 2);
    m.caja(plata, [w * 0.72, 0.002, 0.001], [x0, H * 0.53, D / 2 - 0.0003]);
    m.caja(plata, [0.026, 0.004, 0.001], [x0, 0.018, D / 2 - 0.0003]);
    return m;
  }

  const cono = m.material('cono', { color: 0x2c2c2e, rugosidad: 0.85 });
  const hueco = m.material('hueco', { color: 0x080808, rugosidad: 1 });
  const zF = zB + 0.0015; // delante del frontal
  const disco = (mat, r, alto, x, y, z, seg = 32) => m.cilindro(mat, [r, r, alto], [x, y, z], [PI / 2, 0, 0], seg);
  /** Cúpula (media esfera) que sale del frontal hacia delante, con su punta en zPunta. */
  const cupula = (mat, r, x, y, zPunta, seg = 20) => m.esfera(mat, r, [x, y, zPunta - r], { thetaLargo: PI / 2, segmentos: seg }, [PI / 2, 0, 0]);
  // Woofer abajo: aro negro, suspensión, cono hundido y tapa central
  const wx = x0, wy = 0.088;
  disco(negro, 0.057, 0.003, wx, wy, zF, 40);
  m.aro(negro, 0.046, 0.0035, [wx, wy, zF + 0.0015], [0, 0, 0]);
  m.pieza(cono, new THREE.CylinderGeometry(0.043, 0.016, 0.014, 32, 1, true), [wx, wy, zF + 0.001 - 0.007], [PI / 2, 0, 0]);
  disco(cono, 0.043, 0.001, wx, wy, zF - 0.013, 32); // fondo del cono
  cupula(negro, 0.017, wx, wy, D / 2 - 0.002);
  // Tweeter arriba a la derecha con su aro, la cúpula y el puente
  const tx = x0 + 0.028, ty = 0.186;
  disco(negro, 0.034, 0.003, tx, ty, zF, 32);
  disco(cono, 0.024, 0.003, tx, ty, zF + 0.001, 28);
  cupula(negro, 0.01, tx, ty, D / 2 - 0.001, 16);
  m.caja(negro, [0.046, 0.003, 0.003], [tx, ty, zF + 0.003]);
  // Reflector redondo y, debajo, el puerto de graves, arriba a la izquierda
  const px = x0 - 0.035;
  cupula(negro, 0.012, px, 0.203, D / 2, 16);
  m.aro(negro, 0.018, 0.003, [px, 0.16, zF + 0.001], [0, 0, 0]);
  disco(hueco, 0.017, 0.001, px, 0.16, zF + 0.0005, 24);
  // Tornillos: cuatro en las esquinas del woofer y cuatro alrededor del tweeter
  const tw = 0.047, tt = 0.025;
  for (const [x, y] of [[wx - tw, wy - tw], [wx + tw, wy - tw], [wx - tw, wy + tw], [wx + tw, wy + tw],
    [tx - tt, ty - tt], [tx + tt, ty - tt], [tx - tt, ty + tt], [tx + tt, ty + tt]]) {
    disco(hueco, 0.003, 0.002, x, y, zF + 0.001, 10);
  }
  m.caja(plata, [0.026, 0.004, 0.001], [wx, 0.018, zF]);
  // Panel de mandos oscuro en el costado derecho, con tres ruedas que asoman hasta el borde
  const zP = D / 2 - 0.07;
  m.caja(hueco, [0.001, 0.105, 0.036], [xb + 0.0005, 0.167, zP]);
  for (const y of [0.141, 0.167, 0.193]) m.cilindro(negro, [0.0085, 0.0085, lado], [xb + lado / 2, y, zP], [0, 0, PI / 2], 16);
  return m;
}

/** Colores simples de los vinilos, uno de cada (el pack de 5 usa los 5 primeros). */
const COLORES = [
  ['rojo', 0xd23b33], ['amarillo', 0xf1c232], ['azul', 0x2f6dcf], ['verde', 0x3fa548], ['rosa', 0xe46aa5],
  ['naranja', 0xee8a2b], ['morado', 0x7d55c0], ['negro', 0x2a2a2d], ['turquesa', 0x22a8a0], ['blanco', 0xf1efe9],
];
/** Funda de un LP de 12": 31,5 cm de lado; 5 mm por vinilo (funda, funda interior y disco). */
const LADO = 0.315, GROSOR = 0.005;

/**
 * Pack de `n` vinilos en sus fundas, pegados uno a otro y cada uno de un
 * color. De pie: las fundas en fila a lo ancho (lomos hacia delante, +Z).
 * Tumbados: apilados. En las dos caras de fuera, un disco negro con la
 * etiqueta del color de la otra punta, para que se lea como un vinilo.
 */
function vinilos(n, tumbado) {
  const largo = n * GROSOR;
  const dims = tumbado ? { ancho: LADO, fondo: LADO, alto: largo } : { ancho: largo, fondo: LADO, alto: LADO };
  const m = new Modelo(`vinilos-${n}-${tumbado ? 'tumbados' : 'de-pie'}`, dims);
  const mats = COLORES.slice(0, n).map(([nombre, color]) => m.material(`funda-${nombre}`, { color, rugosidad: 0.55 }));
  const disco = m.material('disco-negro', { color: 0x141416, rugosidad: 0.35 });
  // Posición a lo largo del pack (x de pie, y tumbado) y tamaño de una pieza fina de grosor t
  const pon = (s) => (tumbado ? [0, s, 0] : [s - largo / 2, LADO / 2, 0]);
  const tam = (t) => (tumbado ? [LADO, t, LADO] : [t, LADO, LADO]);
  // Fundas con una rendija de 0,5 mm entre ellas; las de las puntas dejan 1 mm para el disco impreso
  const juego = 0.00025, relieve = 0.001;
  for (let i = 0; i < n; i++) {
    const a = i === 0 ? relieve : i * GROSOR + juego;
    const b = i === n - 1 ? largo - relieve : (i + 1) * GROSOR - juego;
    m.cajaRedonda(mats[i], tam(b - a), 0.0012, pon((a + b) / 2), undefined, 1);
  }
  // Disco negro impreso en las dos caras de fuera, con la etiqueta del color de la otra punta
  const giro = tumbado ? [0, 0, 0] : [0, 0, PI / 2];
  for (const [fuera, etiqueta] of [[-1, mats[n - 1]], [1, mats[0]]]) {
    const borde = fuera < 0 ? 0 : largo;
    m.cilindro(disco, [0.13, 0.13, 0.0008], pon(borde - fuera * 0.0008), giro, 48);
    m.cilindro(etiqueta, [0.045, 0.045, 0.0008], pon(borde - fuera * 0.0004), giro, 32);
  }
  return m;
}

// ---------------------------------------------------------------------------
const VINILOS = (n, tumbado) => ({
  ruta: `decoracion/vinilos-${n}-${tumbado ? 'tumbados' : 'de-pie'}`,
  construir: () => vinilos(n, tumbado),
  ficha: { nombre: `Pack de ${n} vinilos ${tumbado ? 'tumbados' : 'de pie'}`, categoria: 'Decoración', colocacion: 'superficie' },
  como: `Mías (sin foto): funda estándar de LP de 12" de 31,5 × 31,5 cm y 5 mm por vinilo, × ${n} = ${String(n * 0.5).replace('.', ',')} cm ${tumbado ? 'de alto (apilados)' : 'de ancho (en fila)'}.`,
  fotos: `Sin foto: diseño propio. ${n} fundas pegadas, una de cada color (${COLORES.slice(0, n).map(([c]) => c).join(', ')}), con una rendija fina entre ellas y un disco negro con etiqueta de color en las dos caras de fuera. ${tumbado ? 'Apiladas en horizontal' : 'De canto, con los lomos hacia delante'}.`,
});

const OBJETOS = [
  {
    ruta: 'electronica/tocadiscos', construir: tocadiscos,
    ficha: { nombre: 'Tocadiscos negro con tapa', categoria: 'Electrónica', colocacion: 'superficie' },
    como: 'Las del encargo (37,3 de largo × 35,8 de ancho × 9,7 cm de alto, con la tapa bajada): 35,8 de ancho y 37,3 de fondo. Mías: patas de 1,2 cm, cuerpo hasta 6,4 cm, plato de ø29,6 cm.',
    fotos: 'Cuerpo negro mate con banda frontal, botón de velocidad a la izquierda y tres a la derecha; plato de aluminio con alfombrilla de fieltro negro, brazo recto plateado con cápsula blanca, adaptador de 45 y selector de tamaño; tapa de metacrilato ahumado **cerrada** (en las fotos está abierta; las medidas son con ella bajada). Sin los rótulos de la marca.',
  },
  {
    ruta: 'electronica/altavoz-izquierdo', construir: () => altavoz(false),
    ficha: { nombre: 'Altavoz de estantería izquierdo (con rejilla)', categoria: 'Electrónica', colocacion: 'superficie' },
    como: 'Las reales de cada altavoz de la pareja: 14,6 de ancho × 19,6 de fondo × 23,4 cm de alto. Mías: marco de madera de 7 mm y rejilla de 7 mm.',
    fotos: 'El de la izquierda de la foto: madera clara con veta, rejilla de tela gris con la raya plateada a media altura y plaquita abajo. Sin el rótulo de la marca.',
  },
  {
    ruta: 'electronica/altavoz-derecho', construir: () => altavoz(true),
    ficha: { nombre: 'Altavoz de estantería derecho (activo)', categoria: 'Electrónica', colocacion: 'superficie' },
    como: 'Las reales de cada altavoz de la pareja: 14,6 de ancho × 19,6 de fondo × 23,4 cm de alto. Posiciones del frontal medidas en la foto: woofer de ø11,4 cm abajo, tweeter de ø6,8 cm arriba a la derecha.',
    fotos: 'El de la derecha de la foto: madera clara con veta y frontal gris oscuro sin rejilla; tweeter, reflector, puerto de graves, woofer con tornillos y el panel de mandos con tres ruedas en el costado derecho. Sin el mando a distancia ni el rótulo de la marca.',
  },
  VINILOS(5, false), VINILOS(5, true), VINILOS(10, false), VINILOS(10, true),
];

await procesarLote(OBJETOS, {
  reiniciar: process.argv.includes('--reiniciar'),
  seccion: 'lote5',
  titulo: 'Lote 5: tocadiscos, altavoces y vinilos',
  introduccion: `Tocadiscos y altavoces a partir de las fotos de producto del encargo, con
sus medidas; los packs de vinilos, diseño propio sin foto (medidas de una
funda estándar de LP). Los altavoces son la pareja de la foto, en dos fichas
para poder ponerlos por separado. Todos son de **superficie** (mesas y muebles donde
quepan) y no admiten nada encima. Los vinilos, en dos fichas por pack: de pie
y tumbados (la app solo gira en horizontal). Solo están en el catálogo: no se
colocan en la casa.`,
});
