// Gestión de los objetos colocados en la vivienda: añadir, mover, rotar,
// borrar, duplicar y seleccionar. Hay tres formas de colocar un objeto:
//
//   - En el SUELO (muebles): no atraviesan paredes, pilares, puertas ni
//     ventanas, ni se solapan entre sí (con la ayuda de EspacioLibre).
//   - En la PARED (cuadros, espejos): colgados de una cara de pared de una
//     estancia (ver vivienda/colgar.ts), sin tapar puertas ni ventanas ni
//     solaparse con otros objetos de pared.
//   - APOYADOS sobre un mueble (jarrones, lámparas, la tele): en una de sus
//     tapas o baldas, sin salirse ni solaparse con lo que ya hay en ella. Se
//     mueven y giran con el mueble; si el mueble se borra, pasan a otro mueble
//     libre cercano o al suelo.
//     REGLA DE APOYO: solo se apoyan en una superficie si su huella (con su
//     giro) cabe en el ancho × fondo de esa superficie y su alto no pasa de su
//     altura libre (ver motivoNoCabe en catalogo.ts). Si no cabe en ninguna
//     superficie de un mueble, el mueble es un obstáculo para él (va por el
//     suelo) y se explica por qué (motivoNoApoyo / avisoApoyo).
//
// Los objetos de pared y los apoyados no son obstáculo para los del suelo.
//
// ALFOMBRAS (fichas con "alfombra": true): objetos de suelo planos que van
// DEBAJO de los muebles. No chocan con ningún objeto ni ninguno choca con
// ellas (solo las limitan paredes, puertas y fijos), así que se pueden poner
// bajo muebles que ya están y mover libremente, y los muebles se mueven por
// encima sin estorbo. Nunca se marcan como solapadas. No son soporte: lo que
// queda encima sigue en el suelo y no se mueve con la alfombra. Si se pisan
// dos alfombras, la añadida después queda encima (cada una 1 mm más gruesa
// que la anterior, para que no parpadeen al dibujarse; ver apilarAlfombras).
//
// CAPAS (fase 6): cada objeto pertenece a una capa (ver capas.ts).
//   - Los de capas ocultas no se dibujan, no se seleccionan y no cuentan para
//     choques ni como soporte. Los de capas bloqueadas se ven y cuentan para
//     choques, pero no se pueden seleccionar ni mover.
//   - Los choques se calculan entre objetos de capas visibles. Si al mostrar
//     una capa o pasar un objeto a otra capa quedan objetos solapados, no se
//     impide: se marcan en rojo translúcido (solapes()). Un objeto solapado se
//     puede sacar del solape arrastrándolo, pero ningún arrastre o giro puede
//     meterlo dentro de otro objeto con el que no estuviera ya solapado.
//   - Objetos apoyados en un mueble de OTRA capa: siguen al mueble cuando se
//     mueve o gira. Si el mueble se oculta (su capa se oculta), se quedan en
//     su sitio, visibles, y se avisa (apoyadosSobreOcultos()). Si el mueble se
//     borra (o se borra su capa), pasan a otro mueble cercano o al suelo,
//     como siempre. Cambiar el mueble de capa no les afecta.
//   - Al cargar una escena (o deshacer), cada objeto se coloca teniendo en
//     cuenta solo los de SU capa, para que guardar y cargar no mueva nada.
//   - Las operaciones de capas (mostrar, ocultar, pasar de capa, duplicar) no
//     mueven nada: los apoyos que no cumplan la regla de apoyo se marcan en
//     rojo, como los solapes (apoyosInvalidos()).

import * as THREE from 'three';
import {
  alturaCentroDe, conTamano, esAlfombra, medioGirado, motivoNoCabe, superficiesDe, zonaEn, zonasDe, type ItemCatalogo, type MotivoNoCabe, type Superficie,
} from '../catalogo/catalogo';
import { crearModelo } from '../catalogo/modelos';
import { GestorCapas, type Capa } from './capas';
import {
  buscarEnCara, limitarAltura, puntoEnPared, validoEnPared, type CaraColgable, type RectPared,
} from '../vivienda/colgar';
import type { EspacioLibre, Huella, Obstaculo } from '../vivienda/espacio';
import { esColgado, obstaculosFijos, rectsDeFijos, type Fijo } from '../vivienda/fijos';
import { convexosSeSolapan, encoger, huellaRectangulo } from '../vivienda/geometria';
import type { Punto } from '../vivienda/modelo';

/** Cómo está colocado ahora un objeto. */
export type EstadoColocacion = 'suelo' | 'pared' | 'superficie';

/** Dónde está colgado un objeto de pared: cara, posición a lo largo de ella y altura de su centro. */
export interface EnPared {
  cara: CaraColgable;
  u: number;
  y: number;
}

/** Dónde está apoyado un objeto: mueble, altura de la tapa o balda y posición/giro respecto al mueble. */
export interface Apoyo {
  soporte: ObjetoColocado;
  nivel: number;
  x: number;
  z: number;
  /** Giro respecto al mueble (grados). */
  giro: number;
}

/** Un objeto del catálogo colocado en la escena. */
export interface ObjetoColocado {
  /** Número único dentro de la sesión (para distinguir dos mesas iguales). */
  uid: number;
  item: ItemCatalogo;
  /** Nodo 3D del objeto. Su posición es el centro de la base; su rotación, el giro en Y. */
  raiz: THREE.Object3D;
  /** Giro alrededor del eje vertical, en grados [0, 360) (en el mundo). */
  rotacion: number;
  colocacion: EstadoColocacion;
  /** Id de la capa a la que pertenece. */
  capa: string;
  pared?: EnPared;
  apoyo?: Apoyo;
}

type Oyente = () => void;

/** Por qué no se puede apoyar un objeto en un mueble: no cabe por tamaño, por altura, o no queda sitio libre. */
export type MotivoNoApoyo = MotivoNoCabe | 'lleno';

/** Aviso de por qué el objeto que se arrastra no se ha podido apoyar en un mueble. */
export interface AvisoApoyo {
  objeto: ObjetoColocado;
  soporte: ObjetoColocado;
  motivo: MotivoNoApoyo;
  texto: string;
}

/** Centímetros, para los avisos ("45 cm", "12,5 cm"). */
const cm = (metros: number) => `${String(Math.round(metros * 1000) / 10).replace('.', ',')} cm`;

/** Texto que explica por qué `item` (girado `giro` grados respecto al mueble) no se puede apoyar en `soporte`. */
export function textoNoApoyo(item: ItemCatalogo, soporte: ItemCatalogo, motivo: MotivoNoApoyo, giro: number): string {
  const zonas = zonasDe(soporte);
  const cabecera = `«${item.nombre}» no se puede apoyar en «${soporte.nombre}»`;
  if (motivo === 'lleno') return `${cabecera}: no queda sitio libre en sus superficies.`;
  if (motivo === 'alto') {
    const libre = Math.max(...zonas.filter((z) => motivoNoCabe(item.dimensiones, giro, z) !== 'grande').map((z) => z.alturaLibre));
    return `${cabecera}: es demasiado alto (mide ${cm(item.dimensiones.alto)} y donde cabe de ancho y fondo solo hay ${cm(libre)} libres).`;
  }
  const h = medioGirado(item.dimensiones, giro);
  const mayor = [...zonas].sort((a, b) => b.ancho * b.fondo - a.ancho * a.fondo)[0];
  return `${cabecera}: es demasiado grande (ocupa ${cm(2 * h.x)} × ${cm(2 * h.z)} con su giro y la superficie mayor mide ${cm(mayor.ancho)} × ${cm(mayor.fondo)}).`;
}

