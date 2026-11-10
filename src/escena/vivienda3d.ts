// Construye la vivienda en 3D a partir de data/vivienda.json:
//   - un suelo por estancia,
//   - paredes con sus huecos reales de puertas y ventanas, y pilares (el
//     "núcleo" macizo),
//   - por encima, los acabados de cada cara (paredes3d.ts), la carpintería
//     (carpinteria.ts) y los techos (techos.ts).
// No usa el DOM, así que también se puede usar en los tests.
//
// Convenio de ejes: el punto [x, z] del JSON es (x, 0, z) en 3D; y es la altura.

import * as THREE from 'three';
import type { Estancia, Pared, Pilar, Punto, Vivienda } from '../vivienda/modelo';
import { altoPared, altoPilar, largoPared } from '../vivienda/modelo';
import { estanciasPorLado } from '../vivienda/caras';
import { distanciaASegmento } from '../vivienda/geometria';
import { crearBarandilla, crearCarpinteria, type PuertaAbatible } from './carpinteria';
import { construirAcabados, type AcabadosParedes } from './paredes3d';
import { construirTechos, type Techos3D } from './techos';
import { construirFijos, type Fijos3D } from './fijos3d';

/** Un elemento vertical (pared o pilar) que se puede "cortar" para ver el interior. */
export interface ElementoVertical {
  /** Contenedor de todo el elemento (sin transformar). */
  objeto: THREE.Group;
  /** Muro macizo. Para cortarlo se aplasta en vertical (scale.y). */
  nucleo: THREE.Group;
  /** Revestimientos y carpintería: se ocultan cuando el muro está cortado. */
  acabados: THREE.Group;
  /** Segmento en planta que representa el elemento (para decidir si tapa la vista). */
  a: Punto;
  b: Punto;
  /** Altura completa (m). */
  alto: number;
  /** Grosor en planta (m). */
  grosor: number;
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
  /** Acabados de las paredes: pintura por estancia, rodapiés, umbrales… */
  acabados: AcabadosParedes;
  /** Puertas que se pueden abrir y cerrar. */
  puertas: PuertaAbatible[];
  cortinas: THREE.Object3D[];
  techos: Techos3D;
  /** Elementos fijos (cocina, baño, armario empotrado, aire acondicionado). */
  fijos: Fijos3D;
}

// Colores del muro macizo: es lo que se ve en los cantos y en las caras que no dan a ninguna estancia.
const COLOR_SUELO = 0xd9c3a5;
const COLOR_SUELO_EXTERIOR = 0xbfc3c7;
const COLOR_PARED = 0xf0eeea;
const COLOR_PILAR = 0xf0eeea;

const materialPared = new THREE.MeshStandardMaterial({ color: COLOR_PARED, roughness: 0.95, name: 'muro' });
const materialPilar = new THREE.MeshStandardMaterial({ color: COLOR_PILAR, roughness: 0.95, name: 'pilar' });

/**
 * Modo comprobación: pinta paredes y pilares de un color llamativo para que su
 * huella se distinga bien bajo el plano superpuesto.
 */
export function resaltarMuros(activo: boolean) {
  for (const m of [materialPared, ligeros.get(materialPared)]) (m as THREE.MeshStandardMaterial | undefined)?.color.setHex(activo ? 0xe0302a : COLOR_PARED);
  for (const m of [materialPilar, ligeros.get(materialPilar)]) (m as THREE.MeshStandardMaterial | undefined)?.color.setHex(activo ? 0xb01a8a : COLOR_PILAR);
}

/** Versión barata (Lambert) de cada material mate ya sustituido, para la calidad ligera. */
const ligeros = new Map<THREE.Material, THREE.Material>();

/**
 * Con calidad ligera, los materiales mates y lisos (muros, pintura, techos)
 * pasan a MeshLambertMaterial, mucho más barato por píxel y casi igual a la vista.
 */
