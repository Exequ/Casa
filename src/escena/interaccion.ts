// Interacción con el ratón, el dedo y el teclado sobre la escena 3D:
//   - Clic en un objeto: lo selecciona.  Clic en vacío: deselecciona.
//   - Arrastrar un objeto (ratón o dedo):
//       · muebles (suelo): se mueven por el suelo;
//       · cuadros y espejos (pared): se pegan a la pared a la que se apunta
//         (o a la más cercana al punto del suelo señalado) y corren a lo largo de ella;
//       · jarrones, plantas... (superficie): se apoyan en el mueble que hay
//         debajo del puntero si caben (regla de apoyo), o van por el suelo si
//         no hay ninguno o no caben (el panel dice por qué).
//   - Q / E: girar 15° (con Mayúsculas: 1°).  D: duplicar.  Supr: borrar.  Esc: deseleccionar.
//   - Ctrl+Z: deshacer.  Ctrl+Mayús+Z (o Ctrl+Y): rehacer.
// El resto de arrastres (en vacío) los gestiona la cámara orbital.
// Con el Modo cámara (candado) puesto, todo va a la cámara: no se selecciona
// ni se arrastra nada, no se resalta nada al pasar y las teclas de edición
// no hacen nada (ver modoCamara.ts).

import * as THREE from 'three';
import { superficiesDe } from '../catalogo/catalogo';
import { caraEnRayo, caraMasCercana, type CaraColgable } from '../vivienda/colgar';
import type { EspacioLibre } from '../vivienda/espacio';
import type { Escena } from './escena';
import { accionDeTecla } from './modoCamara';
import { textoNoApoyo, type AvisoApoyo, type GestorObjetos, type ObjetoColocado } from './objetos';

export interface OpcionesInteraccion {
  espacio: EspacioLibre;
  /** ¿Se ve ahora esa cara de pared? (las de los muros bajados no cuentan al apuntar) */
  caraVisible: (c: CaraColgable) => boolean;
  deshacer: () => void;
  rehacer: () => void;
  duplicar: () => void;
  /** ¿Está puesto el Modo cámara? (entonces solo se mueve la cámara) */
  modoCamara: () => boolean;
  /** Se ha pulsado una tecla de edición con el Modo cámara puesto. */
  avisarBloqueo: () => void;
  /** Se ha tocado (sin arrastrar) un objeto de una capa bloqueada. */
  avisarCapaBloqueada: (obj: ObjetoColocado) => void;
}

export interface Interaccion {
  /** Termina el arrastre en curso, si lo hay (p. ej. al poner el candado). */
  cancelarArrastre(): void;
}