/** ¿Está la huella (centro x, z; giro en grados) dentro del rectángulo de la superficie? */
function dentroDeZona(zona: Superficie, x: number, z: number, ancho: number, fondo: number, giro: number): boolean {
  const h = huellaRectangulo(x, z, ancho, fondo, THREE.MathUtils.degToRad(giro));
  return h.every(([hx, hz]) => Math.abs(hx - zona.x) <= zona.ancho / 2 + 1e-6 && Math.abs(hz - zona.z) <= zona.fondo / 2 + 1e-6);
}

/** Holgura para que dos objetos apoyados puedan tocarse (1 mm). */
const HOLGURA = 0.001;
/** Paso de la búsqueda de sitio libre sobre un mueble (m). */
const PASO_SUPERFICIE = 0.02;

const normalizar = (g: number) => {
  const r = ((g % 360) + 360) % 360;
  return Math.abs(r - 360) < 1e-9 ? 0 : r;
};

export class GestorObjetos {
  readonly objetos: ObjetoColocado[] = [];
  seleccionado: ObjetoColocado | null = null;
  /** Caras de pared donde se pueden colgar cosas. */
  readonly caras: CaraColgable[];

  /** Capas de la escena (visibilidad, bloqueo, capa activa). */
  readonly capas: GestorCapas;
  /**
   * Por qué no se ha podido apoyar el objeto que se arrastra en el mueble que
   * hay bajo el puntero (lo muestra el panel). null = nada que avisar.
   */
  avisoApoyo: AvisoApoyo | null = null;
  /**
   * Capa de los objetos que se crean ahora (null = la activa). Al cargar una
   * escena se pone la de cada objeto.
   */
  capaNuevos: string | null = null;
  /** Cargando una escena: cada objeto solo choca con los de su capa (visibles o no). */
  cargando = false;

  private siguienteUid = 1;
  /** Con qué objetos está solapado cada uno (se recalcula en cada notificar). */
  private paresSolape = new Map<ObjetoColocado, Set<ObjetoColocado>>();
  /** Objetos visibles apoyados que no cumplen la regla de apoyo (se recalcula en cada notificar). */
  private invalidos = new Set<ObjetoColocado>();
  private marcasVisibles = true;
  private materialSolape = new THREE.MeshBasicMaterial({ color: 0xe11d48, transparent: true, opacity: 0.35, depthWrite: false });
  /** Caja que resalta el objeto seleccionado. */
  private resaltado = new THREE.BoxHelper(new THREE.Object3D(), 0x2f7cf6);
  private oyentesCambio: Oyente[] = [];
  private oyentesSeleccion: Oyente[] = [];
  private escena: THREE.Scene;
  private espacio: EspacioLibre;

  /** Rectángulos de los elementos fijos pegados a las paredes (ahí no se cuelga nada). */
  private rectsFijos: RectPared[];
  /** Elementos fijos colgados (armarios altos, aire acondicionado): estorban a los muebles más altos que su base. */
  private colgados: { huella: Punto[]; base: number }[];

  constructor(escena: THREE.Scene, espacio: EspacioLibre, caras: CaraColgable[] = [], fijos: Fijo[] = [], capas = new GestorCapas()) {
    this.escena = escena;
    this.capas = capas;
    this.espacio = espacio;
    this.caras = caras;
    this.rectsFijos = rectsDeFijos(caras, fijos);
    this.colgados = obstaculosFijos(fijos.filter(esColgado));
    this.resaltado.visible = false;
    escena.add(this.resaltado);
  }

  // --- Avisos para la interfaz y el autoguardado ---------------------------

  /** Se llama cuando cambia algo que hay que guardar (añadir, mover, rotar, borrar). */
  alCambiar(fn: Oyente) { this.oyentesCambio.push(fn); }
  /** Se llama cuando cambia el objeto seleccionado o sus datos visibles. */
  alSeleccionar(fn: Oyente) { this.oyentesSeleccion.push(fn); }

  /** Avisa de un cambio. `guardar = false` sirve para cambios intermedios (arrastre). */
  notificar(guardar = true) {
    this.apilarAlfombras();
    this.actualizarSolapes();
    if (this.seleccionado) this.actualizarResaltado();
    for (const fn of this.oyentesSeleccion) fn();
    if (guardar) for (const fn of this.oyentesCambio) fn();
  }

  // --- Añadir ------------------------------------------------------------------

  private async crear(item: ItemCatalogo): Promise<ObjetoColocado> {
    const raiz = await crearModelo(item);
    const capa = this.capaNuevos ?? this.capas.activa;
    const obj: ObjetoColocado = { uid: this.siguienteUid++, item, raiz, rotacion: 0, colocacion: 'suelo', capa };
    raiz.visible = this.capas.visible(capa);
    raiz.userData.objeto = obj; // para encontrarlo al hacer clic
    return obj;
  }

  private alta(obj: ObjetoColocado): ObjetoColocado {
    this.escena.add(obj.raiz);
    this.objetos.push(obj);
    return obj;
  }

  /**
   * Coloca un objeto en el SUELO, en el sitio libre (sin paredes ni otros
   * muebles) más cercano a (x, z), con un giro en grados. Si no cabe en
   * ningún sitio de la vivienda, no lo añade y devuelve null.
   */
  async agregar(item: ItemCatalogo, x = 0, z = 0, rotacion = 0): Promise<ObjetoColocado | null> {
    const obj = await this.crear(item);
    this.aplicarRotacion(obj, rotacion);
    const sitio = this.espacio.buscarSitio({ ...this.huella(obj), x, z }, this.espacio.radioTotal(), this.obstaculos(obj));
    if (!sitio) return null;
    obj.raiz.position.set(sitio.x, 0, sitio.z);
    return this.alta(obj);
  }

  /**
   * Cuelga un objeto en una cara de pared, lo más cerca posible de `u`, con
   * su centro a la altura `y` (por defecto, la de su ficha). Null si no cabe en esa cara.
   */
  async agregarEnPared(item: ItemCatalogo, cara: CaraColgable, u: number, y = alturaCentroDe(item)): Promise<ObjetoColocado | null> {
    const sitio = this.sitioEnPared(item, cara, u, y);
    if (!sitio) return null;
    const obj = await this.crear(item);
    this.ponerEnPared(obj, sitio);
    return this.alta(obj);
  }

