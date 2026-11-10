// Caras de pared de cada estancia.
//
// El acabado de una pared depende de la estancia a la que mira: un tabique
// puede tener el baño por un lado y el pasillo por el otro. Como el polígono
// de cada estancia sigue la cara interior de sus muros y pilares, las caras de
// pared de una estancia son, sencillamente, los lados de su polígono.
//
// Este módulo recorre esos lados y los parte en "tramos": cada tramo pertenece
// a una pared o a un pilar concretos (para poder bajarlo con él cuando tapa la
// vista) y sabe qué huecos de puertas y ventanas lo atraviesan. Los lados que
// una estancia comparte con otra sin muro (salón y cocina) no son caras.
//
// Solo geometría en planta: sin 3D ni DOM.

import type { Estancia, Hueco, Pared, Punto, Vivienda } from './modelo';
import { largoPared } from './modelo';
import { puntoEnPoligono } from './geometria';

/** Tolerancia para decidir que un lado de estancia está sobre la cara de un muro o pilar (m). */
const TOL_CARA = 0.035;
/** Tolerancia para decidir que dos lados de estancias distintas están en la misma línea (m). */
const TOL_LINEA = 0.005;

export interface HuecoCara {
  /** Posición a lo largo del tramo, desde su inicio (m). */
  desde: number;
  hasta: number;
  /** Alturas inferior y superior del hueco (m). */
  abajo: number;
  arriba: number;
  hueco: Hueco;
}

export interface TramoCara {
  estancia: string;
  /** Extremos del tramo, sobre el lado del polígono, en el sentido del polígono. */
  a: Punto;
  b: Punto;
  /** Dirección unitaria de a hacia b. */
  dir: Punto;
  /** Normal unitaria que apunta hacia dentro de la estancia. */
  n: Punto;
  largo: number;
  /** Distancia recorrida por el perímetro hasta `a` (para que los azulejos sigan al doblar la esquina). */
  u0: number;
  /** Pared o pilar al que pertenece esta cara (null si no se ha encontrado ninguno). */
  elemento: { tipo: 'pared' | 'pilar'; id: string } | null;
  /** Cuánto sobresale el muro por delante del lado del polígono (m, ≥ 0); el acabado se pone por delante. */
  adelanto: number;
  huecos: HuecoCara[];
  /** ¿El extremo coincide con una esquina del polígono? (si no, es un corte entre dos muros en línea). */
  inicioEnEsquina: boolean;
  finEnEsquina: boolean;
}

type Intervalo = [number, number];

/** Resta de [0, largo] los intervalos dados. */
function complemento(largo: number, cubiertos: Intervalo[]): Intervalo[] {
  const libres: Intervalo[] = [];
  let t = 0;
  for (const [t1, t2] of [...cubiertos].sort((p, q) => p[0] - q[0])) {
    if (t1 > t + 1e-6) libres.push([t, t1]);
    t = Math.max(t, t2);
  }
  if (t < largo - 1e-6) libres.push([t, largo]);
  return libres;
}

interface Candidato {
  elemento: { tipo: 'pared' | 'pilar'; id: string };
  intervalo: Intervalo;
  /** Posición de la cara del elemento respecto al lado, hacia dentro de la estancia (m). */
  cara: number;
  pared?: Pared;
}

