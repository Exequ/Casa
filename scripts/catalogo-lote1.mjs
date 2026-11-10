// Fase 5, lote 1: muebles reales del salón y del pasillo, ajustados a las
// fotos del piso (lote 2 de la fase 5, parte A).
//
// Uso:  npm run catalogo:lote1                 (no toca las medidas ya corregidas a mano)
//       npm run catalogo:lote1 -- --reiniciar  (vuelve a las medidas de este script)
//
// Por cada objeto escribe en catalogo/<categoria>/ el .glb y el .json, y
// regenera su tabla en docs/OBJETOS.md. Las maderas llevan veta y las
// tapicerías un tejido sutil (texturas procedurales pequeñas, ver lib/texturas.mjs).
//
// TODAS LAS MEDIDAS SON ESTIMADAS (referencias de las fotos: puerta interior
// de 2,05 m y listones de tarima de 7–9 cm). Para corregir una medida basta con
// editar el .json: la app escala el modelo a lo que diga la ficha.

import * as THREE from 'three';
import { Modelo } from './lib/modelo3d.mjs';
import { MAT, marcoRectangular, pataCuadrada, procesarLote } from './lib/lote.mjs';

const PI = Math.PI;

/**
 * Celosía de listones a ±45° en un rectángulo vertical: `plano` 'x' (lado
 * largo, en z = c) o 'z' (lado corto, en x = c), de u1 a u2 a lo largo y de
 * y1 a y2 de alto, con rombos de ancho `paso`.
 */
function celosia(m, material, plano, c, [u1, u2], [y1, y2], paso, listón = 0.026, grueso = 0.016) {
  const h = y2 - y1, L = u2 - u1;
  const desfase = ((L % paso) + paso) % paso / 2;
  const punto = (u, y) => (plano === 'x' ? [u1 + u, y, c] : [c, y, u1 + u]);
  for (const sentido of [1, -1]) {
    for (let k = -Math.ceil(h / paso) - 1; k * paso <= L + h; k++) {
      // Recta u = u0 + sentido·(y − y1), recortada al rectángulo
      const u0 = desfase + k * paso;
      let ta = 0, tb = h;
      const uEn = (t) => (sentido > 0 ? u0 + t : u0 + h - t);
      // Recortar en u ∈ [0, L]
      const t0 = sentido > 0 ? -u0 : u0 + h - L, t1 = sentido > 0 ? L - u0 : u0 + h;
      ta = Math.max(ta, Math.min(t0, t1)); tb = Math.min(tb, Math.max(t0, t1));
      if (tb - ta < 0.03) continue;
      const a = punto(uEn(ta), y1 + ta), b = punto(uEn(tb), y1 + tb);
      if (plano === 'x') m.barraCuadrada(material, a, b, grueso, listón);
      else m.barraCuadrada(material, a, b, listón, grueso);
    }
  }
}

// ---------------------------------------------------------------------------

