// Fase 5, lote 1: muebles reales del salón y del pasillo, hechos a partir de
// las fotos del piso.
//
// Uso:  npm run catalogo:lote1            (no toca las medidas ya corregidas a mano)
//       npm run catalogo:lote1 -- --reiniciar   (vuelve a las medidas de este script)
//
// Por cada objeto escribe en catalogo/<categoria>/:
//   - <id>.glb   el modelo (piezas de three.js, una malla por material)
//   - <id>.json  la ficha (nombre, categoría, medidas, colocación, superficies)
// y al final regenera la tabla de docs/OBJETOS.md.
//
// TODAS LAS MEDIDAS SON ESTIMADAS a partir de las fotos (referencias: puerta
// interior de 2,05 m y listones de tarima de 7–9 cm). Para corregir una medida
// basta con editar el .json: la app escala el modelo a lo que diga la ficha.
// Si el .json ya existe, este script respeta sus "dimensiones", "superficies",
// "alturaCentro" y "medidas" (salvo con --reiniciar).

import * as THREE from 'three';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Modelo, guardarObjeto } from './lib/modelo3d.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOGO = join(RAIZ, 'catalogo');
const REINICIAR = process.argv.includes('--reiniciar');
const PI = Math.PI;

// ---------------------------------------------------------------------------
// Materiales habituales (color de la foto y brillo)
// ---------------------------------------------------------------------------
const MAT = {
  negroMate: { color: 0x1b1b1b, rugosidad: 0.6, metalico: 0.3 },
  metalNegro: { color: 0x1a1a1a, rugosidad: 0.42, metalico: 0.6 },
  laton: { color: 0xb08d57, rugosidad: 0.35, metalico: 0.85 },
  plata: { color: 0xc5c8cc, rugosidad: 0.3, metalico: 0.85 },
  cristal: { color: 0xcfe5e2, rugosidad: 0.05, opacidad: 0.28 },
  luna: { color: 0xd8e2e8, rugosidad: 0.12, metalico: 0.55 },
};

// ---------------------------------------------------------------------------
// Objetos
// ---------------------------------------------------------------------------

function sofa() {
  const W = 2.05, D = 0.92, H = 0.85;
  const m = new Modelo('sofa-3-plazas', { ancho: W, fondo: D, alto: H });
  const tela = m.material('tela-crema', { color: 0xe6dccb, rugosidad: 0.95 });
  const cojinCrema = m.material('cojin-crema', { color: 0xf0e8d8, rugosidad: 0.95 });
  const cojinAzul = m.material('cojin-azul', { color: 0x7b8a99, rugosidad: 0.95 });
  const madera = m.material('madera-clara', { color: 0xc8a27a, rugosidad: 0.55 });
  const brazo = 0.22, patas = 0.1;
  // Patas bajas torneadas de madera clara
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    m.cilindro(madera, [0.024, 0.017, patas], [sx * (W / 2 - 0.1), patas / 2, sz * (D / 2 - 0.1)], undefined, 16);
  }
  // Brazos altos y enrollados hacia fuera: cuerpo + rollo
  for (const sx of [-1, 1]) {
    m.cajaRedonda(tela, [brazo, 0.5, D - 0.02], 0.05, [sx * (W / 2 - brazo / 2), patas + 0.25, 0]);
    m.cilindro(tela, [0.1, 0.1, D], [sx * (W / 2 - 0.1), 0.6, 0], [PI / 2, 0, 0], 28);
  }
  // Base del asiento y respaldo
  const interior = W - 2 * brazo;
  m.cajaRedonda(tela, [interior + 0.04, 0.24, D - 0.04], 0.03, [0, patas + 0.12, 0]);
  m.cajaRedonda(tela, [interior + 0.06, 0.53, 0.24], 0.07, [0, 0.32 + 0.265, -D / 2 + 0.12]);
  // Tres cojines de asiento
  const ancho = interior / 3 - 0.006;
  for (let i = -1; i <= 1; i++) {
    m.cajaRedonda(tela, [ancho, 0.15, 0.64], 0.055, [i * (ancho + 0.006), 0.34 + 0.075, D / 2 - 0.02 - 0.32]);
  }
  // Cuatro cojines sueltos apoyados en el respaldo: azules en los extremos, crema en el centro
  const lado = 0.4;
  [[-0.56, cojinAzul, 0.07], [-0.19, cojinCrema, -0.05], [0.19, cojinCrema, 0.05], [0.56, cojinAzul, -0.07]].forEach(([x, mat, giro]) => {
    m.cajaRedonda(mat, [lado, lado, 0.13], 0.06, [x, 0.625, -D / 2 + 0.24 + 0.1], [-0.28, 0, giro], 3);
  });
  return m;
}

