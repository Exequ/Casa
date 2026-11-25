// Lote 5: música. Tocadiscos y pareja de altavoces (de fotos de producto, con
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
 * Pareja de altavoces de estantería juntos: caja de madera clara con frontal
 * gris oscuro. El de la izquierda con la rejilla de tela gris puesta (raya
 * plateada a media altura); el de la derecha sin ella: tweeter arriba a la
 * derecha, reflector y puerto de graves a la izquierda, woofer abajo, y en su
 * costado de fuera el panel de mandos hundido con tres ruedas.
 * Medidas del encargo: 48 de ancho (los dos), 10 de fondo y 50 de alto.
 */
function altavoces() {
  const W = 0.48, D = 0.1, H = 0.5;
  const m = new Modelo('altavoces', { ancho: W, fondo: D, alto: H });
  const madera = m.material('madera-clara', { color: 0xa86b33, rugosidad: 0.5, textura: 'madera' });
  const frontal = m.material('frontal-gris', { color: 0x3e4044, rugosidad: 0.5, metalico: 0.2 });
  const rejilla = m.material('rejilla-tela', { color: 0x5a5c5f, rugosidad: 0.95, textura: 'tela' });
  const negro = m.material('altavoz-negro', { color: 0x1a1a1b, rugosidad: 0.7 });
  const cono = m.material('cono', { color: 0x2c2c2e, rugosidad: 0.85 });
  const hueco = m.material('hueco', { color: 0x080808, rugosidad: 1 });
  const plata = m.material('plata', MAT.plata);

  const hueco2 = 0.04, A = (W - hueco2) / 2; // 22 cm cada uno
  const pared = 0.012; // marco de madera alrededor del frontal
  const zB = D / 2 - 0.01; // cara del frontal; delante solo vuelan el labio de madera, la rejilla y los altavoces
  const lado5 = 0.005; // el de la derecha: costado 5 mm más adentro, donde asoman las ruedas de los mandos
  /** Caja de madera (aristas redondeadas) de xa a xb con el labio delante y el frontal gris dentro. */
  const caja = (xa, xb) => {
    const w = xb - xa, x0 = (xa + xb) / 2;
    m.cajaRedonda(madera, [w, H, zB + D / 2], 0.006, [x0, H / 2, (zB - D / 2) / 2], undefined, 2);
    const labio = 0.004, zl = zB + labio / 2;
    for (const sy of [-1, 1]) m.caja(madera, [w - 0.004, pared, labio], [x0, H / 2 + sy * (H / 2 - pared / 2 - 0.002), zl]);
    for (const sx of [-1, 1]) m.caja(madera, [pared, H - 2 * pared - 0.004, labio], [x0 + sx * (w / 2 - pared / 2 - 0.002), H / 2, zl]);
    m.caja(frontal, [w - 2 * pared - 0.004, H - 2 * pared - 0.004, 0.003], [x0, H / 2, zB]);
    return { x0, w };
  };
  // Izquierdo: rejilla de tela gris que tapa el frontal, con la raya plateada y la plaquita
  const izq = caja(-W / 2, -hueco2 / 2);
  const zR = (zB + 0.001 + D / 2) / 2, gR = D / 2 - zB - 0.001;
  m.cajaRedonda(rejilla, [izq.w - 0.006, H - 0.006, gR], 0.003, [izq.x0, H / 2, zR], undefined, 2);
  m.caja(plata, [izq.w * 0.72, 0.003, 0.001], [izq.x0, H * 0.6, D / 2 - 0.0003]);
  m.caja(plata, [0.04, 0.006, 0.001], [izq.x0, 0.045, D / 2 - 0.0003]);

  // Derecho: sin rejilla
  const der = caja(hueco2 / 2, W / 2 - lado5);
  const xD = der.x0, zF = zB + 0.0015; // delante del frontal
  const disco = (mat, r, alto, x, y, z, seg = 32) => m.cilindro(mat, [r, r, alto], [x, y, z], [PI / 2, 0, 0], seg);
  /** Cúpula (media esfera) que sale del frontal hacia delante, con su punta en zPunta. */
  const cupula = (mat, r, x, y, zPunta, seg = 20) => m.esfera(mat, r, [x, y, zPunta - r], { thetaLargo: PI / 2, segmentos: seg }, [PI / 2, 0, 0]);
  // Woofer: aro negro, suspensión, cono hundido y tapa central
  const wy = 0.16, wx = xD;
  disco(negro, 0.09, 0.003, wx, wy, zF, 40);
  m.aro(negro, 0.072, 0.0045, [wx, wy, zF + 0.0015], [0, 0, 0]);
  m.pieza(cono, new THREE.CylinderGeometry(0.068, 0.025, 0.018, 36, 1, true), [wx, wy, zF + 0.001 - 0.009], [PI / 2, 0, 0]);
  disco(cono, 0.068, 0.001, wx, wy, zF - 0.017, 36); // fondo del cono
  cupula(negro, 0.026, wx, wy, D / 2 - 0.002);
  // Tweeter arriba a la derecha con su aro, la cúpula y el puente
  const ty = 0.37, tx = xD + 0.035;
  disco(negro, 0.05, 0.003, tx, ty, zF, 32);
  disco(cono, 0.036, 0.003, tx, ty, zF + 0.001, 28);
  cupula(negro, 0.014, tx, ty, D / 2 - 0.001, 16);
  m.caja(negro, [0.07, 0.004, 0.003], [tx, ty, zF + 0.003]);
  // Reflector redondo y puerto de graves a la izquierda
  const px = xD - 0.06;
  cupula(negro, 0.02, px, 0.415, D / 2, 16);
  m.aro(negro, 0.027, 0.004, [px, 0.33, zF + 0.001], [0, 0, 0]);
  disco(hueco, 0.026, 0.001, px, 0.33, zF + 0.0005, 24);
  // Tornillos (cuatro alrededor del woofer y cuatro del tweeter)
  for (const [x, y] of [[wx - 0.065, wy - 0.075], [wx + 0.065, wy - 0.075], [wx - 0.065, wy + 0.075], [wx + 0.065, wy + 0.075],
    [tx - 0.035, ty - 0.035], [tx + 0.035, ty - 0.035], [tx - 0.035, ty + 0.035], [tx + 0.035, ty + 0.035]]) {
    disco(hueco, 0.004, 0.002, x, y, zF + 0.001, 10);
  }
  m.caja(plata, [0.04, 0.006, 0.001], [xD, 0.045, zF]);
  // Panel de mandos oscuro en el costado de fuera, con tres ruedas que asoman hasta el borde
  const xLado = W / 2 - lado5;
  m.caja(hueco, [0.001, 0.2, 0.05], [xLado + 0.0005, 0.33, -0.005]);
  for (const y of [0.27, 0.33, 0.39]) m.cilindro(negro, [0.011, 0.011, lado5], [xLado + lado5 / 2, y, -0.005], [0, 0, PI / 2], 16);
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
    ruta: 'electronica/altavoces', construir: altavoces,
    ficha: { nombre: 'Altavoces de estantería (pareja)', categoria: 'Electrónica', colocacion: 'superficie' },
    como: 'Las del encargo para los dos juntos: 48 de ancho × 10 de fondo × 50 cm de alto. Mías: dos cajas de 22 cm de ancho separadas 4 cm. (Más altas y planas que las de la foto; ver ESTADO).',
    fotos: 'Madera clara con veta y frontal gris oscuro. El de la izquierda con la rejilla de tela gris y la raya plateada; el de la derecha con tweeter, reflector, puerto de graves, woofer con tornillos y el panel de mandos con tres ruedas en el costado de fuera. Sin el mando a distancia ni los rótulos de la marca.',
  },
  VINILOS(5, false), VINILOS(5, true), VINILOS(10, false), VINILOS(10, true),
];

await procesarLote(OBJETOS, {
  reiniciar: process.argv.includes('--reiniciar'),
  seccion: 'lote5',
  titulo: 'Lote 5: tocadiscos, altavoces y vinilos',
  introduccion: `Tocadiscos y altavoces a partir de las fotos de producto del encargo, con
sus medidas; los packs de vinilos, diseño propio sin foto (medidas de una
funda estándar de LP). Todos son de **superficie** (mesas y muebles donde
quepan) y no admiten nada encima. Los vinilos, en dos fichas por pack: de pie
y tumbados (la app solo gira en horizontal). Solo están en el catálogo: no se
colocan en la casa.`,
});