  /**
   * Cuelga un objeto en la pared libre más cercana a (x, z), preferiblemente
   * en la estancia dada y en las caras que cumplan `preferir`.
   */
  async agregarEnParedCerca(item: ItemCatalogo, x: number, z: number, estancia: string | null, preferir: (c: CaraColgable) => boolean = () => true) {
    const sitio = this.paredLibreCerca(item, x, z, estancia, preferir);
    if (!sitio) return null;
    const obj = await this.crear(item);
    this.ponerEnPared(obj, sitio);
    return this.alta(obj);
  }

  /** Apoya un objeto sobre un mueble, en el sitio libre más cercano a (x, z) del mundo. Null si no cabe. */
  async agregarSobre(item: ItemCatalogo, soporte: ObjetoColocado, nivel: number, x: number, z: number, giroMundo = soporte.rotacion): Promise<ObjetoColocado | null> {
    const giro = normalizar(giroMundo - soporte.rotacion);
    const local = this.aLocal(soporte, x, z);
    const sitio = this.sitioEnSoporte(item, soporte, nivel, local.x, local.z, giro);
    if (!sitio) return null;
    const obj = await this.crear(item);
    this.ponerSobre(obj, { soporte, nivel, ...sitio, giro });
    return this.alta(obj);
  }

  /**
   * Añade un objeto donde le toca según su tipo: los de pared, en la pared
   * libre más cercana; los de superficie, sobre el mueble libre más cercano
   * (o en el suelo si no hay); los demás, en el suelo.
   */
  async agregarSegunTipo(item: ItemCatalogo, x: number, z: number, estancia: string | null, preferirCara?: (c: CaraColgable) => boolean) {
    if (item.colocacion === 'pared') return this.agregarEnParedCerca(item, x, z, estancia, preferirCara);
    if (item.colocacion === 'superficie') {
      const apoyo = this.buscarApoyo(item, x, z, 0, 4, null, estancia);
      if (apoyo) return this.agregarSobre(item, apoyo.soporte, apoyo.nivel, ...this.aMundo(apoyo.soporte, apoyo.x, apoyo.z), apoyo.soporte.rotacion);
    }
    return this.agregar(item, x, z, 0);
  }

  /** Duplica un objeto al lado del original (en su misma pared o mueble si cabe). */
  async duplicar(obj: ObjetoColocado): Promise<ObjetoColocado | null> {
    const { item } = obj;
    if (obj.colocacion === 'pared' && obj.pared) {
      const { cara, u, y } = obj.pared;
      const desplazado = this.sitioEnPared(item, cara, u + item.dimensiones.ancho + 0.1, y)
        ?? this.sitioEnPared(item, cara, u - item.dimensiones.ancho - 0.1, y);
      if (desplazado) {
        const copia = await this.crear(item);
        this.ponerEnPared(copia, desplazado);
        return this.alta(copia);
      }
      const p = obj.raiz.position;
      return this.agregarEnParedCerca(item, p.x, p.z, cara.estancia);
    }
    const p = obj.raiz.position;
    if (obj.colocacion === 'superficie' && obj.apoyo) {
      const { soporte, nivel } = obj.apoyo;
      const giro = obj.apoyo.giro;
      const sitio = this.sitioEnSoporte(item, soporte, nivel, obj.apoyo.x + item.dimensiones.ancho, obj.apoyo.z, giro);
      if (sitio) {
        const copia = await this.crear(item);
        this.ponerSobre(copia, { soporte, nivel, ...sitio, giro });
        return this.alta(copia);
      }
      return this.agregarSegunTipo(item, p.x, p.z, null);
    }
    // Suelo: al lado, sin solaparse (el buscador de sitio lo aparta lo justo)
    return this.agregar(item, p.x + 0.3, p.z + 0.3, obj.rotacion);
  }

  // --- Quitar ---------------------------------------------------------------------

  /** Quita un objeto de la escena. Lo que tenía encima pasa a otro mueble cercano o al suelo. */
  borrar(obj: ObjetoColocado) {
    const i = this.objetos.indexOf(obj);
    if (i === -1) return;
    this.objetos.splice(i, 1);
    this.escena.remove(obj.raiz);
    for (const a of this.apoyadosEn(obj)) this.reubicar(a, obj);
    if (this.seleccionado === obj) this.seleccionar(null);
    this.notificar();
  }

  /** Quita todos los objetos. */
  vaciar() {
    for (const obj of this.objetos) this.escena.remove(obj.raiz);
    this.objetos.length = 0;
    this.seleccionar(null);
    this.notificar();
  }

  /** Selecciona un objeto (o ninguno, con null). Los de capas ocultas o bloqueadas no se pueden seleccionar. */
  seleccionar(obj: ObjetoColocado | null) {
    this.seleccionado = obj && this.editable(obj) ? obj : null;
    if (this.avisoApoyo && this.avisoApoyo.objeto !== this.seleccionado) this.avisoApoyo = null;
    this.actualizarResaltado();
    this.notificar(false);
  }

  // --- Mover y girar en el suelo ------------------------------------------------------

  /**
   * Arrastra un objeto del suelo hacia (x, z) sin dejar que atraviese paredes,
   * pilares ni otros muebles. Puede pasar por una puerta si cabe; al terminar
   * hay que llamar a asentar(). Lo que lleva encima se mueve con él.
   */
  mover(obj: ObjetoColocado, x: number, z: number, guardar = true) {
    if (obj.colocacion !== 'suelo') return;
    const p = this.espacio.mover(this.huella(obj), x, z, this.obstaculos(obj));
    obj.raiz.position.set(p.x, 0, p.z);
    this.moverApoyados(obj);
    this.notificar(guardar);
  }

  /**
   * Coloca definitivamente el objeto al soltarlo: si se ha quedado en el hueco
   * de una puerta, lo lleva al sitio libre más cercano.
   */
  asentar(obj: ObjetoColocado) {
    if (obj.colocacion === 'suelo') {
      const sitio = this.espacio.asentar(this.huella(obj), this.obstaculos(obj));
      if (sitio) obj.raiz.position.set(sitio.x, 0, sitio.z);
      this.moverApoyados(obj);
    }
    this.notificar();
  }

  /**
   * Fija el giro del objeto (en grados). Si girado no cabe donde está (por
   * una pared u otro mueble), se aparta lo mínimo; si no cabe en ningún
   * sitio cercano, no se gira. Los objetos de pared no se giran.
   * Devuelve true si se ha podido girar.
   */
  rotar(obj: ObjetoColocado, grados: number): boolean {
    if (obj.colocacion === 'pared') return false;
    if (obj.colocacion === 'superficie' && obj.apoyo) {
      const a = obj.apoyo;
      const giro = normalizar(grados - a.soporte.rotacion);
      const sitio = this.sitioEnSoporte(obj.item, a.soporte, a.nivel, a.x, a.z, giro, obj, 0.3);
      if (!sitio) { this.notificar(false); return false; }
      this.ponerSobre(obj, { ...a, ...sitio, giro });
      this.notificar();
      return true;
    }
    const anterior = obj.rotacion;
    this.aplicarRotacion(obj, grados);
    const sitio = this.espacio.buscarSitio(this.huella(obj), 1, this.obstaculos(obj));
    if (!sitio) {
      this.aplicarRotacion(obj, anterior);
      this.notificar(false);
      return false;
    }
    obj.raiz.position.set(sitio.x, 0, sitio.z);
    this.moverApoyados(obj);
    this.notificar();
    return true;
  }