function sillon() {
  const W = 0.8, D = 0.85, H = 0.8;
  const m = new Modelo('sillon', { ancho: W, fondo: D, alto: H });
  const tela = m.material('tela-gris-marron', { color: 0x857a6d, rugosidad: 0.95 });
  const cojin = m.material('cojin-gris', { color: 0x9da1a5, rugosidad: 0.95 });
  const pata = m.material('madera-oscura', { color: 0x3b2e25, rugosidad: 0.55 });
  const patas = 0.08;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    m.cilindro(pata, [0.022, 0.016, patas], [sx * (W / 2 - 0.07), patas / 2, sz * (D / 2 - 0.07)], undefined, 14);
  }
  for (const sx of [-1, 1]) m.cajaRedonda(tela, [0.15, 0.55, D], 0.06, [sx * (W / 2 - 0.075), patas + 0.275, 0]);
  m.cajaRedonda(tela, [W - 0.26, 0.24, D - 0.04], 0.03, [0, patas + 0.12, 0]);
  m.cajaRedonda(tela, [W - 0.04, 0.5, 0.2], 0.07, [0, 0.3 + 0.25, -D / 2 + 0.1]);
  m.cajaRedonda(tela, [W - 0.31, 0.14, 0.6], 0.055, [0, 0.32 + 0.07, D / 2 - 0.02 - 0.3]);
  m.cajaRedonda(cojin, [0.4, 0.4, 0.13], 0.06, [0, 0.595, -D / 2 + 0.2 + 0.09], [-0.28, 0, 0.05], 3);
  return m;
}

function mesaCentro() {
  const W = 1.0, D = 0.7, H = 0.45;
  const m = new Modelo('mesa-centro', { ancho: W, fondo: D, alto: H });
  const madera = m.material('madera-miel', { color: 0x6a3519, rugosidad: 0.45 });
  const cristal = m.material('cristal', MAT.cristal);
  const pata = 0.05, tapa = 0.04, marco = 0.07;
  const yTapa = H - tapa;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    m.caja(madera, [pata, yTapa, pata], [sx * (W / 2 - pata / 2), yTapa / 2, sz * (D / 2 - pata / 2)]);
  }
  // Tapa: marco de madera con el cristal encajado
  for (const sz of [-1, 1]) m.caja(madera, [W, tapa, marco], [0, yTapa + tapa / 2, sz * (D / 2 - marco / 2)]);
  for (const sx of [-1, 1]) m.caja(madera, [marco, tapa, D - 2 * marco], [sx * (W / 2 - marco / 2), yTapa + tapa / 2, 0]);
  m.caja(cristal, [W - 2 * marco, 0.008, D - 2 * marco], [0, H - 0.012, 0]);
  // Faldón bajo la tapa en los lados largos
  for (const sz of [-1, 1]) m.caja(madera, [W - 2 * pata, 0.05, 0.02], [0, yTapa - 0.025, sz * (D / 2 - 0.03)]);
  // Celosía en X en los dos laterales (y travesaño abajo)
  for (const sx of [-1, 1]) {
    const x = sx * (W / 2 - pata / 2);
    const z1 = D / 2 - pata, y1 = 0.07, y2 = yTapa - 0.01;
    m.barraCuadrada(madera, [x, y1, -z1], [x, y2, z1], 0.035, 0.022);
    m.barraCuadrada(madera, [x, y1, z1], [x, y2, -z1], 0.035, 0.022);
    m.caja(madera, [0.03, 0.03, D - 2 * pata], [x, 0.06, 0]);
  }
  return m;
}

