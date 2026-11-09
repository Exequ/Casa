// Gestión de los objetos colocados en la habitación: añadir, mover, rotar,
// borrar y seleccionar. Aquí también se impide que atraviesen las paredes.

import * as THREE from 'three';
import type { ItemCatalogo } from '../catalogo/catalogo';
import { crearModelo } from '../catalogo/modelos';
import type { Habitacion } from './habitacion';

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
  private habitacion: Habitacion;

  constructor(escena: THREE.Scene, habitacion: Habitacion) {
    this.escena = escena;
    this.habitacion = habitacion;
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

  /** Coloca un objeto del catálogo en (x, z) con un giro en grados. */
  async agregar(item: ItemCatalogo, x = 0, z = 0, rotacion = 0): Promise<ObjetoColocado> {
    const raiz = await crearModelo(item);
    const obj: ObjetoColocado = { uid: this.siguienteUid++, item, raiz, rotacion: 0 };
    raiz.userData.objeto = obj; // para encontrarlo al hacer clic
    this.escena.add(raiz);
    this.objetos.push(obj);
    this.aplicarRotacion(obj, rotacion);
    this.aplicarPosicion(obj, x, z);
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

  /** Mueve un objeto a (x, z) sin dejar que atraviese las paredes. */
  mover(obj: ObjetoColocado, x: number, z: number, guardar = true) {
    this.aplicarPosicion(obj, x, z);
    this.notificar(guardar);
  }

  /** Fija el giro del objeto (en grados). */
  rotar(obj: ObjetoColocado, grados: number) {
    this.aplicarRotacion(obj, grados);
    // Al girar puede ocupar más en un eje: lo recolocamos para que no atraviese paredes.
    this.aplicarPosicion(obj, obj.raiz.position.x, obj.raiz.position.z);
    this.notificar();
  }

  /**
   * Gira el objeto `paso` grados (positivo = antihorario visto desde arriba).
   * Si `ajustar` es true, salta al siguiente múltiplo de `paso`
   * (p. ej. con paso 15: 37° → 45°, o 37° → 30° hacia el otro lado).
   */
  girar(obj: ObjetoColocado, paso: number, ajustar = true) {
    if (!ajustar) return this.rotar(obj, obj.rotacion + paso);
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

  private aplicarPosicion(obj: ObjetoColocado, x: number, z: number) {
    const { medioX, medioZ } = this.medioTamano(obj);
    const p = this.habitacion.limitar(x, z, medioX, medioZ);
    obj.raiz.position.set(p.x, 0, p.z);
    if (obj === this.seleccionado) this.actualizarResaltado();
  }

  /**
   * Mitad del espacio que ocupa el objeto en X y en Z una vez girado
   * (la "caja" alineada con las paredes que envuelve al rectángulo girado).
   */
  private medioTamano(obj: ObjetoColocado) {
    const a = obj.raiz.rotation.y;
    const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    const w = obj.item.dimensiones.ancho / 2, d = obj.item.dimensiones.fondo / 2;
    return { medioX: w * c + d * s, medioZ: w * s + d * c };
  }

  private actualizarResaltado() {
    const sel = this.seleccionado;
    this.resaltado.visible = !!sel;
    if (sel) this.resaltado.setFromObject(sel.raiz);
  }
}
