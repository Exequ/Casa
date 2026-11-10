// Carpintería: puertas (marco, tapajuntas, hoja y manilla), ventanas y
// balconeras de madera con vidrio, paños fijos, lamas del tendedero,
// barandilla de barrotes y cortinas.
//
// Todo se construye en las coordenadas locales de la pared, igual que su
// núcleo macizo: x a lo largo de la pared (de -largo/2 a +largo/2), y hacia
// arriba y z a lo ancho, con +z = lado derecho y -z = lado izquierdo (viendo
// la pared caminando de "desde" a "hasta").
//
// Para dibujar pocas mallas, las piezas de un mismo material se funden en una.
// No usa el DOM, así que también se puede usar en los tests.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Lado } from '../vivienda/caras';
import { altoPared, estiloDe, largoPared, type Hueco, type Pared, type Vivienda } from '../vivienda/modelo';

// --- Materiales (compartidos por toda la vivienda) ----------------------------------
export const MATERIALES_CARPINTERIA = {
  /** Madera oscura tipo nogal de ventanas y balconeras. */
  madera: new THREE.MeshStandardMaterial({ color: 0x4b2c1b, roughness: 0.5, name: 'madera' }),
  /** Lacado blanco de puertas, marcos y tapajuntas. */
  lacado: new THREE.MeshStandardMaterial({ color: 0xf5f5f2, roughness: 0.4, name: 'lacado' }),
  /** Manillas y herrajes plateados. */
  metal: new THREE.MeshStandardMaterial({ color: 0xc8cbd0, roughness: 0.3, metalness: 0.9, name: 'metal' }),
  /** Aluminio negro de las lamas y la barandilla. */
  aluminio: new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.5, metalness: 0.4, name: 'aluminio' }),
  /** Vidrio transparente. */
  cristal: new THREE.MeshStandardMaterial({
    color: 0xe3eef2, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.2, depthWrite: false, name: 'cristal',
  }),
  /** Tela blanca de las cortinas. */
  tela: new THREE.MeshStandardMaterial({
    color: 0xfbfbf8, roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.93, name: 'tela',
  }),
};
type NombreMaterial = keyof typeof MATERIALES_CARPINTERIA;

/** Ancho del tapajuntas (m) y cuánto monta sobre el marco. */
export const TAPAJUNTAS = { ancho: 0.07, solape: 0.015 };
/** Ángulo de las puertas abiertas (grados). */
const APERTURA = 88;

export interface PuertaAbatible {
  nombre: string;
  /** Grupo que gira sobre las bisagras. */
  pivote: THREE.Group;
  /** Giro (radianes) con la puerta abierta. */
  abierta: number;
}

export interface Carpinteria3D {
  /** Todo lo de esta pared, en sus coordenadas locales. */
  grupo: THREE.Group;
  puertas: PuertaAbatible[];
  cortinas: THREE.Object3D[];
}

/** Acumula cajas por material y las funde en una malla por material. */
class Piezas {
  private porMaterial = new Map<NombreMaterial, THREE.BufferGeometry[]>();

  /** Caja de tamaño (ancho, alto, fondo) centrada en (x, y, z). `giroX` la inclina sobre su eje largo. */
  caja(material: NombreMaterial, tam: [number, number, number], centro: [number, number, number], giroX = 0) {
    if (tam.some((t) => t <= 1e-6)) return;
    const g = new THREE.BoxGeometry(...tam);
    if (giroX) g.rotateX(giroX);
    g.translate(...centro);
    this.anadir(material, g);
  }

  /** Cilindro corto con el eje a lo ancho de la pared (rosetas, mirilla). */
  disco(material: NombreMaterial, radio: number, fondo: number, centro: [number, number, number]) {
    const g = new THREE.CylinderGeometry(radio, radio, fondo, 16);
    g.rotateX(Math.PI / 2);
    g.translate(...centro);
    this.anadir(material, g);
  }

  anadir(material: NombreMaterial, g: THREE.BufferGeometry) {
    if (!this.porMaterial.has(material)) this.porMaterial.set(material, []);
    this.porMaterial.get(material)!.push(g);
  }

  /** Mallas resultantes, una por material. */
  mallas(nombre: string): THREE.Mesh[] {
    return [...this.porMaterial].map(([material, geometrias]) => {
      const malla = new THREE.Mesh(mergeGeometries(geometrias), MATERIALES_CARPINTERIA[material]);
      malla.name = `${nombre}:${material}`;
      // El vidrio y la tela dejan pasar la luz; lo demás da sombra.
      malla.castShadow = material !== 'cristal' && material !== 'tela';
      malla.receiveShadow = material !== 'cristal';
      if (material === 'cristal') malla.renderOrder = 2;
      return malla;
    });
  }
}

