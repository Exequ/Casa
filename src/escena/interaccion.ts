// Interacción con el ratón y el teclado sobre la escena 3D:
//   - Clic en un objeto: lo selecciona.  Clic en vacío: deselecciona.
//   - Arrastrar un objeto: lo mueve por el suelo.
//   - Q / E: girar 15° (con Mayúsculas: 1°).   Supr: borrar.   Esc: deseleccionar.
// El resto de arrastres (en vacío) los gestiona la cámara orbital.

import * as THREE from 'three';
import type { Escena } from './escena';
import type { GestorObjetos, ObjetoColocado } from './objetos';

export function activarInteraccion(escena: Escena, gestor: GestorObjetos) {
  const lienzo = escena.renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const sueloMatematico = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // plano y = 0

  /** Datos del arrastre en curso (si lo hay). */
  let arrastre: { obj: ObjetoColocado; desfase: THREE.Vector3; movido: boolean } | null = null;
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
    const impactos = raycaster.intersectObjects(gestor.objetos.map((o) => o.raiz), true);
    return impactos.length ? gestor.objetoDe(impactos[0].object) : null;
  }

  /** Punto del suelo bajo el ratón, o null si se apunta al cielo. */
  function puntoEnSuelo(e: PointerEvent): THREE.Vector3 | null {
    apuntar(e);
    return raycaster.ray.intersectPlane(sueloMatematico, new THREE.Vector3());
  }

  // Escuchamos en fase de captura para actuar ANTES que la cámara orbital:
  // si se pulsa sobre un objeto, desactivamos la cámara durante el arrastre.
  lienzo.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return; // solo botón izquierdo
    const obj = objetoBajoRaton(e);
    if (!obj) {
      pulsacionEnVacio = { x: e.clientX, y: e.clientY };
      return;
    }
    gestor.seleccionar(obj);
    const punto = puntoEnSuelo(e);
    if (!punto) return;
    escena.controles.enabled = false;
    arrastre = { obj, desfase: obj.raiz.position.clone().sub(punto), movido: false };
    lienzo.setPointerCapture(e.pointerId);
    lienzo.style.cursor = 'grabbing';
  }, { capture: true });

  lienzo.addEventListener('pointermove', (e) => {
    if (arrastre) {
      const punto = puntoEnSuelo(e);
      if (!punto) return;
      arrastre.movido = true;
      // No guardamos en cada movimiento; solo al soltar.
      gestor.mover(arrastre.obj, punto.x + arrastre.desfase.x, punto.z + arrastre.desfase.z, false);
      return;
    }
    // Sin arrastre: cambiamos el cursor al pasar por encima de un objeto.
    if (e.buttons === 0) lienzo.style.cursor = objetoBajoRaton(e) ? 'grab' : '';
  });

  lienzo.addEventListener('pointerup', (e) => {
    if (arrastre) {
      if (arrastre.movido) gestor.notificar(); // ahora sí: guardar
      arrastre = null;
      escena.controles.enabled = true;
      lienzo.releasePointerCapture(e.pointerId);
      lienzo.style.cursor = 'grab';
      return;
    }
    // Clic (sin apenas mover el ratón) en el vacío → deseleccionar.
    if (pulsacionEnVacio) {
      const distancia = Math.hypot(e.clientX - pulsacionEnVacio.x, e.clientY - pulsacionEnVacio.y);
      if (distancia < 5) gestor.seleccionar(null);
      pulsacionEnVacio = null;
    }
  });

  // --- Teclado -------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    // Si se está escribiendo en un campo de texto/número, no interferimos.
    const destino = e.target as HTMLElement;
    if (destino instanceof HTMLInputElement && destino.type !== 'range') return;

    const sel = gestor.seleccionado;
    if (!sel) return;
    const tecla = e.key.toLowerCase();
    if (e.key === 'Delete' || e.key === 'Backspace') { // Supr (o borrar en Mac)
      gestor.borrar(sel);
    } else if (e.key === 'Escape') {
      gestor.seleccionar(null);
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