function libreria() {
  const W = 0.9, D = 0.4, H = 2.0;
  const m = new Modelo('libreria', { ancho: W, fondo: D, alto: H });
  const madera = m.material('madera-muy-oscura', { color: 0x35261c, rugosidad: 0.5 });
  const fondoMat = m.material('fondo-oscuro', { color: 0x2a1e16, rugosidad: 0.7 });
  const tirador = m.material('laton', MAT.laton);
  const Wc = 0.86, zAtras = -D / 2, zFrente = D / 2 - 0.03, Dc = zFrente - zAtras, zc = (zAtras + zFrente) / 2;
  const alto = 1.94, lateral = 0.022, Wi = Wc - 2 * lateral;
  for (const sx of [-1, 1]) m.caja(madera, [lateral, alto, Dc], [sx * (Wc / 2 - lateral / 2), alto / 2, zc]);
  m.caja(fondoMat, [Wi, alto, 0.01], [0, alto / 2, zAtras + 0.005]);
  // Moldura superior en dos escalones
  m.caja(madera, [Wc + 0.02, 0.03, Dc + 0.015], [0, alto + 0.015, zAtras + (Dc + 0.015) / 2]);
  m.caja(madera, [W, 0.03, D], [0, alto + 0.045, 0]);
  m.caja(madera, [Wi, 0.02, Dc - 0.01], [0, alto - 0.01, zc - 0.005]);
  // Zócalo y cajón inferior con tirador
  m.caja(madera, [Wi, 0.08, 0.02], [0, 0.04, zFrente - 0.03]);
  m.caja(madera, [Wi, 0.02, Dc - 0.01], [0, 0.09, zc - 0.005]);
  m.caja(madera, [Wi - 0.006, 0.2, 0.02], [0, 0.205, zFrente - 0.01]);
  m.caja(madera, [Wi - 0.06, 0.15, 0.004], [0, 0.205, zFrente + 0.001]); // panel del frente, en relieve
  m.cilindro(tirador, [0.013, 0.013, 0.025], [0, 0.205, zFrente + 0.0125], [PI / 2, 0, 0], 16);
  // Baldas: la del cajón y cuatro más
  for (const arriba of BALDAS_LIBRERIA) {
    m.caja(madera, [Wi, 0.022, Dc - 0.01], [0, arriba - 0.011, zc - 0.005]);
    m.caja(madera, [Wi, 0.03, 0.012], [0, arriba - 0.015, zFrente - 0.006]); // canto frontal más grueso
  }
  return m;
}
const BALDAS_LIBRERIA = [0.33, 0.65, 0.97, 1.29, 1.61];

function muebleTv() {
  const W = 0.9, D = 0.38, H = 0.55;
  const m = new Modelo('mueble-tv', { ancho: W, fondo: D, alto: H });
  const madera = m.material('madera-media', { color: 0x9a6a40, rugosidad: 0.55 });
  const pata = 0.04, tapa = 0.03;
  m.caja(madera, [W, tapa, D], [0, H - tapa / 2, 0]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    m.caja(madera, [pata, H - tapa, pata], [sx * (W / 2 - pata / 2 - 0.01), (H - tapa) / 2, sz * (D / 2 - pata / 2 - 0.01)]);
  }
  // Dos estantes de listones sobre un bastidor
  for (const y of [0.1, 0.3]) {
    for (const sx of [-1, 1]) m.caja(madera, [0.025, 0.03, D - 0.1], [sx * (W / 2 - 0.03), y, 0]);
    for (const sz of [-1, 1]) m.caja(madera, [W - 0.1, 0.03, 0.025], [0, y, sz * (D / 2 - 0.03)]);
    const n = 5, ancho = 0.045, z0 = -(D / 2 - 0.06), paso = (2 * (D / 2 - 0.06)) / (n - 1);
    for (let i = 0; i < n; i++) m.caja(madera, [W - 0.08, 0.02, ancho], [0, y + 0.025, z0 + i * paso]);
  }
  return m;
}

function television() {
  const W = 0.73, D = 0.2, H = 0.48;
  const m = new Modelo('television', { ancho: W, fondo: D, alto: H });
  const marco = m.material('plastico-negro', { color: 0x141414, rugosidad: 0.3 });
  const pantalla = m.material('pantalla', { color: 0x15171b, rugosidad: 0.1, metalico: 0.2 });
  const peana = m.material('peana', { color: 0x222222, rugosidad: 0.35, metalico: 0.4 });
  const yPanel = 0.05, altoPanel = H - yPanel;
  m.cajaRedonda(marco, [W, altoPanel, 0.035], 0.006, [0, yPanel + altoPanel / 2, 0], undefined, 2);
  m.caja(pantalla, [W - 0.03, altoPanel - 0.04, 0.002], [0, yPanel + altoPanel / 2 + 0.006, 0.0175 + 0.001]);
  m.cajaRedonda(marco, [0.42, 0.24, 0.035], 0.01, [0, yPanel + 0.19, -0.03], undefined, 2);
  m.caja(peana, [0.06, 0.07, 0.03], [0, 0.045, -0.01]);
  m.cajaRedonda(peana, [0.3, 0.014, D], 0.005, [0, 0.007, 0], undefined, 2);
  return m;
}

