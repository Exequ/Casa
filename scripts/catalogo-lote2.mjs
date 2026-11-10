// Fase 5, lote 2: muebles del dormitorio, del balcón y del tendedero, a
// partir de las fotos del piso.
//
// Uso:  npm run catalogo:lote2                 (no toca las medidas ya corregidas a mano)
//       npm run catalogo:lote2 -- --reiniciar  (vuelve a las medidas de este script)
//
// Mismo método que el lote 1 (ver catalogo-lote1.mjs): un .glb y un .json por
// objeto en catalogo/<categoria>/ y su tabla en docs/OBJETOS.md.
// TODAS LAS MEDIDAS SON ESTIMADAS.

import * as THREE from 'three';
import { Modelo } from './lib/modelo3d.mjs';
import { MAT, marcoRectangular, pataCuadrada, procesarLote } from './lib/lote.mjs';

const PI = Math.PI;
/** Madera tono cerezo de la cama, la mesita y la cómoda (foto del dormitorio). */
const CEREZO = { color: 0x8a4a22, rugosidad: 0.45, textura: 'madera' };

// ---------------------------------------------------------------------------

function cama() {
  const W = 1.58, D = 2.08, H = 0.95;
  const m = new Modelo('cama', { ancho: W, fondo: D, alto: H });
  const madera = m.material('madera-cerezo', CEREZO);
  const canape = m.material('canape-blanco', { color: 0xf0efea, rugosidad: 0.7 });
  const colchon = m.material('colchon-blanco', { color: 0xf3f2ee, rugosidad: 0.85, textura: 'tela' });
  const ribete = m.material('ribete-gris', { color: 0xa9aaa8, rugosidad: 0.8 });
  // Cabecero (atrás, -Z): dos postes torneados con remate en bola y un panel entre ellos
  const poste = 0.06, zCab = -D / 2 + poste / 2, xPoste = W / 2 - poste / 2;
  const altoPoste = H - 0.06;
  for (const sx of [-1, 1]) {
    m.caja(madera, [poste, altoPoste, poste], [sx * xPoste, altoPoste / 2, zCab]);
    m.cilindro(madera, [0.026, 0.029, 0.02], [sx * xPoste, altoPoste + 0.01, zCab], undefined, 20);
    m.esfera(madera, 0.029, [sx * xPoste, H - 0.029, zCab], { segmentos: 20 });
  }
  const xin = xPoste - poste / 2;
  m.caja(madera, [2 * xin, 0.05, 0.035], [0, altoPoste - 0.03, zCab]); // travesaño de arriba, redondeado
  m.cilindro(madera, [0.02, 0.02, 2 * xin], [0, altoPoste - 0.005, zCab], [0, 0, PI / 2], 12);
  m.caja(madera, [2 * xin, 0.42, 0.022], [0, 0.4 + 0.21 + 0.03, zCab]); // panel liso
  m.caja(madera, [2 * xin, 0.04, 0.035], [0, 0.4 + 0.02, zCab]); // travesaño de abajo
  // Canapé abatible blanco (1,50 × 2,00 bajo el colchón) y colchón con ribete
  const Wc = 1.5, Dc = D - poste - 0.02, zc = -D / 2 + poste + 0.02 + Dc / 2;
  m.cajaRedonda(canape, [Wc, 0.33, Dc], 0.01, [0, 0.03 + 0.165, zc]);
  m.caja(canape, [Wc - 0.08, 0.03, Dc - 0.08], [0, 0.015, zc]); // zócalo retranqueado
  m.cajaRedonda(colchon, [Wc, 0.24, 2.0], 0.04, [0, 0.36 + 0.12, D / 2 - 1.0], undefined, 3);
  for (const y of [0.37, 0.59]) {
    m.cilindro(ribete, [0.005, 0.005, Wc - 0.08], [0, y, D / 2 - 0.006], [0, 0, PI / 2], 6);
    for (const sx of [-1, 1]) m.cilindro(ribete, [0.005, 0.005, 2.0 - 0.08], [sx * (Wc / 2 - 0.004), y, D / 2 - 1.0], [PI / 2, 0, 0], 6);
  }
  return m;
}

