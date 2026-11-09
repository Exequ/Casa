// Geometría 2D en planta (x, z), sin dependencias de Three.js.

import type { Punto } from './modelo';

const EPS = 1e-9;

/** Área con signo (positiva si los puntos van en sentido antihorario en x→derecha, z→arriba). */
export function areaConSigno(p: Punto[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, z1] = p[i];
    const [x2, z2] = p[(i + 1) % p.length];
    s += x1 * z2 - x2 * z1;
  }
  return s / 2;
}

/** Área de un polígono (m²), fórmula del lazo. */
export function area(p: Punto[]): number {
  return Math.abs(areaConSigno(p));
}

/** Perímetro de un polígono (m). */
export function perimetro(p: Punto[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, z1] = p[i];
    const [x2, z2] = p[(i + 1) % p.length];
    s += Math.hypot(x2 - x1, z2 - z1);
  }
  return s;
}

/** Caja que envuelve una lista de puntos. */
export function caja(puntos: Punto[]) {
  const xs = puntos.map((p) => p[0]);
  const zs = puntos.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);
  return { minX, maxX, minZ, maxZ, ancho: maxX - minX, fondo: maxZ - minZ, centro: [(minX + maxX) / 2, (minZ + maxZ) / 2] as Punto };
}

/** Centroide (centro de masas) de un polígono. */
export function centroide(p: Punto[]): Punto {
  const a = areaConSigno(p);
  if (Math.abs(a) < EPS) return caja(p).centro;
  let cx = 0, cz = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, z1] = p[i];
    const [x2, z2] = p[(i + 1) % p.length];
    const f = x1 * z2 - x2 * z1;
    cx += (x1 + x2) * f;
    cz += (z1 + z2) * f;
  }
  return [cx / (6 * a), cz / (6 * a)];
}

/** Distancia de un punto a un segmento. */
export function distanciaASegmento(p: Punto, a: Punto, b: Punto): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz;
  const t = l2 < EPS ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz));
}

/**
 * ¿Está el punto dentro del polígono? Los puntos sobre el borde
 * (a menos de `tolerancia`) cuentan como dentro.
 */
export function puntoEnPoligono(pt: Punto, poli: Punto[], tolerancia = 1e-6): boolean {
  for (let i = 0; i < poli.length; i++) {
    if (distanciaASegmento(pt, poli[i], poli[(i + 1) % poli.length]) <= tolerancia) return true;
  }
  // Ray casting
  let dentro = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, zi] = poli[i];
    const [xj, zj] = poli[j];
    if ((zi > pt[1]) !== (zj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - zi)) / (zj - zi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Un punto adecuado para poner la etiqueta: el centroide si cae dentro; si no, el punto interior más centrado. */
export function puntoInterior(poli: Punto[]): Punto {
  const c = centroide(poli);
  if (puntoEnPoligono(c, poli, -1)) return c;
  // Buscamos en una rejilla el punto interior más alejado del borde.
  const b = caja(poli);
  let mejor: Punto = c, mejorDist = -Infinity;
  for (let i = 1; i < 20; i++) {
    for (let j = 1; j < 20; j++) {
      const p: Punto = [b.minX + (b.ancho * i) / 20, b.minZ + (b.fondo * j) / 20];
      if (!puntoEnPoligono(p, poli, -1)) continue;
      let d = Infinity;
      for (let k = 0; k < poli.length; k++) d = Math.min(d, distanciaASegmento(p, poli[k], poli[(k + 1) % poli.length]));
      if (d > mejorDist) { mejorDist = d; mejor = p; }
    }
  }
  return mejor;
}

/** Producto vectorial 2D de (b - a) x (c - a). */
function orientacion(a: Punto, b: Punto, c: Punto): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** ¿Se cortan los segmentos ab y cd? (incluye tocarse) */
export function segmentosSeCortan(a: Punto, b: Punto, c: Punto, d: Punto): boolean {
  const o1 = orientacion(a, b, c), o2 = orientacion(a, b, d);
  const o3 = orientacion(c, d, a), o4 = orientacion(c, d, b);
  if (((o1 > EPS && o2 < -EPS) || (o1 < -EPS && o2 > EPS)) && ((o3 > EPS && o4 < -EPS) || (o3 < -EPS && o4 > EPS))) return true;
  const enSegmento = (p: Punto, q: Punto, r: Punto) =>
    Math.min(p[0], q[0]) - EPS <= r[0] && r[0] <= Math.max(p[0], q[0]) + EPS &&
    Math.min(p[1], q[1]) - EPS <= r[1] && r[1] <= Math.max(p[1], q[1]) + EPS;
  if (Math.abs(o1) <= EPS && enSegmento(a, b, c)) return true;
  if (Math.abs(o2) <= EPS && enSegmento(a, b, d)) return true;
  if (Math.abs(o3) <= EPS && enSegmento(c, d, a)) return true;
  if (Math.abs(o4) <= EPS && enSegmento(c, d, b)) return true;
  return false;
}

/**
 * Esquinas del rectángulo que ocupa un objeto en planta.
 * Mismo convenio de giro que Three.js (rotation.y en radianes, positivo =
 * antihorario visto desde arriba).
 */
export function huellaRectangulo(cx: number, cz: number, ancho: number, fondo: number, giro: number): Punto[] {
  const c = Math.cos(giro), s = Math.sin(giro);
  const w = ancho / 2, d = fondo / 2;
  // local (lx, lz) → mundo (cx + c·lx + s·lz, cz − s·lx + c·lz)
  return ([[-w, -d], [w, -d], [w, d], [-w, d]] as Punto[]).map(([lx, lz]) => [cx + c * lx + s * lz, cz - s * lx + c * lz]);
}

/** ¿Está el punto estrictamente dentro de un polígono convexo? */
export function puntoEnConvexo(pt: Punto, poli: Punto[]): boolean {
  let signo = 0;
  for (let i = 0; i < poli.length; i++) {
    const o = orientacion(poli[i], poli[(i + 1) % poli.length], pt);
    if (Math.abs(o) <= EPS) return false;
    const s = Math.sign(o);
    if (signo === 0) signo = s;
    else if (s !== signo) return false;
  }
  return true;
}

/** ¿Toca el segmento ab el interior o el borde del polígono convexo? */
export function segmentoTocaConvexo(a: Punto, b: Punto, poli: Punto[]): boolean {
  if (puntoEnConvexo(a, poli) || puntoEnConvexo(b, poli)) return true;
  for (let i = 0; i < poli.length; i++) {
    if (segmentosSeCortan(a, b, poli[i], poli[(i + 1) % poli.length])) return true;
  }
  return false;
}

/** Encoge un polígono convexo hacia su centro una distancia aproximada `d`. */
export function encoger(poli: Punto[], d: number): Punto[] {
  const c = caja(poli).centro;
  return poli.map(([x, z]) => {
    const dx = x - c[0], dz = z - c[1];
    const l = Math.hypot(dx, dz) || 1;
    return [x - (dx / l) * d, z - (dz / l) * d];
  });
}