/** Tramos de cara de pared de una estancia. */
export function carasDeEstancia(v: Vivienda, e: Estancia): TramoCara[] {
  const tramos: TramoCara[] = [];
  const poli = e.poligono;
  let perimetro = 0;

  for (let i = 0; i < poli.length; i++) {
    const a = poli[i], b = poli[(i + 1) % poli.length];
    const largo = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u0 = perimetro;
    perimetro += largo;
    if (largo < 1e-6) continue;
    const dir: Punto = [(b[0] - a[0]) / largo, (b[1] - a[1]) / largo];
    // Normal interior: la que, desde el centro del lado, cae dentro del polígono.
    let n: Punto = [-dir[1], dir[0]];
    const medio: Punto = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (!puntoEnPoligono([medio[0] + n[0] * 0.005, medio[1] + n[1] * 0.005], poli, -1)) n = [dir[1], -dir[0]];

    const aLoLargo = (p: Punto) => (p[0] - a[0]) * dir[0] + (p[1] - a[1]) * dir[1];
    const haciaDentro = (p: Punto) => (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1];

    // 1. Trozos compartidos con otra estancia (sin muro entre ambas): no son cara de pared.
    const compartidos: Intervalo[] = [];
    for (const otra of v.estancias) {
      if (otra === e) continue;
      otra.poligono.forEach((p, k) => {
        const q = otra.poligono[(k + 1) % otra.poligono.length];
        if (Math.abs(haciaDentro(p)) > TOL_LINEA || Math.abs(haciaDentro(q)) > TOL_LINEA) return;
        const t1 = Math.max(0, Math.min(aLoLargo(p), aLoLargo(q)));
        const t2 = Math.min(largo, Math.max(aLoLargo(p), aLoLargo(q)));
        if (t2 - t1 > 1e-6) compartidos.push([t1, t2]);
      });
    }

    // 2. Paredes y pilares cuya cara coincide con este lado.
    const candidatos: Candidato[] = [];
    for (const p of v.paredes) {
      if (p.tipo === 'barandilla') continue;
      const lp = largoPared(p);
      if (lp < 1e-6) continue;
      const d: Punto = [(p.hasta[0] - p.desde[0]) / lp, (p.hasta[1] - p.desde[1]) / lp];
      if (Math.abs(d[0] * dir[0] + d[1] * dir[1]) < 1e-3) {
        // Pared perpendicular: este lado puede ser su testa (el canto de su extremo).
        for (const [extremo, otro] of [[p.desde, p.hasta], [p.hasta, p.desde]] as const) {
          const cara = haciaDentro(extremo);
          if (Math.abs(cara) > TOL_CARA || haciaDentro(otro) >= 0) continue;
          const t1 = Math.max(0, aLoLargo(extremo) - p.grosor / 2), t2 = Math.min(largo, aLoLargo(extremo) + p.grosor / 2);
          if (t2 - t1 > 0.01) candidatos.push({ elemento: { tipo: 'pared', id: p.id }, intervalo: [t1, t2], cara });
        }
        continue;
      }
      if (Math.abs(d[0] * dir[1] - d[1] * dir[0]) > 1e-3) continue; // no es paralela
      const eje = haciaDentro(p.desde);
      if (eje >= 0) continue; // la pared no queda detrás de este lado
      const cara = eje + p.grosor / 2;
      if (Math.abs(cara) > TOL_CARA) continue;
      const t1 = Math.max(0, Math.min(aLoLargo(p.desde), aLoLargo(p.hasta)));
      const t2 = Math.min(largo, Math.max(aLoLargo(p.desde), aLoLargo(p.hasta)));
      if (t2 - t1 > 0.01) candidatos.push({ elemento: { tipo: 'pared', id: p.id }, intervalo: [t1, t2], cara, pared: p });
    }
    for (const p of v.pilares ?? []) {
      const esquinas: Punto[] = [
        [p.desde[0], p.desde[1]], [p.hasta[0], p.desde[1]], [p.hasta[0], p.hasta[1]], [p.desde[0], p.hasta[1]],
      ];
      const centro: Punto = [(p.desde[0] + p.hasta[0]) / 2, (p.desde[1] + p.hasta[1]) / 2];
      if (haciaDentro(centro) >= 0) continue; // el pilar no queda detrás de este lado
      const cara = Math.max(...esquinas.map(haciaDentro));
      if (Math.abs(cara) > TOL_CARA) continue;
      const ts = esquinas.map(aLoLargo);
      const t1 = Math.max(0, Math.min(...ts)), t2 = Math.min(largo, Math.max(...ts));
      if (t2 - t1 > 0.01) candidatos.push({ elemento: { tipo: 'pilar', id: p.id }, intervalo: [t1, t2], cara });
    }

    // 3. Partimos cada trozo libre por los límites de los candidatos y elegimos, en cada
    //    trocito, el elemento cuya cara está más cerca del lado.
    for (const [l1, l2] of complemento(largo, compartidos)) {
      const cortes = new Set<number>([l1, l2]);
      for (const c of candidatos) for (const t of c.intervalo) if (t > l1 + 1e-6 && t < l2 - 1e-6) cortes.add(t);
      const orden = [...cortes].sort((p, q) => p - q);
      let actual: { c: Candidato | null; t1: number; t2: number } | null = null;
      const cerrar = () => {
        if (!actual || actual.t2 - actual.t1 < 1e-6) return;
        const { c, t1, t2 } = actual;
        const pa: Punto = [a[0] + dir[0] * t1, a[1] + dir[1] * t1];
        const pb: Punto = [a[0] + dir[0] * t2, a[1] + dir[1] * t2];
        const huecos: HuecoCara[] = [];
        if (c?.pared) {
          const p = c.pared, lp = largoPared(p);
          const d: Punto = [(p.hasta[0] - p.desde[0]) / lp, (p.hasta[1] - p.desde[1]) / lp];
          for (const h of p.huecos ?? []) {
            const h1: Punto = [p.desde[0] + d[0] * h.distancia, p.desde[1] + d[1] * h.distancia];
            const h2: Punto = [h1[0] + d[0] * h.ancho, h1[1] + d[1] * h.ancho];
            const desde = Math.max(0, Math.min(aLoLargo(h1), aLoLargo(h2)) - t1);
            const hasta = Math.min(t2 - t1, Math.max(aLoLargo(h1), aLoLargo(h2)) - t1);
            if (hasta - desde > 0.01) huecos.push({ desde, hasta, abajo: h.alfeizar, arriba: h.alfeizar + h.alto, hueco: h });
          }
        }
        tramos.push({
          estancia: e.id, a: pa, b: pb, dir, n, largo: t2 - t1, u0: u0 + t1,
          elemento: c?.elemento ?? null,
          adelanto: Math.max(0, c?.cara ?? 0),
          huecos,
          inicioEnEsquina: t1 < 1e-6,
          finEnEsquina: t2 > largo - 1e-6,
        });
      };
      for (let k = 0; k + 1 < orden.length; k++) {
        const medioT = (orden[k] + orden[k + 1]) / 2;
        let mejor: Candidato | null = null;
        for (const c of candidatos) {
          if (medioT < c.intervalo[0] || medioT > c.intervalo[1]) continue;
          if (!mejor || Math.abs(c.cara) < Math.abs(mejor.cara)) mejor = c;
        }
        if (actual && actual.c === mejor) actual.t2 = orden[k + 1];
        else { cerrar(); actual = { c: mejor, t1: orden[k], t2: orden[k + 1] }; }
      }
      cerrar();
    }
  }
  return tramos;
}