/** Manilla: roseta y palanca por las dos caras de una hoja de grosor `g`, en (x, y). `sentido` = hacia dónde apunta la palanca. */
function manilla(piezas: Piezas, x: number, y: number, g: number, sentido: number, z0 = 0) {
  for (const s of [1, -1]) {
    piezas.disco('metal', 0.024, 0.008, [x, y, z0 + s * (g / 2 + 0.004)]);
    piezas.caja('metal', [0.016, 0.016, 0.045], [x, y, z0 + s * (g / 2 + 0.026)]);
    piezas.caja('metal', [0.12, 0.018, 0.014], [x + sentido * 0.052, y, z0 + s * (g / 2 + 0.045)]);
  }
}

/** Puerta abatible: marco, tapajuntas (si es blanca) y hoja sobre su pivote. */
function puerta(h: Hueco, cx: number, grosor: number, fijas: Piezas): PuertaAbatible & { mallas: THREE.Object3D } {
  const estilo = estiloDe(h);
  const vidriera = estilo === 'puerta-vidriera';
  const material: NombreMaterial = vidriera ? 'madera' : 'lacado';
  const w = h.ancho, H = h.alto;
  const marco = vidriera ? 0.05 : 0.03;

  // Marco: dos largueros y el cabecero, forrando el hueco
  const fondoMarco = grosor + (vidriera ? 0.03 : 0.01);
  for (const s of [-1, 1]) fijas.caja(material, [marco, H, fondoMarco], [cx + s * (w / 2 - marco / 2), H / 2, 0]);
  fijas.caja(material, [w, marco, fondoMarco], [cx, H - marco / 2, 0]);

  // Tapajuntas por las dos caras (solo en las puertas lacadas)
  if (!vidriera) {
    const { ancho, solape } = TAPAJUNTAS;
    for (const lado of [-1, 1]) {
      const z = lado * (grosor / 2 + 0.0085);
      for (const s of [-1, 1]) {
        fijas.caja('lacado', [ancho, H + ancho - solape, 0.027], [cx + s * (w / 2 - solape + ancho / 2), (H + ancho - solape) / 2, z]);
      }
      fijas.caja('lacado', [w + 2 * (ancho - solape), ancho, 0.027], [cx, H - solape + ancho / 2, z]);
    }
  }

  // Hoja, colgada de un pivote en las bisagras
  const sb = h.bisagra === 'hasta' ? 1 : -1; // extremo de las bisagras
  const sa = h.abre === 'derecha' ? 1 : -1; // lado hacia el que abre (+z = derecha)
  const gHoja = vidriera ? 0.045 : 0.04;
  const wl = w - 2 * marco - 0.004, hl = H - marco - 0.008;
  const pivote = new THREE.Group();
  pivote.name = `puerta:${h.nombre ?? ''}`;
  pivote.position.set(cx + sb * (w / 2 - marco - 0.002), 0, sa * Math.max(0, grosor / 2 - gHoja / 2 - 0.005));
  const hoja = new Piezas();
  const xc = -sb * (wl / 2), y0 = 0.005;
  if (vidriera) {
    // Bastidor de madera, panel macizo abajo y vidrio encima
    const liston = 0.09, panel = 0.32;
    for (const s of [-1, 1]) hoja.caja('madera', [liston, hl, gHoja], [xc + s * (wl / 2 - liston / 2), y0 + hl / 2, 0]);
    hoja.caja('madera', [wl - 2 * liston, liston, gHoja], [xc, y0 + hl - liston / 2, 0]);
    hoja.caja('madera', [wl - 2 * liston, panel, gHoja], [xc, y0 + panel / 2, 0]);
    hoja.caja('cristal', [wl - 2 * liston, hl - panel - liston, 0.006], [xc, y0 + panel + (hl - panel - liston) / 2, 0]);
  } else {
    hoja.caja('lacado', [wl, hl, gHoja], [xc, y0 + hl / 2, 0]);
    if (estilo === 'puerta-entrada') for (const s of [1, -1]) hoja.disco('metal', 0.012, 0.006, [xc, 1.5, s * (gHoja / 2 + 0.003)]);
  }
  manilla(hoja, -sb * (wl - 0.065), 1.02, gHoja, sb);
  for (const m of hoja.mallas('hoja')) pivote.add(m);
  return { nombre: h.nombre ?? 'puerta', pivote, abierta: THREE.MathUtils.degToRad(APERTURA) * sa * sb, mallas: pivote };
}