function mesitaNoche() {
  const W = 0.45, D = 0.38, H = 0.5;
  const m = new Modelo('mesita-noche', { ancho: W, fondo: D, alto: H });
  const madera = m.material('madera-cerezo', CEREZO);
  const pomo = m.material('pomo', MAT.plata);
  const tapa = 0.025;
  m.cajaRedonda(madera, [W, tapa, D], 0.006, [0, H - tapa / 2, 0], undefined, 2);
  const pata = 0.04, alto = H - tapa;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pataCuadrada(m, madera, sx * (W / 2 - 0.01 - pata / 2), sz * (D / 2 - 0.01 - pata / 2), alto, pata, 0.034);
  // Costados, trasera y fondo entre las patas, con un hueco abierto bajo el cajón
  const xin = W / 2 - 0.01 - pata, zin = D / 2 - 0.01 - pata;
  for (const sx of [-1, 1]) m.caja(madera, [0.016, 0.3, 2 * zin + 0.01], [sx * (xin + 0.004), alto - 0.15, 0]);
  m.caja(madera, [2 * xin + 0.01, 0.3, 0.016], [0, alto - 0.15, -(zin + 0.004)]);
  m.caja(madera, [2 * xin, 0.016, 2 * zin], [0, alto - 0.3, 0]);
  m.caja(madera, [2 * xin, 0.016, 2 * zin], [0, 0.1, 0]); // balda baja
  // Cajón con frente liso y pomo
  m.caja(madera, [2 * xin - 0.004, 0.15, 0.02], [0, alto - 0.085, zin + 0.01 - 0.008]);
  m.esfera(pomo, 0.013, [0, alto - 0.085, zin + 0.012 + 0.008], { segmentos: 14 });
  return m;
}

function lamparaMesa() {
  const m = new Modelo('lampara-sobremesa', null);
  const pantalla = m.material('pantalla-blanca', { color: 0xf4f2ec, rugosidad: 0.9, dobleCara: true, textura: 'tela' });
  const plata = m.material('metal-plateado', { color: 0xc9cbcc, rugosidad: 0.25, metalico: 0.9 });
  // Base redonda plana, vástago fino y pantalla cónica blanca
  m.torno(plata, [[0, 0], [0.075, 0], [0.075, 0.008], [0.06, 0.016], [0.012, 0.018], [0, 0.018]], [0, 0, 0], 36);
  m.cilindro(plata, [0.006, 0.006, 0.3], [0, 0.018 + 0.15, 0], undefined, 12);
  m.cilindro(pantalla, [0.1, 0.14, 0.18], [0, 0.45 - 0.09, 0], undefined, 40, true);
  m.aro(plata, 0.1, 0.002, [0, 0.45 - 0.001, 0]);
  m.cilindro(plata, [0.012, 0.012, 0.03], [0, 0.33, 0], undefined, 10);
  return m.ajustar({ ancho: 0.28, fondo: 0.28, alto: 0.45 }, 0.01);
}

function comoda() {
  const W = 0.6, D = 0.42, H = 1.15;
  const m = new Modelo('comoda-alta', { ancho: W, fondo: D, alto: H });
  const madera = m.material('madera-cerezo', CEREZO);
  const frente = m.material('frente-cerezo', { ...CEREZO, color: 0x93512a });
  const zocalo = 0.05, tapa = 0.025, lado = 0.02;
  m.caja(madera, [W, tapa, D], [0, H - tapa / 2, 0]);
  m.caja(madera, [W - 0.03, zocalo, D - 0.03], [0, zocalo / 2, -0.015]);
  for (const sx of [-1, 1]) m.caja(madera, [lado, H - tapa - zocalo, D - 0.02], [sx * (W / 2 - lado / 2), zocalo + (H - tapa - zocalo) / 2, -0.01]);
  m.caja(madera, [W - 2 * lado, H - tapa - zocalo, 0.012], [0, zocalo + (H - tapa - zocalo) / 2, -D / 2 + 0.006]);
  // Seis cajones de frente liso, separados por una junta fina (sin tiradores: frente liso)
  const n = 6, junta = 0.006, zona = H - tapa - zocalo, alto = (zona - junta * (n + 1)) / n;
  m.caja(madera, [W - 2 * lado, zona, 0.01], [0, zocalo + zona / 2, D / 2 - 0.025]); // fondo oscuro de las juntas
  for (let i = 0; i < n; i++) {
    const y = zocalo + junta + i * (alto + junta) + alto / 2;
    m.caja(frente, [W - 2 * lado - 0.006, alto, 0.02], [0, y, D / 2 - 0.01]);
  }
  return m;
}