function versionLigera(m: THREE.Material): THREE.Material {
  if (!(m instanceof THREE.MeshStandardMaterial) || m.map || m.transparent || m.metalness > 0 || m.roughness < 0.85) return m;
  let l = ligeros.get(m);
  if (!l) {
    l = new THREE.MeshLambertMaterial({
      color: m.color, name: m.name, side: m.side,
      polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits,
    });
    ligeros.set(m, l);
  }
  return l;
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

/** Grupo vacío para un elemento: contenedor, núcleo y acabados. */
function contenedor(nombre: string) {
  const objeto = new THREE.Group();
  objeto.name = nombre;
  const nucleo = new THREE.Group();
  nucleo.name = 'nucleo';
  const acabados = new THREE.Group();
  acabados.name = 'acabados';
  objeto.add(nucleo, acabados);
  return { objeto, nucleo, acabados };
}

/**
 * Pared con sus huecos. El núcleo se construye en coordenadas locales (x a lo
 * largo de la pared, de -largo/2 a +largo/2; z a lo ancho) y luego se coloca y gira.
 *
 * Para cada hueco se ponen: un trozo de muro bajo el alféizar (si lo hay) y
 * un dintel encima (si no llega al techo). Entre huecos, muro completo.
 * Las barandillas no son macizas: son barrotes.
 */
export function crearPared(p: Pared, v: Vivienda): ElementoVertical {
  const largo = largoPared(p);
  const alto = altoPared(p, v);
  const { objeto, nucleo, acabados } = contenedor(`pared:${p.id}`);
  const sobreHuecos: THREE.Object3D[] = [];
  const x0 = -largo / 2; // borde "desde" en coordenadas locales

  if (p.tipo === 'barandilla') {
    nucleo.add(crearBarandilla(largo, alto));
  } else {
    const huecos = [...(p.huecos ?? [])].sort((a, b) => a.distancia - b.distancia);
    let cursor = 0; // distancia ya construida desde "desde"
    for (const h of huecos) {
      // Muro completo hasta el hueco
      if (h.distancia > cursor + 1e-6) {
        const l = h.distancia - cursor;
        nucleo.add(bloque(l, alto, p.grosor, x0 + cursor + l / 2, alto / 2, materialPared));
      }
      const centro = x0 + h.distancia + h.ancho / 2;
      // Antepecho bajo la ventana
      if (h.alfeizar > 1e-6) {
        const antepecho = bloque(h.ancho, h.alfeizar, p.grosor, centro, h.alfeizar / 2, materialPared);
        antepecho.name = 'antepecho';
        nucleo.add(antepecho);
        sobreHuecos.push(antepecho);
      }
      // Dintel sobre el hueco
      const arriba = h.alfeizar + h.alto;
      if (alto - arriba > 1e-6) {
        const dintel = bloque(h.ancho, alto - arriba, p.grosor, centro, arriba + (alto - arriba) / 2, materialPared);
        dintel.name = 'dintel';
        nucleo.add(dintel);
        sobreHuecos.push(dintel);
      }
      cursor = h.distancia + h.ancho;
    }
    if (largo - cursor > 1e-6) {
      const l = largo - cursor;
      nucleo.add(bloque(l, alto, p.grosor, x0 + cursor + l / 2, alto / 2, materialPared));
    }
  }

  // Colocamos la pared: centro en el punto medio y eje local X apuntando de "desde" a "hasta".
  colocarComoPared(nucleo, p);
  objeto.userData.pared = p.id;
  return { objeto, nucleo, acabados, a: p.desde, b: p.hasta, alto, grosor: p.grosor, sobreHuecos };
}

/** Coloca un grupo en el sitio de una pared: origen en su punto medio y eje X local a lo largo de ella. */
function colocarComoPared(grupo: THREE.Object3D, p: Pared) {
  const dx = p.hasta[0] - p.desde[0];
  const dz = p.hasta[1] - p.desde[1];
  grupo.position.set((p.desde[0] + p.hasta[0]) / 2, 0, (p.desde[1] + p.hasta[1]) / 2);
  grupo.rotation.y = Math.atan2(-dz, dx);
}

/** Pilar: bloque macizo de suelo a techo. */
export function crearPilar(p: Pilar, v: Vivienda): ElementoVertical {
  const minX = Math.min(p.desde[0], p.hasta[0]), maxX = Math.max(p.desde[0], p.hasta[0]);
  const minZ = Math.min(p.desde[1], p.hasta[1]), maxZ = Math.max(p.desde[1], p.hasta[1]);
  const ancho = maxX - minX, fondo = maxZ - minZ, alto = altoPilar(p, v);
  // El núcleo tiene el origen en el suelo, para poder "cortarlo" aplastándolo en vertical.
  const { objeto, nucleo, acabados } = contenedor(`pilar:${p.id}`);
  nucleo.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), materialPilar);
  m.position.y = alto / 2;
  m.castShadow = m.receiveShadow = true;
  nucleo.add(m);
  // Segmento representativo: a lo largo del lado mayor.
  const cz = (minZ + maxZ) / 2, cx = (minX + maxX) / 2;
  const [a, b]: [Punto, Punto] = ancho >= fondo ? [[minX, cz], [maxX, cz]] : [[cx, minZ], [cx, maxZ]];
  return { objeto, nucleo, acabados, a, b, alto, grosor: Math.min(ancho, fondo), sobreHuecos: [] };
}

