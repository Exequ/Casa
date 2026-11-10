// Dónde se pueden colgar cuadros y espejos.
//
// Un objeto de pared vive en una "cara colgable": el trozo de pared (o pilar)
// que da a una estancia interior, sacado de las caras de `caras.ts`. En esa
// cara se mide con dos números: `u`, la distancia a lo largo de la cara hasta
// el centro del objeto, e `y`, la altura de su centro sobre el suelo.
//
// Un objeto de pared está bien colocado si:
//   - no se sale de la cara (ni por los lados, ni por el suelo, ni por el techo);
//   - no tapa ninguna puerta ni ventana (con su tapajuntas o marco alrededor);
//   - no se solapa con otro objeto colgado en la misma pared de la misma estancia.
//
// Solo geometría en planta y alturas: sin 3D ni DOM.

import { carasDeEstancia } from './caras';
import { alturaEstancia, type Punto, type Vivienda } from './modelo';

/** Margen alrededor de los huecos: el tapajuntas de las puertas y el marco de las ventanas (m). */
export const MARGEN_HUECO = { puerta: 0.07, ventana: 0.03 };
/** Separación entre la trasera del objeto y la pared (m). */
export const SEPARACION_PARED = 0.003;
/** Una cara más corta que esto no admite objetos (m). */
const LARGO_MINIMO = 0.15;
const EPS = 1e-6;

export interface CaraColgable {
  /** Identificador estable de la cara: estancia|elemento|número. */
  clave: string;
  estancia: string;
  /** Pared o pilar al que pertenece: "pared:<id>" o "pilar:<id>". */
  elemento: string;
  /** Inicio de la cara en planta y dirección unitaria a lo largo de ella. */
  a: Punto;
  dir: Punto;
  /** Normal unitaria hacia dentro de la estancia. */
  n: Punto;
  largo: number;
  /** Distancia desde el lado del polígono hasta la superficie de la pared (m). */
  adelanto: number;
  /** Altura del techo de la estancia (m). */
  alto: number;
  /** Rectángulos prohibidos (huecos con su margen), en coordenadas de la cara. */
  huecos: { desde: number; hasta: number; abajo: number; arriba: number }[];
}

/** Un rectángulo colgado en una cara: centro (u, y) y tamaño (ancho × alto). */
export interface RectPared {
  cara: CaraColgable;
  u: number;
  y: number;
  ancho: number;
  alto: number;
}

/** Caras de pared de las estancias interiores donde se puede colgar algo. */
export function carasColgables(v: Vivienda): CaraColgable[] {
  const caras: CaraColgable[] = [];
  for (const e of v.estancias) {
    if (e.exterior) continue;
    const alto = alturaEstancia(e, v);
    carasDeEstancia(v, e).forEach((t, i) => {
      if (!t.elemento || t.largo < LARGO_MINIMO) return;
      if (t.elemento.tipo === 'pared' && v.paredes.find((p) => p.id === t.elemento!.id)?.tipo === 'barandilla') return;
      const elemento = `${t.elemento.tipo}:${t.elemento.id}`;
      caras.push({
        clave: `${e.id}|${elemento}|${i}`,
        estancia: e.id,
        elemento,
        a: t.a,
        dir: t.dir,
        n: t.n,
        largo: t.largo,
        adelanto: t.adelanto,
        alto,
        huecos: t.huecos.map((h) => {
          const m = h.hueco.tipo === 'puerta' ? MARGEN_HUECO.puerta : MARGEN_HUECO.ventana;
          return { desde: h.desde - m, hasta: h.hasta + m, abajo: Math.max(0, h.abajo - m), arriba: h.arriba + m };
        }),
      });
    });
  }
  return caras;
}

/** ¿Están dos caras en la misma pared de la misma estancia (mismo plano, mirando al mismo lado)? */
function mismoPlano(c1: CaraColgable, c2: CaraColgable): boolean {
  if (c1 === c2) return true;
  if (c1.estancia !== c2.estancia) return false;
  if (Math.abs(c1.n[0] * c2.n[0] + c1.n[1] * c2.n[1] - 1) > 1e-6) return false;
  // Distancia de un punto de la superficie de c2 al plano de c1
  const p1: Punto = [c1.a[0] + c1.n[0] * c1.adelanto, c1.a[1] + c1.n[1] * c1.adelanto];
  const p2: Punto = [c2.a[0] + c2.n[0] * c2.adelanto, c2.a[1] + c2.n[1] * c2.adelanto];
  return Math.abs((p2[0] - p1[0]) * c1.n[0] + (p2[1] - p1[1]) * c1.n[1]) < 0.01;
}

/** Posición `u` de un rectángulo de otra cara medida en las coordenadas de `cara`. */
function uEn(cara: CaraColgable, r: RectPared): number {
  const x = r.cara.a[0] + r.cara.dir[0] * r.u - cara.a[0];
  const z = r.cara.a[1] + r.cara.dir[1] * r.u - cara.a[1];
  return x * cara.dir[0] + z * cara.dir[1];
}

