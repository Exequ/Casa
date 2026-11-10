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
   * Solo muebles de suelo: alturas (m) de sus tapas o baldas, donde se pueden
   * apoyar objetos de "superficie". Por defecto, el borde superior del mueble.
   */
  superficies?: number[];
}

/** Un objeto del catálogo ya listo para usar en la app (con los valores por defecto puestos). */
export interface ItemCatalogo extends FichaObjeto {
  /** Identificador único: ruta del json sin extensión, p. ej. "mesa" o "salon/sofa". */
  id: string;
  /** URL final del .glb (la que entiende el navegador). */
  urlGlb: string;
  colocacion: Colocacion;
}

/** Altura del centro de un objeto de pared (la de su ficha o 1,50 m). */
export const alturaCentroDe = (item: FichaObjeto) => item.alturaCentro ?? ALTURA_CENTRO_PARED;

/** Alturas donde se pueden apoyar cosas sobre un mueble, de abajo arriba ([] si no es un mueble de suelo). */
export function superficiesDe(item: FichaObjeto): number[] {
  if ((item.colocacion ?? 'suelo') !== 'suelo') return [];
  return [...(item.superficies?.length ? item.superficies : [item.dimensiones.alto])].sort((a, b) => a - b);
}

// Vite sustituye estas dos líneas por el contenido real de la carpeta.
const fichas = import.meta.glob<FichaObjeto>('/catalogo/**/*.json', { eager: true, import: 'default' });
const urlsGlb = import.meta.glob<string>('/catalogo/**/*.glb', { eager: true, query: '?url', import: 'default' });

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
    if (!Array.isArray(f.superficies) || !f.superficies.every((h) => typeof h === 'number' && h > 0 && h <= d.alto + 1e-9)) {
      return '"superficies" debe ser una lista de alturas (m) entre 0 y el alto del objeto';
    }
    if ((f.colocacion ?? 'suelo') !== 'suelo') return '"superficies" solo vale en objetos de suelo';
  }
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
    });
  }

  return items.sort((a, b) =>
    a.categoria.localeCompare(b.categoria, 'es') || a.nombre.localeCompare(b.nombre, 'es'));
}