  /**
   * Gira el objeto `paso` grados (positivo = antihorario visto desde arriba).
   * Si `ajustar` es true, salta al siguiente múltiplo de `paso`
   * (p. ej. con paso 15: 37° → 45°, o 37° → 30° hacia el otro lado).
   */
  girar(obj: ObjetoColocado, paso: number, ajustar = true) {
    if (!ajustar) { this.rotar(obj, obj.rotacion + paso); return; }
    const p = Math.abs(paso);
    const actual = Math.round(obj.rotacion * 1e6) / 1e6; // evita errores de redondeo
    const grados = paso > 0
      ? Math.floor(actual / p) * p + p
      : Math.ceil(actual / p) * p - p;
    this.rotar(obj, grados);
  }

  // --- Medida ----------------------------------------------------------------------------

  /**
   * Cambia la medida (ancho × fondo) de un objeto de suelo que tiene varias
   * (las alfombras): pone el modelo de esa medida en el mismo sitio y con el
   * mismo giro. Si con la nueva medida no cabe ahí (una pared u otro mueble),
   * se aparta lo justo (hasta 0,5 m); si tampoco, no cambia y devuelve false.
   */
  async cambiarTamano(obj: ObjetoColocado, ancho: number, fondo: number): Promise<boolean> {
    const nuevo = conTamano(obj.item, ancho, fondo);
    if (!nuevo || obj.colocacion !== 'suelo' || !this.objetos.includes(obj)) return false;
    if (nuevo === obj.item) return true;
    const raiz = await crearModelo(nuevo);
    if (!this.objetos.includes(obj)) return false; // se ha borrado mientras se cargaba
    const anterior = obj.item;
    obj.item = nuevo;
    const sitio = this.espacio.buscarSitio(this.huella(obj), 0.5, this.obstaculos(obj));
    if (!sitio) {
      obj.item = anterior;
      this.notificar(false);
      return false;
    }
    raiz.position.set(sitio.x, 0, sitio.z);
    raiz.rotation.y = obj.raiz.rotation.y;
    raiz.visible = obj.raiz.visible;
    raiz.userData.objeto = obj;
    this.escena.remove(obj.raiz);
    this.escena.add(raiz);
    obj.raiz = raiz;
    this.moverApoyados(obj);
    this.notificar();
    return true;
  }

  // --- Pared ---------------------------------------------------------------------------

  /** Rectángulos de los objetos colgados (menos `excepto`): los que no se pueden pisar en la pared. */
  rectsPared(excepto?: ObjetoColocado): RectPared[] {
    return this.objetos
      .filter((o) => o !== excepto && o.colocacion === 'pared' && o.pared && this.cuenta(o, excepto))
      .map((o): RectPared => ({ cara: o.pared!.cara, u: o.pared!.u, y: o.pared!.y, ancho: o.item.dimensiones.ancho, alto: o.item.dimensiones.alto }))
      .concat(this.rectsFijos);
  }

  /** Posición válida en una cara lo más cerca posible de (u, y), o null. */
  sitioEnPared(item: ItemCatalogo, cara: CaraColgable, u: number, y: number, excepto?: ObjetoColocado): EnPared | null {
    const { ancho, alto } = item.dimensiones;
    if (alto > cara.alto) return null;
    const yy = limitarAltura(cara, y, alto);
    const uu = buscarEnCara({ cara, u, y: yy, ancho, alto }, this.rectsPared(excepto));
    return uu === null ? null : { cara, u: uu, y: yy };
  }

  /** Pared libre más cercana a (x, z) (primero en la estancia y caras preferidas; luego en cualquiera). */
  paredLibreCerca(item: ItemCatalogo, x: number, z: number, estancia: string | null, preferir: (c: CaraColgable) => boolean = () => true, excepto?: ObjetoColocado): EnPared | null {
    const y = alturaCentroDe(item);
    const intentos: ((c: CaraColgable) => boolean)[] = [
      (c) => (!estancia || c.estancia === estancia) && preferir(c),
      (c) => !estancia || c.estancia === estancia,
      () => true,
    ];
    for (const filtro of intentos) {
      const candidatas = this.caras.filter(filtro)
        .map((cara) => {
          const t = (x - cara.a[0]) * cara.dir[0] + (z - cara.a[1]) * cara.dir[1];
          const u = Math.min(cara.largo, Math.max(0, t));
          const d = Math.hypot(x - (cara.a[0] + cara.dir[0] * u), z - (cara.a[1] + cara.dir[1] * u));
          return { cara, u, d };
        })
        .sort((p, q) => p.d - q.d);
      for (const { cara, u } of candidatas) {
        const sitio = this.sitioEnPared(item, cara, u, y, excepto);
        if (sitio) return sitio;
      }
    }
    return null;
  }

  /**
   * Lleva un objeto a una cara de pared, lo más cerca posible de `u` (con
   * la altura que ya tenía, o la de su ficha). Sirve para arrastrarlo y para
   * pasarlo de una pared a otra. Devuelve false si en esa cara no cabe.
   */
  colgar(obj: ObjetoColocado, cara: CaraColgable, u: number, guardar = true): boolean {
    if (obj.item.colocacion !== 'pared') return false;
    const y = obj.pared?.y ?? alturaCentroDe(obj.item);
    const sitio = this.sitioEnPared(obj.item, cara, u, y, obj);
    if (!sitio) return false;
    this.ponerEnPared(obj, sitio);
    this.notificar(guardar);
    return true;
  }

  /**
   * Cambia la altura del centro de un objeto de pared. Si a esa altura tapa
   * un hueco o choca con otro objeto, se queda donde estaba (devuelve false).
   */
  ponerAltura(obj: ObjetoColocado, y: number, guardar = true): boolean {
    if (obj.colocacion !== 'pared' || !obj.pared) return false;
    const { cara, u } = obj.pared;
    const { ancho, alto } = obj.item.dimensiones;
    const yy = limitarAltura(cara, y, alto);
    if (!validoEnPared({ cara, u, y: yy, ancho, alto }, this.rectsPared(obj))) { this.notificar(false); return false; }
    this.ponerEnPared(obj, { cara, u, y: yy });
    this.notificar(guardar);
    return true;
  }

  private ponerEnPared(obj: ObjetoColocado, sitio: EnPared) {
    const { alto, fondo } = obj.item.dimensiones;
    const p = puntoEnPared(sitio.cara, sitio.u, sitio.y, alto, fondo);
    obj.colocacion = 'pared';
    obj.pared = { ...sitio };
    obj.apoyo = undefined;
    obj.raiz.position.set(p.x, p.y, p.z);
    this.aplicarRotacion(obj, THREE.MathUtils.radToDeg(p.giro));
  }

  // --- Superficies ------------------------------------------------------------------------