/**
 * Ventana, balconera o paño fijo de madera: marco, travesaño opcional y
 * `hojas` paños con su vidrio. Con travesaño, los paños de abajo son fijos.
 */
function ventana(h: Hueco, cx: number, grosor: number, interior: number, p: Piezas) {
  const w = h.ancho, y1 = h.alfeizar, y2 = h.alfeizar + h.alto;
  const fijo = estiloDe(h) === 'fijo';
  const marco = 0.05, fondo = Math.min(0.07, grosor + 0.02);
  const n = Math.max(1, h.hojas ?? 1);
  // Marco exterior
  for (const s of [-1, 1]) p.caja('madera', [marco, h.alto, fondo], [cx + s * (w / 2 - marco / 2), (y1 + y2) / 2, 0]);
  p.caja('madera', [w - 2 * marco, marco, fondo], [cx, y2 - marco / 2, 0]);
  p.caja('madera', [w - 2 * marco, marco, fondo], [cx, y1 + marco / 2, 0]);

  const xa = cx - w / 2 + marco, luz = w - 2 * marco; // hueco libre entre largueros
  /** Rellena la franja entre dos alturas con `n` paños; `abatible` les pone bastidor y manilla. */
  const franja = (abajo: number, arriba: number, abatible: boolean) => {
    const anchoPano = luz / n;
    for (let i = 0; i < n; i++) {
      const x = xa + anchoPano * (i + 0.5);
      if (abatible) {
        const b = 0.055; // bastidor de la hoja
        for (const s of [-1, 1]) p.caja('madera', [b, arriba - abajo, 0.055], [x + s * (anchoPano / 2 - b / 2), (abajo + arriba) / 2, 0]);
        for (const y of [abajo + b / 2, arriba - b / 2]) p.caja('madera', [anchoPano - 2 * b, b, 0.055], [x, y, 0]);
        p.caja('cristal', [anchoPano - 2 * b, arriba - abajo - 2 * b, 0.006], [x, (abajo + arriba) / 2, 0]);
        // Manilla en el larguero que cierra contra la hoja de al lado (hacia el interior)
        const haciaCentro = i < n / 2 ? 1 : -1;
        const ym = Math.min(arriba - 0.3, Math.max(abajo + 0.3, 1.05 + (abajo > 0.5 ? abajo - 0.2 : 0)));
        p.caja('metal', [0.022, 0.13, 0.03], [x + haciaCentro * (anchoPano / 2 - b / 2), ym, interior * 0.043]);
      } else {
        if (i > 0) p.caja('madera', [marco, arriba - abajo, fondo], [xa + anchoPano * i, (abajo + arriba) / 2, 0]); // montante
        p.caja('cristal', [anchoPano - (n > 1 ? marco : 0), arriba - abajo, 0.006], [x, (abajo + arriba) / 2, 0]);
      }
    }
  };
  const dentro1 = y1 + marco, dentro2 = y2 - marco;
  if (h.travesano !== undefined) {
    p.caja('madera', [luz, 0.06, fondo], [cx, h.travesano, 0]);
    franja(dentro1, h.travesano - 0.03, false); // abajo, fijos
    franja(h.travesano + 0.03, dentro2, !fijo); // arriba, hojas
  } else {
    franja(dentro1, dentro2, !fijo);
  }
}

/** Celosía de lamas horizontales inclinadas, con montantes cada menos de 1 m. */
function lamas(h: Hueco, cx: number, p: Piezas) {
  const w = h.ancho, y1 = h.alfeizar, y2 = h.alfeizar + h.alto;
  const perfil = 0.04;
  const tramos = Math.max(1, Math.ceil(w / 0.95));
  for (let i = 0; i <= tramos; i++) p.caja('aluminio', [perfil, h.alto, 0.05], [cx - w / 2 + (w * i) / tramos + (i === 0 ? perfil / 2 : i === tramos ? -perfil / 2 : 0), (y1 + y2) / 2, 0]);
  for (const y of [y1 + perfil / 2, y2 - perfil / 2]) p.caja('aluminio', [w, perfil, 0.05], [cx, y, 0]);
  const paso = 0.1;
  for (let y = y1 + perfil + paso / 2; y < y2 - perfil; y += paso) {
    p.caja('aluminio', [w - 2 * perfil, 0.012, 0.085], [cx, y, 0], THREE.MathUtils.degToRad(-35));
  }
}

