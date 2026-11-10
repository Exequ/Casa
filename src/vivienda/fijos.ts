// Elementos fijos de la vivienda: cocina, baño, armario empotrado y aire
// acondicionado. No son objetos del catálogo: forman parte de la vivienda, no
// se seleccionan, no se mueven ni se borran, y los muebles no pueden
// atravesarlos.
//
// Cada fijo es una caja (en `data/vivienda.json`, sección "fijos"):
//   - `posicion` [x, z]: centro de su base en planta (m);
//   - `altura`: altura de su base sobre el suelo (m; 0 = apoyado en el suelo);
//   - `giro`: 0, 90, 180 o 270 grados, como los muebles (0 = el frente mira
//     hacia +z, 90 = hacia +x, 180 = hacia −z, 270 = hacia −x);
//   - `dimensiones`: ancho (de lado a lado, visto de frente), fondo y alto (m).
// Lo que tiene dentro (puertas, cajones, horno, grifos...) lo dibuja el código
// de cada `tipo` (src/escena/fijos3d.ts) dentro de esa caja.
//
// Choques:
//   - Los fijos del suelo (base por debajo de 0,5 m) son obstáculo para todos
//     los muebles, como una pared más.
//   - Los colgados (base a 0,5 m o más: armarios altos, espejo, aire
//     acondicionado) solo estorban a los muebles más altos que su base.
//   - Ningún cuadro ni espejo del catálogo puede colgarse donde hay un fijo
//     pegado a la pared.
//
// Solo datos y geometría en planta: sin 3D ni DOM.

import { caja, convexosSeSolapan, encoger, huellaRectangulo, puntoEnPoligono, segmentoTocaConvexo } from './geometria';
import { alturaEstancia, largoPared, type Punto, type Vivienda } from './modelo';
import type { CaraColgable, RectPared } from './colgar';

export const TIPOS_FIJO = [
  // Cocina
  'cocina-bajo', 'cocina-alto', 'columna-frigorifico',
  // Baño
  'plato-ducha', 'mampara', 'barra', 'griferia-ducha', 'mueble-lavabo', 'inodoro', 'bide', 'espejo',
  // Dormitorio
  'armario-empotrado',
  // Aire acondicionado
  'split-interior', 'split-exterior',
] as const;
export type TipoFijo = (typeof TIPOS_FIJO)[number];

/** Módulos de un mueble de cocina (de izquierda a derecha, visto de frente). */
export interface ModuloCocina {
  tipo: 'puertas' | 'cajones' | 'horno' | 'lavavajillas' | 'estantes' | 'campana' | 'relleno';
  ancho: number;
  /** Cajones: cuántos. Puertas: cuántas hojas. */
  n?: number;
  /** Horno: con placa de cocción encima. */
  placa?: boolean;
  /** Puertas: con fregadero bajo encimera y grifo encima. */
  fregadero?: boolean;
  /** Puerta sola: lado del tirador, visto de frente. */
  tirador?: 'izquierda' | 'derecha';
}

export interface Fijo {
  id: string;
  tipo: TipoFijo;
  nombre?: string;
  estancia: string;
  /** Centro de la base en planta [x, z] (m). */
  posicion: Punto;
  /** Altura de la base sobre el suelo (m). Por defecto 0. */
  altura?: number;
  /** Giro (grados): 0, 90, 180 o 270. Por defecto 0. */
  giro?: number;
  dimensiones: { ancho: number; fondo: number; alto: number };
  /** Pared a la que va unido (id de vivienda.json): se oculta con ella si se baja (colgados, armario empotrado). */
  pared?: string;
  /** Material principal (nombre libre, solo informativo: los colores los pone el código de cada tipo). */
  material?: string;
  /** Muebles de cocina: sus módulos. */
  modulos?: ModuloCocina[];
  /** Armario empotrado: número de puertas. */
  puertas?: number;
  /** Medidas: "estimadas" (fotos y plano) o "confirmadas". */
  medidas?: 'estimadas' | 'confirmadas';
}

/** Base por encima de la cual un fijo cuenta como colgado (m). */
export const ALTURA_COLGADO = 0.5;
const GIROS = [0, 90, 180, 270];

