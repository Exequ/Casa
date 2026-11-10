// Formato de data/vivienda.json y su validación.
//
// Coordenadas en METROS, vistas en planta como en el plano:
//   [x, z]  →  x hacia la derecha del plano, z hacia abajo del plano.
// En 3D, x y z son los mismos ejes y la altura es y (el suelo es y = 0).
//
// El formato completo está explicado en el README (sección "Formato de vivienda.json").

import { validarFijos, type Fijo } from './fijos';
import { validarAcabado, type AcabadoEstancia, type Aplique } from './acabados';
import { validarSuelo, type Suelo } from './suelos';

/** Punto en planta: [x, z] en metros. */
export type Punto = [number, number];

export interface Estancia {
  id: string;
  nombre: string;
  /** Esquinas del suelo, en orden (horario o antihorario), siguiendo la cara interior de los muros. */
  poligono: Punto[];
  /** Altura libre de techo (m). Si no se indica, se usa la de la vivienda. */
  alturaTecho?: number;
  /** true para balcones/terrazas (sin techo). */
  exterior?: boolean;
  /** Superficie útil que indica el plano (m²), solo para comprobar. */
  superficiePlano?: number;
  /** Suelo (tipo, color y escala). Si no se indica, uno por defecto según la estancia. */
  suelo?: Suelo;
  /** Acabados de las paredes: pintura, revestimientos y rodapié. */
  acabado?: AcabadoEstancia;
  /** Focos empotrados en el techo: posiciones [x, z]. */
  focos?: Punto[];
  /** Apliques lineales de pared. */
  apliques?: Aplique[];
}

/**
 * Carpintería de un hueco:
 * - `puerta-blanca`: puerta lacada blanca con tapajuntas (por defecto en las puertas).
 * - `puerta-entrada`: como la anterior, con mirilla.
 * - `puerta-vidriera`: puerta de madera oscura con vidrio.
 * - `ventana`: ventana o balconera de madera oscura con hojas de vidrio (por defecto en las ventanas).
 * - `fijo`: paño fijo acristalado con marco de madera.
 * - `lamas`: celosía de lamas horizontales de aluminio negro.
 */
export type EstiloHueco = 'puerta-blanca' | 'puerta-entrada' | 'puerta-vidriera' | 'ventana' | 'fijo' | 'lamas';
export const ESTILOS_HUECO: EstiloHueco[] = ['puerta-blanca', 'puerta-entrada', 'puerta-vidriera', 'ventana', 'fijo', 'lamas'];

export interface Hueco {
  tipo: 'puerta' | 'ventana';
  nombre?: string;
  /** Distancia (m) desde el punto `desde` de la pared hasta el borde del hueco. */
  distancia: number;
  /** Ancho del hueco (m), medido a lo largo de la pared. */
  ancho: number;
  /** Alto del hueco (m). */
  alto: number;
  /** Altura del alféizar (m): 0 en puertas y puertas-ventana. */
  alfeizar: number;
  /** Carpintería. Por defecto: `puerta-blanca` en puertas y `ventana` en ventanas. */
  estilo?: EstiloHueco;
  /** Número de hojas o paños en que se reparte el ancho. Por defecto 1. */
  hojas?: number;
  /** Altura (m, desde el suelo) de un travesaño horizontal que parte el hueco en dos. */
  travesano?: number;
  /**
   * Puertas: extremo donde están las bisagras (`desde` = el más cercano al
   * punto "desde" de la pared) y lado hacia el que abre, visto caminando de
   * "desde" a "hasta". Por defecto: `desde` e `izquierda`.
   */
  bisagra?: 'desde' | 'hasta';
  abre?: 'izquierda' | 'derecha';
  /** true = cortina de tela hasta el suelo por el lado interior. */
  cortina?: boolean;
}

export interface Pared {
  id: string;
  nombre?: string;
  /** Extremos del EJE CENTRAL de la pared. */
  desde: Punto;
  hasta: Punto;
  /** Grosor (m); la pared se extiende grosor/2 a cada lado del eje. */
  grosor: number;
  /**
   * Altura (m). Si no se indica, la mayor altura de techo de las estancias
   * que toca (o la de la vivienda si no toca ninguna).
   */
  alto?: number;
  /** `barandilla` = barrotes verticales (no es un muro macizo). Por defecto `muro`. */
  tipo?: 'muro' | 'barandilla';
  huecos?: Hueco[];
}

/** Pilar o patinillo: bloque macizo de suelo a techo, rectángulo alineado con los ejes. */
export interface Pilar {
  id: string;
  /** Dos esquinas opuestas. */
  desde: Punto;
  hasta: Punto;
}

export interface Plano {
  /** Ruta de la imagen del plano (relativa a la raíz del proyecto). */
  imagen: string;
  /** Escala de la imagen. */
  pixelesPorMetro: number;
  /** Píxel de la imagen que corresponde al punto (0, 0). */
  origenPx: [number, number];
  anchoPx: number;
  altoPx: number;
}

