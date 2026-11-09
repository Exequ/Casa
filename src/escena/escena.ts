// Escena 3D básica: renderizador, cámara orbital, luces y etiquetas HTML.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

/** Rectángulo en planta (m). */
export interface Caja2D { minX: number; maxX: number; minZ: number; maxZ: number }

/**
 * Calidad gráfica. 'ligera' para móviles y tabletas (sombras de 1024 px y
 * menos píxeles), 'normal' para ordenadores (sombras de 2048 px). 'alta' es
 * la de la fase 2 (4096 px), solo para comparar.
 */
export type Calidad = 'ligera' | 'normal' | 'alta';

/**
 * Elige la calidad: la de la dirección (?calidad=ligera|normal|alta) si se
 * indica; si no, 'ligera' en pantallas táctiles o pequeñas y 'normal' en el resto.
 */
export function elegirCalidad(): Calidad {
  const pedida = new URLSearchParams(location.search).get('calidad');
  if (pedida === 'ligera' || pedida === 'normal' || pedida === 'alta') return pedida;
  const tactil = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const pequena = Math.min(window.screen?.width ?? 1e4, window.screen?.height ?? 1e4) < 800;
  return tactil || pequena ? 'ligera' : 'normal';
}

const AJUSTES: Record<Calidad, { sombra: number; maxPixelRatio: number; textura: number }> = {
  ligera: { sombra: 1024, maxPixelRatio: 1.5, textura: 512 },
  normal: { sombra: 2048, maxPixelRatio: 2, textura: 512 },
  alta: { sombra: 4096, maxPixelRatio: 2, textura: 512 },
};

export interface Escena {
  renderer: THREE.WebGLRenderer;
  /** Calidad elegida y sus ajustes. */
  calidad: Calidad;
  /** Resolución de las texturas de suelo según la calidad (px). */
  tamanoTextura: number;
  escena: THREE.Scene;
  camara: THREE.PerspectiveCamera;
  controles: OrbitControls;
  /** Registra una función que se ejecuta en cada fotograma, antes de dibujar. */
  cadaFotograma(fn: () => void): void;
  /**
   * Mueve la cámara (con una animación corta) para encuadrar un rectángulo.
   * `planta = true` mira desde arriba, en vertical. `reorientar = true` gira
   * la vista para aprovechar mejor la pantalla (en vez de mantener el giro actual).
   */
  encuadrar(caja: Caja2D, planta?: boolean, animar?: boolean, reorientar?: boolean): void;
}

