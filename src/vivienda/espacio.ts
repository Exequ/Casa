// Espacio libre de la vivienda: dónde pueden estar los muebles.
//
// Idea: un mueble está bien colocado si su huella (rectángulo en planta)
// queda dentro del suelo de las estancias. Los polígonos de las estancias
// siguen la cara interior de los muros, así que un mueble bien colocado
// nunca atraviesa paredes ni pilares. En los huecos de puertas y ventanas no
// hay suelo de ninguna estancia (es el grosor del muro), así que un mueble
// no puede quedarse en ellos.
//
// Al ARRASTRAR, el mueble avanza de forma continua (nunca salta un muro) y
// puede pasar de una estancia a otra por una puerta, pero solo si cabe por
// ella. Para eso, mientras se arrastra, el hueco de cada puerta interior
// cuenta como suelo de paso. Al soltarlo, si se ha quedado en una puerta, se
// coloca en el sitio libre más cercano.
//
// Las estancias que comparten un borde sin muro (salón y cocina abierta) se
// tratan como un solo espacio: un mueble puede quedar a caballo entre ambas.

import type { Punto, Vivienda } from './modelo';
import { largoPared } from './modelo';
import {
  caja, encoger, huellaRectangulo, puntoEnPoligono, segmentoTocaConvexo,
} from './geometria';

/** Margen para que un mueble pueda quedar pegado a la pared sin contar como choque (1 mm). */
const HOLGURA = 0.001;
/** Tolerancia para decidir que dos bordes están en la misma línea (5 mm). */
const TOL_LINEA = 0.005;
/** Paso del avance continuo al arrastrar (m). Menor que el muro más fino. */
const PASO = 0.02;

type Segmento = [Punto, Punto];

export interface Huella {
  x: number;
  z: number;
  ancho: number;
  fondo: number;
  /** Giro en radianes. */
  giro: number;
}

/** Un conjunto de polígonos de suelo y sus bordes exteriores. */
interface Region {
  poligonos: Punto[][];
  bordes: Segmento[];
}

export class EspacioLibre {
  /** Polígonos del suelo de cada estancia. */
  readonly poligonos: { id: string; poligono: Punto[] }[];
  /** Huecos de las puertas que comunican dos estancias (rectángulos en planta). */
  readonly pasos: Punto[][];
  /** Suelo donde puede quedarse un mueble: solo las estancias. */
  private estancias: Region;
  /** Suelo por el que puede pasar un mueble al arrastrarlo: estancias + puertas. */
  private transito: Region;

  constructor(vivienda: Vivienda) {
    this.poligonos = vivienda.estancias.map((e) => ({ id: e.id, poligono: e.poligono }));
    const polis = this.poligonos.map((p) => p.poligono);
    this.pasos = huecosDePaso(vivienda, polis);
    this.estancias = { poligonos: polis, bordes: calcularBordes(polis) };
    const todos = [...polis, ...this.pasos];
    this.transito = { poligonos: todos, bordes: calcularBordes(todos) };
  }

  /** Id de la estancia que contiene el punto (o null). */
  estanciaEn(x: number, z: number): string | null {
    for (const p of this.poligonos) if (puntoEnPoligono([x, z], p.poligono)) return p.id;
    return null;
  }

  /** ¿Está el punto en el suelo de alguna estancia? */
  dentro(pt: Punto): boolean {
    return this.estancias.poligonos.some((p) => puntoEnPoligono(pt, p, 1e-4));
  }

  /**
   * ¿Está bien colocado un mueble con esta huella? (sin atravesar muros,
   * pilares ni huecos). Con `transito = true`, los huecos de las puertas
   * interiores cuentan como suelo (se usa mientras se arrastra).
   */
  esValida(h: Huella, transito = false): boolean {
    const region = transito ? this.transito : this.estancias;
    const esquinas = encoger(huellaRectangulo(h.x, h.z, h.ancho, h.fondo, h.giro), HOLGURA);
    // 1. Todas las esquinas sobre suelo
    if (!esquinas.every((p) => region.poligonos.some((poli) => puntoEnPoligono(p, poli, 1e-4)))) return false;
    // 2. Ningún borde del suelo (muro, pilar, jamba) cruza la huella
    for (const [a, b] of region.bordes) {
      if (segmentoTocaConvexo(a, b, esquinas)) return false;
    }
    return true;
  }