function sofa() {
  const W = 2.05, D = 0.92;
  const m = new Modelo('sofa-3-plazas', null);
  const tela = m.material('tela-crema', { color: 0xd9c7a0, rugosidad: 0.95, textura: 'tela' });
  const vivo = m.material('vivo', { color: 0xc4ad82, rugosidad: 0.9 });
  const cojinAzul = m.material('cojin-azul', { color: 0x5b6878, rugosidad: 0.95, textura: 'tela' });
  const cojinBlanco = m.material('cojin-blanco', { color: 0xece4d2, rugosidad: 0.95, textura: 'tela' });
  const madera = m.material('madera-clara', { color: 0xb39470, rugosidad: 0.55, textura: 'madera' });
  const patas = 0.07, b = 0.015;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pataCuadrada(m, madera, sx * (W / 2 - 0.1), sz * (D / 2 - 0.1), patas, 0.07, 0.055);

  // Brazos enrollados hacia fuera ("rolled arm"): perfil extruido de delante atrás
  const r = 0.11, cy = 0.56;
  for (const s of [-1, 1]) {
    const cx = W / 2 - r - b, x0 = W / 2 - 0.025 - b, xi = cx - r;
    const forma = new THREE.Shape();
    const theta1 = -Math.acos((x0 - cx) / r);
    const P = (x, y) => [s * x, y];
    forma.moveTo(...P(xi, patas + 0.005));
    forma.lineTo(...P(x0, patas + 0.005));
    forma.lineTo(...P(x0, cy + r * Math.sin(theta1)));
    for (let i = 1; i <= 24; i++) {
      const t = theta1 + ((PI - theta1) * i) / 24;
      forma.lineTo(...P(cx + r * Math.cos(t), cy + r * Math.sin(t)));
    }
    forma.lineTo(...P(xi, patas + 0.005));
    m.extrusion(tela, forma, D - 2 * b - 0.01, [0, 0, -D / 2 + b + 0.005], undefined, { bisel: b, segmentosCurva: 12 });
    // Vivo (cordón) en el frente del rollo
    m.aro(vivo, r + b - 0.004, 0.005, [s * cx, cy, D / 2 - 0.003], [0, 0, 0]);
  }
  const interior = W - 2 * (2 * r + b) + 0.02;
  // Base del asiento con su vivo, y respaldo fijo (más alto que los brazos)
  m.cajaRedonda(tela, [interior + 0.04, 0.26, D - 0.05], 0.03, [0, patas + 0.13, 0.0]);
  m.cilindro(vivo, [0.006, 0.006, interior + 0.02], [0, patas + 0.255, D / 2 - 0.028], [0, 0, PI / 2], 8);
  m.cajaRedonda(tela, [interior + 0.12, 0.5, 0.26], 0.09, [0, 0.3 + 0.25, -D / 2 + 0.13]);
  // Tres cojines de asiento gruesos
  const ancho = interior / 3 - 0.008, fondo = D - 0.26 - 0.03;
  for (let i = -1; i <= 1; i++) {
    m.cajaRedonda(tela, [ancho, 0.16, fondo], 0.06, [i * (ancho + 0.008), 0.33 + 0.08, D / 2 - 0.02 - fondo / 2]);
  }
  // Cojines sueltos como en la foto: azul (detrás) y blanco a la izquierda, azul y uno crema pequeño a la derecha
  const zc = -D / 2 + 0.26 + 0.07;
  [
    [-0.66, cojinAzul, 0.42, 0.62, zc - 0.03, 0.06],
    [-0.4, cojinBlanco, 0.42, 0.62, zc + 0.02, -0.05],
    [0.22, cojinAzul, 0.42, 0.62, zc, 0.08],
    [0.58, cojinBlanco, 0.34, 0.58, zc - 0.01, -0.06],
  ].forEach(([x, mat, lado, y, z, giro]) => m.cajaRedonda(mat, [lado, lado, 0.13], 0.06, [x, y, z], [-0.25, 0, giro], 3));
  return m.ajustar({ ancho: W, fondo: D, alto: 0.85 }, 0.015);
}

function sillon() {
  const W = 0.8, D = 0.85;
  const m = new Modelo('sillon', null);
  const tela = m.material('tela-gris-marron', { color: 0x4d443b, rugosidad: 0.95, textura: 'tela' });
  const cojin = m.material('cojin-gris', { color: 0x6f675c, rugosidad: 0.97, textura: 'tela' });
  const pata = m.material('madera-oscura', { color: 0x2e231b, rugosidad: 0.55, textura: 'madera' });
  const patas = 0.07;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pataCuadrada(m, pata, sx * (W / 2 - 0.07), sz * (D / 2 - 0.07), patas, 0.05, 0.04);
  // Brazos rectos ("track arm") algo más bajos que el respaldo
  for (const sx of [-1, 1]) m.cajaRedonda(tela, [0.13, 0.53, D], 0.05, [sx * (W / 2 - 0.065), patas + 0.265, 0]);
  m.cajaRedonda(tela, [W - 0.24, 0.24, D - 0.04], 0.03, [0, patas + 0.12, 0]);
  m.cajaRedonda(tela, [W - 0.02, 0.56, 0.22], 0.07, [0, 0.24 + 0.28, -D / 2 + 0.11]);
  m.cajaRedonda(tela, [W - 0.27, 0.15, 0.6], 0.055, [0, 0.31 + 0.075, D / 2 - 0.02 - 0.3]);
  m.cajaRedonda(cojin, [0.44, 0.36, 0.14], 0.06, [0, 0.6, -D / 2 + 0.22 + 0.08], [-0.2, 0, 0.03], 3);
  return m.ajustar({ ancho: W, fondo: D, alto: 0.8 }, 0.012);
}

