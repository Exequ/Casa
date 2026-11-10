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
//
// Los objetos de pared y los apoyados no son obstáculo para los del suelo.

import * as THREE from 'three';
import { alturaCentroDe, superficiesDe, type ItemCatalogo } from '../catalogo/catalogo';
import { crearModelo } from '../catalogo/modelos';
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
  pared?: EnPared;
  apoyo?: Apoyo;
}

type Oyente = () => void;

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

  private siguienteUid = 1;
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

  constructor(escena: THREE.Scene, espacio: EspacioLibre, caras: CaraColgable[] = [], fijos: Fijo[] = []) {
    this.escena = escena;
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
    if (this.seleccionado) this.actualizarResaltado();
    for (const fn of this.oyentesSeleccion) fn();
    if (guardar) for (const fn of this.oyentesCambio) fn();
  }

  // --- Añadir ------------------------------------------------------------------

  private async crear(item: ItemCatalogo): Promise<ObjetoColocado> {
    const raiz = await crearModelo(item);
    const obj: ObjetoColocado = { uid: this.siguienteUid++, item, raiz, rotacion: 0, colocacion: 'suelo' };
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

  /** Selecciona un objeto (o ninguno, con null). */
  seleccionar(obj: ObjetoColocado | null) {
    this.seleccionado = obj;
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

  // --- Pared ---------------------------------------------------------------------------

  /** Rectángulos de los objetos colgados (menos `excepto`): los que no se pueden pisar en la pared. */
  rectsPared(excepto?: ObjetoColocado): RectPared[] {
    return this.objetos
      .filter((o) => o !== excepto && o.colocacion === 'pared' && o.pared)
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
    return obj.item.colocacion === 'suelo' && obj.colocacion === 'suelo' && superficiesDe(obj.item).length > 0;
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
   * mueble). Null si no cabe: no hay hueco libre, no hay altura hasta la
   * balda de encima o el objeto es más grande que el mueble.
   */
  sitioEnSoporte(item: ItemCatalogo, soporte: ObjetoColocado, nivel: number, x: number, z: number, giro: number, excepto?: ObjetoColocado, radioMax = Infinity): { x: number; z: number } | null {
    const niveles = superficiesDe(soporte.item);
    if (!niveles.some((n) => Math.abs(n - nivel) < 1e-6)) return null;
    const encima = niveles.find((n) => n > nivel + 1e-6);
    if (encima !== undefined && item.dimensiones.alto > encima - nivel - 0.005) return null;
    const W = soporte.item.dimensiones.ancho / 2, F = soporte.item.dimensiones.fondo / 2;
    const g = THREE.MathUtils.degToRad(giro);
    const { ancho, fondo } = item.dimensiones;
    const otros = this.objetos
      .filter((o) => o !== excepto && o.colocacion === 'superficie' && o.apoyo?.soporte === soporte && Math.abs(o.apoyo.nivel - nivel) < 1e-6)
      .map((o) => huellaRectangulo(o.apoyo!.x, o.apoyo!.z, o.item.dimensiones.ancho, o.item.dimensiones.fondo, THREE.MathUtils.degToRad(o.apoyo!.giro)));
    const vale = (px: number, pz: number) => {
      const h = huellaRectangulo(px, pz, ancho, fondo, g);
      if (!h.every(([hx, hz]) => Math.abs(hx) <= W + 1e-6 && Math.abs(hz) <= F + 1e-6)) return false;
      const dentro = encoger(h, HOLGURA);
      return !otros.some((o) => convexosSeSolapan(dentro, o));
    };
    // Mitad del tamaño girado, para empezar dentro de la tapa
    const mx = Math.abs(Math.cos(g)) * ancho / 2 + Math.abs(Math.sin(g)) * fondo / 2;
    const mz = Math.abs(Math.sin(g)) * ancho / 2 + Math.abs(Math.cos(g)) * fondo / 2;
    if (mx > W + 1e-6 || mz > F + 1e-6) return null;
    const x0 = Math.min(W - mx, Math.max(-W + mx, x)), z0 = Math.min(F - mz, Math.max(-F + mz, z));
    if (vale(x0, z0)) return { x: x0, z: z0 };
    // Rejilla de puntos de la tapa, del más cercano al más lejano
    const puntos: [number, number, number][] = [];
    for (let px = -W + mx; px <= W - mx + 1e-9; px += PASO_SUPERFICIE) {
      for (let pz = -F + mz; pz <= F - mz + 1e-9; pz += PASO_SUPERFICIE) {
        const d = Math.hypot(px - x0, pz - z0);
        if (d <= radioMax) puntos.push([d, px, pz]);
      }
    }
    puntos.sort((p, q) => p[0] - q[0]);
    for (const [, px, pz] of puntos) if (vale(px, pz)) return { x: px, z: pz };
    return null;
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

  // --- Varios -----------------------------------------------------------------------------

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
   */
  obstaculos(excepto?: ObjetoColocado): Obstaculo[] {
    const alto = excepto ? excepto.item.dimensiones.alto : Infinity;
    return this.objetos
      .filter((o) => o !== excepto && o.colocacion === 'suelo')
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
  }

  private actualizarResaltado() {
    const sel = this.seleccionado;
    this.resaltado.visible = !!sel;
    if (sel) this.resaltado.setFromObject(sel.raiz);
  }
}