  /** ¿Puede este objeto hacer de soporte? (los muebles de suelo que están en el suelo) */
  esSoporte(obj: ObjetoColocado): boolean {
    return obj.item.colocacion === 'suelo' && obj.colocacion === 'suelo' && superficiesDe(obj.item).length > 0
      && (this.cargando || this.capas.visible(obj.capa));
  }

  /** Objetos apoyados sobre un mueble. */
  apoyadosEn(soporte: ObjetoColocado): ObjetoColocado[] {
    return this.objetos.filter((o) => o.colocacion === 'superficie' && o.apoyo?.soporte === soporte);
  }

  /** Coordenadas (x, z) del mundo pasadas al sistema del mueble (centro de su base, sin girar). */
  aLocal(soporte: ObjetoColocado, x: number, z: number): { x: number; z: number } {
    const g = soporte.raiz.rotation.y, c = Math.cos(g), s = Math.sin(g);
    const dx = x - soporte.raiz.position.x, dz = z - soporte.raiz.position.z;
    return { x: c * dx - s * dz, z: s * dx + c * dz };
  }

  /** Coordenadas del mueble pasadas al mundo. */
  aMundo(soporte: ObjetoColocado, x: number, z: number): [number, number] {
    const g = soporte.raiz.rotation.y, c = Math.cos(g), s = Math.sin(g);
    return [soporte.raiz.position.x + c * x + s * z, soporte.raiz.position.z - s * x + c * z];
  }

  /**
   * Sitio libre (en coordenadas del mueble) más cercano a (x, z) en la tapa
   * o balda `nivel`, para un objeto con giro `giro` (grados, respecto al
   * mueble). Null si no cabe: el mueble no tiene esa balda, el objeto no
   * cumple la regla de apoyo (más grande que la superficie o más alto que
   * su altura libre) o no queda hueco libre.
   */
  sitioEnSoporte(item: ItemCatalogo, soporte: ObjetoColocado, nivel: number, x: number, z: number, giro: number, excepto?: ObjetoColocado, radioMax = Infinity): { x: number; z: number } | null {
    const zona = zonaEn(soporte.item, nivel);
    if (!zona || motivoNoCabe(item.dimensiones, giro, zona)) return null;
    const g = THREE.MathUtils.degToRad(giro);
    const { ancho, fondo } = item.dimensiones;
    const otros = this.objetos
      .filter((o) => o !== excepto && o.colocacion === 'superficie' && o.apoyo?.soporte === soporte && Math.abs(o.apoyo.nivel - nivel) < 1e-6
        && this.cuenta(o, excepto) && !this.paresSolape.get(excepto!)?.has(o))
      .map((o) => huellaRectangulo(o.apoyo!.x, o.apoyo!.z, o.item.dimensiones.ancho, o.item.dimensiones.fondo, THREE.MathUtils.degToRad(o.apoyo!.giro)));
    const vale = (px: number, pz: number) => {
      if (!dentroDeZona(zona, px, pz, ancho, fondo, giro)) return false;
      const dentro = encoger(huellaRectangulo(px, pz, ancho, fondo, g), HOLGURA);
      return !otros.some((o) => convexosSeSolapan(dentro, o));
    };
    // Hasta dónde puede ir el centro del objeto dentro de la superficie (con su tamaño girado)
    const medio = medioGirado(item.dimensiones, giro);
    const hx = Math.max(0, zona.ancho / 2 - medio.x), hz = Math.max(0, zona.fondo / 2 - medio.z);
    const x0 = Math.min(zona.x + hx, Math.max(zona.x - hx, x)), z0 = Math.min(zona.z + hz, Math.max(zona.z - hz, z));
    if (vale(x0, z0)) return { x: x0, z: z0 };
    // Rejilla de puntos de la superficie, del más cercano al más lejano
    const puntos: [number, number, number][] = [];
    for (let px = zona.x - hx; px <= zona.x + hx + 1e-9; px += PASO_SUPERFICIE) {
      for (let pz = zona.z - hz; pz <= zona.z + hz + 1e-9; pz += PASO_SUPERFICIE) {
        const d = Math.hypot(px - x0, pz - z0);
        if (d <= radioMax) puntos.push([d, px, pz]);
      }
    }
    puntos.sort((p, q) => p[0] - q[0]);
    for (const [, px, pz] of puntos) if (vale(px, pz)) return { x: px, z: pz };
    return null;
  }

  /**
   * Por qué no se puede apoyar `item` (con giro `giroMundo`) en ninguna
   * superficie del mueble: "grande" (su huella no cabe en ninguna), "alto"
   * (cabe de ancho y fondo en alguna, pero no de alto) o "lleno" (cabría,
   * pero no queda sitio libre). null si se puede apoyar en alguna.
   */
  motivoNoApoyo(item: ItemCatalogo, soporte: ObjetoColocado, giroMundo: number, excepto?: ObjetoColocado): MotivoNoApoyo | null {
    const giro = normalizar(giroMundo - soporte.rotacion);
    const zonas = zonasDe(soporte.item);
    const motivos = zonas.map((z) => motivoNoCabe(item.dimensiones, giro, z));
    if (motivos.some((m) => m === null)) {
      return zonas.some((z) => this.sitioEnSoporte(item, soporte, z.altura, z.x, z.z, giro, excepto)) ? null : 'lleno';
    }
    return motivos.includes('alto') ? 'alto' : 'grande';
  }

  /**
   * ¿Cumple su apoyo la regla? (el mueble tiene esa balda, el objeto cabe en
   * ella de tamaño y de alto, y está dentro de su superficie). Los que no
   * están apoyados, sí.
   */
  apoyoValido(obj: ObjetoColocado): boolean {
    const a = obj.apoyo;
    if (obj.colocacion !== 'superficie' || !a) return true;
    const zona = zonaEn(a.soporte.item, a.nivel);
    return !!zona && !motivoNoCabe(obj.item.dimensiones, a.giro, zona)
      && dentroDeZona(zona, a.x, a.z, obj.item.dimensiones.ancho, obj.item.dimensiones.fondo, a.giro);
  }

  /** Objetos visibles apoyados que no cumplen la regla de apoyo (marcados en rojo; no se mueven solos). */
  apoyosInvalidos(): ObjetoColocado[] {
    return this.objetos.filter((o) => this.invalidos.has(o));
  }

  /**
   * El mueble libre más cercano a (x, z) del mundo donde cabe el objeto
   * (dentro de `radio` metros), probando sus tapas y baldas de arriba abajo.
   * Con `estancia`, primero los muebles de esa estancia.
   */
  buscarApoyo(item: ItemCatalogo, x: number, z: number, giroMundo = 0, radio = 2, excepto: ObjetoColocado | null = null, estancia: string | null = null): Apoyo | null {
    const soportes = this.objetos
      .filter((o) => o !== excepto && this.esSoporte(o))
      .map((o) => ({ o, d: Math.hypot(o.raiz.position.x - x, o.raiz.position.z - z) }))
      .filter(({ o, d }) => d <= radio || (estancia !== null && this.espacio.estanciaEn(o.raiz.position.x, o.raiz.position.z) === estancia))
      .sort((p, q) => {
        if (estancia) {
          const ep = this.espacio.estanciaEn(p.o.raiz.position.x, p.o.raiz.position.z) === estancia ? 0 : 1;
          const eq = this.espacio.estanciaEn(q.o.raiz.position.x, q.o.raiz.position.z) === estancia ? 0 : 1;
          if (ep !== eq) return ep - eq;
        }
        return p.d - q.d;
      });
    for (const { o } of soportes) {
      const giro = normalizar(giroMundo - o.rotacion);
      const local = this.aLocal(o, x, z);
      for (const nivel of [...superficiesDe(o.item)].reverse()) {
        const sitio = this.sitioEnSoporte(item, o, nivel, local.x, local.z, giro, excepto ?? undefined);
        if (sitio) return { soporte: o, nivel, ...sitio, giro };
      }
    }
    return null;
  }