  /**
   * Arrastra una huella desde su posición actual hacia (x, z) de forma
   * continua: si choca, se detiene junto a la pared o se desliza a lo largo
   * de ella. Puede cruzar puertas si cabe. Devuelve la posición final.
   */
  mover(h: Huella, x: number, z: number): { x: number; z: number } {
    // Si el mueble ya estaba mal colocado (no cabía en ningún sitio), lo dejamos moverse libre.
    if (!this.esValida(h, true)) return { x, z };
    // 1. Avanzamos en línea recta hasta llegar o chocar...
    const choque = this.hastaChocar(h, x, z);
    if (Math.hypot(x - choque.x, z - choque.z) < 1e-9) return choque;
    // 2. ...y desde ahí intentamos seguir deslizando a lo largo de la pared, en X o en Z.
    const desde = { ...h, ...choque };
    const candidatos = [choque, this.hastaChocar(desde, x, choque.z), this.hastaChocar(desde, choque.x, z)];
    // Nos quedamos con el candidato más cercano al destino.
    let mejor = candidatos[0];
    for (const c of candidatos) {
      if (Math.hypot(x - c.x, z - c.z) < Math.hypot(x - mejor.x, z - mejor.z) - 1e-9) mejor = c;
    }
    return mejor;
  }

  /**
   * Coloca definitivamente una huella: si está bien colocada no cambia; si se
   * ha quedado en el hueco de una puerta (o en un sitio no válido), se mueve
   * al sitio libre más cercano. Devuelve null si no hay sitio cerca.
   */
  asentar(h: Huella): { x: number; z: number } | null {
    return this.buscarSitio(h, 1.5);
  }

  /** Avanza en línea recta hacia (x, z) hasta justo antes de que deje de ser válida (en tránsito). */
  private hastaChocar(h: Huella, x: number, z: number): { x: number; z: number } {
    const dist = Math.hypot(x - h.x, z - h.z);
    const en = (t: number) => ({ x: h.x + (x - h.x) * t, z: h.z + (z - h.z) * t });
    const valida = (t: number) => this.esValida({ ...h, ...en(t) }, true);
    // 1. Avance en pasos pequeños hasta el primer choque (nunca se salta un muro)...
    const pasos = Math.max(1, Math.ceil(dist / PASO));
    let bien = 0, mal = -1;
    for (let i = 1; i <= pasos; i++) {
      if (!valida(i / pasos)) { mal = i / pasos; break; }
      bien = i / pasos;
    }
    if (mal < 0) return en(bien);
    // 2. ...y afinamos por bisección para quedar a menos de 1 mm de la pared.
    for (let k = 0; k < 10; k++) {
      const m = (bien + mal) / 2;
      if (valida(m)) bien = m; else mal = m;
    }
    return en(bien);
  }

  /**
   * Busca la posición válida (fuera de puertas) más cercana a (x, z) para la
   * huella, en espiral, hasta `radioMax` metros. Devuelve null si no hay sitio.
   */
  buscarSitio(h: Huella, radioMax = 3): { x: number; z: number } | null {
    if (this.esValida(h)) return { x: h.x, z: h.z };
    const paso = 0.05;
    for (let r = paso; r <= radioMax + 1e-9; r += paso) {
      const n = Math.max(8, Math.ceil((2 * Math.PI * r) / paso));
      for (let i = 0; i < n; i++) {
        const a = (2 * Math.PI * i) / n;
        const p = { x: h.x + r * Math.cos(a), z: h.z + r * Math.sin(a) };
        if (this.esValida({ ...h, ...p })) return p;
      }
    }
    return null;
  }

  /** Caja que envuelve todas las estancias. */
  cajaTotal() {
    return caja(this.poligonos.flatMap((p) => p.poligono));
  }
}

/**
 * Rectángulos de suelo de paso en las puertas que comunican dos estancias.
 * Cada rectángulo va del borde de la estancia de un lado al de la del otro,
 * con el ancho de la puerta, para que encaje exactamente con ambos suelos.
 */
