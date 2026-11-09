// Construye la vivienda en 3D a partir de data/vivienda.json:
//   - un suelo por estancia,
//   - paredes con sus huecos reales de puertas y ventanas,
//   - pilares y patinillos.
// No usa el DOM, así que también se puede usar en los tests.
//
// Convenio de ejes: el punto [x, z] del JSON es (x, 0, z) en 3D; y es la altura.

import * as THREE from 'three';
import type { Estancia, Pared, Pilar, Punto, Vivienda } from '../vivienda/modelo';
import { altoPared, altoPilar, largoPared } from '../vivienda/modelo';
import { distanciaASegmento } from '../vivienda/geometria';

/** Un elemento vertical (pared o pilar) que se puede "cortar" para ver el interior. */
export interface ElementoVertical {
  objeto: THREE.Object3D;
  /** Segmento en planta que representa el elemento (para decidir si tapa la vista). */
  a: Punto;
  b: Punto;
  /** Altura completa (m). */
  alto: number;
  /** Grosor en planta (m). */
  grosor: number;
  /** Cristales (se ocultan cuando el elemento está cortado). */
  cristales: THREE.Object3D[];
  /** Antepechos y dinteles (se ocultan en el modo huella para que los huecos se vean). */
  sobreHuecos: THREE.Object3D[];
  /** Solo pilares: paredes que lo tocan. El pilar se corta si se corta alguna de ellas. */
  vecinos?: ElementoVertical[];
}

export interface Vivienda3D {
  grupo: THREE.Group;
  /** Suelo de cada estancia, por id. */
  suelos: Map<string, THREE.Mesh>;
  /** Paredes y pilares. */
  verticales: ElementoVertical[];
}

// Colores provisionales (los materiales de verdad llegarán en la fase 3).
const COLOR_SUELO = 0xd9c3a5;
const COLOR_SUELO_EXTERIOR = 0xbfc3c7;
const COLOR_PARED = 0xf2efe9;
const COLOR_PILAR = 0xe2ddd4;

const materialPared = new THREE.MeshStandardMaterial({ color: COLOR_PARED, roughness: 0.95 });
const materialPilar = new THREE.MeshStandardMaterial({ color: COLOR_PILAR, roughness: 0.95 });
const materialCristal = new THREE.MeshStandardMaterial({
  color: 0xa9d4f5, transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false,
});

/**
 * Modo comprobación: pinta paredes y pilares de un color llamativo para que su
 * huella se distinga bien bajo el plano superpuesto.
 */
export function resaltarMuros(activo: boolean) {
  materialPared.color.setHex(activo ? 0xe0302a : COLOR_PARED);
  materialPilar.color.setHex(activo ? 0xb01a8a : COLOR_PILAR);
}

