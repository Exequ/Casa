// Acabados de las paredes en 3D:
//   - el revestimiento de cada cara (pintura de la estancia a la que mira, o
//     alicatado donde lo haya), con los huecos de puertas y ventanas recortados;
//   - los rodapiés;
//   - los "umbrales": el trozo de suelo que queda bajo cada puerta o balconera.
//
// Las paredes y pilares macizos (vivienda3d.ts) quedan debajo como "núcleo":
// dan el volumen, las sombras y el color de las caras exteriores. Encima, por
// el lado de cada estancia, va una lámina con su acabado. Así un tabique
// puede tener alicatado por el lado del baño y pintura por el del pasillo.
//
// No usa el DOM (salvo las texturas, que se saltan en los tests).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { colorPared, rodapieDe, validarColorPared, type Revestimiento } from '../vivienda/acabados';
import { carasDeEstancia, ladoDe, tramoEnZona, type Lado, type TramoCara } from '../vivienda/caras';
import { puntoEnPoligono } from '../vivienda/geometria';
import { alturaEstancia, estiloDe, largoPared, type Estancia, type Punto, type Vivienda } from '../vivienda/modelo';
import { sueloDe } from '../vivienda/suelos';
import { materialPared } from './texturasPared';

/** Separación entre el muro y la lámina de acabado (m). */
const HOLGURA = 0.002;
/** Grosor del rodapié (m). */
const GROSOR_RODAPIE = 0.012;
/** Ancho del tapajuntas de las puertas (m): el rodapié se corta ahí. */
export const ANCHO_TAPAJUNTAS = 0.07;

export interface AcabadosParedes {
  /** Láminas de acabado, por el elemento ("pared:id" o "pilar:id") al que pertenecen. */
  porElemento: Map<string, THREE.Mesh[]>;
  /** Láminas que no pertenecen a ningún muro (no se bajan nunca). */
  sueltas: THREE.Mesh[];
  /** Rodapiés de todas las estancias. */
  rodapies: THREE.Group;
  /** Suelo bajo puertas y balconeras, por la estancia de la que toma el suelo. */
  umbrales: Map<string, THREE.Mesh[]>;
  /** Material de pintura de cada estancia (se le cambia el color desde la interfaz). */
  pintura: Map<string, THREE.MeshStandardMaterial | THREE.MeshLambertMaterial>;
  /** Materiales que lleva cada pared por cada lado (para comprobar que no queda ninguna cara sin acabado). */
  carasPared: Map<string, Record<Lado, THREE.Material[]>>;
}

/** Un rectángulo de lámina: de u1 a u2 a lo largo del tramo y de y1 a y2 de altura. */
interface Celda { u1: number; u2: number; y1: number; y2: number }

