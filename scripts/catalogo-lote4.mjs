// Lote 4: zapatero y mueble cafetera (coffee corner), a partir de las fotos de
// producto (con sus medidas) que se adjuntaron al encargo.
//
// Uso:  npm run catalogo:lote4                 (no toca las medidas ya corregidas a mano)
//       npm run catalogo:lote4 -- --reiniciar  (vuelve a las medidas de este script)
//
// Mismo método que los lotes 1 y 2 (ver catalogo-lote1.mjs): un .glb y un .json
// por objeto en catalogo/<categoria>/ y su tabla en docs/OBJETOS.md.
// (El "lote 3" fue la escena inicial amueblada: no añadió objetos.)
// Las medidas exteriores son las de las fotos; las interiores, estimadas.

import * as THREE from 'three';
import { Modelo } from './lib/modelo3d.mjs';
import { procesarLote } from './lib/lote.mjs';

const PI = Math.PI;

// ---------------------------------------------------------------------------

/**
 * Zapatero de 3 trampillas abatibles: estructura de roble claro (Roble Canadian)
 * y frentes blanco brillo, cada uno con un tirador de aluminio en el canto de arriba.
 */
function zapatero() {
  const W = 0.6, D = 0.22, H = 1.13;
  const m = new Modelo('zapatero', { ancho: W, fondo: D, alto: H });
  const roble = m.material('roble-canadian', { color: 0xdcc6a2, rugosidad: 0.55, textura: 'madera' });
  const blanco = m.material('blanco-brillo', { color: 0xfafaf8, rugosidad: 0.12 });
  const hueco = m.material('hueco-oscuro', { color: 0x3a3631, rugosidad: 0.9 });
  const alu = m.material('aluminio', { color: 0xc3c6c9, rugosidad: 0.3, metalico: 0.85 });
  const tapa = 0.02, lado = 0.016, zocalo = 0.022;
  // Tapa de lado a lado encima de los costados; costados hasta el suelo; trasera fina
  m.caja(roble, [W, tapa, D], [0, H - tapa / 2, 0]);
  const altoLado = H - tapa;
  for (const sx of [-1, 1]) m.caja(roble, [lado, altoLado, D], [sx * (W / 2 - lado / 2), altoLado / 2, 0]);
  const dentro = W - 2 * lado;
  m.caja(roble, [dentro, altoLado, 0.008], [0, altoLado / 2, -D / 2 + 0.004]);
  // Zócalo retranqueado y fondo oscuro que se ve por las juntas
  m.caja(roble, [dentro, zocalo, 0.016], [0, zocalo / 2, D / 2 - 0.03]);
  m.caja(hueco, [dentro, altoLado - zocalo, 0.002], [0, zocalo + (altoLado - zocalo) / 2, D / 2 - 0.022]);
  // Tres trampillas iguales entre los costados, enrasadas con su canto
  // (2 mm por detrás del canto: por delante solo asoma el labio del tirador)
  const n = 3, junta = 0.004, grueso = 0.018;
  const zona = altoLado - zocalo - junta; // junta bajo la tapa
  const alto = (zona - junta * (n - 1)) / n;
  const zF = D / 2 - 0.002 - grueso / 2;
  for (let i = 0; i < n; i++) {
    const y0 = zocalo + i * (alto + junta);
    m.caja(blanco, [dentro - 2 * junta, alto, grueso], [0, y0 + alto / 2, zF]);
    // Junta oscura sobre la trampilla (se ve como una raya fina desde cualquier altura)
    m.caja(hueco, [dentro, junta, grueso - 0.004], [0, y0 + alto + junta / 2, zF - 0.002]);
    // Tirador: perfil de aluminio de 13 cm sobre el canto de arriba, con un labio por delante
    const yT = y0 + alto;
    m.caja(alu, [0.13, 0.006, grueso], [0, yT - 0.003, zF]);
    m.caja(alu, [0.13, 0.016, 0.002], [0, yT - 0.008, D / 2 - 0.001]);
  }
  return m;
}