function mesaComedor() {
  const W = 1.2, D = 0.7, H = 0.75;
  const m = new Modelo('mesa-comedor-cristal', { ancho: W, fondo: D, alto: H });
  const cristal = m.material('cristal', MAT.cristal);
  const metal = m.material('metal-negro', MAT.metalNegro);
  const vidrio = 0.012, yVidrio = H - vidrio;
  m.caja(cristal, [W, vidrio, D], [0, H - vidrio / 2, 0]);
  // Bastidor bajo el cristal
  for (const sz of [-1, 1]) m.caja(metal, [1.06, 0.03, 0.02], [0, yVidrio - 0.015, sz * 0.27]);
  for (const sx of [-1, 1]) m.caja(metal, [0.02, 0.03, 0.56], [sx * 0.52, yVidrio - 0.015, 0]);
  // Patas ligeramente inclinadas hacia fuera
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    m.barraCuadrada(metal, [sx * 0.52, yVidrio, sz * 0.27], [sx * 0.565, 0.0015, sz * 0.305], 0.025);
  }
  return m;
}

function silla() {
  const W = 0.48, D = 0.55, H = 0.82;
  const m = new Modelo('silla-comedor', { ancho: W, fondo: D, alto: H });
  const tapizado = m.material('tapizado-blanco', { color: 0xeceae4, rugosidad: 0.85 });
  const metal = m.material('metal-negro', MAT.metalNegro);
  // Asiento
  m.cajaRedonda(tapizado, [0.46, 0.08, 0.45], 0.03, [0, 0.44, D / 2 - 0.225]);
  // Respaldo curvo: sector de anillo extruido hacia arriba, cóncavo hacia delante
  const R = 0.43, t = 0.04, zc = -D / 2 + (R + t);
  const alfa = Math.asin((W / 2) / (R + t));
  const forma = new THREE.Shape();
  // Coordenadas de la forma: (x, -z del mundo); se extruye hacia arriba
  const punto = (r, f) => [r * Math.sin(f), r * Math.cos(f) - zc];
  forma.moveTo(...punto(R + t, -alfa));
  for (let i = 1; i <= 24; i++) forma.lineTo(...punto(R + t, -alfa + (2 * alfa * i) / 24));
  for (let i = 24; i >= 0; i--) forma.lineTo(...punto(R, -alfa + (2 * alfa * i) / 24));
  m.extrusion(tapizado, forma, 0.3, [0, H - 0.3, 0], [-PI / 2, 0, 0]);
  // Patas de metal negro, las de atrás algo abiertas
  const r = 0.011;
  for (const sx of [-1, 1]) {
    m.barra(metal, [sx * 0.19, 0.4, 0.2], [sx * 0.205, 0.0005, 0.235], r);
    m.barra(metal, [sx * 0.19, 0.4, -0.13], [sx * 0.205, 0.0005, -0.22], r);
    m.barra(metal, [sx * 0.19, 0.4, -0.13], [sx * 0.19, 0.56, -0.19], r); // sujeción del respaldo
  }
  return m;
}

function lamparaSemiesfera() {
  const W = 0.3, H = 1.45;
  const m = new Modelo('lampara-pie-semiesfera', { ancho: W, fondo: W, alto: H });
  const negro = m.material('negro-mate', MAT.negroMate);
  const pantalla = m.material('pantalla-negra', { ...MAT.negroMate, rugosidad: 0.7, dobleCara: true });
  m.torno(negro, [[0, 0], [0.15, 0], [0.15, 0.012], [0.135, 0.028], [0, 0.028]], [0, 0, 0], 40);
  m.cilindro(negro, [0.011, 0.011, 1.3], [0, 0.028 + 0.65, 0], undefined, 14);
  m.cilindro(negro, [0.022, 0.022, 0.05], [0, 1.29, 0], undefined, 16);
  m.esfera(pantalla, 0.15, [0, H - 0.15, 0], { thetaLargo: PI / 2, segmentos: 40 });
  return m;
}