/** Geometría de un conjunto de celdas de un tramo (coordenadas del mundo; UV en metros). */
function geometriaCeldas(t: TramoCara, celdas: Celda[]): THREE.BufferGeometry {
  const pos: number[] = [], normales: number[] = [], uvs: number[] = [], indices: number[] = [];
  const sep = t.adelanto + HOLGURA;
  // El orden (dir, arriba) da una cara que mira hacia (-dir.z, dir.x); si la estancia queda al otro lado, se invierte.
  const invertir = -t.dir[1] * t.n[0] + t.dir[0] * t.n[1] < 0;
  for (const c of celdas) {
    const base = pos.length / 3;
    for (const [u, y] of [[c.u1, c.y1], [c.u2, c.y1], [c.u2, c.y2], [c.u1, c.y2]]) {
      pos.push(t.a[0] + t.dir[0] * u + t.n[0] * sep, y, t.a[1] + t.dir[1] * u + t.n[1] * sep);
      normales.push(t.n[0], 0, t.n[1]);
      uvs.push(t.u0 + u, y);
    }
    if (invertir) indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    else indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normales, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  return g;
}

/**
 * Parte la cara de un tramo en celdas y dice qué material lleva cada una:
 * -1 = pintura; k ≥ 0 = el revestimiento k de la estancia. Los huecos quedan sin celda.
 */
export function celdasDeTramo(t: TramoCara, alto: number, revestimientos: Revestimiento[]): Map<number, Celda[]> {
  // Franja (en u y en y) que cubre cada revestimiento en este tramo
  const franjas = revestimientos.map((r) => {
    const u = r.zona ? tramoEnZona(t, r.zona) : ([0, t.largo] as [number, number]);
    const y1 = Math.min(alto, r.desde ?? 0);
    const y2 = r.hasta === undefined || r.hasta === 'techo' ? alto : Math.min(alto, r.hasta);
    return u && y2 > y1 ? { u, y1, y2 } : null;
  });
  const us = new Set<number>([0, t.largo]), ys = new Set<number>([0, alto]);
  for (const h of t.huecos) {
    us.add(h.desde); us.add(h.hasta);
    ys.add(Math.min(alto, h.abajo)); ys.add(Math.min(alto, h.arriba));
  }
  for (const f of franjas) if (f) { us.add(f.u[0]); us.add(f.u[1]); ys.add(f.y1); ys.add(f.y2); }
  const ou = [...us].sort((a, b) => a - b), oy = [...ys].sort((a, b) => a - b);

  const celdas = new Map<number, Celda[]>();
  for (let i = 0; i + 1 < ou.length; i++) {
    for (let j = 0; j + 1 < oy.length; j++) {
      const c: Celda = { u1: ou[i], u2: ou[i + 1], y1: oy[j], y2: oy[j + 1] };
      if (c.u2 - c.u1 < 1e-6 || c.y2 - c.y1 < 1e-6) continue;
      const um = (c.u1 + c.u2) / 2, ym = (c.y1 + c.y2) / 2;
      if (t.huecos.some((h) => um > h.desde && um < h.hasta && ym > h.abajo && ym < h.arriba)) continue;
      let material = -1;
      franjas.forEach((f, k) => { if (f && um > f.u[0] && um < f.u[1] && ym > f.y1 && ym < f.y2) material = k; });
      if (!celdas.has(material)) celdas.set(material, []);
      celdas.get(material)!.push(c);
    }
  }
  return celdas;
}

/** Caja alargada en planta: de p1 a p2 (centros de sus testas), con su grosor y su altura. */
function liston(p1: Punto, p2: Punto, y1: number, y2: number, grosor: number): THREE.BufferGeometry {
  const largo = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  const g = new THREE.BoxGeometry(largo, y2 - y1, grosor);
  g.rotateY(Math.atan2(-(p2[1] - p1[1]), p2[0] - p1[0]));
  g.translate((p1[0] + p2[0]) / 2, (y1 + y2) / 2, (p1[1] + p2[1]) / 2);
  return g;
}

/** Rodapié de una estancia: una sola malla con todos sus tramos (o null si no lleva). */
function crearRodapie(e: Estancia, tramos: TramoCara[]): THREE.Mesh | null {
  const r = rodapieDe(e.acabado);
  if (!r) return null;
  const piezas: THREE.BufferGeometry[] = [];
  for (const t of tramos) {
    // Trozos sin rodapié: donde hay puerta (con su tapajuntas) o un hueco que llega al suelo.
    const cortes: [number, number][] = t.huecos
      .filter((h) => h.abajo < r.alto)
      .map((h) => {
        const m = h.hueco.tipo === 'puerta' && estiloDe(h.hueco) !== 'puerta-vidriera' ? ANCHO_TAPAJUNTAS : 0;
        return [h.desde - m, h.hasta + m];
      });
    cortes.sort((p, q) => p[0] - q[0]);
    // En las esquinas se alarga un grosor, para que cierre con el rodapié de la pared de al lado.
    let u = t.inicioEnEsquina ? -GROSOR_RODAPIE : 0;
    const fin = t.largo + (t.finEnEsquina ? GROSOR_RODAPIE : 0);
    const trozos: [number, number][] = [];
    for (const [c1, c2] of cortes) {
      if (c1 > u + 0.005) trozos.push([u, c1]);
      u = Math.max(u, c2);
    }
    if (fin > u + 0.005) trozos.push([u, fin]);
    const sep = t.adelanto + HOLGURA + GROSOR_RODAPIE / 2;
    for (const [u1, u2] of trozos) {
      const en = (x: number): Punto => [t.a[0] + t.dir[0] * x + t.n[0] * sep, t.a[1] + t.dir[1] * x + t.n[1] * sep];
      piezas.push(liston(en(u1), en(u2), 0, r.alto, GROSOR_RODAPIE));
    }
  }
  if (!piezas.length) return null;
  const malla = new THREE.Mesh(mergeGeometries(piezas), new THREE.MeshStandardMaterial({ color: r.color, roughness: 0.55 }));
  malla.name = `rodapie:${e.id}`;
  malla.receiveShadow = true;
  return malla;
}

/** Suelo bajo las puertas y los huecos que llegan al suelo, para que no se vea un hueco en el pavimento. */
function crearUmbrales(v: Vivienda): Map<string, THREE.Mesh[]> {
  const umbrales = new Map<string, THREE.Mesh[]>();
  const estanciaEn = (p: Punto) => v.estancias.find((e) => puntoEnPoligono(p, e.poligono)) ?? null;
  for (const p of v.paredes) {
    const l = largoPared(p);
    if (l < 1e-6) continue;
    const d: Punto = [(p.hasta[0] - p.desde[0]) / l, (p.hasta[1] - p.desde[1]) / l];
    const n: Punto = [-d[1], d[0]];
    for (const h of p.huecos ?? []) {
      if (h.alfeizar > 0.02) continue;
      const centro: Punto = [p.desde[0] + d[0] * (h.distancia + h.ancho / 2), p.desde[1] + d[1] * (h.distancia + h.ancho / 2)];
      const lados = [1, -1]
        .map((s) => estanciaEn([centro[0] + n[0] * s * (p.grosor / 2 + 0.06), centro[1] + n[1] * s * (p.grosor / 2 + 0.06)]))
        .filter((e): e is Estancia => !!e);
      if (!lados.length) continue;
      // El umbral lleva el suelo de la estancia interior con tarima si la hay; si no, el de la primera interior.
      const duena = lados.find((e) => !e.exterior && sueloDe(e).tipo === 'tarima') ?? lados.find((e) => !e.exterior) ?? lados[0];
      const m = p.grosor / 2 + 0.02;
      const esquinas: Punto[] = [[h.distancia, -m], [h.distancia + h.ancho, -m], [h.distancia + h.ancho, m], [h.distancia, m]]
        .map(([u, w]) => [p.desde[0] + d[0] * u + n[0] * w, p.desde[1] + d[1] * u + n[1] * w]);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(esquinas.flatMap(([x, z]) => [x, 0.002, z]), 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(esquinas.flatMap(([x, z]) => [x, -z]), 2)); // como los suelos
      // Triángulos mirando hacia arriba, sea cual sea el sentido de las esquinas
      const giro = (esquinas[1][0] - esquinas[0][0]) * (esquinas[2][1] - esquinas[0][1]) - (esquinas[1][1] - esquinas[0][1]) * (esquinas[2][0] - esquinas[0][0]);
      g.setIndex(giro > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
      const malla = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x999999 }));
      malla.name = `umbral:${p.id}`;
      malla.receiveShadow = true;
      if (!umbrales.has(duena.id)) umbrales.set(duena.id, []);
      umbrales.get(duena.id)!.push(malla);
    }
  }
  return umbrales;
}