/** Motivo por el que un rectángulo no vale (o null si vale). */
export function problemaEnPared(r: RectPared, otros: RectPared[] = []): 'fuera' | 'hueco' | 'solape' | null {
  const { cara, u, y, ancho, alto } = r;
  const u1 = u - ancho / 2, u2 = u + ancho / 2, y1 = y - alto / 2, y2 = y + alto / 2;
  if (u1 < -EPS || u2 > cara.largo + EPS || y1 < -EPS || y2 > cara.alto + EPS) return 'fuera';
  for (const h of cara.huecos) {
    if (u1 < h.hasta - EPS && u2 > h.desde + EPS && y1 < h.arriba - EPS && y2 > h.abajo + EPS) return 'hueco';
  }
  for (const o of otros) {
    if (!mismoPlano(cara, o.cara)) continue;
    const uo = uEn(cara, o);
    if (Math.abs(uo - u) < (ancho + o.ancho) / 2 - EPS && Math.abs(o.y - y) < (alto + o.alto) / 2 - EPS) return 'solape';
  }
  return null;
}

export const validoEnPared = (r: RectPared, otros: RectPared[] = []) => problemaEnPared(r, otros) === null;

/**
 * La posición `u` válida más cercana a la pedida en esa cara (a la altura
 * dada), buscando en pasos de 1 cm. Null si en esa cara no cabe a esa altura.
 */
export function buscarEnCara(r: RectPared, otros: RectPared[] = []): number | null {
  const { cara, ancho } = r;
  if (cara.largo < ancho - EPS) return null;
  const min = ancho / 2, max = cara.largo - ancho / 2;
  const u0 = Math.min(max, Math.max(min, r.u));
  for (let d = 0; d <= cara.largo + 0.01; d += 0.01) {
    for (const u of d === 0 ? [u0] : [u0 - d, u0 + d]) {
      if (u < min - EPS || u > max + EPS) continue;
      if (validoEnPared({ ...r, u }, otros)) return u;
    }
  }
  return null;
}

/** Altura del centro limitada para que el objeto no se salga por el suelo ni por el techo. */
export function limitarAltura(cara: CaraColgable, y: number, alto: number): number {
  return Math.min(cara.alto - alto / 2, Math.max(alto / 2, y));
}

/**
 * Dónde queda el objeto en el mundo: posición de su base (centro de la base,
 * como todos los objetos) y giro en Y (radianes) para que su frente (+Z) mire
 * a la estancia.
 */
export function puntoEnPared(cara: CaraColgable, u: number, y: number, alto: number, fondo: number) {
  const d = cara.adelanto + SEPARACION_PARED + fondo / 2;
  return {
    x: cara.a[0] + cara.dir[0] * u + cara.n[0] * d,
    y: y - alto / 2,
    z: cara.a[1] + cara.dir[1] * u + cara.n[1] * d,
    giro: Math.atan2(cara.n[0], cara.n[1]),
  };
}

/** Distancia de un punto en planta a una cara, y la `u` del punto más cercano de la cara. */
export function distanciaACara(cara: CaraColgable, x: number, z: number): { distancia: number; u: number } {
  const t = (x - cara.a[0]) * cara.dir[0] + (z - cara.a[1]) * cara.dir[1];
  const u = Math.min(cara.largo, Math.max(0, t));
  const px = cara.a[0] + cara.dir[0] * u, pz = cara.a[1] + cara.dir[1] * u;
  return { distancia: Math.hypot(x - px, z - pz), u };
}

/**
 * La cara más cercana a un punto del suelo. Con `estancia`, solo las de esa
 * estancia; además, solo las que miran hacia el punto (el punto está delante).
 */
export function caraMasCercana(caras: CaraColgable[], x: number, z: number, estancia: string | null = null) {
  let mejor: { cara: CaraColgable; u: number; distancia: number } | null = null;
  for (const cara of caras) {
    if (estancia && cara.estancia !== estancia) continue;
    const delante = (x - cara.a[0]) * cara.n[0] + (z - cara.a[1]) * cara.n[1];
    if (delante < -0.05) continue;
    const { distancia, u } = distanciaACara(cara, x, z);
    if (!mejor || distancia < mejor.distancia) mejor = { cara, u, distancia };
  }
  return mejor;
}

/**
 * Primera cara que corta un rayo (origen y dirección en 3D) por su lado de
 * delante. `usar` permite descartar caras (p. ej. las de muros bajados).
 */
export function caraEnRayo(
  caras: CaraColgable[],
  origen: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  usar: (c: CaraColgable) => boolean = () => true,
) {
  let mejor: { cara: CaraColgable; u: number; y: number; t: number } | null = null;
  for (const cara of caras) {
    const den = dir.x * cara.n[0] + dir.z * cara.n[1];
    if (den >= -1e-9) continue; // la mira por detrás o de canto
    const px = cara.a[0] + cara.n[0] * cara.adelanto, pz = cara.a[1] + cara.n[1] * cara.adelanto;
    const t = ((px - origen.x) * cara.n[0] + (pz - origen.z) * cara.n[1]) / den;
    if (t <= 0 || (mejor && t >= mejor.t)) continue;
    const hx = origen.x + dir.x * t, hy = origen.y + dir.y * t, hz = origen.z + dir.z * t;
    const u = (hx - cara.a[0]) * cara.dir[0] + (hz - cara.a[1]) * cara.dir[1];
    if (u < 0 || u > cara.largo || hy < 0 || hy > cara.alto) continue;
    if (!usar(cara)) continue;
    mejor = { cara, u, y: hy, t };
  }
  return mejor;
}
