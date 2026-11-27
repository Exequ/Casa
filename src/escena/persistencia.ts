// Guardar y cargar la escena.
//
// Formato del archivo (JSON), versión 6:
// {
//   "version": 6,
//   "vivienda": "Vivienda 2ºA",
//   "capas": [
//     { "id": "base", "nombre": "Base", "visible": true, "bloqueada": true, "color": "#2f7cf6" },
//     { "id": "capa-2", "nombre": "Capa 2", "visible": true, "bloqueada": false, "color": "#16a34a" }
//   ],
//   "capaActiva": "capa-2",
//   "objetos": [
//     { "catalogo": "mesa", "posicion": { "x": 3.1, "y": 0, "z": 1.8 }, "rotacion": 90, "colocacion": "suelo", "capa": "base" },
//     { "catalogo": "jarron", "posicion": { "x": 3.2, "y": 0.75, "z": 1.7 }, "rotacion": 90,
//       "colocacion": "superficie", "soporte": 0, "nivel": 0.75 },
//     { "catalogo": "cuadro", "posicion": { "x": 2.0, "y": 1.35, "z": 0.25 }, "rotacion": 0,
//       "colocacion": "pared", "pared": "pared:fachada-norte", "estancia": "salon", "altura": 1.5 }
//   ],
//   "suelos": { "salon": { "tipo": "tarima", "color": "#a97b4f", "escala": 2.4 } },
//   "paredes": { "dormitorio": { "color": "#bfccd6" } },
//   "ajustes": { "luces": { "encendidas": true, "apagadas": ["bano"] }, "puertasAbiertas": false, "cortinas": true }
// }
//   - "catalogo": id del objeto (nombre del .json del catálogo sin extensión)
//   - "posicion": centro de la base del objeto, en metros, en coordenadas de vivienda.json
//   - "rotacion": giro alrededor del eje vertical, en grados
//   - "colocacion": "suelo", "pared" o "superficie" (apoyado sobre un mueble)
//   - "capa": id de la capa del objeto (si falta o no existe, "base")
//   - "capas": lista ordenada de capas (nombre, visible, bloqueada, color);
//     "capaActiva": a la que van los objetos nuevos
//   - pared: "pared" = muro o pilar donde cuelga ("pared:<id>" o "pilar:<id>"),
//     "estancia" = a qué estancia mira, "altura" = altura de su centro (m)
//   - superficie: "soporte" = posición (desde 0) del mueble en la lista
//     "objetos", "nivel" = altura de la tapa o balda donde se apoya (m)
//   - "suelos" y "paredes": solo las estancias cambiadas respecto a vivienda.json
//   - "ajustes": interruptores de luz, puertas abiertas o cerradas y cortinas visibles
//
// Versiones anteriores (se migran solas al cargarlas):
//   - v5 (fase 4-5): sin capas; todos los objetos pasan a la capa Base (bloqueada).
//   - v4 (fase 3b): objetos sin "colocacion" (todos en el suelo).
//   - v3 (fase 3a): además, sin "paredes" ni "ajustes".
//   - v2 (fase 2): además, sin "suelos".
//   - v1 (fase 1, o sin versión): las posiciones eran relativas al centro de una
//     habitación de ejemplo; se colocan relativas al centro del salón.
// Si algún objeto no cabe donde estaba (paredes u otros muebles), se mueve al
// sitio libre más cercano; si no cabe en ninguna parte, se omite y se avisa.
// Si un objeto apoyado ya no cumple la regla de apoyo (su balda es más
// pequeña o más baja que él, o el mueble ya no la tiene; p. ej. escenas de
// antes de que las superficies tuvieran tamaño y altura libre), pasa a otra
// superficie del mismo mueble donde quepa, a otro mueble cercano o al suelo,
// y se anota en `movidos` (el panel lo cuenta).

