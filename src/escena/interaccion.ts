// Interacción con el ratón, el dedo y el teclado sobre la escena 3D:
//   - Clic en un objeto: lo selecciona.  Clic en vacío: deselecciona.
//   - Arrastrar un objeto (ratón o dedo):
//       · muebles (suelo): se mueven por el suelo;
//       · cuadros y espejos (pared): se pegan a la pared a la que se apunta
//         (o a la más cercana al punto del suelo señalado) y corren a lo largo de ella;
//       · jarrones, plantas... (superficie): se apoyan en el mueble que hay
//         debajo del puntero, o van por el suelo si no hay ninguno.
//   - Q / E: girar 15° (con Mayúsculas: 1°).  D: duplicar.  Supr: borrar.  Esc: deseleccionar.
//   - Ctrl+Z: deshacer.  Ctrl+Mayús+Z (o Ctrl+Y): rehacer.
// El resto de arrastres (en vacío) los gestiona la cámara orbital.

import * as THREE from 'three';
import { superficiesDe } from '../catalogo/catalogo';
import { caraEnRayo, caraMasCercana, type CaraColgable } from '../vivienda/colgar';
import type { EspacioLibre } from '../vivienda/espacio';
import type { Escena } from './escena';
import type { GestorObjetos, ObjetoColocado } from './objetos';

export interface OpcionesInteraccion {
  espacio: EspacioLibre;
  /** ¿Se ve ahora esa cara de pared? (las de los muros bajados no cuentan al apuntar) */
  caraVisible: (c: CaraColgable) => boolean;
  deshacer: () => void;
  rehacer: () => void;
  duplicar: () => void;
}

export function activarInteraccion(escena: Escena, gestor: GestorObjetos, opciones: OpcionesInteraccion) {
  const lienzo = escena.renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const sueloMatematico = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // plano y = 0

  /** Datos del arrastre en curso (si lo hay). */
  let arrastre: { obj: ObjetoColocado; desfase: THREE.Vector3; movido: boolean; puntero: number } | null = null;
  /** Dónde se pulsó el ratón sobre el vacío (para distinguir clic de giro de cámara). */
  let pulsacionEnVacio: { x: number; y: number } | null = null;

  /** Prepara el raycaster con la posición del ratón. */
  function apuntar(e: PointerEvent) {
    const r = lienzo.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, escena.camara);
  }

  /** Objeto bajo el ratón, o null. */
  function objetoBajoRaton(e: PointerEvent): ObjetoColocado | null {
    apuntar(e);
    // (los objetos ocultos, como los cuadros de un muro bajado, no se pueden tocar)
    const impactos = raycaster.intersectObjects(gestor.objetos.filter((o) => o.raiz.visible).map((o) => o.raiz), true);
    return impactos.length ? gestor.objetoDe(impactos[0].object) : null;
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

  /** Arrastre de un objeto de superficie: sobre el mueble que hay bajo el puntero, o por el suelo. */
  function arrastrarEnSuperficie(obj: ObjetoColocado, e: PointerEvent) {
    apuntar(e);
    const soportes = gestor.objetos.filter((o) => o !== obj && gestor.esSoporte(o));
    const impacto = raycaster.intersectObjects(soportes.map((o) => o.raiz), true)[0];
    const soporte = impacto ? gestor.objetoDe(impacto.object) : null;
    if (impacto && soporte && soportes.includes(soporte)) {
      // La tapa o balda señalada: la más alta que queda por debajo del punto (y luego las demás)
      const niveles = superficiesDe(soporte.item);
      const debajo = niveles.filter((n) => n <= impacto.point.y + 0.05).reverse();
      const resto = niveles.filter((n) => !debajo.includes(n)).sort((p, q) => Math.abs(p - impacto.point.y) - Math.abs(q - impacto.point.y));
      for (const nivel of [...debajo, ...resto]) {
        if (gestor.apoyar(obj, soporte, nivel, impacto.point.x, impacto.point.z, false)) return;
      }
    }
    const p = raycaster.ray.intersectPlane(sueloMatematico, new THREE.Vector3());
    if (!p) return;
    if (obj.colocacion === 'suelo') gestor.mover(obj, p.x, p.z, false);
    else gestor.bajarAlSuelo(obj, p.x, p.z, false, 0.6);
  }

  // Escuchamos en fase de captura para actuar ANTES que la cámara orbital:
  // si se pulsa sobre un objeto, desactivamos la cámara durante el arrastre.
  lienzo.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !e.isPrimary) return; // solo botón izquierdo / primer dedo
    const obj = objetoBajoRaton(e);
    if (!obj) {
      pulsacionEnVacio = { x: e.clientX, y: e.clientY };
      return;
    }
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
    if (e.buttons === 0) lienzo.style.cursor = objetoBajoRaton(e) ? 'grab' : '';
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
      if (distancia < 5 && e.type === 'pointerup') gestor.seleccionar(null);
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
    const tecla = e.key.toLowerCase();

    // Deshacer / rehacer (no hace falta tener nada seleccionado)
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (tecla === 'z' && !e.shiftKey) { e.preventDefault(); opciones.deshacer(); return; }
      if ((tecla === 'z' && e.shiftKey) || tecla === 'y') { e.preventDefault(); opciones.rehacer(); return; }
      return;
    }
    if (e.altKey || arrastre) return;

    const sel = gestor.seleccionado;
    if (!sel) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { // Supr (o borrar en Mac)
      gestor.borrar(sel);
    } else if (e.key === 'Escape') {
      gestor.seleccionar(null);
    } else if (tecla === 'd') {
      opciones.duplicar();
    } else if (tecla === 'q' || tecla === 'e') {
      const sentido = tecla === 'q' ? 1 : -1; // Q = antihorario, E = horario (vistos desde arriba)
      if (e.shiftKey) gestor.girar(sel, sentido * 1, false); // giro fino de 1°
      else gestor.girar(sel, sentido * 15); // pasos de 15°
    } else {
      return;
    }
    e.preventDefault();
  });
}
