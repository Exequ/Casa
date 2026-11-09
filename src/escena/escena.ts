// Escena 3D básica: renderizador, cámara orbital y luces.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { DatosHabitacion } from './habitacion';

export interface Escena {
  renderer: THREE.WebGLRenderer;
  escena: THREE.Scene;
  camara: THREE.PerspectiveCamera;
  controles: OrbitControls;
  /** Registra una función que se ejecuta en cada fotograma, antes de dibujar. */
  cadaFotograma(fn: () => void): void;
}

export function crearEscena(contenedor: HTMLElement, habitacion: DatosHabitacion): Escena {
  // --- Renderizador ---------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // sombras filtradas (suaves con shadow.radius)
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // colores más naturales
  contenedor.appendChild(renderer.domElement);

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0xe4e9ef);

  // --- Cámara y controles orbitales -----------------------------------------
  // Ratón: botón izquierdo = rotar, rueda = zoom, botón derecho = desplazar.
  const camara = new THREE.PerspectiveCamera(50, 1, 0.05, 200);
  const tamano = Math.max(habitacion.ancho, habitacion.largo);
  camara.position.set(tamano * 0.9, tamano * 1.1, tamano * 1.3);

  const controles = new OrbitControls(camara, renderer.domElement);
  controles.target.set(0, 0.6, 0);
  controles.enableDamping = true; // movimiento suave
  controles.minDistance = 0.5;
  controles.maxDistance = 30;
  controles.maxPolarAngle = Math.PI / 2 - 0.05; // no bajar por debajo del suelo
  controles.screenSpacePanning = false; // desplazar en paralelo al suelo
  controles.update();

  // --- Luces ----------------------------------------------------------------
  // Luz ambiental de cielo/suelo: rellena las sombras para que no queden negras.
  const ambiente = new THREE.HemisphereLight(0xffffff, 0xb9a48f, 1.6);
  escena.add(ambiente);

  // "Sol" casi cenital que proyecta las sombras.
  const sol = new THREE.DirectionalLight(0xfff4e5, 2.2);
  sol.position.set(tamano * 0.4, 8, tamano * 0.6);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  sol.shadow.radius = 6; // difumina el borde de la sombra
  sol.shadow.blurSamples = 16;
  sol.shadow.bias = -0.0005;
  sol.shadow.normalBias = 0.02;
  // La "caja" de sombras cubre la habitación con un poco de margen.
  const margen = tamano / 2 + 1;
  Object.assign(sol.shadow.camera, { left: -margen, right: margen, top: margen, bottom: -margen, near: 1, far: 20 });
  escena.add(sol);

  // --- Bucle de dibujo y ajuste de tamaño -------------------------------------
  const tareas: Array<() => void> = [];

  function ajustarTamano() {
    const { clientWidth: w, clientHeight: h } = contenedor;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
  }
  new ResizeObserver(ajustarTamano).observe(contenedor);
  ajustarTamano();

  renderer.setAnimationLoop(() => {
    controles.update();
    for (const tarea of tareas) tarea();
    renderer.render(escena, camara);
  });

  return { renderer, escena, camara, controles, cadaFotograma: (fn) => tareas.push(fn) };
}