function mesaCentro() {
  const W = 1.0, D = 0.7, H = 0.45;
  const m = new Modelo('mesa-centro', { ancho: W, fondo: D, alto: H });
  const madera = m.material('madera-teca', { color: 0x683b21, rugosidad: 0.45, textura: 'madera' });
  const cristal = m.material('cristal-ahumado', { color: 0x8f9a95, rugosidad: 0.05, opacidad: 0.4 });
  const tapa = 0.045, marco = 0.085, pata = 0.055, vuelo = 0.015;
  const yTapa = H - tapa;
  // Tapa: marco ancho con el cristal ahumado un poco hundido
  for (const sz of [-1, 1]) m.caja(madera, [W, tapa, marco], [0, yTapa + tapa / 2, sz * (D / 2 - marco / 2)]);
  for (const sx of [-1, 1]) m.caja(madera, [marco, tapa, D - 2 * marco], [sx * (W / 2 - marco / 2), yTapa + tapa / 2, 0]);
  m.caja(cristal, [W - 2 * marco + 0.012, 0.006, D - 2 * marco + 0.012], [0, H - 0.014, 0]);
  // Patas cuadradas, algo más finas abajo
  const px = W / 2 - vuelo - pata / 2, pz = D / 2 - vuelo - pata / 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pataCuadrada(m, madera, sx * px, sz * pz, yTapa, pata, 0.042);
  // Faldón bajo la tapa, travesaño a media altura y celosía de rombos entre ambos (en los 4 lados)
  const faldon = 0.05, yRiel = 0.13, riel = 0.035;
  const xin = px - pata / 2, zin = pz - pata / 2;
  for (const sz of [-1, 1]) {
    const z = sz * (pz + pata / 2 - 0.012);
    m.caja(madera, [2 * xin, faldon, 0.022], [0, yTapa - faldon / 2, z]);
    m.caja(madera, [2 * xin, riel, 0.026], [0, yRiel, z]);
    celosia(m, madera, 'x', z, [-xin, xin], [yRiel + riel / 2, yTapa - faldon], yTapa - faldon - yRiel - riel / 2);
  }
  for (const sx of [-1, 1]) {
    const x = sx * (px + pata / 2 - 0.012);
    m.caja(madera, [0.022, faldon, 2 * zin], [x, yTapa - faldon / 2, 0]);
    m.caja(madera, [0.026, riel, 2 * zin], [x, yRiel, 0]);
    celosia(m, madera, 'z', x, [-zin, zin], [yRiel + riel / 2, yTapa - faldon], yTapa - faldon - yRiel - riel / 2);
  }
  return m;
}

/** Superficies de la librería: 4 baldas y la tapa. */
const BALDAS_LIBRERIA = [0.37, 0.66, 0.98, 1.36];

function libreria() {
  const W = 0.9, D = 0.4, H = 2.0;
  const m = new Modelo('libreria', { ancho: W, fondo: D, alto: H });
  const madera = m.material('madera-muy-oscura', { color: 0x3c1f14, rugosidad: 0.5, textura: 'madera' });
  const fondoMat = m.material('fondo-oscuro', { color: 0x2c160e, rugosidad: 0.7, textura: 'madera' });
  const Wc = 0.84, zAtras = -D / 2, zFrente = 0.16, Dc = zFrente - zAtras, zc = (zAtras + zFrente) / 2;
  const lado = 0.035, Wi = Wc - 2 * lado, yZocalo = 0.1, yArriba = 1.86;
  // Zócalo con moldura
  m.caja(madera, [Wc + 0.02, yZocalo, Dc + 0.01], [0, yZocalo / 2, zAtras + (Dc + 0.01) / 2]);
  m.caja(madera, [Wc + 0.03, 0.018, Dc + 0.018], [0, yZocalo - 0.009, zAtras + (Dc + 0.018) / 2]);
  // Laterales gruesos con montante delantero, fondo
  for (const sx of [-1, 1]) {
    m.caja(madera, [lado, yArriba - yZocalo, Dc], [sx * (Wc / 2 - lado / 2), (yZocalo + yArriba) / 2, zc]);
    m.caja(madera, [0.05, yArriba - yZocalo, 0.012], [sx * (Wc / 2 - 0.025), (yZocalo + yArriba) / 2, zFrente + 0.006]);
  }
  m.caja(fondoMat, [Wi, yArriba - yZocalo, 0.012], [0, (yZocalo + yArriba) / 2, zAtras + 0.006]);
  // Friso y cornisa escalonada que vuela por delante y por los lados
  m.caja(madera, [Wc + 0.01, 0.06, Dc + 0.012], [0, yArriba + 0.03, zAtras + (Dc + 0.012) / 2]);
  m.caja(madera, [0.87, 0.025, 0.375], [0, yArriba + 0.06 + 0.0125, zAtras + 0.375 / 2]);
  m.caja(madera, [0.885, 0.025, 0.39], [0, yArriba + 0.085 + 0.0125, zAtras + 0.39 / 2]);
  m.caja(madera, [W, 0.03, D], [0, H - 0.015, 0]);
  m.caja(madera, [Wi, 0.022, Dc - 0.012], [0, yArriba - 0.011, zc]);
  // Cajón con panel en relieve y pomo
  m.caja(madera, [Wi, 0.02, Dc - 0.012], [0, yZocalo + 0.01, zc]);
  m.caja(madera, [Wi - 0.008, 0.23, 0.022], [0, 0.235, zFrente - 0.005]);
  marcoRectangular(m, madera, Wi - 0.08, 0.17, 0.006, 0.02, 0);
  m.materiales.get(madera).geometrias.slice(-4).forEach((g) => g.translate(0, 0.15, zFrente + 0.009));
  m.esfera(madera, 0.015, [0, 0.235, zFrente + 0.02], { segmentos: 12 });
  // Cuatro baldas con el canto delantero más grueso
  for (const arriba of BALDAS_LIBRERIA) {
    m.caja(madera, [Wi, 0.025, Dc - 0.012], [0, arriba - 0.0125, zc]);
    m.caja(madera, [Wi, 0.035, 0.015], [0, arriba - 0.0175, zFrente - 0.0075]);
  }
  return m;
}