/** Cortina recogida a los dos lados del hueco, por el lado interior, hasta el suelo. */
function cortina(h: Hueco, cx: number, grosor: number, interior: number, altoTecho: number): THREE.Object3D {
  const grupo = new THREE.Group();
  grupo.name = 'cortina';
  const z = interior * (grosor / 2 + 0.09);
  const arriba = altoTecho - 0.04, abajo = 0.01;
  const w = h.ancho;
  const geometrias: THREE.BufferGeometry[] = [];
  // Dos paños, cada uno cubre un 30 % del ancho, con pliegues ondulados
  for (const s of [-1, 1]) {
    const x1 = cx + s * (w / 2 - 0.02), x2 = cx + s * (w / 2 - 0.02 - 0.3 * w);
    const pasos = Math.max(8, Math.round(Math.abs(x2 - x1) / 0.015));
    const pos: number[] = [], indices: number[] = [];
    for (let i = 0; i <= pasos; i++) {
      const x = x1 + ((x2 - x1) * i) / pasos;
      const onda = 0.03 * Math.sin((i / pasos) * Math.PI * 2 * Math.max(3, Math.round(Math.abs(x2 - x1) / 0.09)));
      pos.push(x, abajo, z + onda, x, arriba, z + onda);
      if (i < pasos) indices.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    geometrias.push(g);
  }
  const tela = new THREE.Mesh(mergeGeometries(geometrias), MATERIALES_CARPINTERIA.tela);
  tela.receiveShadow = true;
  // Riel
  const riel = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, 0.02, 0.02), MATERIALES_CARPINTERIA.lacado);
  riel.position.set(cx, altoTecho - 0.03, z);
  grupo.add(tela, riel);
  return grupo;
}

/**
 * Carpintería de todos los huecos de una pared (o null si no tiene).
 * `lados` dice qué estancias hay a cada lado (para saber cuál es el interior) y
 * `altoInterior`, la altura de techo por ese lado (para las cortinas).
 */
export function crearCarpinteria(
  p: Pared, v: Vivienda, lados: Record<Lado, string[]>,
): Carpinteria3D | null {
  if (!p.huecos?.length) return null;
  const largo = largoPared(p);
  const grupo = new THREE.Group();
  grupo.name = `carpinteria:${p.id}`;
  const fijas = new Piezas();
  const puertas: PuertaAbatible[] = [];
  const cortinas: THREE.Object3D[] = [];

  // Lado interior: aquel donde hay una estancia que no es exterior (izquierda = -z).
  const esInterior = (ids: string[]) => ids.some((id) => !v.estancias.find((e) => e.id === id)?.exterior);
  const interior = esInterior(lados.izquierda) && !esInterior(lados.derecha) ? -1 : esInterior(lados.derecha) && !esInterior(lados.izquierda) ? 1 : -1;
  const idsInterior = interior === -1 ? lados.izquierda : lados.derecha;
  const alturas = idsInterior.map((id) => v.estancias.find((e) => e.id === id)?.alturaTecho ?? v.alturaTecho);
  const altoInterior = Math.min(altoPared(p, v), ...(alturas.length ? alturas : [v.alturaTecho]));

  for (const h of p.huecos) {
    const cx = -largo / 2 + h.distancia + h.ancho / 2;
    const estilo = estiloDe(h);
    if (h.tipo === 'puerta' || estilo.startsWith('puerta')) {
      const pt = puerta(h, cx, p.grosor, fijas);
      grupo.add(pt.mallas);
      puertas.push({ nombre: pt.nombre, pivote: pt.pivote, abierta: pt.abierta });
    } else if (estilo === 'lamas') {
      lamas(h, cx, fijas);
    } else {
      ventana(h, cx, p.grosor, interior, fijas);
    }
    if (h.cortina) {
      const c = cortina(h, cx, p.grosor, interior, altoInterior);
      cortinas.push(c);
      grupo.add(c);
    }
  }
  for (const m of fijas.mallas(`carpinteria:${p.id}`)) grupo.add(m);
  return { grupo, puertas, cortinas };
}

/** Barandilla de barrotes verticales: pasamanos, barra inferior y barrotes cada 11 cm (coordenadas locales de la pared). */
export function crearBarandilla(largo: number, alto: number): THREE.Mesh {
  const p = new Piezas();
  p.caja('aluminio', [largo, 0.04, 0.04], [0, alto - 0.02, 0]);
  p.caja('aluminio', [largo, 0.025, 0.025], [0, 0.09, 0]);
  const n = Math.max(1, Math.round(largo / 0.11));
  for (let i = 0; i <= n; i++) {
    const poste = i === 0 || i === n;
    const lado = poste ? 0.035 : 0.012;
    p.caja('aluminio', [lado, poste ? alto - 0.02 : alto - 0.12, lado], [-largo / 2 + (largo * i) / n, poste ? (alto - 0.02) / 2 : 0.09 + (alto - 0.12) / 2, 0]);
  }
  return p.mallas('barandilla')[0];
}