function lamparaTripode() {
  const m = new Modelo('lampara-tripode', null);
  const negro = m.material('negro-mate', MAT.negroMate);
  const pantalla = m.material('pantalla-tela', { color: 0x202020, rugosidad: 0.9, dobleCara: true });
  const laton = m.material('laton', MAT.laton);
  const yApice = 0.95, r = 0.012, Rpie = 0.2459;
  // Tres patas: una hacia atrás y dos hacia delante
  for (const ang of [-PI / 2, PI / 6, (5 * PI) / 6]) {
    m.barra(negro, [0, yApice, 0], [Rpie * Math.cos(ang), r * 0.26, -Rpie * Math.sin(ang)], r, 10);
  }
  // Pieza de unión de latón y vástago
  m.cilindro(laton, [0.022, 0.026, 0.07], [0, yApice, 0], undefined, 20);
  m.cilindro(laton, [0.009, 0.009, 0.06], [0, yApice + 0.06, 0], undefined, 12);
  // Pantalla cilíndrica con aros de latón
  m.cilindro(pantalla, [0.18, 0.18, 0.3], [0, 1.15, 0], undefined, 40, true);
  m.aro(laton, 0.18, 0.004, [0, 1.3 - 0.004, 0]);
  m.aro(laton, 0.18, 0.004, [0, 1.0 + 0.004, 0]);
  m.centrar();
  m.dimensiones = m.medir();
  return m;
}

function mesitaAlambre() {
  const W = 0.35, H = 0.55;
  const m = new Modelo('mesita-alambre', { ancho: W, fondo: W, alto: H });
  const metal = m.material('metal-negro', MAT.metalNegro);
  m.cilindro(metal, [W / 2, W / 2, 0.012], [0, H - 0.006, 0], undefined, 40);
  const t = 0.004;
  const aros = [[0.15, t + 0.001], [0.105, 0.27], [0.165, H - 0.016]];
  for (const [radio, y] of aros) m.aro(metal, radio, t, [0, y, 0]);
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (2 * PI * i) / n, c = Math.cos(a), s = Math.sin(a);
    const pts = aros.map(([radio, y]) => [radio * c, y, radio * s]);
    m.barra(metal, pts[0], pts[1], t, 6);
    m.barra(metal, pts[1], pts[2], t, 6);
  }
  return m;
}

function mesitaBandeja() {
  const W = 0.45, H = 0.45;
  const m = new Modelo('mesita-bandeja', { ancho: W, fondo: W, alto: H });
  const bandeja = m.material('bandeja-negra', { color: 0x161616, rugosidad: 0.35, metalico: 0.4 });
  const metal = m.material('metal-negro', MAT.metalNegro);
  m.torno(bandeja, [[0, 0.42], [0.218, 0.42], [0.225, 0.45], [0.219, 0.45], [0.212, 0.428], [0, 0.428]], [0, 0, 0], 48);
  const r = 0.008;
  // Patas cruzadas: dos aspas, una en cada dirección
  for (const [dx, dz] of [[1, 0], [0, 1]]) {
    for (const s of [-1, 1]) {
      m.barra(metal, [s * 0.18 * dx, r * 0.63, s * 0.18 * dz], [-s * 0.16 * dx, 0.42, -s * 0.16 * dz], r, 8);
    }
  }
  m.esfera(metal, 0.014, [0, 0.21, 0], { segmentos: 12 });
  return m;
}

function espejoMarcoNegro() {
  const W = 0.95, D = 0.04, H = 0.65, marco = 0.09;
  const m = new Modelo('espejo-marco-negro', { ancho: W, fondo: D, alto: H });
  const negro = m.material('marco-negro', { color: 0x151515, rugosidad: 0.45 });
  const luna = m.material('espejo', MAT.luna);
  marcoRectangular(m, negro, W, H, D, marco);
  m.caja(luna, [W - 2 * marco + 0.01, H - 2 * marco + 0.01, 0.006], [0, H / 2, 0.006]);
  m.caja(negro, [W - 2 * marco, H - 2 * marco, 0.01], [0, H / 2, -D / 2 + 0.005]);
  return m;
}

/** Marco de cuatro listones (con el frente redondeado) de ancho W, alto H, fondo D y listón `ancho`. */
function marcoRectangular(m, material, W, H, D, ancho) {
  m.cajaRedonda(material, [W, ancho, D], 0.004, [0, H - ancho / 2, 0], undefined, 2);
  m.cajaRedonda(material, [W, ancho, D], 0.004, [0, ancho / 2, 0], undefined, 2);
  for (const sx of [-1, 1]) m.cajaRedonda(material, [ancho, H - 2 * ancho + 0.002, D], 0.004, [sx * (W / 2 - ancho / 2), H / 2, 0], undefined, 2);
}