  /**
   * Para escenas guardadas cuyo apoyo ya no cumple la regla: apoya el objeto
   * en otra superficie del mismo mueble donde quepa (la de altura más
   * parecida), si no en el mueble libre más cercano (a menos de 1,5 m) y si
   * no, en el suelo, en el sitio libre más cercano. Null si no cabe en nada.
   */
  async agregarReubicado(item: ItemCatalogo, soporte: ObjetoColocado | undefined, nivel: number, x: number, z: number, giroMundo: number): Promise<ObjetoColocado | null> {
    if (soporte) {
      const giro = normalizar(giroMundo - soporte.rotacion);
      const local = this.aLocal(soporte, x, z);
      const otras = superficiesDe(soporte.item).filter((n) => Math.abs(n - nivel) > 1e-6).sort((a, b) => Math.abs(a - nivel) - Math.abs(b - nivel));
      for (const n of otras) {
        const sitio = this.sitioEnSoporte(item, soporte, n, local.x, local.z, giro);
        if (sitio) {
          const obj = await this.crear(item);
          this.ponerSobre(obj, { soporte, nivel: n, ...sitio, giro });
          return this.alta(obj);
        }
      }
    }
    const apoyo = this.buscarApoyo(item, x, z, giroMundo, 1.5, null);
    if (apoyo && apoyo.soporte !== soporte) {
      const obj = await this.crear(item);
      this.ponerSobre(obj, apoyo);
      return this.alta(obj);
    }
    return this.agregar(item, x, z, giroMundo);
  }

  /**
   * Apoya (o mueve) un objeto de superficie sobre un mueble, en la tapa o
   * balda `nivel`, lo más cerca posible de (x, z) del mundo. Devuelve false
   * si ahí no cabe.
   */
  apoyar(obj: ObjetoColocado, soporte: ObjetoColocado, nivel: number, x: number, z: number, guardar = true): boolean {
    if (obj.item.colocacion !== 'superficie' || soporte === obj || !this.esSoporte(soporte)) return false;
    const giro = obj.apoyo?.soporte === soporte ? obj.apoyo.giro : normalizar(obj.rotacion - soporte.rotacion);
    const local = this.aLocal(soporte, x, z);
    const sitio = this.sitioEnSoporte(obj.item, soporte, nivel, local.x, local.z, giro, obj);
    if (!sitio) return false;
    this.ponerSobre(obj, { soporte, nivel, ...sitio, giro });
    this.notificar(guardar);
    return true;
  }

  /**
   * Baja un objeto de superficie al suelo, en el sitio libre más cercano a
   * (x, z). Devuelve false si no hay sitio.
   */
  bajarAlSuelo(obj: ObjetoColocado, x: number, z: number, guardar = true, radio = 1): boolean {
    if (obj.colocacion === 'suelo' && Math.hypot(obj.raiz.position.x - x, obj.raiz.position.z - z) < 1e-9) return true;
    const sitio = this.espacio.buscarSitio(
      { x, z, ancho: obj.item.dimensiones.ancho, fondo: obj.item.dimensiones.fondo, giro: obj.raiz.rotation.y },
      radio, this.obstaculos(obj),
    );
    if (!sitio) return false;
    obj.colocacion = 'suelo';
    obj.apoyo = undefined;
    obj.pared = undefined;
    obj.raiz.position.set(sitio.x, 0, sitio.z);
    this.notificar(guardar);
    return true;
  }

  private ponerSobre(obj: ObjetoColocado, apoyo: Apoyo) {
    obj.colocacion = 'superficie';
    obj.apoyo = { ...apoyo };
    obj.pared = undefined;
    this.colocarApoyado(obj);
  }

  /** Recalcula la posición en el mundo de un objeto apoyado a partir de su mueble. */
  private colocarApoyado(obj: ObjetoColocado) {
    const a = obj.apoyo!;
    const [x, z] = this.aMundo(a.soporte, a.x, a.z);
    obj.raiz.position.set(x, a.nivel, z);
    this.aplicarRotacion(obj, a.soporte.rotacion + a.giro);
  }

  /** Lleva consigo lo que hay encima de un mueble (al moverlo o girarlo). */
  private moverApoyados(soporte: ObjetoColocado) {
    for (const o of this.apoyadosEn(soporte)) this.colocarApoyado(o);
  }

  /** Un objeto se ha quedado sin mueble: a otro mueble libre cercano o, si no hay, al suelo. */
  private reubicar(obj: ObjetoColocado, soporteBorrado: ObjetoColocado) {
    const { x, z } = obj.raiz.position;
    const apoyo = this.buscarApoyo(obj.item, x, z, obj.rotacion, 1.5, obj);
    if (apoyo && apoyo.soporte !== soporteBorrado) {
      this.ponerSobre(obj, apoyo);
      return;
    }
    if (!this.bajarAlSuelo(obj, x, z, false, this.espacio.radioTotal())) {
      // No cabe en ninguna parte: se quita también
      const i = this.objetos.indexOf(obj);
      if (i >= 0) this.objetos.splice(i, 1);
      this.escena.remove(obj.raiz);
    }
  }

  // --- Capas -----------------------------------------------------------------------------

  /** ¿Se ve el objeto? (su capa está visible) */
  visible(obj: ObjetoColocado) { return this.capas.visible(obj.capa); }
  /** ¿Se puede seleccionar y mover? (su capa está visible y desbloqueada) */
  editable(obj: ObjetoColocado) { return this.capas.editable(obj.capa); }

  /** ¿Cuenta `o` como obstáculo para `para`? Al cargar, solo los de la misma capa; si no, los de capas visibles. */
  private cuenta(o: ObjetoColocado, para?: ObjetoColocado) {
    if (this.cargando) return o.capa === (para?.capa ?? this.capaNuevos ?? this.capas.activa);
    return this.capas.visible(o.capa);
  }

  /** Objetos de una capa. */
  deCapa(capa: string) { return this.objetos.filter((o) => o.capa === capa); }

  /** Por qué no se puede añadir ahora a la capa activa (o null si se puede). */
  puedeAnadir(): string | null {
    const c = this.capas.capaActiva();
    if (!c.visible) return `La capa activa "${c.nombre}" está oculta: muéstrala (👁) o elige otra capa para añadir objetos.`;
    if (c.bloqueada) return `La capa activa "${c.nombre}" está bloqueada: desbloquéala (🔒) o elige otra capa para añadir objetos.`;
    return null;
  }