/** Suelo de una estancia: polígono plano a la altura y = 0. */
export function crearSuelo(e: Estancia): THREE.Mesh {
  // ShapeGeometry trabaja en el plano XY; usamos (x, -z) y luego lo tumbamos,
  // de modo que el punto (x, y=-z) acaba en (x, 0, z).
  const forma = new THREE.Shape(e.poligono.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geometria = new THREE.ShapeGeometry(forma);
  geometria.rotateX(-Math.PI / 2);
  const suelo = new THREE.Mesh(
    geometria,
    new THREE.MeshStandardMaterial({ color: e.exterior ? COLOR_SUELO_EXTERIOR : COLOR_SUELO, roughness: 0.85 }),
  );
  suelo.receiveShadow = true;
  suelo.name = `suelo:${e.id}`;
  suelo.userData.estancia = e.id;
  return suelo;
}

/** Caja de tamaño (largo × alto × grosor) colocada en coordenadas locales de la pared. */
function bloque(largo: number, alto: number, grosor: number, x: number, y: number, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(largo, alto, grosor), material);
  m.position.set(x, y, 0);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Pared con sus huecos. Se construye en coordenadas locales (x a lo largo de
 * la pared, de -largo/2 a +largo/2; z a lo ancho) y luego se coloca y gira.
 *
 * Para cada hueco se ponen: un trozo de muro bajo el alféizar (si lo hay) y
 * un dintel encima (si no llega al techo). Entre huecos, muro completo.
 */
export function crearPared(p: Pared, v: Vivienda): ElementoVertical {
  const largo = largoPared(p);
  const alto = altoPared(p, v);
  const grupo = new THREE.Group();
  grupo.name = `pared:${p.id}`;
  const cristales: THREE.Object3D[] = [];
  const sobreHuecos: THREE.Object3D[] = [];
  const x0 = -largo / 2; // borde "desde" en coordenadas locales

  const huecos = [...(p.huecos ?? [])].sort((a, b) => a.distancia - b.distancia);
  let cursor = 0; // distancia ya construida desde "desde"
  for (const h of huecos) {
    // Muro completo hasta el hueco
    if (h.distancia > cursor + 1e-6) {
      const l = h.distancia - cursor;
      grupo.add(bloque(l, alto, p.grosor, x0 + cursor + l / 2, alto / 2, materialPared));
    }
    const centro = x0 + h.distancia + h.ancho / 2;
    // Antepecho bajo la ventana
    if (h.alfeizar > 1e-6) {
      const antepecho = bloque(h.ancho, h.alfeizar, p.grosor, centro, h.alfeizar / 2, materialPared);
      antepecho.name = 'antepecho';
      grupo.add(antepecho);
      sobreHuecos.push(antepecho);
    }
    // Dintel sobre el hueco
    const arriba = h.alfeizar + h.alto;
    if (alto - arriba > 1e-6) {
      const dintel = bloque(h.ancho, alto - arriba, p.grosor, centro, arriba + (alto - arriba) / 2, materialPared);
      dintel.name = 'dintel';
      grupo.add(dintel);
      sobreHuecos.push(dintel);
    }
    // Cristal en las ventanas
    if (h.tipo === 'ventana') {
      const cristal = new THREE.Mesh(new THREE.BoxGeometry(h.ancho, h.alto, 0.02), materialCristal);
      cristal.position.set(centro, h.alfeizar + h.alto / 2, 0);
      cristal.name = 'cristal';
      grupo.add(cristal);
      cristales.push(cristal);
    }
    cursor = h.distancia + h.ancho;
  }
  if (largo - cursor > 1e-6) {
    const l = largo - cursor;
    grupo.add(bloque(l, alto, p.grosor, x0 + cursor + l / 2, alto / 2, materialPared));
  }

  // Colocamos la pared: centro en el punto medio y eje local X apuntando de "desde" a "hasta".
  const dx = p.hasta[0] - p.desde[0];
  const dz = p.hasta[1] - p.desde[1];
  grupo.position.set((p.desde[0] + p.hasta[0]) / 2, 0, (p.desde[1] + p.hasta[1]) / 2);
  grupo.rotation.y = Math.atan2(-dz, dx);
  grupo.userData.pared = p.id;
  return { objeto: grupo, a: p.desde, b: p.hasta, alto, grosor: p.grosor, cristales, sobreHuecos };
}

/** Pilar: bloque macizo de suelo a techo. */
export function crearPilar(p: Pilar, v: Vivienda): ElementoVertical {
  const minX = Math.min(p.desde[0], p.hasta[0]), maxX = Math.max(p.desde[0], p.hasta[0]);
  const minZ = Math.min(p.desde[1], p.hasta[1]), maxZ = Math.max(p.desde[1], p.hasta[1]);
  const ancho = maxX - minX, fondo = maxZ - minZ, alto = altoPilar(p, v);
  // Lo metemos en un grupo con origen en el suelo, para poder "cortarlo" escalando en Y.
  const grupo = new THREE.Group();
  grupo.name = `pilar:${p.id}`;
  grupo.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), materialPilar);
  m.position.y = alto / 2;
  m.castShadow = m.receiveShadow = true;
  grupo.add(m);
  // Segmento representativo: a lo largo del lado mayor.
  const cz = (minZ + maxZ) / 2, cx = (minX + maxX) / 2;
  const [a, b]: [Punto, Punto] = ancho >= fondo ? [[minX, cz], [maxX, cz]] : [[cx, minZ], [cx, maxZ]];
  return { objeto: grupo, a, b, alto, grosor: Math.min(ancho, fondo), cristales: [], sobreHuecos: [] };
}

/** Construye toda la vivienda. */
export function construirVivienda(v: Vivienda): Vivienda3D {
  const grupo = new THREE.Group();
  grupo.name = 'vivienda';
  const suelos = new Map<string, THREE.Mesh>();
  for (const e of v.estancias) {
    const suelo = crearSuelo(e);
    suelos.set(e.id, suelo);
    grupo.add(suelo);
  }
  const paredes = v.paredes.map((p) => crearPared(p, v));
  const pilares = (v.pilares ?? []).map((p) => {
    const el = crearPilar(p, v);
    el.vecinos = paredes.filter((pared) => toca(p, pared));
    return el;
  });
  const verticales: ElementoVertical[] = [...paredes, ...pilares];
  for (const el of verticales) grupo.add(el.objeto);
  return { grupo, suelos, verticales };
}

/** ¿Toca el pilar a la pared? (con 2 cm de margen) */
function toca(p: Pilar, pared: ElementoVertical): boolean {
  const minX = Math.min(p.desde[0], p.hasta[0]) - 0.02, maxX = Math.max(p.desde[0], p.hasta[0]) + 0.02;
  const minZ = Math.min(p.desde[1], p.hasta[1]) - 0.02, maxZ = Math.max(p.desde[1], p.hasta[1]) + 0.02;
  const mx = (minX + maxX) / 2, mz = (minZ + maxZ) / 2;
  const puntos: Punto[] = [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ], [mx, minZ], [mx, maxZ], [minX, mz], [maxX, mz]];
  return puntos.some((pt) => distanciaASegmento(pt, pared.a, pared.b) <= pared.grosor / 2 + 1e-3);
}

/** Área (m²) de la geometría de un suelo, sumando sus triángulos. Se usa en los tests. */
export function areaGeometria(malla: THREE.Mesh): number {
  const g = malla.geometry;
  const pos = g.getAttribute('position');
  const idx = g.getIndex();
  const n = idx ? idx.count : pos.count;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let total = 0;
  for (let i = 0; i < n; i += 3) {
    const [ia, ib, ic] = idx ? [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)] : [i, i + 1, i + 2];
    a.fromBufferAttribute(pos, ia);
    b.fromBufferAttribute(pos, ib);
    c.fromBufferAttribute(pos, ic);
    total += b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
  }
  return total;
}