function cuadroGris() {
  const W = 0.3, D = 0.02, H = 0.4, marco = 0.015;
  const m = new Modelo('cuadro-marco-gris', { ancho: W, fondo: D, alto: H });
  const gris = m.material('marco-gris', { color: 0x6c6d6b, rugosidad: 0.5, metalico: 0.2 });
  const paspartu = m.material('paspartu', { color: 0xf3f1ea, rugosidad: 0.9 });
  const lamina = m.material('lamina-clara', { color: 0xd9d2b8, rugosidad: 0.85 });
  const verde = m.material('lamina-verde', { color: 0x8a9a6c, rugosidad: 0.85 });
  marcoRectangular(m, gris, W, H, D, marco);
  m.caja(paspartu, [W - 2 * marco + 0.002, H - 2 * marco + 0.002, 0.004], [0, H / 2, 0.002]);
  m.caja(lamina, [0.18, 0.26, 0.002], [0, H / 2, 0.005]);
  m.caja(verde, [0.12, 0.1, 0.002], [0, H / 2 - 0.03, 0.0065]);
  m.caja(gris, [W - 2 * marco, H - 2 * marco, 0.004], [0, H / 2, -D / 2 + 0.002]);
  return m;
}

function marcoMadera() {
  const W = 0.18, D = 0.02, H = 0.24, marco = 0.018;
  const m = new Modelo('marco-madera', { ancho: W, fondo: D, alto: H });
  const madera = m.material('marco-madera', { color: 0x9a6a3e, rugosidad: 0.5, textura: 'madera' });
  const paspartu = m.material('paspartu', { color: 0xf3f1ea, rugosidad: 0.9 });
  const lamina = m.material('lamina-verde', { color: 0x7d8d5c, rugosidad: 0.85 });
  marcoRectangular(m, madera, W, H, D, marco);
  m.caja(paspartu, [W - 2 * marco + 0.002, H - 2 * marco + 0.002, 0.004], [0, H / 2, 0.002]);
  m.caja(lamina, [0.09, 0.13, 0.002], [0, H / 2, 0.005]);
  m.caja(madera, [W - 2 * marco, H - 2 * marco, 0.004], [0, H / 2, -D / 2 + 0.002]);
  return m;
}

/** Varillas de una mesa o silla plegable: un tubo de `a` a `b`. */
const tubo = (m, mat, a, b, r = 0.009) => m.barra(mat, a, b, r, 8);

function mesaBalcon() {
  const H = 0.72, R = 0.3;
  const m = new Modelo('mesa-balcon', { ancho: 2 * R, fondo: 2 * R, alto: H });
  const blanco = m.material('metal-blanco', MAT.metalBlanco);
  // Tapa redonda con el borde doblado hacia abajo
  m.torno(blanco, [[0, H], [R, H], [R, H - 0.025], [R - 0.004, H - 0.025], [R - 0.004, H - 0.005], [0, H - 0.005]], [0, 0, 0], 48);
  // Patas en tijera: dos pares que se cruzan bajo la tapa (plegable)
  const yCruce = 0.3, ap = 0.22;
  for (const s of [-1, 1]) {
    tubo(m, blanco, [s * ap, 0.009, -0.05], [-s * 0.15, H - 0.025, -0.05]);
    tubo(m, blanco, [s * ap, 0.009, 0.05], [-s * 0.15, H - 0.025, 0.05]);
  }
  tubo(m, blanco, [0, yCruce, -0.06], [0, yCruce, 0.06], 0.008);
  // Arco de refuerzo bajo la tapa
  m.aro(blanco, R - 0.04, 0.006, [0, H - 0.04, 0]);
  return m.ajustar({ ancho: 0.6, fondo: 0.6, alto: H }, 0.01);
}