export function activarInteraccion(escena: Escena, gestor: GestorObjetos, opciones: OpcionesInteraccion): Interaccion {
  const lienzo = escena.renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const sueloMatematico = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // plano y = 0

  /** Datos del arrastre en curso (si lo hay). */
  let arrastre: { obj: ObjetoColocado; desfase: THREE.Vector3; movido: boolean; puntero: number } | null = null;
  /** Dónde se pulsó el ratón sobre el vacío (para distinguir clic de giro de cámara). */
  let pulsacionEnVacio: { x: number; y: number; bloqueado: ObjetoColocado | null } | null = null;

  /** Prepara el raycaster con la posición del ratón. */
  function apuntar(e: PointerEvent) {
    const r = lienzo.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, escena.camara);
  }

  /** Objeto visible bajo el ratón (el primero que se toca), o null. */
  function objetoTocado(e: PointerEvent): ObjetoColocado | null {
    apuntar(e);
    // (los objetos ocultos, como los cuadros de un muro bajado o los de una capa oculta, no se pueden tocar)
    const impactos = raycaster.intersectObjects(gestor.objetos.filter((o) => o.raiz.visible).map((o) => o.raiz), true);
    return impactos.length ? gestor.objetoDe(impactos[0].object) : null;
  }

  /** Objeto que se puede seleccionar bajo el ratón, o null (los de capas bloqueadas tapan pero no se cogen). */
  function objetoBajoRaton(e: PointerEvent): ObjetoColocado | null {
    const obj = objetoTocado(e);
    return obj && gestor.editable(obj) ? obj : null;
  }

  /** Punto del suelo bajo el ratón, o null si se apunta al cielo. */
  function puntoEnSuelo(e: PointerEvent): THREE.Vector3 | null {
    apuntar(e);
    return raycaster.ray.intersectPlane(sueloMatematico, new THREE.Vector3());
  }

  /** Arrastre de un objeto de pared: a la pared señalada, o a la más cercana al punto del suelo señalado. */
  function arrastrarEnPared(obj: ObjetoColocado, e: PointerEvent) {
    apuntar(e);
    const { origin, direction } = raycaster.ray;
    const enRayo = caraEnRayo(gestor.caras, origin, direction, opciones.caraVisible);
    if (enRayo && gestor.colgar(obj, enRayo.cara, enRayo.u, false)) return;
    const p = raycaster.ray.intersectPlane(sueloMatematico, new THREE.Vector3());
    if (!p) return;
    const estancia = opciones.espacio.estanciaEn(p.x, p.z);
    const cerca = caraMasCercana(gestor.caras, p.x, p.z, estancia) ?? caraMasCercana(gestor.caras, p.x, p.z);
    if (cerca) gestor.colgar(obj, cerca.cara, cerca.u, false);
  }

  /**
   * Arrastre de un objeto de superficie: sobre el mueble que hay bajo el
   * puntero, en la superficie señalada o, si ahí no cabe (regla de apoyo o
   * falta de sitio), en la más alta de las de debajo donde quepa y luego en
   * las demás. Si no cabe en ninguna, el mueble le estorba como a un mueble
   * del suelo (va por el suelo) y se anota por qué en gestor.avisoApoyo.
   */
  function arrastrarEnSuperficie(obj: ObjetoColocado, e: PointerEvent) {
    apuntar(e);
    const soportes = gestor.objetos.filter((o) => o !== obj && gestor.esSoporte(o));
    const impacto = raycaster.intersectObjects(soportes.map((o) => o.raiz), true)[0];
    const soporte = impacto ? gestor.objetoDe(impacto.object) : null;
    let aviso: AvisoApoyo | null = null;
    if (impacto && soporte && soportes.includes(soporte)) {
      // La tapa o balda señalada: la más alta que queda por debajo del punto (y luego las demás)
      const niveles = superficiesDe(soporte.item);
      const debajo = niveles.filter((n) => n <= impacto.point.y + 0.05).reverse();
      const resto = niveles.filter((n) => !debajo.includes(n)).sort((p, q) => Math.abs(p - impacto.point.y) - Math.abs(q - impacto.point.y));
      for (const nivel of [...debajo, ...resto]) {
        if (gestor.apoyar(obj, soporte, nivel, impacto.point.x, impacto.point.z, false)) {
          gestor.avisoApoyo = null;
          return;
        }
      }
      const giro = obj.apoyo?.soporte === soporte ? obj.apoyo.giro + soporte.rotacion : obj.rotacion;
      const motivo = gestor.motivoNoApoyo(obj.item, soporte, giro, obj) ?? 'lleno';
      aviso = { objeto: obj, soporte, motivo, texto: textoNoApoyo(obj.item, soporte.item, motivo, ((giro - soporte.rotacion) % 360 + 360) % 360) };
    }
    gestor.avisoApoyo = aviso;
    const p = raycaster.ray.intersectPlane(sueloMatematico, new THREE.Vector3());
    if (!p) { gestor.notificar(false); return; }
    if (obj.colocacion === 'suelo') gestor.mover(obj, p.x, p.z, false);
    else if (!gestor.bajarAlSuelo(obj, p.x, p.z, false, 0.6)) gestor.notificar(false);
  }

  // Escuchamos en fase de captura para actuar ANTES que la cámara orbital:
  // si se pulsa sobre un objeto, desactivamos la cámara durante el arrastre.
  lienzo.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !e.isPrimary) return; // solo botón izquierdo / primer dedo
    // En Modo cámara no se mira si hay un objeto debajo: el gesto es de la cámara.
    const tocado = opciones.modoCamara() ? null : objetoTocado(e);
    const obj = tocado && gestor.editable(tocado) ? tocado : null;
    if (!obj) {
      pulsacionEnVacio = { x: e.clientX, y: e.clientY, bloqueado: tocado };
      return;
    }
    gestor.avisoApoyo = null;
    gestor.seleccionar(obj);
    const punto = puntoEnSuelo(e);
    escena.controles.enabled = false;
    const desfase = punto ? obj.raiz.position.clone().sub(punto) : new THREE.Vector3();
    arrastre = { obj, desfase, movido: false, puntero: e.pointerId };
    lienzo.setPointerCapture(e.pointerId);
    lienzo.style.cursor = 'grabbing';
  }, { capture: true });

  lienzo.addEventListener('pointermove', (e) => {
    if (arrastre) {
      if (e.pointerId !== arrastre.puntero) return;
      const { obj } = arrastre;
      arrastre.movido = true;
      // No guardamos en cada movimiento; solo al soltar.
      if (obj.item.colocacion === 'pared') arrastrarEnPared(obj, e);
      else if (obj.item.colocacion === 'superficie') arrastrarEnSuperficie(obj, e);
      else {
        const punto = puntoEnSuelo(e);
        if (punto) gestor.mover(obj, punto.x + arrastre.desfase.x, punto.z + arrastre.desfase.z, false);
      }
      return;
    }
    // Sin arrastre: cambiamos el cursor al pasar por encima de un objeto.
    if (e.buttons === 0) lienzo.style.cursor = !opciones.modoCamara() && objetoBajoRaton(e) ? 'grab' : '';
  });

  const soltar = (e: PointerEvent) => {
    if (arrastre) {
      if (e.pointerId !== arrastre.puntero) return;
      if (arrastre.movido) gestor.asentar(arrastre.obj); // fuera de puertas, y guardar
      arrastre = null;
      escena.controles.enabled = true;
      if (lienzo.hasPointerCapture(e.pointerId)) lienzo.releasePointerCapture(e.pointerId);
      lienzo.style.cursor = 'grab';
      return;
    }
    // Clic (sin apenas mover el ratón) en el vacío → deseleccionar.
    if (pulsacionEnVacio) {
      const distancia = Math.hypot(e.clientX - pulsacionEnVacio.x, e.clientY - pulsacionEnVacio.y);
      if (distancia < 5 && e.type === 'pointerup') {
        gestor.seleccionar(null);
        if (pulsacionEnVacio.bloqueado) opciones.avisarCapaBloqueada(pulsacionEnVacio.bloqueado);
      }
      pulsacionEnVacio = null;
    }
  };
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);

  // --- Teclado -------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    // Si se está escribiendo en un campo de texto/número, no interferimos.
    const destino = e.target as HTMLElement;
    if (destino instanceof HTMLInputElement && destino.type !== 'range' && destino.type !== 'checkbox') return;
    if (destino instanceof HTMLTextAreaElement || destino instanceof HTMLSelectElement) return;
    if (arrastre && !(e.ctrlKey || e.metaKey)) return;

    const sel = gestor.seleccionado;
    const accion = accionDeTecla(e, !!sel, opciones.modoCamara());
    if (!accion) return;
    switch (accion.tipo) {
      case 'bloqueada': opciones.avisarBloqueo(); break;
      case 'deshacer': opciones.deshacer(); break;
      case 'rehacer': opciones.rehacer(); break;
      case 'deseleccionar': gestor.seleccionar(null); break;
      case 'borrar': if (sel) gestor.borrar(sel); break;
      case 'duplicar': opciones.duplicar(); break;
      case 'girar':
        if (!sel) break;
        if (accion.fino) gestor.girar(sel, accion.sentido * 1, false); // giro fino de 1°
        else gestor.girar(sel, accion.sentido * 15); // pasos de 15°
        break;
    }
    e.preventDefault();
  });

  return {
    cancelarArrastre() {
      if (!arrastre) return;
      const { obj, movido, puntero } = arrastre;
      arrastre = null;
      if (movido) gestor.asentar(obj);
      escena.controles.enabled = true;
      if (lienzo.hasPointerCapture(puntero)) lienzo.releasePointerCapture(puntero);
      lienzo.style.cursor = '';
    },
  };
}