/**
 * Construye los acabados de todas las paredes.
 * `materialNucleo` es el material de los muros macizos (el que se ve en las
 * caras que no dan a ninguna estancia).
 */
export function construirAcabados(v: Vivienda, materialNucleo: THREE.Material, tamanoTextura = 512): AcabadosParedes {
  const porElemento = new Map<string, THREE.Mesh[]>();
  const sueltas: THREE.Mesh[] = [];
  const rodapies = new THREE.Group();
  rodapies.name = 'rodapies';
  const pintura = new Map<string, THREE.MeshStandardMaterial | THREE.MeshLambertMaterial>();
  const carasPared = new Map<string, Record<Lado, THREE.Material[]>>();
  for (const p of v.paredes) carasPared.set(p.id, { izquierda: [], derecha: [] });

  for (const e of v.estancias) {
    if (e.exterior) continue; // las fachadas se quedan con el material del muro
    const alto = alturaEstancia(e, v);
    const revestimientos = e.acabado?.revestimientos ?? [];
    const pintar = new THREE.MeshStandardMaterial({
      color: colorPared(e.acabado), roughness: 0.93,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    pintar.name = `pintura:${e.id}`;
    pintura.set(e.id, pintar);
    const materialDe = (k: number) => (k < 0 ? pintar : materialPared(revestimientos[k].material, tamanoTextura));

    const tramos = carasDeEstancia(v, e);
    // Juntamos las celdas de todos los tramos por (elemento, material) para dibujar pocas mallas.
    const grupos = new Map<string, { elemento: string | null; material: THREE.Material; geometrias: THREE.BufferGeometry[] }>();
    for (const t of tramos) {
      const elemento = t.elemento ? `${t.elemento.tipo}:${t.elemento.id}` : null;
      const pared = t.elemento?.tipo === 'pared' ? v.paredes.find((p) => p.id === t.elemento!.id) : undefined;
      for (const [k, celdas] of celdasDeTramo(t, alto, revestimientos)) {
        const material = materialDe(k);
        const clave = `${elemento}|${material.name}`;
        if (!grupos.has(clave)) grupos.set(clave, { elemento, material, geometrias: [] });
        grupos.get(clave)!.geometrias.push(geometriaCeldas(t, celdas));
        if (pared && Math.abs(t.dir[0] * (pared.hasta[0] - pared.desde[0]) + t.dir[1] * (pared.hasta[1] - pared.desde[1])) > 1e-6) {
          const lista = carasPared.get(pared.id)![ladoDe(pared, t)];
          if (!lista.includes(material)) lista.push(material);
        }
      }
    }
    for (const { elemento, material, geometrias } of grupos.values()) {
      const malla = new THREE.Mesh(mergeGeometries(geometrias), material);
      malla.name = `acabado:${e.id}`;
      malla.receiveShadow = true;
      if (!elemento) sueltas.push(malla);
      else {
        if (!porElemento.has(elemento)) porElemento.set(elemento, []);
        porElemento.get(elemento)!.push(malla);
      }
    }
    const rodapie = crearRodapie(e, tramos);
    if (rodapie) rodapies.add(rodapie);
  }
  // Las caras que no dan a ninguna estancia interior muestran el muro tal cual.
  for (const caras of carasPared.values()) {
    for (const lado of ['izquierda', 'derecha'] as Lado[]) if (!caras[lado].length) caras[lado].push(materialNucleo);
  }
  return { porElemento, sueltas, rodapies, umbrales: crearUmbrales(v), pintura, carasPared };
}

// --- Color de las paredes desde la interfaz -----------------------------------------

type Oyente = () => void;

/** Cambia el color de la pintura de cada estancia y recuerda los cambios para guardarlos en la escena. */
export class GestorParedes {
  private oyentes: Oyente[] = [];
  private vivienda: Vivienda;
  private pintura: Map<string, THREE.MeshStandardMaterial | THREE.MeshLambertMaterial>;

  constructor(vivienda: Vivienda, pintura: Map<string, THREE.MeshStandardMaterial | THREE.MeshLambertMaterial>) {
    this.vivienda = vivienda;
    this.pintura = pintura;
  }

  /** Se llama cuando cambia el color de alguna estancia. */
  alCambiar(fn: Oyente) { this.oyentes.push(fn); }

  /** Estancias que tienen paredes pintadas (las interiores). */
  estancias(): string[] {
    return [...this.pintura.keys()];
  }

  /** Color de la estancia según vivienda.json. */
  original(id: string): string {
    return colorPared(this.vivienda.estancias.find((e) => e.id === id)?.acabado).toLowerCase();
  }

  /** Color que tiene ahora la estancia (#rrggbb). */
  actual(id: string): string {
    const m = this.pintura.get(id);
    return m ? `#${m.color.getHexString()}` : this.original(id);
  }

  /** Cambia el color de una estancia (null = volver al de vivienda.json). */
  cambiar(id: string, color: string | null, avisar = true) {
    this.pintura.get(id)?.color.set(color ?? this.original(id));
    if (avisar) for (const fn of this.oyentes) fn();
  }

  /** Colores cambiados respecto a vivienda.json (lo que se guarda en la escena). */
  cambios(): Record<string, { color: string }> {
    const r: Record<string, { color: string }> = {};
    for (const id of this.pintura.keys()) if (this.actual(id) !== this.original(id)) r[id] = { color: this.actual(id) };
    return r;
  }

  /** Restaura los colores de una escena guardada. Devuelve cuántos ha ignorado por no ser válidos. */
  restaurar(cambios: Record<string, unknown> | undefined): number {
    let ignorados = 0;
    for (const [id, c] of Object.entries(cambios ?? {})) if (!this.pintura.has(id) || validarColorPared(c)) ignorados++;
    for (const id of this.pintura.keys()) {
      const c = cambios?.[id];
      this.cambiar(id, c && !validarColorPared(c) ? (c as { color: string }).color : null, false);
    }
    for (const fn of this.oyentes) fn();
    return ignorados;
  }
}