function sillaBalcon() {
  const W = 0.4, D = 0.45, H = 0.85;
  const m = new Modelo('silla-balcon', null);
  const blanco = m.material('metal-blanco', MAT.metalBlanco);
  const ySeat = 0.44, zSeatF = 0.2, zSeatB = -0.12;
  // Patas delanteras (que suben hasta el asiento) y traseras (que suben hasta el respaldo), cruzadas como tijera
  for (const sx of [-1, 1]) {
    const x = sx * 0.18;
    tubo(m, blanco, [x, 0.009, D / 2 - 0.009], [x * 0.96, ySeat, zSeatB + 0.02]);
    tubo(m, blanco, [x, 0.009, -D / 2 + 0.03], [x * 0.95, H - 0.009, -D / 2 + 0.07]);
  }
  tubo(m, blanco, [-0.17, 0.15, 0.1], [0.17, 0.15, 0.1], 0.007);
  // Asiento de listones
  const n = 6, ancho = (zSeatF - zSeatB) / n;
  for (let i = 0; i < n; i++) {
    m.cajaRedonda(blanco, [0.36, 0.012, ancho - 0.008], 0.004, [0, ySeat, zSeatB + ancho / 2 + i * ancho], undefined, 1);
  }
  for (const sx of [-1, 1]) tubo(m, blanco, [sx * 0.175, ySeat - 0.012, zSeatB], [sx * 0.175, ySeat - 0.012, zSeatF], 0.007);
  // Respaldo: dos listones anchos y algo curvos entre las patas traseras
  for (const y of [0.66, 0.78]) {
    const z = -D / 2 + 0.07 - (H - y) * 0.04 / (H - 0.009) * 0 + (y - 0.66) * 0.02;
    m.cajaRedonda(blanco, [0.34, 0.06, 0.012], 0.004, [0, y, z - 0.005], [-0.12, 0, 0], 1);
  }
  return m.ajustar({ ancho: W, fondo: D, alto: H }, 0.04);
}