import { conTamano, zonaEn, motivoNoCabe, type ItemCatalogo } from '../catalogo/catalogo';
import { distanciaACara } from '../vivienda/colgar';
import { crearModelo } from '../catalogo/modelos';
import type { Suelo } from '../vivienda/suelos';
import { capasPorDefecto, ID_BASE, normalizarCapas, type Capa } from './capas';
import type { EstadoLuces } from './luces';
import type { EstadoColocacion, GestorObjetos, ObjetoColocado } from './objetos';
import type { GestorParedes } from './paredes3d';
import type { GestorSuelos } from './suelos3d';

export interface ObjetoGuardado {
  catalogo: string;
  posicion: { x: number; y: number; z: number };
  rotacion: number;
  colocacion?: EstadoColocacion;
  /** Objetos de pared: muro o pilar, estancia y altura del centro. */
  pared?: string;
  estancia?: string;
  altura?: number;
  /** Objetos apoyados: índice del mueble en la lista y altura de la tapa o balda. */
  soporte?: number;
  nivel?: number;
  /** Capa del objeto (v6). */
  capa?: string;
  /** Medida elegida (objetos con varias, como las alfombras): ancho × fondo en m. Sin ella, la de la ficha. */
  tamano?: { ancho: number; fondo: number };
}

/** Versión actual del formato de escena. */
export const VERSION_ESCENA = 6;

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
  version: 1 | 2 | 3 | 4 | 5 | 6;
  vivienda?: string;
  objetos: ObjetoGuardado[];
  suelos?: Record<string, Suelo>;
  paredes?: Record<string, { color: string }>;
  ajustes?: Partial<AjustesEscena>;
  /** Capas en orden y capa activa (v6). */
  capas?: Capa[];
  capaActiva?: string;
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

/** Un objeto colocado, tal como se guarda. `indices` da la posición de cada mueble en la lista. */
function guardarObjeto(o: ObjetoColocado, indices: Map<ObjetoColocado, number>): ObjetoGuardado {
  const g: ObjetoGuardado = {
    catalogo: o.item.id,
    posicion: {
      x: redondear(o.raiz.position.x),
      y: redondear(o.raiz.position.y),
      z: redondear(o.raiz.position.z),
    },
    rotacion: redondear(o.rotacion, 2),
    colocacion: o.colocacion,
    capa: o.capa,
  };
  if (o.colocacion === 'pared' && o.pared) {
    g.pared = o.pared.cara.elemento;
    g.estancia = o.pared.cara.estancia;
    g.altura = redondear(o.pared.y);
  }
  if (o.colocacion === 'superficie' && o.apoyo) {
    g.soporte = indices.get(o.apoyo.soporte);
    g.nivel = redondear(o.apoyo.nivel);
  }
  if (o.item.medidasDisponibles) g.tamano = { ancho: o.item.dimensiones.ancho, fondo: o.item.dimensiones.fondo };
  return g;
}

/** Convierte el estado actual de la escena en un objeto JSON. */
export function serializar(estado: EstadoEscena): EscenaGuardada {
  const lista = estado.objetos.objetos;
  const indices = new Map(lista.map((o, i) => [o, i]));
  const capas = estado.objetos.capas.datos();
  return {
    version: VERSION_ESCENA,
    ...(estado.nombreVivienda ? { vivienda: estado.nombreVivienda } : {}),
    capas: capas.capas,
    capaActiva: capas.activa,
    objetos: lista.map((o) => guardarObjeto(o, indices)),
    suelos: estado.suelos.cambios(),
    paredes: estado.paredes.cambios(),
    ajustes: estado.ajustes.leer(),
  };
}

/**
 * Pasa una escena de cualquier versión a la versión 6.
 * `centroV1` es el punto donde se colocaba el centro de la habitación de la fase 1.
 */