/**
 * Construye toda la vivienda. `tamanoTextura` es la resolución de las texturas
 * de los alicatados (px); `ligera` = materiales mates más baratos (móvil).
 */
export function construirVivienda(v: Vivienda, tamanoTextura = 512, ligera = false): Vivienda3D {
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

  // Acabados de cada cara, rodapiés y umbrales
  const acabados = construirAcabados(v, materialPared, tamanoTextura);
  for (const el of verticales) for (const malla of acabados.porElemento.get(el.objeto.name) ?? []) el.acabados.add(malla);
  for (const malla of acabados.sueltas) grupo.add(malla);
  grupo.add(acabados.rodapies);
  for (const lista of acabados.umbrales.values()) for (const malla of lista) grupo.add(malla);

  // Carpintería de cada pared (se coloca igual que su núcleo)
  const lados = estanciasPorLado(v);
  const puertas: PuertaAbatible[] = [];
  const cortinas: THREE.Object3D[] = [];
  v.paredes.forEach((p, i) => {
    const c = crearCarpinteria(p, v, lados.get(p.id)!);
    if (!c) return;
    colocarComoPared(c.grupo, p);
    paredes[i].acabados.add(c.grupo);
    puertas.push(...c.puertas);
    cortinas.push(...c.cortinas);
  });

  // Elementos fijos: los del suelo, con la vivienda; los colgados, con su pared
  // (en el grupo de acabados, que se oculta cuando la pared se baja).
  const fijos = construirFijos(v.fijos ?? [], tamanoTextura);
  for (const g of fijos.suelo) grupo.add(g);
  for (const [clave, lista] of fijos.colgados) {
    const destino = verticales.find((el) => el.objeto.name === clave)?.acabados ?? grupo;
    for (const g of lista) destino.add(g);
  }

  const techos = construirTechos(v);
  grupo.add(techos.grupo);
  if (ligera) {
    grupo.traverse((o) => {
      const malla = o as THREE.Mesh;
      if (malla.isMesh && !Array.isArray(malla.material)) malla.material = versionLigera(malla.material);
    });
    for (const [id, m] of acabados.pintura) acabados.pintura.set(id, versionLigera(m) as THREE.MeshLambertMaterial);
  }
  return { grupo, suelos, verticales, acabados, puertas, cortinas, techos, fijos };
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