function muebleTv() {
  const W = 0.9, D = 0.38, H = 0.55;
  const m = new Modelo('mueble-tv', { ancho: W, fondo: D, alto: H });
  const madera = m.material('madera-teca', { color: 0x6c3f24, rugosidad: 0.5, textura: 'madera' });
  const pata = 0.045, tapa = 0.03;
  m.caja(madera, [W, tapa, D], [0, H - tapa / 2, 0]);
  const px = W / 2 - pata / 2 - 0.01, pz = D / 2 - pata / 2 - 0.01;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.caja(madera, [pata, H - tapa, pata], [sx * px, (H - tapa) / 2, sz * pz]);
  // Faldón bajo la tapa
  for (const sz of [-1, 1]) m.caja(madera, [2 * px - pata, 0.05, 0.02], [0, H - tapa - 0.025, sz * (pz + pata / 2 - 0.01)]);
  for (const sx of [-1, 1]) m.caja(madera, [0.02, 0.05, 2 * pz - pata], [sx * (px + pata / 2 - 0.01), H - tapa - 0.025, 0]);
  // Un estante de listones a media altura (como en la foto) y patas libres por debajo
  const y = 0.25;
  for (const sz of [-1, 1]) m.caja(madera, [2 * px - pata, 0.035, 0.022], [0, y, sz * (pz + pata / 2 - 0.012)]);
  for (const sx of [-1, 1]) m.caja(madera, [0.022, 0.035, 2 * pz - pata], [sx * (px + pata / 2 - 0.012), y, 0]);
  const n = 9, listón = 0.026, z0 = -(pz - 0.01), paso = (2 * (pz - 0.01)) / (n - 1);
  for (let i = 0; i < n; i++) m.caja(madera, [2 * px - pata, 0.015, listón], [0, y + 0.0175 + 0.0075, z0 + i * paso]);
  return m;
}

function television() {
  const W = 0.73, D = 0.2, H = 0.48;
  const m = new Modelo('television', { ancho: W, fondo: D, alto: H });
  const marco = m.material('marco-gris', { color: 0x2b2c2f, rugosidad: 0.3, metalico: 0.45 });
  const pantalla = m.material('pantalla', { color: 0x0e0f12, rugosidad: 0.08, metalico: 0.2 });
  const peana = m.material('peana', { color: 0x141414, rugosidad: 0.25, metalico: 0.3 });
  const plata = m.material('plata', MAT.plata);
  const yPanel = 0.055, altoPanel = H - yPanel;
  m.cajaRedonda(marco, [W, altoPanel, 0.045], 0.008, [0, yPanel + altoPanel / 2, 0], undefined, 2);
  m.caja(pantalla, [W - 0.04, altoPanel - 0.06, 0.002], [0, yPanel + altoPanel / 2 + 0.008, 0.0225 + 0.001]);
  m.caja(plata, [0.05, 0.006, 0.002], [0, yPanel + 0.012, 0.0235]);
  m.cajaRedonda(marco, [0.42, 0.25, 0.04], 0.012, [0, yPanel + 0.19, -0.04], undefined, 2);
  m.caja(peana, [0.07, 0.06, 0.04], [0, 0.04, -0.02]);
  m.cajaRedonda(peana, [0.32, 0.014, D], 0.005, [0, 0.007, 0], undefined, 2);
  return m;
}

function mesaComedor() {
  const W = 1.2, D = 0.7, H = 0.75;
  const m = new Modelo('mesa-comedor-cristal', { ancho: W, fondo: D, alto: H });
  const cristal = m.material('cristal', { ...MAT.cristal, color: 0xc4d6d0, opacidad: 0.32 });
  const metal = m.material('metal-negro', MAT.metalNegro);
  const vidrio = 0.012, yVidrio = H - vidrio;
  m.caja(cristal, [W, vidrio, D], [0, H - vidrio / 2, 0]);
  // Patas redondas finas, abiertas hacia fuera, sujetas con una pletina bajo el cristal
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    m.caja(metal, [0.07, 0.008, 0.07], [sx * 0.49, yVidrio - 0.004, sz * 0.24]);
    m.barra(metal, [sx * 0.49, yVidrio - 0.008, sz * 0.24], [sx * 0.565, 0.002, sz * 0.315], 0.012, 12);
  }
  return m;
}

