// Guardar y cargar la escena.
//
// Formato del archivo (JSON), versión 2:
// {
//   "version": 2,
//   "vivienda": "Vivienda 2ºA",
//   "objetos": [
//     { "catalogo": "mesa", "posicion": { "x": 3.1, "y": 0, "z": 1.8 }, "rotacion": 90 }
//   ]
// }
//   - "catalogo": id del objeto (nombre del .json del catálogo sin extensión)
//   - "posicion": centro de la base del objeto, en metros, en coordenadas de vivienda.json
//   - "rotacion": giro alrededor del eje vertical, en grados
//
// Versión 1 (fase 1): igual, pero las posiciones eran relativas al centro de
// una habitación de ejemplo. Al cargarla se colocan relativas al centro del
// salón y, si algún objeto no cabe, se mueve al sitio libre más cercano.

import type { ItemCatalogo } from '../catalogo/catalogo';
import type { GestorObjetos } from './objetos';

export interface ObjetoGuardado {
  catalogo: string;
  posicion: { x: number; y: number; z: number };
  rotacion: number;
}

export interface EscenaGuardada {
  version: 1 | 2;
  vivienda?: string;
  objetos: ObjetoGuardado[];
}

/** Clave usada para el autoguardado en el navegador. */
const CLAVE_AUTOGUARDADO = 'casa3d:escena';

/** Redondea a milímetros/décimas de grado para que el JSON quede legible. */
const redondear = (n: number, decimales = 3) => Number(n.toFixed(decimales));

/** Convierte el estado actual de la escena en un objeto JSON. */
export function serializar(gestor: GestorObjetos, nombreVivienda?: string): EscenaGuardada {
  return {
    version: 2,
    ...(nombreVivienda ? { vivienda: nombreVivienda } : {}),
    objetos: gestor.objetos.map((o) => ({
      catalogo: o.item.id,
      posicion: {
        x: redondear(o.raiz.position.x),
        y: redondear(o.raiz.position.y),
        z: redondear(o.raiz.position.z),
      },
      rotacion: redondear(o.rotacion, 2),
    })),
  };
}

/**
 * Pasa una escena de cualquier versión a la versión 2.
 * `centroV1` es el punto donde se colocaba el centro de la habitación de la fase 1.
 */
export function migrar(datos: EscenaGuardada, centroV1: { x: number; z: number }): EscenaGuardada {
  if (!datos || !Array.isArray(datos.objetos)) throw new Error('El archivo no tiene una lista "objetos".');
  const version = datos.version ?? 1;
  if (version === 2) return datos;
  if (version !== 1) throw new Error(`Versión de escena desconocida: ${String(version)}`);
  return {
    version: 2,
    objetos: datos.objetos.map((o) => ({
      ...o,
      posicion: { x: (o.posicion?.x ?? 0) + centroV1.x, y: 0, z: (o.posicion?.z ?? 0) + centroV1.z },
    })),
  };
}

/**
 * Sustituye la escena actual por la guardada. Los objetos que ya no existen
 * en el catálogo se ignoran (con un aviso en la consola).
 */
export async function aplicar(
  gestor: GestorObjetos,
  datos: EscenaGuardada,
  catalogo: ItemCatalogo[],
  centroV1: { x: number; z: number },
) {
  const escena = migrar(datos, centroV1);
  gestor.vaciar();
  const porId = new Map(catalogo.map((item) => [item.id, item]));
  for (const o of escena.objetos) {
    const item = porId.get(o.catalogo);
    if (!item) {
      console.warn(`Escena: el objeto "${o.catalogo}" no está en el catálogo; se omite.`);
      continue;
    }
    await gestor.agregar(item, o.posicion?.x ?? 0, o.posicion?.z ?? 0, o.rotacion ?? 0);
  }
  gestor.notificar();
}

// --- Autoguardado en localStorage --------------------------------------------

export function autoguardar(gestor: GestorObjetos, nombreVivienda?: string) {
  try {
    localStorage.setItem(CLAVE_AUTOGUARDADO, JSON.stringify(serializar(gestor, nombreVivienda)));
  } catch (e) {
    console.warn('No se pudo autoguardar', e);
  }
}

export function leerAutoguardado(): EscenaGuardada | null {
  try {
    const texto = localStorage.getItem(CLAVE_AUTOGUARDADO);
    return texto ? (JSON.parse(texto) as EscenaGuardada) : null;
  } catch {
    return null;
  }
}

// --- Archivos ----------------------------------------------------------------

/** Lo que el visor de claude.ai ofrece a la página para guardar archivos (si existe). */
interface VisorDescargas {
  save(p: { filename: string; data: string }): Promise<unknown>;
}

/**
 * Descarga la escena como archivo .json. Devuelve un texto para mostrar si
 * algo no ha ido bien (o null si se ha descargado).
 *
 * Dentro del visor de claude.ai las descargas normales están bloqueadas: allí
 * se usa su capacidad "downloads", que pide confirmación al usuario.
 */
export async function descargarArchivo(gestor: GestorObjetos, nombreVivienda?: string, nombre = 'escena.json'): Promise<string | null> {
  const texto = JSON.stringify(serializar(gestor, nombreVivienda), null, 2);
  const visor = (window as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (visor?.use) {
    try {
      const descargas = (await visor.use('downloads')) as VisorDescargas | null;
      if (descargas) {
        await descargas.save({ filename: nombre, data: texto });
        return null;
      }
    } catch (e) {
      const codigo = (e as { code?: string }).code;
      return codigo === 'declined' ? 'Guardado cancelado.' : `No se pudo guardar el archivo aquí (${codigo ?? 'error'}).`;
    }
  }
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
  return null;
}

/** Lee un archivo .json elegido por el usuario. */
export async function leerArchivo(archivo: File): Promise<EscenaGuardada> {
  return JSON.parse(await archivo.text()) as EscenaGuardada;
}