export interface Vivienda {
  nombre: string;
  /** Altura de techo por defecto (m). */
  alturaTecho: number;
  plano?: Plano;
  estancias: Estancia[];
  paredes: Pared[];
  pilares?: Pilar[];
  /** Elementos fijos: cocina, baño, armario empotrado, aire acondicionado (ver vivienda/fijos.ts). */
  fijos?: Fijo[];
  /** Notas sobre lo que se ha supuesto al pasar el plano a datos. */
  suposiciones?: string[];
}

const esNumero = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const esPunto = (p: unknown): p is Punto => Array.isArray(p) && p.length === 2 && esNumero(p[0]) && esNumero(p[1]);

/** Largo de una pared (m). */
export function largoPared(p: Pared): number {
  return Math.hypot(p.hasta[0] - p.desde[0], p.hasta[1] - p.desde[1]);
}

/** Tolerancia para decidir que el borde de una estancia toca una pared o un pilar (m). */
const TOL_CONTACTO = 0.03;

/**
 * Estancias interiores (con techo) que tocan una pared: las que tienen un
 * lado paralelo a la pared, pegado a una de sus caras y a lo largo de ella.
 */
export function estanciasDePared(p: Pared, v: Vivienda): Estancia[] {
  const largo = largoPared(p);
  if (largo <= 0) return [];
  const ux = (p.hasta[0] - p.desde[0]) / largo, uz = (p.hasta[1] - p.desde[1]) / largo;
  const local = ([x, z]: Punto) => {
    const dx = x - p.desde[0], dz = z - p.desde[1];
    return { u: dx * ux + dz * uz, n: -dx * uz + dz * ux }; // a lo largo / a lo ancho
  };
  return v.estancias.filter((e) => !e.exterior && e.poligono.some((a, i) => {
    const la = local(a), lb = local(e.poligono[(i + 1) % e.poligono.length]);
    const paralelo = Math.abs(la.n - lb.n) < 1e-3;
    const pegado = Math.abs(Math.abs(la.n) - p.grosor / 2) <= TOL_CONTACTO;
    const solape = Math.min(largo, Math.max(la.u, lb.u)) - Math.max(0, Math.min(la.u, lb.u));
    return paralelo && pegado && solape > 0.01;
  }));
}

/**
 * Altura efectiva de una pared (m): la suya si la tiene; si no, la mayor
 * altura de techo de las estancias que toca; si no toca ninguna, la de la vivienda.
 */
export function altoPared(p: Pared, v: Vivienda): number {
  if (p.alto !== undefined) return p.alto;
  const alturas = estanciasDePared(p, v).map((e) => alturaEstancia(e, v));
  return alturas.length ? Math.max(...alturas) : v.alturaTecho;
}

/** Altura de un pilar (m): la mayor altura de techo de las estancias que lo rodean. */
export function altoPilar(p: Pilar, v: Vivienda): number {
  const minX = Math.min(p.desde[0], p.hasta[0]) - TOL_CONTACTO, maxX = Math.max(p.desde[0], p.hasta[0]) + TOL_CONTACTO;
  const minZ = Math.min(p.desde[1], p.hasta[1]) - TOL_CONTACTO, maxZ = Math.max(p.desde[1], p.hasta[1]) + TOL_CONTACTO;
  const alturas = v.estancias
    .filter((e) => !e.exterior && e.poligono.some(([x, z]) => x >= minX && x <= maxX && z >= minZ && z <= maxZ))
    .map((e) => alturaEstancia(e, v));
  return alturas.length ? Math.max(...alturas) : v.alturaTecho;
}

/** Altura de techo efectiva de una estancia (m). */
export function alturaEstancia(e: Estancia, v: Vivienda): number {
  return e.alturaTecho ?? v.alturaTecho;
}

/**
 * Comprueba que la vivienda tiene un formato correcto.
 * Devuelve la lista de errores (vacía si todo está bien).
 */