function silla() {
  const W = 0.48, D = 0.55;
  const m = new Modelo('silla-comedor', null);
  const tapizado = m.material('tapizado-blanco', { color: 0xe6dfd2, rugosidad: 0.95, textura: 'tela' });
  const metal = m.material('metal-negro', MAT.metalNegro);
  // Asiento
  m.cajaRedonda(tapizado, [0.46, 0.07, 0.44], 0.03, [0, 0.45, D / 2 - 0.22]);
  // Carcasa del respaldo: muy curva (envuelve los costados), cóncava hacia delante
  const R = 0.24, t = 0.035, zc = -D / 2 + R + t;
  const alfa = Math.asin((W / 2) / (R + t));
  const forma = new THREE.Shape();
  const punto = (r, f) => [r * Math.sin(f), r * Math.cos(f) - zc];
  forma.moveTo(...punto(R + t, -alfa));
  for (let i = 1; i <= 28; i++) forma.lineTo(...punto(R + t, -alfa + (2 * alfa * i) / 28));
  for (let i = 28; i >= 0; i--) forma.lineTo(...punto(R, -alfa + (2 * alfa * i) / 28));
  const yBase = 0.45, yArriba = 0.8;
  m.extrusion(tapizado, forma, yArriba - yBase, [0, yBase, 0], [-PI / 2, 0, 0]);
  // Borde de arriba redondeado
  m.aro(tapizado, R + t / 2, t / 2, [0, yArriba, zc], [PI / 2, 0, -PI / 2 - alfa], 2 * alfa);
  // Cuatro patas finas de metal negro, abiertas hacia fuera
  const r = 0.011;
  for (const sx of [-1, 1]) {
    m.barra(metal, [sx * 0.15, 0.415, 0.16], [sx * 0.22, 0.001, 0.255], r);
    m.barra(metal, [sx * 0.15, 0.415, -0.1], [sx * 0.22, 0.001, -0.245], r);
  }
  m.caja(metal, [0.32, 0.012, 0.3], [0, 0.41, 0.03]);
  return m.ajustar({ ancho: W, fondo: D, alto: 0.82 }, 0.012);
}

function lamparaSemiesfera() {
  const W = 0.3, H = 1.45;
  const m = new Modelo('lampara-pie-semiesfera', { ancho: W, fondo: W, alto: H });
  const negro = m.material('negro-brillante', { color: 0x151515, rugosidad: 0.28, metalico: 0.5 });
  const pantalla = m.material('pantalla-negra', { color: 0x151515, rugosidad: 0.28, metalico: 0.5, dobleCara: true });
  m.torno(negro, [[0, 0], [0.15, 0], [0.15, 0.01], [0.13, 0.024], [0, 0.024]], [0, 0, 0], 40);
  m.cilindro(negro, [0.009, 0.009, 1.3], [0, 0.024 + 0.65, 0], undefined, 12);
  m.cilindro(negro, [0.02, 0.02, 0.05], [0, 1.29, 0], undefined, 16);
  m.esfera(pantalla, 0.15, [0, H - 0.15, 0], { thetaLargo: PI / 2, segmentos: 40 });
  return m;
}

/** Lámpara tipo foco sobre trípode (en la foto, encima de la mesita de alambre). */
function lamparaTripode() {
  const m = new Modelo('lampara-tripode', null);
  const negro = m.material('negro-mate', MAT.negroMate);
  const pantalla = m.material('pantalla', { ...MAT.negroMate, dobleCara: true });
  const laton = m.material('laton', MAT.laton);
  const yNudo = 0.3, rPie = 0.12, r = 0.0065;
  for (const ang of [-PI / 2, PI / 6, (5 * PI) / 6]) {
    m.barra(negro, [0, yNudo, 0], [rPie * Math.cos(ang), r * 0.4, -rPie * Math.sin(ang)], r, 8);
  }
  m.cilindro(negro, [0.014, 0.014, 0.03], [0, yNudo, 0], undefined, 12);
  m.cilindro(negro, [0.006, 0.006, 0.05], [0, yNudo + 0.04, 0], undefined, 8);
  // Horquilla de latón y foco cilíndrico inclinado hacia arriba
  const yEje = 0.47, rHorquilla = 0.09;
  m.aro(laton, rHorquilla, 0.005, [0, yEje, 0], [0, 0, PI], PI);
  for (const sx of [-1, 1]) m.cilindro(laton, [0.013, 0.013, 0.014], [sx * (rHorquilla + 0.005), yEje, 0], [0, 0, PI / 2], 16);
  const inclinacion = 0.35, eje = [0, Math.sin(inclinacion), Math.cos(inclinacion)];
  m.cilindro(pantalla, [0.075, 0.075, 0.17], [0, yEje, 0], [PI / 2 - inclinacion, 0, 0], 32, true);
  m.esfera(negro, 0.075, [0, yEje - eje[1] * 0.085, -eje[2] * 0.085], { thetaLargo: PI / 2, segmentos: 24 }, [PI / 2 - inclinacion + PI, 0, 0]);
  return m.ajustar({ ancho: 0.24, fondo: 0.28, alto: 0.55 }, 0.03);
}

