// Formato de data/vivienda.json y su validación.
//
// Coordenadas en METROS, vistas en planta como en el plano:
//   [x, z]  →  x hacia la derecha del plano, z hacia abajo del plano.
// En 3D, x y z son los mismos ejes y la altura es y (el suelo es y = 0).
//
// El formato completo está explicado en el README (sección "Formato de vivienda.json").

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
}

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
}

export interface Pared {
  id: string;
  nombre?: string;
  /** Extremos del EJE CENTRAL de la pared. */
  desde: Punto;
  hasta: Punto;
  /** Grosor (m); la pared se extiende grosor/2 a cada lado del eje. */
  grosor: number;
  /** Altura (m). Si no se indica, la altura de techo de la vivienda. */
  alto?: number;
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
  /** Notas sobre lo que se ha supuesto al pasar el plano a datos. */
  suposiciones?: string[];
}

const esNumero = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const esPunto = (p: unknown): p is Punto => Array.isArray(p) && p.length === 2 && esNumero(p[0]) && esNumero(p[1]);

/** Largo de una pared (m). */
export function largoPared(p: Pared): number {
  return Math.hypot(p.hasta[0] - p.desde[0], p.hasta[1] - p.desde[1]);
}

/** Altura efectiva de una pared (m). */
export function altoPared(p: Pared, v: Vivienda): number {
  return p.alto ?? v.alturaTecho;
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
    const alto = p.alto ?? v.alturaTecho;
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
  return errores;
}