/**
 * Mueble cafetera (coffee corner) de estructura de tubo negro y tableros de
 * madera rústica: dos baldas abajo, cajón bajo la encimera y, encima, un
 * estante estrecho sobre dos postes con barras para colgar tazas.
 * Sin la decoración de la foto (cafetera, tazas, botellas, tarros, bolsas).
 */
function coffeeCorner() {
  const W = 0.48, D = 0.33, H = 1.345;
  const m = new Modelo('coffee-corner', { ancho: W, fondo: D, alto: H });
  const madera = m.material('madera-rustica', { color: 0x52331d, rugosidad: 0.6, textura: 'madera' });
  const negro = m.material('metal-negro', { color: 0x1c1c1c, rugosidad: 0.5, metalico: 0.6 });
  const oscuro = m.material('nivelador', { color: 0x2a2a2a, rugosidad: 0.8 });
  // Estructura: 4 patas de tubo cuadrado; las de atrás suben hasta el estante de arriba
  const FW = 0.44, FD = 0.31, L = 0.022, nivel = 0.012;
  const xP = FW / 2 - L / 2, zP = FD / 2 - L / 2;
  const tablero = 0.018, yEncimera = 0.795, grosorEncimera = 0.02;
  const yBajoEncimera = yEncimera - grosorEncimera;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const arriba = sz < 0 ? H - tablero : yBajoEncimera;
      m.caja(negro, [L, arriba - nivel, L], [sx * xP, nivel + (arriba - nivel) / 2, sz * zP]);
      m.cilindro(oscuro, [0.009, 0.009, nivel], [sx * xP, nivel / 2, sz * zP], undefined, 10);
    }
  }
  /** Travesaños del marco a una altura: delante, detrás y a los lados. */
  const marco = (y, { delante = true } = {}) => {
    const r = 0.02;
    if (delante) m.caja(negro, [FW - 2 * L, r, r], [0, y, zP]);
    m.caja(negro, [FW - 2 * L, r, r], [0, y, -zP]);
    for (const sx of [-1, 1]) m.caja(negro, [r, r, FD - 2 * L], [sx * xP, y, 0]);
  };
  // Baldas de abajo (40 × 30): la de abajo a 0,10 m y la del medio 25 cm más arriba
  const baldas = [0.1, 0.366];
  for (const y of baldas) {
    m.caja(madera, [0.4, 0.016, 0.3], [0, y - 0.008, 0]);
    marco(y - 0.016 - 0.01);
  }
  // Encimera (48 × 33) a 0,795 m, con el marco debajo y un travesaño lateral bajo el cajón
  m.caja(madera, [W, grosorEncimera, D], [0, yEncimera - grosorEncimera / 2, 0]);
  marco(yBajoEncimera - 0.01, { delante: false });
  for (const sx of [-1, 1]) m.caja(negro, [0.02, 0.02, FD - 2 * L], [sx * xP, 0.655, 0]);
  m.caja(negro, [FW - 2 * L, 0.02, 0.02], [0, 0.655, -zP]);
  // Cajón colgado bajo la encimera: frente de madera rústica y tirador de concha negro
  const altoCajon = 0.11, yCajon = yBajoEncimera - 0.004 - altoCajon / 2;
  const zFrente = FD / 2 - 0.009;
  m.caja(madera, [FW - 2 * L - 0.004, altoCajon, 0.018], [0, yCajon, zFrente]);
  m.caja(madera, [FW - 2 * L - 0.02, altoCajon - 0.02, FD - 0.06], [0, yCajon, -0.02]);
  const concha = new THREE.Shape();
  concha.moveTo(-0.032, 0);
  concha.absarc(0, 0, 0.032, PI, 2 * PI, false);
  concha.lineTo(-0.032, 0);
  m.extrusion(negro, concha, 0.008, [0, yCajon + 0.022, FD / 2], undefined, { segmentosCurva: 16 });
  m.caja(negro, [0.07, 0.008, 0.006], [0, yCajon + 0.026, FD / 2 + 0.003]);
  // Arriba: estante estrecho (43 × 12) al fondo, sobre los postes de atrás
  const fondoEstante = 0.12;
  m.caja(madera, [0.43, tablero, fondoEstante], [0, H - tablero / 2, -D / 2 + fondoEstante / 2]);
  m.caja(negro, [FW - 2 * L, 0.02, 0.02], [0, H - tablero - 0.01, -zP]);
  // Barras redondas entre los postes: dos para colgar tazas y una más abajo
  const barras = [1.275, 1.19, 0.92];
  for (const y of barras) m.barra(negro, [-xP + L / 2, y, -zP], [xP - L / 2, y, -zP], 0.008, 12);
  // Ganchos en S: cuatro en cada barra de las tazas (sin las tazas)
  const gancho = (x, yBarra) => {
    const r = 0.011, t = 0.0022, largo = 0.03;
    const giro = [0, -(PI / 2 - 0.5), 0]; // casi de canto, con la parte de abajo hacia delante
    const base = new THREE.Matrix4().compose(
      new THREE.Vector3(x, yBarra, -zP), new THREE.Quaternion().setFromEuler(new THREE.Euler(...giro)), new THREE.Vector3(1, 1, 1));
    const pon = (g, p, rz = 0) => m.piezaConMatriz(negro, g, base.clone().multiply(
      new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rz)), new THREE.Vector3(1, 1, 1))));
    pon(new THREE.TorusGeometry(r, t, 5, 10, PI), [0, 0, 0]); // curva sobre la barra
    pon(new THREE.CylinderGeometry(t, t, largo, 5), [r, -largo / 2, 0]); // tramo recto hacia abajo
    pon(new THREE.TorusGeometry(r, t, 5, 10, PI), [2 * r, -largo, 0], PI); // curva de abajo (abierta hacia arriba)
  };
  for (const x of [-0.095, -0.012, 0.065, 0.137]) gancho(x, barras[0]);
  for (const x of [-0.139, -0.051, 0.027, 0.109]) gancho(x, barras[1]);
  return m;
}