function mesitaAlambre() {
  const W = 0.45, H = 0.55;
  const m = new Modelo('mesita-alambre', { ancho: W, fondo: W, alto: H });
  const metal = m.material('metal-negro', MAT.metalNegro);
  // Bandeja de arriba con borde
  m.cilindro(metal, [W / 2 - 0.004, W / 2 - 0.004, 0.008], [0, H - 0.012, 0], undefined, 40);
  m.aro(metal, W / 2 - 0.005, 0.005, [0, H - 0.005, 0]);
  // Varillas rectas cruzadas que forman un reloj de arena, con aros arriba, en la cintura y abajo
  const t = 0.0035, rAbajo = 0.205, rArriba = 0.19, giro = (110 * PI) / 180, n = 8;
  const y0 = 0.006, y1 = H - 0.016;
  for (const sentido of [1, -1]) {
    for (let i = 0; i < n; i++) {
      const a = (2 * PI * i) / n, b = a + sentido * giro;
      m.barra(metal, [rAbajo * Math.cos(a), y0, rAbajo * Math.sin(a)], [rArriba * Math.cos(b), y1, rArriba * Math.sin(b)], t, 5);
    }
  }
  m.aro(metal, rAbajo, 0.005, [0, 0.005, 0]);
  m.aro(metal, rArriba, 0.004, [0, y1, 0]);
  const yc = (y0 + y1) / 2, rc = Math.hypot((rAbajo + rArriba * Math.cos(giro)) / 2, (rArriba * Math.sin(giro)) / 2);
  m.aro(metal, rc, 0.0045, [0, yc, 0]);
  return m;
}

function mesitaBandeja() {
  const W = 0.45, H = 0.45;
  const m = new Modelo('mesita-bandeja', { ancho: W, fondo: W, alto: H });
  const bandeja = m.material('bandeja-negra', { color: 0x1a1a1a, rugosidad: 0.35, metalico: 0.4 });
  const metal = m.material('metal-negro', MAT.metalNegro);
  m.torno(bandeja, [[0, 0.42], [0.216, 0.42], [0.225, 0.45], [0.219, 0.45], [0.21, 0.428], [0, 0.428]], [0, 0, 0], 48);
  // Cuatro patas casi rectas y un aspa en el suelo que las une
  const r = 0.007, rp = 0.17;
  const pies = [0, 1, 2, 3].map((i) => (PI / 4) + (i * PI) / 2).map((a) => [Math.cos(a), Math.sin(a)]);
  for (const [c, s] of pies) m.barra(metal, [c * (rp - 0.01), 0.42, s * (rp - 0.01)], [c * rp, 0.0003, s * rp], r, 8);
  m.barra(metal, [pies[0][0] * rp, 0.035, pies[0][1] * rp], [pies[2][0] * rp, 0.035, pies[2][1] * rp], 0.005, 6);
  m.barra(metal, [pies[1][0] * rp, 0.035, pies[1][1] * rp], [pies[3][0] * rp, 0.035, pies[3][1] * rp], 0.005, 6);
  m.cilindro(metal, [0.012, 0.012, 0.012], [0, 0.035, 0], undefined, 10);
  return m;
}

function espejoMarcoNegro() {
  const W = 0.95, D = 0.04, H = 0.65, marco = 0.11;
  const m = new Modelo('espejo-marco-negro', { ancho: W, fondo: D, alto: H });
  const madera = m.material('marco-wengue', { color: 0x231912, rugosidad: 0.5, textura: 'madera' });
  const luna = m.material('espejo', MAT.luna);
  marcoRectangular(m, madera, W, H, D, marco);
  // Pequeño rebaje interior
  marcoRectangular(m, madera, W - 2 * marco + 0.03, H - 2 * marco + 0.03, 0.02, 0.015);
  m.materiales.get(madera).geometrias.slice(-4).forEach((g) => g.translate(0, marco - 0.015, D / 2 - 0.01 - 0.004));
  m.caja(luna, [W - 2 * marco + 0.01, H - 2 * marco + 0.01, 0.006], [0, H / 2, 0.004]);
  m.caja(madera, [W - 2 * marco, H - 2 * marco, 0.01], [0, H / 2, -D / 2 + 0.005]);
  return m;
}

