// Guardar y cargar la escena.
//
// Formato del archivo (JSON), versión 4:
// {
//   "version": 4,
//   "vivienda": "Vivienda 2ºA",
//   "objetos": [
//     { "catalogo": "mesa", "posicion": { "x": 3.1, "y": 0, "z": 1.8 }, "rotacion": 90 }
//   ],
//   "suelos": { "salon": { "tipo": "tarima", "color": "#a97b4f", "escala": 2.4 } },
//   "paredes": { "dormitorio": { "color": "#bfccd6" } },
//   "ajustes": { "luces": { "encendidas": true, "apagadas": ["bano"] }, "puertasAbiertas": false, "cortinas": true }
// }
//   - "catalogo": id del objeto (nombre del .json del catálogo sin extensión)
//   - "posicion": centro de la base del objeto, en metros, en coordenadas de vivienda.json
//   - "rotacion": giro alrededor del eje vertical, en grados
//   - "suelos" y "paredes": solo las estancias cambiadas respecto a vivienda.json
//   - "ajustes": interruptores de luz, puertas abiertas o cerradas y cortinas visibles
//
// Versiones anteriores (se migran solas al cargarlas):
//   - v3 (fase 3a): sin "paredes" ni "ajustes".
//   - v2 (fase 2): además, sin "suelos".
//   - v1 (fase 1, o sin versión): las posiciones eran relativas al centro de una
//     habitación de ejemplo; se colocan relativas al centro del salón.
// Si algún objeto no cabe donde estaba (paredes u otros muebles), se mueve al
// sitio libre más cercano; si no cabe en ninguna parte, se omite y se avisa.

import type { ItemCatalogo } from '../catalogo/catalogo';
import type { Suelo } from '../vivienda/suelos';
import type { EstadoLuces } from './luces';
import type { GestorObjetos } from './objetos';
import type { GestorParedes } from './paredes3d';
import type { GestorSuelos } from './suelos3d';

export interface ObjetoGuardado {
  catalogo: string;
  posicion: { x: number; y: number; z: number };
  rotacion: number;
}

/** Interruptores y opciones de vista que se guardan con la escena. */
export interface AjustesEscena {
  luces: EstadoLuces;
  puertasAbiertas: boolean;
  cortinas: boolean;
}

/** Ajustes de una escena que no los trae (versiones anteriores a la 4). */
export const AJUSTES_POR_DEFECTO: AjustesEscena = {
  luces: { encendidas: true, apagadas: [] },
  puertasAbiertas: false,
  cortinas: true,
};

export interface EscenaGuardada {
  version: 1 | 2 | 3 | 4;
  vivienda?: string;
  objetos: ObjetoGuardado[];
  suelos?: Record<string, Suelo>;
  paredes?: Record<string, { color: string }>;
  ajustes?: Partial<AjustesEscena>;
}

/** Lo que forma una escena: los muebles, los suelos y colores elegidos, y los ajustes. */
export interface EstadoEscena {
  objetos: GestorObjetos;
  suelos: GestorSuelos;
  paredes: GestorParedes;
  ajustes: { leer(): AjustesEscena; aplicar(a: Partial<AjustesEscena> | undefined): void };
  nombreVivienda?: string;
}

/** Clave usada para el autoguardado en el navegador. */
const CLAVE_AUTOGUARDADO = 'casa3d:escena';

/** Redondea a milímetros/décimas de grado para que el JSON quede legible. */
const redondear = (n: number, decimales = 3) => Number(n.toFixed(decimales));

/** Convierte el estado actual de la escena en un objeto JSON. */
export function serializar(estado: EstadoEscena): EscenaGuardada {
  return {
    version: 4,
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
    paredes: estado.paredes.cambios(),
    ajustes: estado.ajustes.leer(),
  };
}

/**
 * Pasa una escena de cualquier versión a la versión 4.
 * `centroV1` es el punto donde se colocaba el centro de la habitación de la fase 1.
 */
export function migrar(datos: EscenaGuardada, centroV1: { x: number; z: number }): EscenaGuardada {
  if (!datos || !Array.isArray(datos.objetos)) throw new Error('El archivo no tiene una lista "objetos".');
  const version = datos.version ?? 1;
  if (![1, 2, 3, 4].includes(version)) throw new Error(`Versión de escena desconocida: ${String(version)}`);
  const objetos = version === 1
    ? datos.objetos.map((o) => ({
      ...o,
      posicion: { x: (o.posicion?.x ?? 0) + centroV1.x, y: 0, z: (o.posicion?.z ?? 0) + centroV1.z },
    }))
    : datos.objetos;
  return {
    ...(version === 1 ? {} : datos),
    version: 4,
    objetos,
    suelos: version >= 3 ? datos.suelos ?? {} : {},
    paredes: version >= 4 ? datos.paredes ?? {} : {},
    ajustes: {
      ...AJUSTES_POR_DEFECTO,
      ...(version >= 4 ? datos.ajustes : {}),
      luces: { ...AJUSTES_POR_DEFECTO.luces, ...(version >= 4 ? datos.ajustes?.luces : {}) },
    },
  };
}

/** Resultado de cargar una escena: lo que no se ha podido poner. */
export interface ResultadoCarga {
  /** Nombres de objetos que no estaban en el catálogo o no cabían en ninguna parte. */
  omitidos: string[];
  /** Suelos y colores de pared ignorados (estancia desconocida o formato no válido). */
  suelosIgnorados: number;
  paredesIgnoradas: number;
}

/** Sustituye la escena actual (muebles, suelos, paredes y ajustes) por la guardada. */
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
  const paredesIgnoradas = estado.paredes.restaurar(escena.paredes);
  estado.ajustes.aplicar(escena.ajustes);
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
  return { omitidos, suelosIgnorados, paredesIgnoradas };
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