export function crearEscena(contenedor: HTMLElement, total: Caja2D, calidad: Calidad = elegirCalidad()): Escena {
  const ajustes = AJUSTES[calidad];
  // --- Renderizador ---------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, ajustes.maxPixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // sombras filtradas (suaves con shadow.radius)
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // colores más naturales
  contenedor.appendChild(renderer.domElement);

  // Capa HTML encima del lienzo para las etiquetas de las estancias.
  const etiquetas = new CSS2DRenderer();
  etiquetas.domElement.className = 'capa-etiquetas';
  contenedor.appendChild(etiquetas.domElement);

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0xe4e9ef);

  // --- Cámara y controles orbitales -----------------------------------------
  // Ratón: botón izquierdo = rotar, rueda = zoom, botón derecho = desplazar.
  // Táctil: un dedo = rotar, dos dedos = zoom y desplazar.
  const camara = new THREE.PerspectiveCamera(50, 1, 0.05, 300);
  const controles = new OrbitControls(camara, renderer.domElement);
  controles.enableDamping = true; // movimiento suave
  controles.minDistance = 0.5;
  controles.maxDistance = 60;
  controles.maxPolarAngle = Math.PI / 2 - 0.05; // no bajar por debajo del suelo
  controles.screenSpacePanning = false; // desplazar en paralelo al suelo

  // --- Luces ----------------------------------------------------------------
  const centroX = (total.minX + total.maxX) / 2, centroZ = (total.minZ + total.maxZ) / 2;
  const tamano = Math.max(total.maxX - total.minX, total.maxZ - total.minZ);
  // Luz ambiental de cielo/suelo: rellena las sombras para que no queden negras.
  escena.add(new THREE.HemisphereLight(0xffffff, 0xb9a48f, 1.6));
  // "Sol" casi cenital que proyecta las sombras.
  const sol = new THREE.DirectionalLight(0xfff4e5, 2.2);
  sol.position.set(centroX + 3, 12, centroZ + 4);
  sol.target.position.set(centroX, 0, centroZ);
  sol.castShadow = true;
  sol.shadow.mapSize.set(ajustes.sombra, ajustes.sombra);
  sol.shadow.radius = 4; // difumina el borde de la sombra
  sol.shadow.blurSamples = 12;
  sol.shadow.bias = -0.0005;
  sol.shadow.normalBias = 0.02;
  const margen = tamano / 2 + 2;
  Object.assign(sol.shadow.camera, { left: -margen, right: margen, top: margen, bottom: -margen, near: 1, far: 40 });
  escena.add(sol, sol.target);

  // --- Encuadre animado -------------------------------------------------------
  let animacion: { desdePos: THREE.Vector3; desdeObj: THREE.Vector3; aPos: THREE.Vector3; aObj: THREE.Vector3; t0: number } | null = null;
  const DURACION = 600; // ms

  function encuadrar(caja: Caja2D, planta = false, animar = true, reorientar = false) {
    const objetivo = new THREE.Vector3((caja.minX + caja.maxX) / 2, 0, (caja.minZ + caja.maxZ) / 2);
    const ancho = caja.maxX - caja.minX, fondo = caja.maxZ - caja.minZ;

    // Giro horizontal de la cámara (acimut). En planta, o si se pide reorientar,
    // se elige para que el lado largo de la vivienda coincida con el lado largo
    // de la pantalla (en un móvil en vertical, la casa se ve "de canto").
    let acimut: number;
    if (planta || reorientar) {
      const girar90 = (ancho >= fondo) !== (camara.aspect >= 1);
      acimut = girar90 ? Math.PI / 2 - (planta ? 0 : 0.35) : (planta ? 0 : 0.35);
    } else {
      const actual = camara.position.clone().sub(controles.target);
      acimut = Math.atan2(actual.x, actual.z); // mantenemos el giro actual
    }
    // Inclinación: 50° para toda la vivienda; algo más cenital (42°) para una estancia, que se ve mejor el suelo.
    const polar = planta ? 0.0001 : THREE.MathUtils.degToRad(reorientar ? 50 : 42);

    // Tamaño aparente del rectángulo visto con ese acimut e inclinación.
    const dx = Math.sin(acimut), dz = Math.cos(acimut); // de la vivienda hacia la cámara
    const esquinas = [[caja.minX, caja.minZ], [caja.maxX, caja.minZ], [caja.maxX, caja.maxZ], [caja.minX, caja.maxZ]];
    const lateral = esquinas.map(([x, z]) => x * dz - z * dx);
    const profundo = esquinas.map(([x, z]) => x * dx + z * dz);
    const anchoPantalla = Math.max(...lateral) - Math.min(...lateral);
    const ALTO_PAREDES = 2.5;
    const altoPantalla = (Math.max(...profundo) - Math.min(...profundo)) * Math.cos(polar) + (planta ? 0 : ALTO_PAREDES * Math.sin(polar));

    // Distancia para que quepa en pantalla (según el campo de visión y la proporción).
    const vfov = THREE.MathUtils.degToRad(camara.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camara.aspect);
    const dist = Math.max(
      (altoPantalla / 2) / Math.tan(vfov / 2), (anchoPantalla / 2) / Math.tan(hfov / 2),
      planta ? 0 : 4.5, // las estancias pequeñas, no demasiado cerca
    ) * 1.12 + (planta ? 0.3 : 1);
    const direccion = new THREE.Vector3(Math.sin(polar) * dx, Math.cos(polar), Math.sin(polar) * dz);
    const posicion = objetivo.clone().addScaledVector(direccion.normalize(), dist);
    if (!animar) {
      camara.position.copy(posicion);
      controles.target.copy(objetivo);
      controles.update();
      return;
    }
    animacion = { desdePos: camara.position.clone(), desdeObj: controles.target.clone(), aPos: posicion, aObj: objetivo, t0: performance.now() };
  }

  // Cámara inicial: vista en diagonal desde el sur-este.
  camara.position.set(centroX + 4, 8, centroZ + 10);
  controles.target.set(centroX, 0, centroZ);

  // --- Bucle de dibujo y ajuste de tamaño -------------------------------------
  const tareas: Array<() => void> = [];

  function ajustarTamano() {
    const { clientWidth: w, clientHeight: h } = contenedor;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h);
    etiquetas.setSize(w, h);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
  }
  new ResizeObserver(ajustarTamano).observe(contenedor);
  ajustarTamano();

  renderer.setAnimationLoop(() => {
    if (animacion) {
      const t = Math.min(1, (performance.now() - animacion.t0) / DURACION);
      const suave = t * t * (3 - 2 * t); // aceleración y frenada suaves
      camara.position.lerpVectors(animacion.desdePos, animacion.aPos, suave);
      controles.target.lerpVectors(animacion.desdeObj, animacion.aObj, suave);
      if (t >= 1) animacion = null;
    }
    controles.update();
    for (const tarea of tareas) tarea();
    renderer.render(escena, camara);
    etiquetas.render(escena, camara);
  });

  return {
    renderer, calidad, tamanoTextura: ajustes.textura, escena, camara, controles,
    cadaFotograma: (fn) => tareas.push(fn), encuadrar,
  };
}