  /**
   * Tras cambiar la visibilidad o el bloqueo de las capas: oculta o muestra
   * sus objetos, deselecciona si el seleccionado ya no se puede editar y
   * recalcula los solapes.
   */
  actualizarCapas() {
    for (const o of this.objetos) o.raiz.visible = this.visible(o);
    if (this.seleccionado && !this.editable(this.seleccionado)) this.seleccionado = null;
    this.actualizarResaltado();
    this.notificar(false);
  }

  /**
   * Pasa un objeto a otra capa (visible y desbloqueada). No se mueve: si
   * queda solapado con algo, se marca en rojo. Devuelve false si no se puede.
   */
  ponerCapa(obj: ObjetoColocado, capa: string): boolean {
    if (!this.capas.existe(capa) || !this.capas.editable(capa) || !this.objetos.includes(obj)) return false;
    if (obj.capa === capa) return true;
    obj.capa = capa;
    obj.raiz.visible = this.visible(obj);
    this.notificar();
    return true;
  }

  /** Quita objetos de la escena; lo que otros tenían encima pasa a otro mueble cercano o al suelo. */
  private quitarVarios(lista: ObjetoColocado[]) {
    const quitar = new Set(lista);
    for (const o of quitar) {
      this.objetos.splice(this.objetos.indexOf(o), 1);
      this.escena.remove(o.raiz);
    }
    for (const soporte of quitar) for (const a of this.apoyadosEn(soporte)) this.reubicar(a, soporte);
    if (this.seleccionado && quitar.has(this.seleccionado)) this.seleccionado = null;
    this.actualizarResaltado();
  }

  /** Borra una capa (no Base) con todos sus objetos. Se puede deshacer con el historial. */
  borrarCapa(id: string): boolean {
    if (!this.capas.existe(id) || id === 'base') return false;
    this.quitarVarios(this.deCapa(id));
    this.capas.quitar(id);
    this.notificar();
    return true;
  }

  /**
   * Duplica una capa con todos sus objetos, en el mismo sitio. La copia queda
   * visible, desbloqueada y activa, y la original se OCULTA (si no, todo
   * quedaría solapado con su copia). Lo apoyado sobre un mueble de la capa
   * va sobre la copia de ese mueble; lo apoyado en muebles de otras capas, sobre el mismo mueble.
   */
  async duplicarCapa(id: string): Promise<Capa | null> {
    const origen = this.capas.get(id);
    if (!origen) return null;
    const fuente = this.deCapa(id);
    const copia = this.capas.crearCopia(id)!;
    this.capas.ponerVisible(id, false);
    const orden = (o: ObjetoColocado) => (o.colocacion === 'suelo' ? 0 : o.colocacion === 'superficie' ? 1 : 2);
    const copias = new Map<ObjetoColocado, ObjetoColocado>();
    const anterior = this.capaNuevos;
    this.capaNuevos = copia.id;
    try {
      for (const o of [...fuente].sort((a, b) => orden(a) - orden(b))) {
        const c = await this.crear(o.item);
        c.colocacion = o.colocacion;
        c.raiz.position.copy(o.raiz.position);
        this.aplicarRotacion(c, o.rotacion);
        if (o.pared) c.pared = { ...o.pared };
        if (o.apoyo) {
          c.apoyo = { ...o.apoyo, soporte: copias.get(o.apoyo.soporte) ?? o.apoyo.soporte };
          this.colocarApoyado(c);
        }
        this.alta(c);
        copias.set(o, c);
      }
    } finally {
      this.capaNuevos = anterior;
    }
    this.actualizarCapas();
    this.notificar();
    return copia;
  }

  /** Quita los objetos de las capas visibles y desbloqueadas (botón Vaciar). Devuelve cuántos. */
  vaciarEditables(): number {
    const lista = this.objetos.filter((o) => this.editable(o));
    this.quitarVarios(lista);
    this.notificar();
    return lista.length;
  }

  /**
   * Sustituye los objetos de una capa por los que ponga `colocar` (p. ej.
   * restaurar la disposición original en Base) sin tocar las demás capas. Lo
   * que otras capas tenían apoyado en un mueble de esta vuelve a apoyarse en
   * el mismo mueble restaurado (mismo objeto del catálogo, a menos de 0,5 m),
   * en el mismo sitio si cabe; si no, va a otro mueble cercano o al suelo.
   */
  async reemplazarCapa<T>(capa: string, colocar: () => Promise<T>): Promise<T> {
    const viejos = this.deCapa(capa);
    const fuera = this.objetos.filter((o) => o.capa !== capa && o.colocacion === 'superficie' && o.apoyo && viejos.includes(o.apoyo.soporte));
    for (const o of viejos) {
      this.objetos.splice(this.objetos.indexOf(o), 1);
      this.escena.remove(o.raiz);
    }
    if (this.seleccionado && viejos.includes(this.seleccionado)) this.seleccionado = null;
    const resultado = await colocar();
    for (const a of fuera) {
      const viejo = a.apoyo!.soporte;
      const nuevo = this.deCapa(capa)
        .filter((o) => o.item.id === viejo.item.id && o.colocacion === 'suelo')
        .map((o) => ({ o, d: o.raiz.position.distanceTo(viejo.raiz.position) }))
        .sort((p, q) => p.d - q.d)[0];
      const sitio = nuevo && nuevo.d < 0.5
        ? this.sitioEnSoporte(a.item, nuevo.o, a.apoyo!.nivel, a.apoyo!.x, a.apoyo!.z, a.apoyo!.giro, a)
        : null;
      if (nuevo && sitio) this.ponerSobre(a, { ...a.apoyo!, soporte: nuevo.o, ...sitio });
      else this.reubicar(a, viejo);
    }
    this.actualizarCapas();
    this.notificar();
    return resultado;
  }

  /** Objetos visibles apoyados en un mueble de una capa oculta (se quedan en su sitio). */
  apoyadosSobreOcultos(): ObjetoColocado[] {
    return this.objetos.filter((o) => this.visible(o) && o.colocacion === 'superficie' && o.apoyo && !this.visible(o.apoyo.soporte));
  }

  // --- Solapes ---------------------------------------------------------------------------

  /** Objetos (de capas visibles) solapados con algún otro. Se marcan en rojo translúcido. */
  solapes(): ObjetoColocado[] {
    return this.objetos.filter((o) => this.paresSolape.has(o));
  }