function cuadroBlanco() {
  const W = 0.25, D = 0.02, H = 0.25, marco = 0.02;
  const m = new Modelo('cuadro-marco-blanco', { ancho: W, fondo: D, alto: H });
  const blanco = m.material('marco-blanco', { color: 0xf2f2ef, rugosidad: 0.5 });
  const paspartu = m.material('paspartu', { color: 0xfaf8f2, rugosidad: 0.9 });
  const lamina = m.material('lamina-azul-gris', { color: 0x7d8b98, rugosidad: 0.85 });
  const oscuro = m.material('lamina-oscura', { color: 0x3f4852, rugosidad: 0.85 });
  marcoRectangular(m, blanco, W, H, D, marco);
  m.caja(paspartu, [W - 2 * marco + 0.002, H - 2 * marco + 0.002, 0.004], [0, H / 2, 0.002]);
  m.caja(lamina, [0.08, 0.08, 0.002], [0, H / 2, 0.005]);
  m.caja(oscuro, [0.035, 0.05, 0.002], [-0.012, H / 2 - 0.005, 0.0065]);
  m.caja(blanco, [W - 2 * marco, H - 2 * marco, 0.004], [0, H / 2, -D / 2 + 0.002]);
  return m;
}

function perchero() {
  const W = 0.45, D = 0.1, H = 0.12;
  const m = new Modelo('perchero-pared', { ancho: W, fondo: D, alto: H });
  const tabla = m.material('tabla-blanca', MAT.blancoLacado);
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
const OBJETOS = [
  {
    ruta: 'sofas/sofa-3-plazas', construir: sofa,
    ficha: { nombre: 'Sofá 3 plazas crema', categoria: 'Sofás y sillones', superficies: [] },
    como: 'Exteriores: las del encargo. Mías: patas de 7 cm, asiento a 0,49 m, brazos a 0,68 m y respaldo a 0,80 m.',
    fotos: 'Brazos enrollados hacia fuera más bajos que el respaldo, con vivo; respaldo fijo; 3 cojines de asiento gruesos; crema más amarillento; cojines azul pizarra (detrás) y blanco a la izquierda, azul y crema pequeño a la derecha.',
  },
  {
    ruta: 'sofas/sillon', construir: sillon,
    ficha: { nombre: 'Sillón gris', categoria: 'Sofás y sillones', superficies: [] },
    como: 'Exteriores: las del encargo. Mías: patas de 7 cm, asiento a 0,46 m, brazos a 0,60 m.',
    fotos: 'Mucho más oscuro (gris pardo); brazos rectos; cojín gris pardo.',
  },
  {
    ruta: 'mesas/mesa-centro', construir: mesaCentro,
    ficha: { nombre: 'Mesa de centro de madera y cristal', categoria: 'Mesas', superficies: [0.45] },
    como: 'Exteriores: las del encargo. Mías: marco de la tapa de 8,5 cm, patas de 5,5 cm.',
    fotos: 'Teca/caoba media con veta; cristal ahumado; celosía de rombos continua en los 4 lados entre el faldón y un travesaño a 0,13 m (abierta por debajo); patas algo más finas abajo.',
  },
  {
    ruta: 'almacenaje/libreria', construir: libreria,
    ficha: { nombre: 'Librería alta de madera oscura', categoria: 'Almacenaje', superficies: [...BALDAS_LIBRERIA, 2.0] },
    como: 'Exteriores: las del encargo. Baldas medidas en la foto respecto al alto total: 0,37 / 0,66 / 0,98 / 1,36 m y la tapa a 2,00 m.',
    fotos: 'Cuatro baldas (no cinco), cornisa escalonada que vuela por delante y los lados, zócalo con moldura, cajón con panel en relieve y pomo de madera; madera más rojiza.',
  },
  {
    ruta: 'almacenaje/mueble-tv', construir: muebleTv,
    ficha: { nombre: 'Mueble de TV de listones', categoria: 'Almacenaje', superficies: [0.275, 0.55] },
    como: 'Exteriores: las del encargo. Estante de listones a 0,275 m medido en la foto.',
    fotos: 'Un solo estante de listones a media altura (no dos) y patas libres por debajo; faldón bajo la tapa; madera teca más oscura.',
  },
  {
    ruta: 'electronica/television', construir: television,
    ficha: { nombre: 'Televisión 32"', categoria: 'Electrónica', colocacion: 'superficie' },
    como: 'Las del encargo (pantalla de 32" 16:9 con peana).',
    fotos: 'Marco gris oscuro algo metálico y más grueso (LCD antiguo), peana negra brillante.',
  },
  {
    ruta: 'mesas/mesa-comedor-cristal', construir: mesaComedor,
    ficha: { nombre: 'Mesa de comedor de cristal', categoria: 'Mesas', superficies: [0.75] },
    como: 'Exteriores: las del encargo. Mías: cristal de 12 mm.',
    fotos: 'Sin bastidor bajo el cristal: patas redondas finas sujetas con pletinas en las esquinas, más abiertas.',
  },
  {
    ruta: 'sillas/silla-comedor', construir: silla,
    ficha: { nombre: 'Silla de comedor blanca', categoria: 'Sillas', superficies: [] },
    como: 'Exteriores: las del encargo. Mías: asiento a 0,48 m.',
    fotos: 'Carcasa envolvente tapizada en blanco roto (el respaldo rodea los costados) con el borde redondeado; patas finas abiertas.',
  },
  {
    ruta: 'iluminacion/lampara-pie-semiesfera', construir: lamparaSemiesfera,
    ficha: { nombre: 'Lámpara de pie semiesfera negra', categoria: 'Iluminación', superficies: [] },
    como: 'Las del encargo.',
    fotos: 'Negro brillante (pantalla y base), vástago más fino.',
  },
  {
    ruta: 'iluminacion/lampara-tripode', construir: lamparaTripode,
    ficha: { nombre: 'Lámpara foco de trípode', categoria: 'Iluminación', colocacion: 'superficie' },
    como: '**Corregida con las fotos**: no es de pie (1,30 m) sino una lámpara tipo foco que está encima de la mesita de alambre y mide casi lo mismo que ella de alto (0,55 m); 0,24 × 0,28 m en planta. Ahora es de superficie.',
    fotos: 'Foco cilíndrico negro inclinado hacia arriba, sobre una horquilla de latón con pomos, y trípode de patas finas.',
  },
  {
    ruta: 'mesas/mesita-alambre', construir: mesitaAlambre,
    ficha: { nombre: 'Mesita auxiliar de alambre', categoria: 'Mesas', superficies: [0.55] },
    como: '**Corregida con las fotos**: la bandeja es más ancha que la estimada (0,45 m en vez de 0,35; en la foto es casi tan ancha como alta).',
    fotos: 'Varillas rectas cruzadas que forman un reloj de arena, con aros arriba, en la cintura y abajo; bandeja de arriba con borde.',
  },
  {
    ruta: 'mesas/mesita-bandeja', construir: mesitaBandeja,
    ficha: { nombre: 'Mesita auxiliar de bandeja negra', categoria: 'Mesas', superficies: [0.43] },
    como: 'Exteriores: las del encargo. Mía: superficie útil de la bandeja a 0,43 m.',
    fotos: 'Patas casi rectas unidas abajo por un aspa (no patas cruzadas en X).',
  },
  {
    ruta: 'pared/espejo-marco-negro', construir: espejoMarcoNegro,
    ficha: { nombre: 'Espejo con marco negro', categoria: 'Decoración de pared', colocacion: 'pared', alturaCentro: 1.3 },
    como: 'Las del encargo.',
    fotos: 'Marco de madera muy oscura (wengué) más ancho (11 cm), con un pequeño rebaje junto a la luna.',
  },
  {
    ruta: 'pared/cuadro-marco-blanco', construir: cuadroBlanco,
    ficha: { nombre: 'Cuadro pequeño de marco blanco', categoria: 'Decoración de pared', colocacion: 'pared', alturaCentro: 1.5 },
    como: 'Las del encargo. Mía: centro a 1,50 m.',
    fotos: 'En la foto hay tres iguales en fila sobre la mesa de comedor; lámina pequeña azul grisácea con paspartú blanco.',
  },
  {
    ruta: 'pared/perchero-pared', construir: perchero,
    ficha: { nombre: 'Perchero de pared de 3 ganchos', categoria: 'Decoración de pared', colocacion: 'pared', alturaCentro: 1.65 },
    como: 'Las del encargo (centro a 1,65 m).',
    fotos: 'No sale en las fotos: sin cambios.',
  },
  {
    ruta: 'pared/espejo-marco-plateado', construir: espejoPlateado,
    ficha: { nombre: 'Espejo pequeño plateado', categoria: 'Decoración de pared', colocacion: 'pared', alturaCentro: 1.45 },
    como: 'Las del encargo. Mía: centro a 1,45 m.',
    fotos: 'No sale en las fotos: sin cambios.',
  },
];

await procesarLote(OBJETOS, {
  reiniciar: process.argv.includes('--reiniciar'),
  seccion: 'lote1',
  titulo: 'Lote 1: salón y pasillo',
  introduccion: `Hecho primero sin fotos (con las medidas y descripciones del encargo) y
ajustado después a las fotos del salón. Todas las medidas son **estimadas**:
las exteriores son las del encargo salvo las marcadas como **corregidas**;
las interiores (asientos, baldas, tapas) y los detalles de forma salen de las
fotos, con la puerta interior (2,05 m) y la tarima (listones de 7–9 cm) como
referencia. Maderas con veta y tapicerías con tejido (texturas procedurales).`,
});