export function validarVivienda(v: Vivienda): string[] {
  const errores: string[] = [];
  if (!v || typeof v !== 'object') return ['vivienda.json no es un objeto'];
  if (!(esNumero(v.alturaTecho) && v.alturaTecho > 0)) errores.push('"alturaTecho" debe ser un número > 0');
  if (!Array.isArray(v.estancias) || v.estancias.length === 0) errores.push('"estancias" debe ser una lista no vacía');
  if (!Array.isArray(v.paredes)) errores.push('"paredes" debe ser una lista');

  const ids = new Set<string>();
  const idUnico = (id: string, donde: string) => {
    if (typeof id !== 'string' || !id) errores.push(`${donde}: falta "id"`);
    else if (ids.has(id)) errores.push(`${donde}: el id "${id}" está repetido`);
    else ids.add(id);
  };

  for (const [i, e] of (v.estancias ?? []).entries()) {
    const donde = `estancia ${e?.id ?? i}`;
    idUnico(e?.id, donde);
    if (typeof e?.nombre !== 'string') errores.push(`${donde}: falta "nombre"`);
    if (!Array.isArray(e?.poligono) || e.poligono.length < 3 || !e.poligono.every(esPunto)) {
      errores.push(`${donde}: "poligono" debe tener al menos 3 puntos [x, z]`);
    }
    if (e?.alturaTecho !== undefined && !(esNumero(e.alturaTecho) && e.alturaTecho > 0)) {
      errores.push(`${donde}: "alturaTecho" debe ser > 0`);
    }
    if (e?.suelo !== undefined) {
      const error = validarSuelo(e.suelo);
      if (error) errores.push(`${donde}: ${error}`);
    }
    if (e?.acabado !== undefined) errores.push(...validarAcabado(e.acabado).map((x) => `${donde}: ${x}`));
    if (e?.focos !== undefined && !(Array.isArray(e.focos) && e.focos.every(esPunto))) {
      errores.push(`${donde}: "focos" debe ser una lista de puntos [x, z]`);
    }
    for (const [k, a] of (e?.apliques ?? []).entries()) {
      if (!esPunto(a?.desde) || !esPunto(a?.hasta) || !esNumero(a?.altura)) errores.push(`${donde}: aplique ${k} necesita "desde", "hasta" y "altura"`);
    }
  }

  for (const [i, p] of (v.paredes ?? []).entries()) {
    const donde = `pared ${p?.id ?? i}`;
    idUnico(p?.id, donde);
    if (!esPunto(p?.desde) || !esPunto(p?.hasta)) {
      errores.push(`${donde}: "desde" y "hasta" deben ser puntos [x, z]`);
      continue;
    }
    const largo = largoPared(p);
    if (largo <= 0) errores.push(`${donde}: tiene largo 0`);
    if (!(esNumero(p.grosor) && p.grosor > 0)) errores.push(`${donde}: "grosor" debe ser > 0`);
    if (p.tipo !== undefined && p.tipo !== 'muro' && p.tipo !== 'barandilla') errores.push(`${donde}: "tipo" debe ser "muro" o "barandilla"`);
    const alto = altoPared(p, v);
    for (const [j, h] of (p.huecos ?? []).entries()) {
      const dh = `${donde}, hueco ${h?.nombre ?? j}`;
      if (h?.tipo !== 'puerta' && h?.tipo !== 'ventana') errores.push(`${dh}: "tipo" debe ser "puerta" o "ventana"`);
      if (![h?.distancia, h?.ancho, h?.alto, h?.alfeizar].every(esNumero)) {
        errores.push(`${dh}: faltan "distancia", "ancho", "alto" o "alfeizar"`);
        continue;
      }
      if (h.distancia < 0 || h.ancho <= 0 || h.distancia + h.ancho > largo + 1e-6) {
        errores.push(`${dh}: se sale de la pared (largo ${largo.toFixed(2)} m)`);
      }
      if (h.alfeizar < 0 || h.alto <= 0 || h.alfeizar + h.alto > alto + 1e-6) {
        errores.push(`${dh}: alféizar + alto supera la altura de la pared (${alto} m)`);
      }
      if (h.estilo !== undefined && !ESTILOS_HUECO.includes(h.estilo)) errores.push(`${dh}: "estilo" debe ser uno de: ${ESTILOS_HUECO.join(', ')}`);
      if (h.hojas !== undefined && !(Number.isInteger(h.hojas) && h.hojas >= 1 && h.hojas <= 8)) errores.push(`${dh}: "hojas" debe ser un entero entre 1 y 8`);
      if (h.travesano !== undefined && !(esNumero(h.travesano) && h.travesano > h.alfeizar && h.travesano < h.alfeizar + h.alto)) {
        errores.push(`${dh}: "travesano" debe quedar dentro del hueco`);
      }
      if (h.bisagra !== undefined && h.bisagra !== 'desde' && h.bisagra !== 'hasta') errores.push(`${dh}: "bisagra" debe ser "desde" o "hasta"`);
      if (h.abre !== undefined && h.abre !== 'izquierda' && h.abre !== 'derecha') errores.push(`${dh}: "abre" debe ser "izquierda" o "derecha"`);
    }
  }

  for (const [i, p] of (v.pilares ?? []).entries()) {
    const donde = `pilar ${p?.id ?? i}`;
    idUnico(p?.id, donde);
    if (!esPunto(p?.desde) || !esPunto(p?.hasta)) errores.push(`${donde}: "desde" y "hasta" deben ser puntos [x, z]`);
  }

  // Los huecos de una misma pared no deben solaparse.
  for (const p of v.paredes ?? []) {
    const hs = [...(p.huecos ?? [])].sort((a, b) => a.distancia - b.distancia);
    for (let k = 1; k < hs.length; k++) {
      if (hs[k].distancia < hs[k - 1].distancia + hs[k - 1].ancho - 1e-6) {
        errores.push(`pared ${p.id}: los huecos "${hs[k - 1].nombre ?? k - 1}" y "${hs[k].nombre ?? k}" se solapan`);
      }
    }
  }
  errores.push(...validarFijos(v));
  return errores;
}

/** Estilo de carpintería de un hueco (el indicado o el de por defecto según su tipo). */
export function estiloDe(h: Hueco): EstiloHueco {
  return h.estilo ?? (h.tipo === 'puerta' ? 'puerta-blanca' : 'ventana');
}
