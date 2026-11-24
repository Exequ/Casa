// Lectura del catálogo de objetos.
//
// El catálogo vive en la carpeta /catalogo (en la raíz del proyecto). Cada
// objeto son dos archivos:
//   - <id>.json  → ficha con nombre, categoría, dimensiones y ruta del glb
//   - <id>.glb   → modelo 3D
//
// Usamos `import.meta.glob` de Vite: al arrancar, Vite encuentra todos los
// .json y .glb de la carpeta (también en subcarpetas) y nos los entrega.
// En modo desarrollo, si añades un archivo nuevo la página se recarga sola.

/**
 * Dónde se coloca un objeto:
 *   - "suelo": en el suelo (muebles). Es lo que se usa si no se indica.
 *   - "pared": colgado en una pared (cuadros, espejos).
 *   - "superficie": apoyado sobre un mueble (jarrones, lámparas de mesa, la
 *     tele...). Si no hay ningún mueble libre, se queda en el suelo.
 */
export type Colocacion = 'suelo' | 'pared' | 'superficie';
export const COLOCACIONES: Colocacion[] = ['suelo', 'pared', 'superficie'];

/** Altura del centro de un objeto de pared si la ficha no dice otra (m). */
export const ALTURA_CENTRO_PARED = 1.5;

/**
 * Una tapa o balda de un mueble, en formato objeto (en la ficha). Medidas en
 * metros; el desplazamiento es el del centro de la superficie respecto al
 * centro del mueble, en sus ejes (X = ancho, Z = fondo; +Z = hacia el frente).
 */
export interface SuperficieFicha {
  altura: number;
  /** Por defecto, el ancho del mueble. */
  ancho?: number;
  /** Por defecto, el fondo del mueble. */
  fondo?: number;
  desplazamientoX?: number;
  desplazamientoZ?: number;
  /** Alto máximo de lo que se apoya. Por defecto, hasta la siguiente superficie del mueble (la de arriba, sin límite). */
  alturaLibre?: number;
}

/** Una tapa o balda ya resuelta (con los valores por defecto puestos). x y z: centro respecto al del mueble. */
export interface Superficie {
  altura: number;
  ancho: number;
  fondo: number;
  x: number;
  z: number;
  /** Infinity = sin límite. */
  alturaLibre: number;
}

/** Formato de la ficha JSON de un objeto del catálogo. */
export interface FichaObjeto {
  nombre: string;
  categoria: string;
  /** Dimensiones reales en metros. ancho = eje X, fondo = eje Z, alto = eje Y. */
  dimensiones: { ancho: number; fondo: number; alto: number };
  /** Ruta del .glb, relativa a la carpeta donde está el .json. */
  glb: string;
  /** Dónde se coloca. Por defecto "suelo". */
  colocacion?: Colocacion;
  /** Solo "pared": altura del centro del objeto sobre el suelo (m). Por defecto 1,50. */
  alturaCentro?: number;
  /**
   * Solo muebles de suelo: sus tapas o baldas, donde se pueden apoyar objetos
   * de "superficie". Cada una es un número (su altura en m: ocupa toda la
   * planta del mueble, con la altura libre por defecto, como siempre) o un
   * objeto SuperficieFicha (con su tamaño, posición y altura libre). Por defecto, el
   * borde superior del mueble. `[]` = no se puede apoyar nada encima (sofás,
   * sillas, lámparas...).
   */
  superficies?: (number | SuperficieFicha)[];
  /** "estimadas" (sacadas de fotos) o "confirmadas" (medidas de verdad). Solo informativo. */
  medidas?: 'estimadas' | 'confirmadas';
}

/** Un objeto del catálogo ya listo para usar en la app (con los valores por defecto puestos). */
export interface ItemCatalogo extends FichaObjeto {
  /** Identificador único: ruta del json sin extensión, p. ej. "mesa" o "salon/sofa". */
  id: string;
  /** URL final del .glb (la que entiende el navegador). */
  urlGlb: string;
  /** URL de la miniatura (<id>.png junto al .json), si existe. */
  urlMiniatura?: string;
  colocacion: Colocacion;
}

/** Altura del centro de un objeto de pared (la de su ficha o 1,50 m). */
export const alturaCentroDe = (item: FichaObjeto) => item.alturaCentro ?? ALTURA_CENTRO_PARED;

/** Alturas donde se pueden apoyar cosas sobre un mueble, de abajo arriba ([] si no es un mueble de suelo). */
export function superficiesDe(item: FichaObjeto): number[] {
  return zonasDe(item).map((z) => z.altura);
}