export const baseDe = (f: Fijo) => f.altura ?? 0;

/** Lo que el grifo del fregadero sobresale por encima de la encimera (m). */
export const ALTO_GRIFO = 0.31;
/** Alto total que ocupa: el de sus dimensiones más, en un mueble con fregadero, el grifo. */
export const altoTotal = (f: Fijo) =>
  f.dimensiones.alto + (f.tipo === 'cocina-bajo' && f.modulos?.some((m) => m.fregadero) ? ALTO_GRIFO : 0);
export const esColgado = (f: Fijo) => baseDe(f) >= ALTURA_COLGADO;

/** Rectángulo que ocupa en planta (4 esquinas). */
export function huellaFijo(f: Fijo): Punto[] {
  const g = ((f.giro ?? 0) * Math.PI) / 180;
  return huellaRectangulo(f.posicion[0], f.posicion[1], f.dimensiones.ancho, f.dimensiones.fondo, g);
}

/** Caja en el mundo (con el grifo, si lo hay): mínimos y máximos [x, y, z]. */
export function cajaFijo(f: Fijo): { min: [number, number, number]; max: [number, number, number] } {
  const c = caja(huellaFijo(f));
  return { min: [c.minX, baseDe(f), c.minZ], max: [c.maxX, baseDe(f) + altoTotal(f), c.maxZ] };
}

/** ¿Se cruzan dos cajas (con 1 mm de holgura, para que puedan tocarse)? */
export function cajasSeCruzan(
  a: { min: number[]; max: number[] }, b: { min: number[]; max: number[] }, holgura = 0.001,
): boolean {
  return [0, 1, 2].every((k) => a.min[k] < b.max[k] - holgura && b.min[k] < a.max[k] - holgura);
}

/** Obstáculos en planta: los del suelo siempre; los colgados, para muebles más altos que su base. */
export function obstaculosFijos(fijos: Fijo[]): { huella: Punto[]; base: number }[] {
  return fijos.map((f) => ({ huella: huellaFijo(f), base: baseDe(f) }));
}

/**
 * Rectángulos que ocupan los fijos en las caras de pared donde se cuelgan
 * cuadros (los que están pegados a ella, a menos de 5 cm): ahí no se puede colgar nada.
 */
export function rectsDeFijos(caras: CaraColgable[], fijos: Fijo[]): RectPared[] {
  const r: RectPared[] = [];
  for (const f of fijos) {
    const esquinas = huellaFijo(f);
    for (const cara of caras) {
      const px = cara.a[0] + cara.n[0] * cara.adelanto, pz = cara.a[1] + cara.n[1] * cara.adelanto;
      const d = esquinas.map(([x, z]) => (x - px) * cara.n[0] + (z - pz) * cara.n[1]);
      if (Math.min(...d) < -0.02 || Math.min(...d) > 0.05) continue;
      const u = esquinas.map(([x, z]) => (x - cara.a[0]) * cara.dir[0] + (z - cara.a[1]) * cara.dir[1]);
      const u1 = Math.max(0, Math.min(...u)), u2 = Math.min(cara.largo, Math.max(...u));
      if (u2 - u1 < 0.01) continue;
      r.push({ cara, u: (u1 + u2) / 2, ancho: u2 - u1, y: baseDe(f) + altoTotal(f) / 2, alto: altoTotal(f) });
    }
  }
  return r;
}

/**
 * Problemas de colocación de un fijo en la vivienda (lista vacía si está bien):
 * fuera de su estancia, atravesando una pared o un pilar, o tapando una
 * puerta o ventana.
 */