function cuadroBlanco() {
  const W = 0.25, D = 0.02, H = 0.25, marco = 0.02;
  const m = new Modelo('cuadro-marco-blanco', { ancho: W, fondo: D, alto: H });
  const blanco = m.material('marco-blanco', { color: 0xf2f2ef, rugosidad: 0.5 });
  const paspartu = m.material('paspartu', { color: 0xfaf8f2, rugosidad: 0.9 });
  const verde = m.material('lamina-verde', { color: 0x6f8c8a, rugosidad: 0.85 });
  const terracota = m.material('lamina-terracota', { color: 0xc98f6b, rugosidad: 0.85 });
  marcoRectangular(m, blanco, W, H, D, marco);
  m.caja(paspartu, [W - 2 * marco + 0.002, H - 2 * marco + 0.002, 0.004], [0, H / 2, 0.002]);
  m.caja(verde, [0.11, 0.11, 0.002], [0, H / 2, 0.005]);
  m.cilindro(terracota, [0.025, 0.025, 0.002], [0.02, H / 2 + 0.02, 0.0065], [PI / 2, 0, 0], 20);
  m.caja(blanco, [W - 2 * marco, H - 2 * marco, 0.004], [0, H / 2, -D / 2 + 0.002]);
  return m;
}

function perchero() {
  const W = 0.45, D = 0.1, H = 0.12;
  const m = new Modelo('perchero-pared', { ancho: W, fondo: D, alto: H });
  const tabla = m.material('tabla-blanca', { color: 0xf4f4f2, rugosidad: 0.45 });
  const negro = m.material('ganchos-negros', MAT.metalNegro);
  m.cajaRedonda(tabla, [W, H, 0.02], 0.004, [0, H / 2, -D / 2 + 0.01], undefined, 2);
  const r = 0.006;
  for (const x of [-0.15, 0, 0.15]) {
    m.cilindro(negro, [0.013, 0.013, 0.006], [x, 0.055, -D / 2 + 0.023], [PI / 2, 0, 0], 14);
    m.barra(negro, [x, 0.055, -D / 2 + 0.02], [x, 0.045, 0.035], r, 8);
    m.barra(negro, [x, 0.045, 0.035], [x, 0.08, 0.04], r, 8);
    m.esfera(negro, 0.01, [x, 0.08, 0.04], { segmentos: 12 });
  }
  return m;
}

function espejoPlateado() {
  const W = 0.35, D = 0.02, H = 0.75, marco = 0.025;
  const m = new Modelo('espejo-marco-plateado', { ancho: W, fondo: D, alto: H });
  const plata = m.material('marco-plateado', MAT.plata);
  const luna = m.material('espejo', MAT.luna);
  marcoRectangular(m, plata, W, H, D, marco);
  m.caja(luna, [W - 2 * marco + 0.006, H - 2 * marco + 0.006, 0.005], [0, H / 2, 0.002]);
  m.caja(plata, [W - 2 * marco, H - 2 * marco, 0.004], [0, H / 2, -D / 2 + 0.002]);
  return m;
}

