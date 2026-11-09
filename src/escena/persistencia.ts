// Guardar y cargar la escena.
//
// Formato del archivo (JSON), versión 3:
// {
//   "version": 3,
//   "vivienda": "Vivienda 2ºA",
//   "objetos": [
//     { "catalogo": "mesa", "posicion": { "x": 3.1, "y": 0, "z": 1.8 }, "rotacion": 90 }
//   ],
//   "suelos": {
//     "salon": { "tipo": "tarima", "color": "#a97b4f", "escala": 1.2 }
//   }
// }
//   - "catalogo": id del objeto (nombre del .json del catálogo sin extensión)
//   - "posicion": centro de la base del objeto, en metros, en coordenadas de vivienda.json
//   - "rotacion": giro alrededor del eje vertical, en grados
//   - "suelos": solo las estancias cuyo suelo se ha cambiado respecto a vivienda.json
//
// Versiones anteriores (se migran solas al cargarlas):
//   - v2 (fase 2): igual, pero sin "suelos".
//   - v1 (fase 1, o sin versión): las posiciones eran relativas al centro de una
//     habitación de ejemplo; se colocan relativas al centro del salón.
// Si algún objeto no cabe donde estaba (paredes u otros muebles), se mueve al
// sitio libre más cercano; si no cabe en ninguna parte, se omite y se avisa.

import type { ItemCatalogo } from '../catalogo/catalogo';
import type { Suelo } from '../vivienda/suelos';
import type { GestorObjetos } from './objetos';
import type { GestorSuelos } from './suelos3d';

export interface ObjetoGuardado {
  catalogo: string;
  posicion: { x: number; y: number; z: number };
  rotacion: number;
}

export interface EscenaGuardada {
  version: 1 | 2 | 3;
  vivienda?: string;
  objetos: ObjetoGuardado[];
  suelos?: Record<string, Suelo>;
}

/** Lo que forma una escena: los muebles colocados y los suelos elegidos. */
export interface EstadoEscena {
  objetos: GestorObjetos;
  suelos: GestorSuelos;
  nombreVivienda?: string;
}

/** Clave usada para el autoguardado en el navegador. */
const CLAVE_AUTOGUARDADO = 'casa3d:escena';

/** Redondea a milímetros/décimas de grado para que el JSON quede legible. */
const redondear = (n: number, decimales = 3) => Number(n.toFixed(decimales));

/** Convierte el estado actual de la escena en un objeto JSON. */
export function serializar(estado: EstadoEscena): EscenaGuardada {
  return {
    version: 3,
    ...(estado.nombreVivienda ? { vivienda: estado.nombreVivienda } : {}),
    objetos: estado.objetos.objetos.map((o) => ({
      catalogo: o.item.id,
      posicion: {
        x: redondear(o.raiz.position.x),
        y: redondear(o.raiz.position.y),
        z: redondear(o.raiz.position.z),
      },
      rotacion: redondear(o.rotacion, 2),
    })),
    suelos: estado.suelos.cambios(),
  };
}

/**
 * Pasa una escena de cualquier versión a la versión 3.
 * `centroV1` es el punto donde se colocaba el centro de la habitación de la fase 1.
 */
export function migrar(datos: EscenaGuardada, centroV1: { x: number; z: number }): EscenaGuardada {
  if (!datos || !Array.isArray(datos.objetos)) throw new Error('El archivo no tiene una lista "objetos".');
  const version = datos.version ?? 1;
  if (version === 3) return { ...datos, suelos: datos.suelos ?? {} };
  if (version === 2) return { ...datos, version: 3, suelos: {} };
  if (version !== 1) throw new Error(`Versión de escena desconocida: ${String(version)}`);
  return {
    version: 3,
    objetos: datos.objetos.map((o) => ({
      ...o,
      posicion: { x: (o.posicion?.x ?? 0) + centroV1.x, y: 0, z: (o.posicion?.z ?? 0) + centroV1.z },
    })),
    suelos: {},
  };
}

/** Resultado de cargar una escena: lo que no se ha podido poner. */
export interface ResultadoCarga {
  /** Nombres de objetos que no estaban en el catálogo o no cabían en ninguna parte. */
  omitidos: string[];
  /** Suelos ignorados (estancia desconocida o formato no válido). */
  suelosIgnorados: number;
}

/** Sustituye la escena actual (muebles y suelos) por la guardada. */
export async function aplicar(
  estado: EstadoEscena,
  datos: EscenaGuardada,
  catalogo: ItemCatalogo[],
  centroV1: { x: number; z: number },
): Promise<ResultadoCarga> {
  const escena = migrar(datos, centroV1);
  const gestor = estado.objetos;
  gestor.vaciar();
  const suelosIgnorados = estado.suelos.restaurar(escena.suelos);
  const porId = new Map(catalogo.map((item) => [item.id, item]));
  const omitidos: string[] = [];
  for (const o of escena.objetos) {
    const item = porId.get(o.catalogo);
    if (!item) {
      console.warn(`Escena: el objeto "${o.catalogo}" no está en el catálogo; se omite.`);
      omitidos.push(o.catalogo);
      continue;
    }
    const obj = await gestor.agregar(item, o.posicion?.x ?? 0, o.posicion?.z ?? 0, o.rotacion ?? 0);
    if (!obj) omitidos.push(item.nombre);
  }
  gestor.notificar();
  return { omitidos, suelosIgnorados };
}

// --- Autoguardado en localStorage --------------------------------------------

export function autoguardar(estado: EstadoEscena) {
  try {
    localStorage.setItem(CLAVE_AUTOGUARDADO, JSON.stringify(serializar(estado)));
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
export async function descargarArchivo(estado: EstadoEscena, nombre = 'escena.json'): Promise<string | null> {
  const texto = JSON.stringify(serializar(estado), null, 2);
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