export function problemasDeFijo(v: Vivienda, f: Fijo): string[] {
  const p: string[] = [];
  const e = v.estancias.find((x) => x.id === f.estancia);
  if (!e) return [`${f.id}: la estancia "${f.estancia}" no existe`];
  const esquinas = encoger(huellaFijo(f), 0.001);
  if (!esquinas.every((q) => puntoEnPoligono(q, e.poligono, 1e-4))) p.push(`${f.id}: se sale de "${e.id}"`);
  for (let i = 0; i < e.poligono.length; i++) {
    if (segmentoTocaConvexo(e.poligono[i], e.poligono[(i + 1) % e.poligono.length], esquinas)) {
      p.push(`${f.id}: atraviesa una pared o un pilar de "${e.id}"`);
      break;
    }
  }
  // Huecos: el hueco de la pared, ampliado 3 cm hacia cada lado, no puede tocar la huella
  // del fijo si sus alturas se cruzan.
  const y1 = baseDe(f), y2 = y1 + altoTotal(f);
  for (const pared of v.paredes) {
    const largo = largoPared(pared);
    const ux = (pared.hasta[0] - pared.desde[0]) / largo, uz = (pared.hasta[1] - pared.desde[1]) / largo;
    for (const h of pared.huecos ?? []) {
      if (!(y1 < h.alfeizar + h.alto - 1e-6 && h.alfeizar < y2 - 1e-6)) continue;
      const t = h.distancia + h.ancho / 2;
      const zona = huellaRectangulo(
        pared.desde[0] + ux * t, pared.desde[1] + uz * t,
        h.ancho, pared.grosor + 0.06, Math.atan2(-uz, ux),
      );
      if (convexosSeSolapan(esquinas, zona)) p.push(`${f.id}: tapa el hueco "${h.nombre ?? h.tipo}" de "${pared.id}"`);
    }
  }
  return p;
}

const esNumero = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Errores de formato de la sección "fijos" de vivienda.json. */
export function validarFijos(v: Vivienda): string[] {
  const errores: string[] = [];
  if (v.fijos === undefined) return errores;
  if (!Array.isArray(v.fijos)) return ['"fijos" debe ser una lista'];
  const ids = new Set<string>();
  for (const [i, f] of v.fijos.entries()) {
    const d = `fijos[${i}]${f && typeof f.id === 'string' ? ` (${f.id})` : ''}`;
    if (!f || typeof f !== 'object') { errores.push(`${d}: no es un objeto`); continue; }
    if (typeof f.id !== 'string' || !f.id) errores.push(`${d}: falta "id"`);
    else if (ids.has(f.id)) errores.push(`${d}: el id está repetido`);
    else ids.add(f.id);
    if (!TIPOS_FIJO.includes(f.tipo)) errores.push(`${d}: "tipo" debe ser uno de: ${TIPOS_FIJO.join(', ')}`);
    const e = v.estancias?.find((x) => x.id === f.estancia);
    if (!e) errores.push(`${d}: la estancia "${String(f.estancia)}" no existe`);
    if (!(Array.isArray(f.posicion) && f.posicion.length === 2 && f.posicion.every(esNumero))) errores.push(`${d}: "posicion" debe ser [x, z]`);
    if (f.giro !== undefined && !GIROS.includes(f.giro)) errores.push(`${d}: "giro" debe ser 0, 90, 180 o 270`);
    if (f.altura !== undefined && !(esNumero(f.altura) && f.altura >= 0)) errores.push(`${d}: "altura" debe ser un número ≥ 0`);
    const dim = f.dimensiones;
    if (!dim || !(esNumero(dim.ancho) && dim.ancho > 0 && esNumero(dim.fondo) && dim.fondo > 0 && esNumero(dim.alto) && dim.alto > 0)) {
      errores.push(`${d}: "dimensiones" debe tener ancho, fondo y alto mayores que 0`);
    } else if (e && baseDe(f) + altoTotal(f) > alturaEstancia(e, v) + 1e-6) {
      errores.push(`${d}: llega más arriba que el techo de "${e.id}"`);
    }
    if (f.pared !== undefined && !v.paredes?.some((p) => p.id === f.pared)) errores.push(`${d}: la pared "${f.pared}" no existe`);
    if (f.modulos !== undefined) {
      if (!Array.isArray(f.modulos) || !f.modulos.every((m) => m && esNumero(m.ancho) && m.ancho > 0)) {
        errores.push(`${d}: "modulos" debe ser una lista con su "ancho"`);
      } else if (dim && Math.abs(f.modulos.reduce((s, m) => s + m.ancho, 0) - dim.ancho) > 0.005) {
        errores.push(`${d}: los anchos de "modulos" no suman el ancho del mueble`);
      }
    }
  }
  return errores;
}