// ---------------------------------------------------------------------------
// Lista del lote: ruta en catalogo/, ficha y cómo se estimaron las medidas
// ---------------------------------------------------------------------------
const OBJETOS = [
  {
    ruta: 'sofas/sofa-3-plazas', construir: sofa,
    ficha: { nombre: 'Sofá 3 plazas crema', categoria: 'Sofás y sillones', superficies: [] },
    como: 'Exteriores: las del encargo. Mías: patas de 10 cm, asiento a 0,49 m, rollo del brazo hasta 0,70 m, cojines sueltos de 40 cm.',
  },
  {
    ruta: 'sofas/sillon', construir: sillon,
    ficha: { nombre: 'Sillón gris', categoria: 'Sofás y sillones', superficies: [] },
    como: 'Exteriores: las del encargo. Mías: patas de 8 cm, asiento a 0,46 m, brazos hasta 0,63 m.',
  },
  {
    ruta: 'mesas/mesa-centro', construir: mesaCentro,
    ficha: { nombre: 'Mesa de centro de madera y cristal', categoria: 'Mesas', superficies: [0.45] },
    como: 'Exteriores: las del encargo. Mías: marco de la tapa de 7 cm, patas de 5 cm, celosía en X en los dos lados cortos.',
  },
  {
    ruta: 'almacenaje/libreria', construir: libreria,
    ficha: { nombre: 'Librería alta de madera oscura', categoria: 'Almacenaje', superficies: [...BALDAS_LIBRERIA, 2.0] },
    como: 'Exteriores: las del encargo. Mías: cajón de 20 cm sobre un zócalo de 8 cm y baldas cada 32 cm (0,33 / 0,65 / 0,97 / 1,29 / 1,61 m) más la tapa a 2,00 m.',
  },
  {
    ruta: 'almacenaje/mueble-tv', construir: muebleTv,
    ficha: { nombre: 'Mueble de TV de listones', categoria: 'Almacenaje', superficies: [0.135, 0.335, 0.55] },
    como: 'Exteriores: las del encargo. Mías: dos estantes de 5 listones con su superficie a 0,135 y 0,335 m, más la tapa a 0,55 m.',
  },
  {
    ruta: 'electronica/television', construir: television,
    ficha: { nombre: 'Televisión 32"', categoria: 'Electrónica', colocacion: 'superficie' },
    como: 'Las del encargo (pantalla de 32" 16:9 con peana).',
  },
  {
    ruta: 'mesas/mesa-comedor-cristal', construir: mesaComedor,
    ficha: { nombre: 'Mesa de comedor de cristal', categoria: 'Mesas', superficies: [0.75] },
    como: 'Exteriores: las del encargo. Mías: cristal de 12 mm y patas que se abren unos 5 cm hacia fuera.',
  },
  {
    ruta: 'sillas/silla-comedor', construir: silla,
    ficha: { nombre: 'Silla de comedor blanca', categoria: 'Sillas', superficies: [] },
    como: 'Exteriores: las del encargo. Mías: asiento a 0,48 m y respaldo curvo de 30 cm de alto.',
  },
  {
    ruta: 'iluminacion/lampara-pie-semiesfera', construir: lamparaSemiesfera,
    ficha: { nombre: 'Lámpara de pie semiesfera negra', categoria: 'Iluminación', superficies: [] },
    como: 'Las del encargo. Mías: base de 30 cm de diámetro (como la pantalla).',
  },
  {
    ruta: 'iluminacion/lampara-tripode', construir: lamparaTripode,
    ficha: { nombre: 'Lámpara de trípode negra', categoria: 'Iluminación', superficies: [] },
    como: 'Ancho y alto: los del encargo. El fondo (0,442) sale de la forma: con tres patas abiertas a 0,45 m, la planta no es cuadrada.',
  },
  {
    ruta: 'mesas/mesita-alambre', construir: mesitaAlambre,
    ficha: { nombre: 'Mesita auxiliar de alambre', categoria: 'Mesas', superficies: [0.55] },
    como: 'Las del encargo. Mías: forma de reloj de arena con 12 varillas.',
  },
  {
    ruta: 'mesas/mesita-bandeja', construir: mesitaBandeja,
    ficha: { nombre: 'Mesita auxiliar de bandeja negra', categoria: 'Mesas', superficies: [0.43] },
    como: 'Exteriores: las del encargo. Mía: superficie útil de la bandeja a 0,43 m (el borde llega a 0,45).',
  },
  {
    ruta: 'pared/espejo-marco-negro', construir: espejoMarcoNegro,
    ficha: { nombre: 'Espejo con marco negro', categoria: 'Decoración de pared', colocacion: 'pared', alturaCentro: 1.3 },
    como: 'Las del encargo (marco de 9 cm, centro a 1,30 m).',
  },
  {
    ruta: 'pared/cuadro-marco-blanco', construir: cuadroBlanco,
    ficha: { nombre: 'Cuadro pequeño de marco blanco', categoria: 'Decoración de pared', colocacion: 'pared', alturaCentro: 1.5 },
    como: 'Las del encargo. Mía: altura del centro a 1,50 m (la que usa la app por defecto).',
  },
  {
    ruta: 'pared/perchero-pared', construir: perchero,
    ficha: { nombre: 'Perchero de pared de 3 ganchos', categoria: 'Decoración de pared', colocacion: 'pared', alturaCentro: 1.65 },
    como: 'Las del encargo (centro a 1,65 m).',
  },
  {
    ruta: 'pared/espejo-marco-plateado', construir: espejoPlateado,
    ficha: { nombre: 'Espejo pequeño plateado', categoria: 'Decoración de pared', colocacion: 'pared', alturaCentro: 1.45 },
    como: 'Las del encargo. Mía: centro a 1,45 m.',
  },
];