/**
 * Tapas y baldas de un mueble con todos sus datos (los que falten, con sus
 * valores por defecto), de abajo arriba. [] si no es un mueble de suelo.
 *   - número: su altura; toda la planta del mueble y la altura libre por
 *     defecto (igual que antes de que hubiera el formato objeto);
 *   - objeto: ancho y fondo (por defecto, los del mueble), centro desplazado
 *     (por defecto 0) y alturaLibre.
 * La alturaLibre por defecto es la distancia hasta la siguiente superficie
 * del mueble; la de más arriba no tiene límite.
 */
export function zonasDe(item: FichaObjeto): Superficie[] {
  if ((item.colocacion ?? 'suelo') !== 'suelo') return [];
  const d = item.dimensiones;
  const lista = Array.isArray(item.superficies) ? item.superficies : [d.alto];
  const ordenadas = lista
    .map((s): SuperficieFicha => (typeof s === 'number' ? { altura: s } : s))
    .sort((a, b) => a.altura - b.altura);
  return ordenadas.map((s, i): Superficie => {
    const siguiente = ordenadas.slice(i + 1).find((o) => o.altura > s.altura + 1e-9);
    return {
      altura: s.altura,
      ancho: s.ancho ?? d.ancho,
      fondo: s.fondo ?? d.fondo,
      x: s.desplazamientoX ?? 0,
      z: s.desplazamientoZ ?? 0,
      alturaLibre: s.alturaLibre ?? (siguiente ? siguiente.altura - s.altura : Infinity),
    };
  });
}

/** La tapa o balda de un mueble que está a la altura `nivel` (o undefined si no tiene). */
export function zonaEn(item: FichaObjeto, nivel: number): Superficie | undefined {
  return zonasDe(item).find((z) => Math.abs(z.altura - nivel) < 1e-6);
}

/** Por qué no se puede apoyar un objeto en una superficie. */
export type MotivoNoCabe = 'grande' | 'alto';

/**
 * REGLA DE APOYO: un objeto se puede apoyar en una superficie si su huella,
 * girada `giro` grados respecto al mueble, cabe dentro de su ancho × fondo y
 * su alto no pasa de su altura libre. Devuelve null si cabe, o el motivo
 * (primero el tamaño: "grande"; luego la altura: "alto").
 */
export function motivoNoCabe(dim: { ancho: number; fondo: number; alto: number }, giro: number, zona: Superficie): MotivoNoCabe | null {
  const { x, z } = medioGirado(dim, giro);
  if (2 * x > zona.ancho + 1e-6 || 2 * z > zona.fondo + 1e-6) return 'grande';
  if (dim.alto > zona.alturaLibre + 1e-6) return 'alto';
  return null;
}

/** Mitad del tamaño en planta (x, z) de un objeto girado `giro` grados. */
export function medioGirado(dim: { ancho: number; fondo: number }, giro: number): { x: number; z: number } {
  const g = (giro * Math.PI) / 180, c = Math.abs(Math.cos(g)), s = Math.abs(Math.sin(g));
  return { x: (c * dim.ancho + s * dim.fondo) / 2, z: (s * dim.ancho + c * dim.fondo) / 2 };
}

// Vite sustituye estas dos líneas por el contenido real de la carpeta.
const fichas = import.meta.glob<FichaObjeto>('/catalogo/**/*.json', { eager: true, import: 'default' });
const urlsGlb = import.meta.glob<string>('/catalogo/**/*.glb', { eager: true, query: '?url', import: 'default' });
// Solo las URL: cada .glb y cada miniatura se descargan cuando hacen falta.
const urlsMiniatura = import.meta.glob<string>('/catalogo/**/*.png', { eager: true, query: '?url', import: 'default' });

/** Comprueba que una ficha tiene todos los campos necesarios. Devuelve el error o null. */
export function validarFicha(f: Partial<FichaObjeto>): string | null {
  if (!f || typeof f !== 'object') return 'no es un objeto JSON';
  if (typeof f.nombre !== 'string') return 'falta "nombre"';
  if (typeof f.categoria !== 'string') return 'falta "categoria"';
  if (typeof f.glb !== 'string') return 'falta "glb"';
  const d = f.dimensiones;
  if (!d || !(d.ancho > 0) || !(d.fondo > 0) || !(d.alto > 0)) {
    return '"dimensiones" debe tener ancho, fondo y alto mayores que 0 (en metros)';
  }
  if (f.colocacion !== undefined && !COLOCACIONES.includes(f.colocacion)) {
    return `"colocacion" debe ser uno de: ${COLOCACIONES.join(', ')}`;
  }
  if (f.alturaCentro !== undefined && !(typeof f.alturaCentro === 'number' && f.alturaCentro > d.alto / 2 && f.alturaCentro < 3)) {
    return '"alturaCentro" debe ser un número (m) mayor que la mitad del alto y menor que 3';
  }
  if (f.superficies !== undefined) {
    const error = validarSuperficies(f.superficies, d);
    if (error) return error;
    if ((f.colocacion ?? 'suelo') !== 'suelo') return '"superficies" solo vale en objetos de suelo';
  }
  return null;
}