  /** Calcula qué objetos visibles se solapan: en el suelo, en la misma pared o sobre la misma tapa. */
  calcularSolapes(): Map<ObjetoColocado, Set<ObjetoColocado>> {
    const pares = new Map<ObjetoColocado, Set<ObjetoColocado>>();
    const anotar = (a: ObjetoColocado, b: ObjetoColocado) => {
      if (!pares.has(a)) pares.set(a, new Set());
      if (!pares.has(b)) pares.set(b, new Set());
      pares.get(a)!.add(b);
      pares.get(b)!.add(a);
    };
    const vis = this.objetos.filter((o) => this.visible(o));
    // En el suelo: huellas (con 1 mm de holgura por lado, como en los choques)
    // (las alfombras van debajo de todo: nunca se solapan con nada)
    const suelo = vis.filter((o) => o.colocacion === 'suelo' && !esAlfombra(o.item)).map((o) => {
      const h = this.huella(o);
      return { o, h: encoger(huellaRectangulo(h.x, h.z, h.ancho, h.fondo, h.giro) as Punto[], HOLGURA) };
    });
    for (let i = 0; i < suelo.length; i++) {
      for (let j = i + 1; j < suelo.length; j++) {
        if (convexosSeSolapan(suelo[i].h, suelo[j].h)) anotar(suelo[i].o, suelo[j].o);
      }
    }
    // En la pared: rectángulos en la misma cara
    const pared = vis.filter((o) => o.colocacion === 'pared' && o.pared);
    for (let i = 0; i < pared.length; i++) {
      for (let j = i + 1; j < pared.length; j++) {
        const a = pared[i], b = pared[j];
        if (a.pared!.cara !== b.pared!.cara) continue;
        const du = Math.abs(a.pared!.u - b.pared!.u), dy = Math.abs(a.pared!.y - b.pared!.y);
        if (du < (a.item.dimensiones.ancho + b.item.dimensiones.ancho) / 2 - HOLGURA
          && dy < (a.item.dimensiones.alto + b.item.dimensiones.alto) / 2 - HOLGURA) anotar(a, b);
      }
    }
    // Sobre la misma tapa o balda
    const encima = vis.filter((o) => o.colocacion === 'superficie' && o.apoyo).map((o) => {
      const a = o.apoyo!;
      return { o, a, h: encoger(huellaRectangulo(a.x, a.z, o.item.dimensiones.ancho, o.item.dimensiones.fondo, THREE.MathUtils.degToRad(a.giro)) as Punto[], HOLGURA) };
    });
    for (let i = 0; i < encima.length; i++) {
      for (let j = i + 1; j < encima.length; j++) {
        const p = encima[i], q = encima[j];
        if (p.a.soporte === q.a.soporte && Math.abs(p.a.nivel - q.a.nivel) < 1e-6 && convexosSeSolapan(p.h, q.h)) anotar(p.o, q.o);
      }
    }
    return pares;
  }

  private actualizarSolapes() {
    this.paresSolape = this.calcularSolapes();
    this.invalidos = new Set(this.objetos.filter((o) => this.visible(o) && !this.apoyoValido(o)));
    for (const o of this.objetos) this.marcar(o, this.enRojo(o));
  }

  /** ¿Va marcado en rojo? (solapado o con un apoyo que no cumple la regla) */
  private enRojo(o: ObjetoColocado) { return this.paresSolape.has(o) || this.invalidos.has(o); }

  /** Pone o quita la caja roja translúcida de un objeto solapado (o mal apoyado). */
  private marcar(obj: ObjetoColocado, solapado: boolean) {
    let marca = obj.raiz.userData.marcaSolape as THREE.Mesh | undefined;
    if (solapado && !marca) {
      const { ancho, fondo, alto } = obj.item.dimensiones;
      marca = new THREE.Mesh(new THREE.BoxGeometry(ancho + 0.02, alto + 0.02, fondo + 0.02), this.materialSolape);
      marca.name = 'marca-solape';
      marca.position.y = alto / 2;
      marca.renderOrder = 10;
      marca.raycast = () => {}; // no se puede tocar: el clic va al objeto
      obj.raiz.add(marca);
      obj.raiz.userData.marcaSolape = marca;
    }
    if (marca) marca.visible = solapado && this.marcasVisibles;
  }

  // --- Varios -----------------------------------------------------------------------------

  /**
   * Alfombras pisándose: todas están a ras de suelo con el mismo grosor, así
   * que se dibujarían mezcladas. Cada una se hace 1 mm más gruesa que la
   * anterior (por orden en la lista: la añadida después, encima). Solo cambia
   * el dibujo (escala vertical del modelo); la ficha y lo guardado, no.
   */
  private apilarAlfombras() {
    let k = 0;
    for (const o of this.objetos) {
      if (!esAlfombra(o.item)) continue;
      o.raiz.scale.y = 1 + (0.001 * k++) / o.item.dimensiones.alto;
    }
  }

  /** Busca el objeto al que pertenece una malla (la que devuelve el raycaster). */
  objetoDe(nodo: THREE.Object3D | null): ObjetoColocado | null {
    for (let n = nodo; n; n = n.parent) {
      if (n.userData.objeto) return n.userData.objeto as ObjetoColocado;
    }
    return null;
  }

  private aplicarRotacion(obj: ObjetoColocado, grados: number) {
    obj.rotacion = normalizar(grados);
    obj.raiz.rotation.y = THREE.MathUtils.degToRad(obj.rotacion);
  }

  /**
   * Huellas de los objetos que están en el suelo, menos `excepto` (los
   * obstáculos para él), y de los elementos fijos colgados más bajos que su
   * parte de arriba. (Los fijos del suelo ya los tiene en cuenta EspacioLibre.)
   * Las alfombras no son obstáculo para nadie, y para una alfombra no lo es
   * ningún objeto (va debajo de los muebles).
   */
  obstaculos(excepto?: ObjetoColocado): Obstaculo[] {
    const alto = excepto ? excepto.item.dimensiones.alto : Infinity;
    const debajo = !!excepto && esAlfombra(excepto.item);
    // Con los que ya estaba solapado no choca (para poder sacarlo del solape)
    const yaSolapados = excepto ? this.paresSolape.get(excepto) : undefined;
    return this.objetos
      .filter((o) => !debajo && o !== excepto && o.colocacion === 'suelo' && !esAlfombra(o.item) && this.cuenta(o, excepto) && !yaSolapados?.has(o))
      .map((o) => {
        const h = this.huella(o);
        return huellaRectangulo(h.x, h.z, h.ancho, h.fondo, h.giro) as Punto[];
      })
      .concat(this.colgados.filter((c) => c.base < alto - 1e-6).map((c) => c.huella));
  }

  /** Rectángulo que ocupa el objeto en planta. */
  huella(obj: ObjetoColocado): Huella {
    return {
      x: obj.raiz.position.x,
      z: obj.raiz.position.z,
      ancho: obj.item.dimensiones.ancho,
      fondo: obj.item.dimensiones.fondo,
      giro: obj.raiz.rotation.y,
    };
  }

  /** Oculta (false) o vuelve a mostrar la caja del seleccionado (p. ej. para hacer una captura). */
  mostrarResaltado(visible: boolean) {
    this.resaltado.visible = visible && !!this.seleccionado;
    this.marcasVisibles = visible;
    for (const o of this.objetos) this.marcar(o, this.enRojo(o));
  }

  private actualizarResaltado() {
    const sel = this.seleccionado;
    this.resaltado.visible = !!sel;
    if (sel) this.resaltado.setFromObject(sel.raiz);
  }
}