// ---------------------------------------------------------------------------

const resumen = [];
for (const o of OBJETOS) {
  const modelo = o.construir();
  const id = o.ruta.split('/').pop();
  let ficha = {
    nombre: o.ficha.nombre,
    categoria: o.ficha.categoria,
    ...(o.ficha.colocacion ? { colocacion: o.ficha.colocacion } : {}),
    ...(o.ficha.alturaCentro !== undefined ? { alturaCentro: o.ficha.alturaCentro } : {}),
    dimensiones: modelo.dimensiones,
    ...(o.ficha.superficies ? { superficies: o.ficha.superficies } : {}),
    medidas: 'estimadas',
    glb: `${id}.glb`,
  };
  // Lo corregido a mano en el .json se respeta
  const rutaJson = join(CATALOGO, `${o.ruta}.json`);
  if (existsSync(rutaJson) && !REINICIAR) {
    const antigua = JSON.parse(readFileSync(rutaJson, 'utf8'));
    for (const campo of ['dimensiones', 'superficies', 'alturaCentro', 'medidas']) {
      if (antigua[campo] !== undefined) ficha[campo] = antigua[campo];
    }
    ficha = Object.fromEntries(Object.entries(ficha));
  }
  const info = await guardarObjeto(CATALOGO, o.ruta, ficha, modelo);
  resumen.push({ ...o, ficha, info, id });
}

// --- docs/OBJETOS.md ----------------------------------------------------------------
const m = (n) => String(n).replace('.', ',');
const filas = resumen.map(({ ruta, ficha, como, info }) => {
  const d = ficha.dimensiones;
  const extra = [
    ficha.colocacion ? `colocación: ${ficha.colocacion}` : 'colocación: suelo',
    ficha.alturaCentro !== undefined ? `centro a ${m(ficha.alturaCentro)} m` : '',
    ficha.superficies ? (ficha.superficies.length ? `superficies: ${ficha.superficies.map(m).join(' / ')} m` : 'sin superficies (no se apoya nada encima)') : '',
  ].filter(Boolean).join('; ');
  return `| ${ficha.nombre} (\`${ruta}\`) | ${m(d.ancho)} × ${m(d.fondo)} × ${m(d.alto)} | ${extra} | ${como} | ${ficha.medidas === 'confirmadas' ? '**confirmada**' : 'estimada'} | ${info.triangulos} |`;
});
const doc = `# Objetos del catálogo

Muebles reales del piso, generados por \`scripts/catalogo-lote1.mjs\` (lote 1:
salón y pasillo). Los objetos de ejemplo de las fases 1 y 4 (mesa, armario,
cuadro, espejo, jarrón y planta provisionales) siguen en \`catalogo/\` hasta el lote 2.

## Cómo corregir una medida

1. Abre el \`.json\` del objeto (por ejemplo \`catalogo/sofas/sofa-3-plazas.json\`).
2. Cambia \`dimensiones\` (en metros: \`ancho\` = de lado a lado, \`fondo\` = de
   delante atrás, \`alto\`). Si es un mueble con \`superficies\`, cambia también
   las alturas de sus tapas o baldas; si es de pared, \`alturaCentro\`.
3. Pon \`"medidas": "confirmadas"\` para marcarla como medida de verdad.

No hace falta tocar nada más: la app estira el modelo a las medidas de la
ficha. Si se vuelve a ejecutar \`npm run catalogo:lote1\`, las medidas de los
\`.json\` existentes se respetan (salvo con \`-- --reiniciar\`) y esta tabla se
regenera con ellas.

## Lote 1: salón y pasillo

Todas las medidas son **estimadas**. Las exteriores (ancho × fondo × alto)
son las del encargo, sacadas de las fotos con estas referencias: puerta
interior de 2,05 m de alto y listones de tarima de 7–9 cm. Las alturas
interiores (asientos, baldas, tapas) y los detalles de forma los puse yo a
partir de la descripción de cada mueble; están anotados en la tabla.

| Objeto | Medidas (ancho × fondo × alto, m) | Colocación | De dónde salen | Estado | Triángulos |
|---|---|---|---|---|---:|
${filas.join('\n')}
`;
writeFileSync(join(RAIZ, 'docs', 'OBJETOS.md'), doc);
console.log('✔ docs/OBJETOS.md');