export function huecosDePaso(v: Vivienda, poligonos: Punto[][]): Punto[][] {
  const pasos: Punto[][] = [];
  for (const p of v.paredes) {
    const largo = largoPared(p);
    const ux = (p.hasta[0] - p.desde[0]) / largo, uz = (p.hasta[1] - p.desde[1]) / largo;
    const nx = -uz, nz = ux; // normal
    for (const h of (p.huecos ?? []).filter((x) => x.tipo === 'puerta')) {
      const s: Punto = [p.desde[0] + ux * h.distancia, p.desde[1] + uz * h.distancia];
      const e: Punto = [s[0] + ux * h.ancho, s[1] + uz * h.ancho];
      // Para cada lado, buscamos el borde de estancia paralelo a la pared más cercano a su cara.
      const caraDe = (signo: number): number | null => {
        let mejor: number | null = null;
        for (const poli of poligonos) {
          for (let i = 0; i < poli.length; i++) {
            const a = poli[i], b = poli[(i + 1) % poli.length];
            const lx = b[0] - a[0], lz = b[1] - a[1];
            const ll = Math.hypot(lx, lz);
            if (ll < 1e-9 || Math.abs(lx * nx + lz * nz) / ll > 1e-3) continue; // no es paralelo
            const offA = (a[0] - s[0]) * nx + (a[1] - s[1]) * nz; // distancia con signo al eje
            if (offA * signo <= 0 || Math.abs(Math.abs(offA) - p.grosor / 2) > 0.03) continue;
            // Debe cubrir el ancho de la puerta
            const t = (q: Punto) => (q[0] - s[0]) * ux + (q[1] - s[1]) * uz;
            const t1 = Math.min(t(a), t(b)), t2 = Math.max(t(a), t(b));
            if (t1 > 0.01 || t2 < h.ancho - 0.01) continue;
            if (mejor === null || Math.abs(offA) < Math.abs(mejor)) mejor = offA;
          }
        }
        return mejor;
      };
      const o1 = caraDe(1), o2 = caraDe(-1);
      if (o1 === null || o2 === null) continue; // no comunica dos estancias (p. ej. la puerta de entrada)
      pasos.push([
        [s[0] + nx * o1, s[1] + nz * o1], [e[0] + nx * o1, e[1] + nz * o1],
        [e[0] + nx * o2, e[1] + nz * o2], [s[0] + nx * o2, s[1] + nz * o2],
      ]);
    }
  }
  return pasos;
}

/**
 * Lados de los polígonos que no se solapan con el lado de otro polígono.
 * Así, el borde entre salón y cocina (que comparten) desaparece y queda
 * un único espacio.
 */
export function calcularBordes(poligonos: Punto[][]): Segmento[] {
  const lados: { a: Punto; b: Punto; poli: number }[] = [];
  poligonos.forEach((p, i) => p.forEach((a, k) => lados.push({ a, b: p[(k + 1) % p.length], poli: i })));

  const bordes: Segmento[] = [];
  for (const lado of lados) {
    const dx = lado.b[0] - lado.a[0], dz = lado.b[1] - lado.a[1];
    const largo = Math.hypot(dx, dz);
    if (largo < 1e-9) continue;
    // Tramos de este lado cubiertos por lados de OTROS polígonos (en parámetro t ∈ [0, 1]).
    const cubiertos: [number, number][] = [];
    for (const otro of lados) {
      if (otro.poli === lado.poli) continue;
      // ¿Está el otro lado sobre la misma recta?
      const distRecta = (p: Punto) => Math.abs((p[0] - lado.a[0]) * dz - (p[1] - lado.a[1]) * dx) / largo;
      if (distRecta(otro.a) > TOL_LINEA || distRecta(otro.b) > TOL_LINEA) continue;
      const t = (p: Punto) => ((p[0] - lado.a[0]) * dx + (p[1] - lado.a[1]) * dz) / (largo * largo);
      const t1 = Math.max(0, Math.min(t(otro.a), t(otro.b)));
      const t2 = Math.min(1, Math.max(t(otro.a), t(otro.b)));
      if (t2 - t1 > 1e-6) cubiertos.push([t1, t2]);
    }
    // Restamos los tramos cubiertos.
    cubiertos.sort((p, q) => p[0] - q[0]);
    let t = 0;
    const punto = (u: number): Punto => [lado.a[0] + dx * u, lado.a[1] + dz * u];
    for (const [t1, t2] of cubiertos) {
      if (t1 > t + 1e-6) bordes.push([punto(t), punto(t1)]);
      t = Math.max(t, t2);
    }
    if (t < 1 - 1e-6) bordes.push([punto(t), punto(1)]);
  }
  return bordes;
}