/** Lado de una pared, visto caminando de "desde" a "hasta". */
export type Lado = 'izquierda' | 'derecha';

/** Normal unitaria de una pared hacia su lado izquierdo (caminando de "desde" a "hasta"). */
export function normalIzquierda(p: Pared): Punto {
  const l = largoPared(p) || 1;
  return [(p.hasta[1] - p.desde[1]) / l, -(p.hasta[0] - p.desde[0]) / l];
}

/** ¿A qué lado de la pared queda la estancia de este tramo? */
export function ladoDe(p: Pared, tramo: TramoCara): Lado {
  const ni = normalIzquierda(p);
  return tramo.n[0] * ni[0] + tramo.n[1] * ni[1] > 0 ? 'izquierda' : 'derecha';
}

/** Estancias que dan a cada lado de cada pared (ids de pared → ids de estancia). */
export function estanciasPorLado(v: Vivienda): Map<string, Record<Lado, string[]>> {
  const r = new Map<string, Record<Lado, string[]>>();
  for (const p of v.paredes) r.set(p.id, { izquierda: [], derecha: [] });
  for (const e of v.estancias) {
    for (const t of carasDeEstancia(v, e)) {
      if (t.elemento?.tipo !== 'pared') continue;
      const p = v.paredes.find((x) => x.id === t.elemento!.id)!;
      const lista = r.get(p.id)![ladoDe(p, t)];
      if (!lista.includes(e.id)) lista.push(e.id);
    }
  }
  return r;
}

/**
 * Trozo de un tramo que cae dentro de una zona rectangular [x1, z1, x2, z2]
 * (con 2 cm de margen), como intervalo a lo largo del tramo; null si no la toca.
 */
export function tramoEnZona(t: TramoCara, zona: [number, number, number, number]): Intervalo | null {
  const m = 0.02;
  const minX = Math.min(zona[0], zona[2]) - m, maxX = Math.max(zona[0], zona[2]) + m;
  const minZ = Math.min(zona[1], zona[3]) - m, maxZ = Math.max(zona[1], zona[3]) + m;
  let t1 = 0, t2 = t.largo;
  // Recorte del segmento contra la caja, eje por eje (Liang–Barsky).
  for (const [p0, d, lo, hi] of [[t.a[0], t.dir[0], minX, maxX], [t.a[1], t.dir[1], minZ, maxZ]] as const) {
    if (Math.abs(d) < 1e-9) {
      if (p0 < lo || p0 > hi) return null;
    } else {
      const ta = (lo - p0) / d, tb = (hi - p0) / d;
      t1 = Math.max(t1, Math.min(ta, tb));
      t2 = Math.min(t2, Math.max(ta, tb));
    }
  }
  return t2 - t1 > 1e-6 ? [t1, t2] : null;
}

/** Lados que dos estancias comparten sin muro entre ellas (p. ej. el paso del salón a la cocina). */
export function ladosCompartidos(v: Vivienda): { a: Punto; b: Punto; estancias: [string, string] }[] {
  const r: { a: Punto; b: Punto; estancias: [string, string] }[] = [];
  v.estancias.forEach((e1, i) => {
    e1.poligono.forEach((a, k) => {
      const b = e1.poligono[(k + 1) % e1.poligono.length];
      const largo = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (largo < 1e-6) return;
      const dir: Punto = [(b[0] - a[0]) / largo, (b[1] - a[1]) / largo];
      const aLoLargo = (p: Punto) => (p[0] - a[0]) * dir[0] + (p[1] - a[1]) * dir[1];
      const fuera = (p: Punto) => Math.abs(-(p[0] - a[0]) * dir[1] + (p[1] - a[1]) * dir[0]);
      for (const e2 of v.estancias.slice(i + 1)) {
        e2.poligono.forEach((p, m) => {
          const q = e2.poligono[(m + 1) % e2.poligono.length];
          if (fuera(p) > TOL_LINEA || fuera(q) > TOL_LINEA) return;
          const t1 = Math.max(0, Math.min(aLoLargo(p), aLoLargo(q))), t2 = Math.min(largo, Math.max(aLoLargo(p), aLoLargo(q)));
          if (t2 - t1 > 0.01) {
            r.push({
              a: [a[0] + dir[0] * t1, a[1] + dir[1] * t1], b: [a[0] + dir[0] * t2, a[1] + dir[1] * t2],
              estancias: [e1.id, e2.id],
            });
          }
        });
      }
    });
  });
  return r;
}