function plantaPequena() {
  const m = new Modelo('planta-pequena', null);
  const maceta = m.material('maceta-blanca', { color: 0xeeece6, rugosidad: 0.5 });
  const tierra = m.material('tierra', { color: 0x3a2a1e, rugosidad: 1 });
  const hoja = m.material('hojas', { color: 0x4f7f2f, rugosidad: 0.7 });
  const hojaClara = m.material('hojas-claras', { color: 0x86a83f, rugosidad: 0.7 });
  // Maceta cilíndrica blanca (13 cm de alto) y una mata redonda de hojas pequeñas
  // Maceta hueca (con borde) y la tierra un poco por debajo del borde
  m.torno(maceta, [[0, 0], [0.06, 0], [0.065, 0.13], [0.058, 0.13], [0.054, 0.11], [0, 0.11]], [0, 0, 0], 32);
  m.cilindro(tierra, [0.055, 0.055, 0.004], [0, 0.114, 0], undefined, 24);
  const aleatorio = (() => { let s = 5; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const hojaGeo = new THREE.SphereGeometry(1, 6, 4);
  for (let i = 0; i < 70; i++) {
    const a = aleatorio() * 2 * PI, e = aleatorio() * 0.9 + 0.1;
    const r = 0.03 + aleatorio() * 0.05;
    const y = 0.16 + e * 0.12;
    const x = Math.cos(a) * r * (1.1 - Math.abs(e - 0.45) * 0.9), z = Math.sin(a) * r * (1.1 - Math.abs(e - 0.45) * 0.9);
    m.pieza(i % 3 ? hoja : hojaClara, hojaGeo, [x, y, z], [aleatorio() * PI, a, aleatorio() * PI], [0.026, 0.006, 0.015]);
  }
  for (let i = 0; i < 6; i++) m.barra(hoja, [0, 0.116, 0], [Math.cos(i) * 0.03, 0.2, Math.sin(i) * 0.03], 0.002, 4);
  return m.ajustar({ ancho: 0.2, fondo: 0.2, alto: 0.3 }, 0.03);
}

function lavadora() {
  const W = 0.6, D = 0.55, H = 0.85;
  const m = new Modelo('lavadora', { ancho: W, fondo: D, alto: H });
  const blanco = m.material('chapa-blanca', { color: 0xf2f2f0, rugosidad: 0.35 });
  const gris = m.material('plastico-gris', { color: 0xb8bbbe, rugosidad: 0.4 });
  const cristal = m.material('cristal-ojo', { color: 0x4b5560, rugosidad: 0.05, metalico: 0.2, opacidad: 0.85 });
  const oscuro = m.material('mandos', { color: 0x3a3d40, rugosidad: 0.4 });
  // Cuerpo hasta 3 cm del frente: por delante solo sobresalen la puerta y los mandos
  m.cajaRedonda(blanco, [W, H - 0.01, D - 0.03], 0.012, [0, 0.01 + (H - 0.01) / 2, -0.015], undefined, 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.cilindro(gris, [0.02, 0.02, 0.012], [sx * 0.25, 0.006, sz * 0.2], undefined, 12);
  // Panel de mandos arriba: cajetín de detergente, mando giratorio y pantallita
  const zF = D / 2 - 0.03;
  m.caja(gris, [W - 0.04, 0.12, 0.006], [0, H - 0.075, zF + 0.003]);
  m.caja(blanco, [0.17, 0.08, 0.008], [-0.18, H - 0.075, zF + 0.007]);
  m.cilindro(blanco, [0.035, 0.035, 0.024], [0.17, H - 0.075, zF + 0.012], [PI / 2, 0, 0], 28);
  m.caja(oscuro, [0.12, 0.035, 0.004], [0.02, H - 0.075, zF + 0.007]);
  // Puerta redonda: aro gris, cristal oscuro, tirador
  const yOjo = 0.42;
  m.cilindro(gris, [0.2, 0.2, 0.025], [0, yOjo, zF + 0.0125], [PI / 2, 0, 0], 48);
  m.cilindro(blanco, [0.18, 0.18, 0.028], [0, yOjo, zF + 0.014], [PI / 2, 0, 0], 48);
  m.cilindro(cristal, [0.13, 0.13, 0.03], [0, yOjo, zF + 0.015], [PI / 2, 0, 0], 48);
  m.caja(gris, [0.03, 0.08, 0.01], [0.17, yOjo, zF + 0.024]);
  // Tapa del filtro abajo
  m.caja(gris, [0.12, 0.08, 0.004], [-0.18, 0.08, zF + 0.002]);
  return m;
}

// ---------------------------------------------------------------------------
const OBJETOS = [
  {
    ruta: 'dormitorio/cama', construir: cama,
    ficha: { nombre: 'Cama con cabecero de cerezo y canapé', categoria: 'Dormitorio', superficies: [] },
    como: 'Las del encargo; colchón de 1,50 × 2,00 × 0,24 sobre canapé de 0,36 m. Cabecero: postes de 6 cm con bola, a 0,95 m (más alto que la mesita de 0,50 m, como en la foto).',
    fotos: 'Postes torneados con remate redondo, panel liso de cerezo, canapé y colchón blancos con ribete gris.',
  },
  {
    ruta: 'dormitorio/mesita-noche', construir: mesitaNoche,
    ficha: { nombre: 'Mesita de noche de cerezo', categoria: 'Dormitorio', superficies: [0.11, 0.5] },
    como: 'Las del encargo; balda baja a 0,11 m.',
    fotos: 'Tapa de cerezo claro al sol, cajón de frente liso; en la foto la lámpara ocupa casi media tapa.',
  },
  {
    ruta: 'iluminacion/lampara-sobremesa', construir: lamparaMesa,
    ficha: { nombre: 'Lámpara de sobremesa blanca', categoria: 'Iluminación', colocacion: 'superficie' },
    como: 'Las del encargo (pantalla de 28 cm abajo y 20 arriba).',
    fotos: 'Pantalla cónica blanca de tela, pie fino plateado y base redonda plana (hay otra igual sobre la cómoda).',
  },
  {
    ruta: 'dormitorio/comoda-alta', construir: comoda,
    ficha: { nombre: 'Cómoda alta de 6 cajones', categoria: 'Dormitorio', superficies: [1.15] },
    como: 'Las del encargo. En la foto llega casi al alféizar de los cuadros (1,15 m) y es más estrecha que la balconera.',
    fotos: 'Seis cajones de frente liso sin tiradores visibles separados por juntas finas, zócalo bajo; cerezo algo más rojizo en los frentes.',
  },
  {
    ruta: 'pared/cuadro-marco-gris', construir: cuadroGris,
    ficha: { nombre: 'Cuadro de marco gris', categoria: 'Decoración de pared', colocacion: 'pared', alturaCentro: 1.55 },
    como: 'Las del encargo. Mía: centro a 1,55 m (en la foto, junto a la cama, algo por encima del cabecero).',
    fotos: 'Marco gris fino con paspartú y lámina clara.',
  },
  {
    ruta: 'pared/marco-madera', construir: marcoMadera,
    ficha: { nombre: 'Marco pequeño de madera', categoria: 'Decoración de pared', colocacion: 'pared', alturaCentro: 1.5 },
    como: 'Las del encargo. En la foto hay cuatro sobre la cómoda en dos filas; mía: centro a 1,50 m.',
    fotos: 'Marco fino de madera media, paspartú blanco y lámina verde.',
  },
  {
    ruta: 'exterior/mesa-balcon', construir: mesaBalcon,
    ficha: { nombre: 'Mesa redonda plegable de balcón', categoria: 'Balcón', superficies: [0.72] },
    como: 'Las del encargo (diámetro 0,60, alto 0,72).',
    fotos: 'Metal blanco, tapa con el borde doblado y patas en tijera que se cruzan.',
  },
  {
    ruta: 'exterior/silla-balcon', construir: sillaBalcon,
    ficha: { nombre: 'Silla plegable de balcón', categoria: 'Balcón', superficies: [] },
    como: 'Exteriores: las del encargo. Mías: asiento a 0,44 m con 6 listones, respaldo de 2 listones anchos.',
    fotos: 'Metal blanco; patas traseras que siguen hasta el respaldo y delanteras cruzadas por debajo del asiento.',
  },
  {
    ruta: 'decoracion/planta-pequena', construir: plantaPequena,
    ficha: { nombre: 'Planta pequeña en maceta blanca', categoria: 'Decoración', colocacion: 'superficie' },
    como: 'Las del encargo (maceta de 13 cm de alto).',
    fotos: 'Mata redonda de hojas pequeñas verde claro en maceta cilíndrica blanca (en la mesa del balcón y en las mesitas del salón).',
  },
  {
    ruta: 'tendedero/lavadora', construir: lavadora,
    ficha: { nombre: 'Lavadora de carga frontal', categoria: 'Tendedero', superficies: [0.85] },
    como: 'Las del encargo (medidas estándar). No sale en las fotos.',
    fotos: 'No sale en las fotos: modelo genérico blanco con puerta redonda y panel de mandos.',
  },
];

await procesarLote(OBJETOS, {
  reiniciar: process.argv.includes('--reiniciar'),
  seccion: 'lote2',
  titulo: 'Lote 2: dormitorio, balcón y tendedero',
  introduccion: `Hecho a partir de las fotos del dormitorio y de la terraza. Todas las
medidas son **estimadas**: las exteriores son las del encargo; las interiores
y los detalles salen de las fotos con la balconera (2,10 m), la puerta (2,05 m)
y la tarima como referencia.`,
});