// ---------------------------------------------------------------------------
const OBJETOS = [
  {
    ruta: 'almacenaje/zapatero', construir: zapatero,
    ficha: { nombre: 'Zapatero blanco y roble', categoria: 'Almacenaje', superficies: [1.13] },
    como: 'Las de la foto (60 × 22 × 113 cm). Mías: tapa de 2 cm, costados de 1,6 cm, zócalo retranqueado de 2,2 cm y tres trampillas iguales de unos 36 cm.',
    fotos: 'Estructura (tapa, costados y zócalo) en Roble Canadian claro con veta; tres trampillas en blanco brillo entre los costados, enrasadas con su canto, con el tirador de aluminio en el canto de arriba de cada una.',
  },
  {
    ruta: 'cocina/coffee-corner', construir: coffeeCorner,
    ficha: { nombre: 'Mueble cafetera (coffee corner)', categoria: 'Cocina', superficies: [0.1, 0.366, 0.795, 1.345] },
    como: 'Las de la foto: encimera de 48 × 33 a 79,5 cm, estante de 43 × 12 a 134,5 cm (55 cm sobre la encimera), baldas de 40 × 30 con 30 y 25 cm de hueco. Mías: balda de abajo a 10 cm, cajón de 11 cm, tubo de 2,2 cm y barras a 1,275 / 1,19 / 0,92 m.',
    fotos: 'Tubo negro mate y tableros de madera rústica marrón; cajón con tirador de concha negro; 8 ganchos en S en las dos barras de arriba. Sin la decoración de la foto (cafetera, tazas, botellas, tarros, bolsas) ni la cinta antivuelco a la pared.',
  },
];

await procesarLote(OBJETOS, {
  reiniciar: process.argv.includes('--reiniciar'),
  seccion: 'lote4',
  titulo: 'Lote 4: zapatero y coffee corner',
  introduccion: `Hecho a partir de las fotos de producto (con sus medidas) del encargo.
Las medidas exteriores son las de las fotos; las interiores y los detalles,
**estimados** a partir de ellas. Solo están en el catálogo: no se colocan en
la casa.`,
});
