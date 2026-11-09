// Gestión de los objetos colocados en la vivienda: añadir, mover, rotar,
// borrar y seleccionar. Aquí también se impide que atraviesen paredes,
// pilares, puertas o ventanas (con la ayuda de EspacioLibre).

import * as THREE from 'three';
import type { ItemCatalogo } from '../catalogo/catalogo';
import { crearModelo } from '../catalogo/modelos';
import type { EspacioLibre, Huella, Obstaculo } from '../vivienda/espacio';
import { huellaRectangulo } from '../vivienda/geometria';

/** Un objeto del catálogo colocado en la escena. */
export interface ObjetoColocado {
  /** Número único dentro de la sesión (para distinguir dos mesas iguales). */
  uid: number;
  item: ItemCatalogo;
  /** Nodo 3D del objeto. Su posición es el centro de la base; su rotación, el giro en Y. */
  raiz: THREE.Object3D;
  /** Giro alrededor del eje vertical, en grados [0, 360). */
  rotacion: number;
}

type Oyente = () => void;

export class GestorObjetos {
  readonly objetos: ObjetoColocado[] = [];
  seleccionado: ObjetoColocado | null = null;

  private siguienteUid = 1;
  /** Caja que resalta el objeto seleccionado. */
  private resaltado = new THREE.BoxHelper(new THREE.Object3D(), 0x2f7cf6);
  private oyentesCambio: Oyente[] = [];
  private oyentesSeleccion: Oyente[] = [];
  private escena: THREE.Scene;
  private espacio: EspacioLibre;

  constructor(escena: THREE.Scene, espacio: EspacioLibre) {
    this.escena = escena;
    this.espacio = espacio;
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
    for (const fn of this.oyentesSeleccion) fn();
    if (guardar) for (const fn of this.oyentesCambio) fn();
  }

  // --- Operaciones -----------------------------------------------------------

  /**
   * Coloca un objeto del catálogo en el sitio libre (sin paredes ni otros
   * muebles) más cercano a (x, z), con un giro en grados. Si no cabe en
   * ningún sitio de la vivienda, no lo añade y devuelve null.
   */
  async agregar(item: ItemCatalogo, x = 0, z = 0, rotacion = 0): Promise<ObjetoColocado | null> {
    const raiz = await crearModelo(item);
    const obj: ObjetoColocado = { uid: this.siguienteUid++, item, raiz, rotacion: 0 };
    raiz.userData.objeto = obj; // para encontrarlo al hacer clic
    this.aplicarRotacion(obj, rotacion);
    const sitio = this.espacio.buscarSitio({ ...this.huella(obj), x, z }, this.espacio.radioTotal(), this.obstaculos());
    if (!sitio) return null;
    obj.raiz.position.set(sitio.x, 0, sitio.z);
    this.escena.add(raiz);
    this.objetos.push(obj);
    return obj;
  }

  /** Quita un objeto de la escena. */
  borrar(obj: ObjetoColocado) {
    const i = this.objetos.indexOf(obj);
    if (i === -1) return;
    this.objetos.splice(i, 1);
    this.escena.remove(obj.raiz);
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

  /**
   * Arrastra un objeto hacia (x, z) sin dejar que atraviese paredes, pilares
   * ni otros muebles.
   * Puede pasar por una puerta si cabe; al terminar hay que llamar a asentar().
   */
  mover(obj: ObjetoColocado, x: number, z: number, guardar = true) {
    const p = this.espacio.mover(this.huella(obj), x, z, this.obstaculos(obj));
    obj.raiz.position.set(p.x, 0, p.z);
    if (obj === this.seleccionado) this.actualizarResaltado();
    this.notificar(guardar);
  }

  /**
   * Coloca definitivamente el objeto al soltarlo: si se ha quedado en el hueco
   * de una puerta, lo lleva al sitio libre más cercano.
   */
  asentar(obj: ObjetoColocado) {
    const sitio = this.espacio.asentar(this.huella(obj), this.obstaculos(obj));
    if (sitio) obj.raiz.position.set(sitio.x, 0, sitio.z);
    if (obj === this.seleccionado) this.actualizarResaltado();
    this.notificar();
  }

  /**
   * Fija el giro del objeto (en grados). Si girado no cabe donde está (por
   * una pared u otro mueble), se aparta lo mínimo; si no cabe en ningún
   * sitio cercano, no se gira.
   * Devuelve true si se ha podido girar.
   */
  rotar(obj: ObjetoColocado, grados: number): boolean {
    const anterior = obj.rotacion;
    this.aplicarRotacion(obj, grados);
    const sitio = this.espacio.buscarSitio(this.huella(obj), 1, this.obstaculos(obj));
    if (!sitio) {
      this.aplicarRotacion(obj, anterior);
      this.notificar(false);
      return false;
    }
    obj.raiz.position.set(sitio.x, 0, sitio.z);
    if (obj === this.seleccionado) this.actualizarResaltado();
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

  /** Busca el objeto al que pertenece una malla (la que devuelve el raycaster). */
  objetoDe(nodo: THREE.Object3D | null): ObjetoColocado | null {
    for (let n = nodo; n; n = n.parent) {
      if (n.userData.objeto) return n.userData.objeto as ObjetoColocado;
    }
    return null;
  }

  // --- Detalles internos -----------------------------------------------------

  private aplicarRotacion(obj: ObjetoColocado, grados: number) {
    obj.rotacion = ((grados % 360) + 360) % 360; // normaliza a [0, 360)
    if (Math.abs(obj.rotacion - 360) < 1e-9) obj.rotacion = 0;
    obj.raiz.rotation.y = THREE.MathUtils.degToRad(obj.rotacion);
  }

  /** Huellas de todos los muebles menos `excepto` (los obstáculos para él). */
  obstaculos(excepto?: ObjetoColocado): Obstaculo[] {
    return this.objetos
      .filter((o) => o !== excepto)
      .map((o) => {
        const h = this.huella(o);
        return huellaRectangulo(h.x, h.z, h.ancho, h.fondo, h.giro);
      });
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

  private actualizarResaltado() {
    const sel = this.seleccionado;
    this.resaltado.visible = !!sel;
    if (sel) this.resaltado.setFromObject(sel.raiz);
  }
}