/** Comprueba la lista "superficies" de una ficha. Devuelve el error o null. */
function validarSuperficies(lista: unknown, d: { ancho: number; fondo: number; alto: number }): string | null {
  const formato = '"superficies" debe ser una lista de alturas (m) entre 0 y el alto del objeto, o de objetos { altura, ancho, fondo, desplazamientoX, desplazamientoZ, alturaLibre }';
  if (!Array.isArray(lista)) return formato;
  const alturas: number[] = [];
  const positivo = (v: unknown) => v === undefined || (typeof v === 'number' && v > 0);
  const numero = (v: unknown) => v === undefined || (typeof v === 'number' && Number.isFinite(v));
  for (const s of lista) {
    const h = typeof s === 'number' ? s : s && typeof s === 'object' ? (s as SuperficieFicha).altura : undefined;
    if (typeof h !== 'number' || !(h > 0 && h <= d.alto + 1e-9)) return formato;
    alturas.push(h);
    if (typeof s === 'number') continue;
    const o = s as SuperficieFicha;
    const conocidos = ['altura', 'ancho', 'fondo', 'desplazamientoX', 'desplazamientoZ', 'alturaLibre'];
    const extra = Object.keys(o).find((k) => !conocidos.includes(k));
    if (extra) return `superficie a ${h} m: campo desconocido "${extra}"`;
    if (!positivo(o.ancho) || !positivo(o.fondo) || !positivo(o.alturaLibre) || !numero(o.desplazamientoX) || !numero(o.desplazamientoZ)) {
      return `superficie a ${h} m: ancho, fondo y alturaLibre deben ser mayores que 0, y los desplazamientos, números (m)`;
    }
    const ancho = o.ancho ?? d.ancho, fondo = o.fondo ?? d.fondo;
    if (Math.abs(o.desplazamientoX ?? 0) + ancho / 2 > d.ancho / 2 + 1e-6 || Math.abs(o.desplazamientoZ ?? 0) + fondo / 2 > d.fondo / 2 + 1e-6) {
      return `superficie a ${h} m: se sale de la planta del mueble (${d.ancho} × ${d.fondo} m)`;
    }
  }
  if (new Set(alturas.map((h) => Math.round(h * 1e6))).size !== alturas.length) return '"superficies": dos superficies no pueden estar a la misma altura';
  return null;
}

/** Une una carpeta y una ruta relativa, resolviendo "./" y "../". */
function unirRuta(carpeta: string, relativa: string): string {
  const partes = carpeta.split('/');
  for (const trozo of relativa.split('/')) {
    if (trozo === '..') partes.pop();
    else if (trozo !== '.' && trozo !== '') partes.push(trozo);
  }
  return partes.join('/');
}

/** Devuelve todos los objetos válidos del catálogo, ordenados por categoría y nombre. */
export function leerCatalogo(): ItemCatalogo[] {
  const items: ItemCatalogo[] = [];

  for (const [rutaJson, ficha] of Object.entries(fichas)) {
    const error = validarFicha(ficha);
    if (error) {
      console.warn(`Catálogo: se ignora ${rutaJson}: ${error}`);
      continue;
    }
    const carpeta = rutaJson.slice(0, rutaJson.lastIndexOf('/'));
    const rutaGlb = unirRuta(carpeta, ficha.glb);
    const urlGlb = urlsGlb[rutaGlb];
    if (!urlGlb) {
      console.warn(`Catálogo: se ignora ${rutaJson}: no existe el archivo ${rutaGlb}`);
      continue;
    }
    items.push({
      ...ficha,
      colocacion: ficha.colocacion ?? 'suelo',
      id: rutaJson.replace(/^\/catalogo\//, '').replace(/\.json$/, ''),
      urlGlb,
      urlMiniatura: urlsMiniatura[rutaJson.replace(/\.json$/, '.png')],
    });
  }

  return items.sort((a, b) =>
    a.categoria.localeCompare(b.categoria, 'es') || a.nombre.localeCompare(b.nombre, 'es'));
}