export function migrar(datos: EscenaGuardada, centroV1: { x: number; z: number }): EscenaGuardada {
  if (!datos || !Array.isArray(datos.objetos)) throw new Error('El archivo no tiene una lista "objetos".');
  const version = datos.version ?? 1;
  if (![1, 2, 3, 4, 5, 6].includes(version)) throw new Error(`Versión de escena desconocida: ${String(version)}`);
  // Capas: antes de la v6 no había; todo va a Base (bloqueada)
  const capas = version >= 6 ? normalizarCapas(datos.capas, datos.capaActiva) : capasPorDefecto();
  const ids = new Set(capas.capas.map((c) => c.id));
  const objetos: ObjetoGuardado[] = (version === 1
    ? datos.objetos.map((o) => ({
      ...o,
      posicion: { x: (o.posicion?.x ?? 0) + centroV1.x, y: 0, z: (o.posicion?.z ?? 0) + centroV1.z },
    }))
    : datos.objetos
  ).map((o) => ({
    ...o,
    colocacion: version >= 5 ? o.colocacion ?? 'suelo' : 'suelo',
    capa: version >= 6 && typeof o.capa === 'string' && ids.has(o.capa) ? o.capa : ID_BASE,
  }));
  return {
    ...(version === 1 ? {} : datos),
    version: VERSION_ESCENA,
    capas: capas.capas,
    capaActiva: capas.activa,
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
  /** Objetos apoyados que ya no cumplían la regla de apoyo y se han movido (qué y adónde). */
  movidos: string[];
  /** Suelos y colores de pared ignorados (estancia desconocida o formato no válido). */
  suelosIgnorados: number;
  paredesIgnoradas: number;
}

/**
 * Sustituye la escena actual (muebles, suelos, paredes y ajustes) por la
 * guardada. Con `conAjustes = false` no toca luces, puertas ni cortinas
 * (para deshacer y rehacer).
 */
export async function aplicar(
  estado: EstadoEscena,
  datos: EscenaGuardada,
  catalogo: ItemCatalogo[],
  centroV1: { x: number; z: number },
  conAjustes = true,
): Promise<ResultadoCarga> {
  const escena = migrar(datos, centroV1);
  const gestor = estado.objetos;
  gestor.vaciar();
  gestor.capas.restaurar({ capas: escena.capas!, activa: escena.capaActiva! });
  const suelosIgnorados = estado.suelos.restaurar(escena.suelos);
  const paredesIgnoradas = estado.paredes.restaurar(escena.paredes);
  if (conAjustes) estado.ajustes.aplicar(escena.ajustes);
  const movidos: string[] = [];
  const omitidos = await colocarObjetos(gestor, escena.objetos, catalogo, movidos);
  gestor.actualizarCapas();
  gestor.notificar();
  if (movidos.length) console.info(`Escena: objetos apoyados que ya no cabían y se han movido:\n- ${movidos.join('\n- ')}`);
  return { omitidos, movidos, suelosIgnorados, paredesIgnoradas };
}

/** Cómo se dice una superficie en los avisos: "la balda a 0,37 m del Mueble cafetera". */
function textoSuperficie(soporte: ObjetoColocado, nivel: number): string {
  const alto = soporte.item.dimensiones.alto;
  const que = Math.abs(nivel - alto) < 1e-6 ? 'la tapa' : 'la balda';
  return `${que} a ${String(Math.round(nivel * 100) / 100).replace('.', ',')} m de «${soporte.item.nombre}»`;
}

/**
 * Coloca los objetos guardados: primero los del suelo (en su orden), luego
 * los apoyados sobre ellos y por último los colgados. Devuelve los que no se
 * han podido poner. En `movidos` anota los apoyados que no cumplían la regla
 * de apoyo y se han llevado a otra superficie o al suelo.
 */
export async function colocarObjetos(gestor: GestorObjetos, objetos: ObjetoGuardado[], catalogo: ItemCatalogo[], movidos: string[] = []): Promise<string[]> {
  const porId = new Map(catalogo.map((item) => [item.id, item]));
  const omitidos: string[] = [];
  const colocados = new Map<number, ObjetoColocado>();
  const items = objetos.map((o) => {
    const item = porId.get(o.catalogo);
    if (!item) {
      console.warn(`Escena: el objeto "${o.catalogo}" no está en el catálogo; se omite.`);
      omitidos.push(o.catalogo);
      return item;
    }
    // Medida elegida (alfombras): si ya no existe esa medida, la de la ficha
    if (o.tamano && item.medidasDisponibles) {
      const conMedida = conTamano(item, o.tamano.ancho, o.tamano.fondo);
      if (!conMedida) console.warn(`Escena: «${item.nombre}» ya no tiene la medida ${o.tamano.ancho} × ${o.tamano.fondo} m; se pone la de la ficha.`);
      return conMedida ?? item;
    }
    return item;
  });
  // Los modelos se descargan todos a la vez (y no uno tras otro al colocarlos)
  await Promise.all([...new Set(items.filter((i): i is ItemCatalogo => !!i))].map((i) => crearModelo(i).catch(() => null)));
  const tipo = (o: ObjetoGuardado, item: ItemCatalogo) =>
    item.colocacion === 'pared' ? 'pared' : o.colocacion === 'superficie' && item.colocacion === 'superficie' ? 'superficie' : 'suelo';
  // Cada objeto se coloca en su capa y solo choca con los de su misma capa
  gestor.cargando = true;
  try {
  for (const fase of ['suelo', 'superficie', 'pared'] as const) {
    for (const [i, o] of objetos.entries()) {
      const item = items[i];
      if (!item || tipo(o, item) !== fase) continue;
      gestor.capaNuevos = o.capa && gestor.capas.existe(o.capa) ? o.capa : ID_BASE;
      const x = o.posicion?.x ?? 0, z = o.posicion?.z ?? 0, rot = o.rotacion ?? 0;
      let obj: ObjetoColocado | null = null;
      if (fase === 'suelo') {
        obj = await gestor.agregar(item, x, z, rot);
      } else if (fase === 'superficie') {
        const soporte = o.soporte !== undefined ? colocados.get(o.soporte) : undefined;
        if (soporte && o.nivel !== undefined) {
          obj = await gestor.agregarSobre(item, soporte, o.nivel, x, z, rot);
          // ¿Ya no cumple la regla de apoyo? A otra superficie donde quepa o al suelo, y se anota.
          const zona = zonaEn(soporte.item, o.nivel);
          const giro = ((rot - soporte.rotacion) % 360 + 360) % 360;
          if (!obj && (!zona || motivoNoCabe(item.dimensiones, giro, zona))) {
            obj = await gestor.agregarReubicado(item, soporte, o.nivel, x, z, rot);
            const motivo = !zona ? 'el mueble ya no tiene esa balda'
              : motivoNoCabe(item.dimensiones, giro, zona) === 'grande' ? 'es más grande que la superficie' : 'es más alto que el hueco';
            const destino = !obj ? 'no cabía en ninguna parte y se ha quitado'
              : obj.colocacion === 'superficie' && obj.apoyo ? `pasa a ${textoSuperficie(obj.apoyo.soporte, obj.apoyo.nivel)}` : 'pasa al suelo';
            movidos.push(`«${item.nombre}»: estaba en ${textoSuperficie(soporte, o.nivel)} (${motivo}); ${destino}`);
            if (!obj) { omitidos.push(item.nombre); continue; }
          }
        }
        // Sin su mueble: al mueble libre más cercano o al suelo
        obj ??= await gestor.agregarSegunTipo(item, x, z, null);
      } else {
        // La cara de ese muro en esa estancia más cercana a la posición guardada
        const caras = gestor.caras.filter((c) => c.elemento === o.pared && (!o.estancia || c.estancia === o.estancia));
        const cara = caras.map((c) => ({ c, ...distanciaACara(c, x, z) })).sort((p, q) => p.distancia - q.distancia)[0];
        if (cara) obj = await gestor.agregarEnPared(item, cara.c, cara.u, o.altura);
        obj ??= await gestor.agregarEnParedCerca(item, x, z, o.estancia ?? null);
      }
      if (obj) colocados.set(i, obj);
      else omitidos.push(item.nombre);
    }
  }
  } finally {
    gestor.cargando = false;
    gestor.capaNuevos = null;
  }
  // Mismo orden que en el archivo (para que guardar y volver a cargar no cambie nada)
  const orden = new Map([...colocados].map(([i, o]) => [o, i]));
  gestor.objetos.sort((a, b) => (orden.get(a) ?? Infinity) - (orden.get(b) ?? Infinity));
  return omitidos;
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
