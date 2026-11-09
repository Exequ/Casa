// Guardar y cargar la escena.
//
// Formato del archivo (JSON):
// {
//   "version": 1,
//   "objetos": [
//     { "catalogo": "mesa", "posicion": { "x": 0.5, "y": 0, "z": -1 }, "rotacion": 90 }
//   ]
// }
//   - "catalogo": id del objeto (nombre del .json del catálogo sin extensión)
//   - "posicion": centro de la base del objeto, en metros
//   - "rotacion": giro alrededor del eje vertical, en grados

import type { ItemCatalogo } from '../catalogo/catalogo';
import type { GestorObjetos } from './objetos';

export interface ObjetoGuardado {
  catalogo: string;
  posicion: { x: number; y: number; z: number };
  rotacion: number;
}

export interface EscenaGuardada {
  version: 1;
  objetos: ObjetoGuardado[];
}

/** Clave usada para el autoguardado en el navegador. */
const CLAVE_AUTOGUARDADO = 'casa3d:escena';

/** Redondea a milímetros/décimas de grado para que el JSON quede legible. */
const redondear = (n: number, decimales = 3) => Number(n.toFixed(decimales));

/** Convierte el estado actual de la escena en un objeto JSON. */
export function serializar(gestor: GestorObjetos): EscenaGuardada {
  return {
    version: 1,
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
 * Sustituye la escena actual por la guardada. Los objetos que ya no existen
 * en el catálogo se ignoran (con un aviso en la consola).
 */
export async function aplicar(gestor: GestorObjetos, datos: EscenaGuardada, catalogo: ItemCatalogo[]) {
  if (!datos || !Array.isArray(datos.objetos)) throw new Error('El archivo no tiene una lista "objetos".');
  gestor.vaciar();
  const porId = new Map(catalogo.map((item) => [item.id, item]));
  for (const o of datos.objetos) {
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

export function autoguardar(gestor: GestorObjetos) {
  try {
    localStorage.setItem(CLAVE_AUTOGUARDADO, JSON.stringify(serializar(gestor)));
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

/** Descarga la escena como archivo .json. */
export function descargarArchivo(gestor: GestorObjetos, nombre = 'escena.json') {
  const texto = JSON.stringify(serializar(gestor), null, 2);
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

/** Lee un archivo .json elegido por el usuario. */
export async function leerArchivo(archivo: File): Promise<EscenaGuardada> {
  return JSON.parse(await archivo.text()) as EscenaGuardada;
}
