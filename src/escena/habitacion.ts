// La habitación: suelo y 4 paredes construidos a partir de data/habitacion.json.
//
// Sistema de coordenadas (en metros):
//   - El centro del suelo es el origen (0, 0, 0).
//   - X va a lo ANCHO, Z va a lo LARGO e Y es la altura.
//   - El interior de la habitación va de -ancho/2 a +ancho/2 en X
//     y de -largo/2 a +largo/2 en Z.

import * as THREE from 'three';

/** Formato de data/habitacion.json */
export interface DatosHabitacion {
  nombre?: string;
  ancho: number; // metros (eje X)
  largo: number; // metros (eje Z)
  alto: number; // metros (eje Y)
}

/** Grosor de las paredes, en metros (se construyen hacia fuera del interior). */
const GROSOR_PARED = 0.1;

interface Pared {
  malla: THREE.Mesh;
  /** Un punto de la cara interior de la pared. */
  punto: THREE.Vector3;
  /** Dirección que apunta desde la pared hacia el interior de la habitación. */
  haciaDentro: THREE.Vector3;
}

/**
 * Líneas cada `paso` metros, partiendo del centro, dentro de un rectángulo
 * de ancho x largo.
 */
function crearCuadricula(ancho: number, largo: number, paso: number): THREE.LineSegments {
  const puntos: number[] = [];
  const y = 0.002; // un pelo por encima del suelo para que no parpadee
  for (let x = 0; x <= ancho / 2; x += paso) {
    for (const s of x === 0 ? [1] : [1, -1]) puntos.push(s * x, y, -largo / 2, s * x, y, largo / 2);
  }
  for (let z = 0; z <= largo / 2; z += paso) {
    for (const s of z === 0 ? [1] : [1, -1]) puntos.push(-ancho / 2, y, s * z, ancho / 2, y, s * z);
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.Float32BufferAttribute(puntos, 3));
  const material = new THREE.LineBasicMaterial({ color: 0x6b4f35, transparent: true, opacity: 0.15 });
  return new THREE.LineSegments(geometria, material);
}

export class Habitacion {
  readonly grupo = new THREE.Group();
  readonly datos: DatosHabitacion;
  private paredes: Pared[] = [];

  constructor(datos: DatosHabitacion) {
    this.datos = datos;
    const { ancho, largo, alto } = datos;

    // --- Suelo ---
    const suelo = new THREE.Mesh(
      new THREE.PlaneGeometry(ancho, largo),
      new THREE.MeshStandardMaterial({ color: 0xc8a27a, roughness: 0.8 }),
    );
    suelo.rotation.x = -Math.PI / 2; // el plano viene vertical; lo tumbamos
    suelo.receiveShadow = true;
    this.grupo.add(suelo);

    // Cuadrícula de 50 cm sobre el suelo, para hacerse una idea de las medidas.
    this.grupo.add(crearCuadricula(ancho, largo, 0.5));

    // --- Paredes ---
    const materialPared = new THREE.MeshStandardMaterial({ color: 0xf2efe9, roughness: 0.95 });
    const g = GROSOR_PARED;
    // [ancho de la caja, fondo de la caja, posición x, posición z, dirección hacia dentro]
    const definiciones: Array<[number, number, number, number, THREE.Vector3]> = [
      [ancho + 2 * g, g, 0, -largo / 2 - g / 2, new THREE.Vector3(0, 0, 1)], // fondo
      [ancho + 2 * g, g, 0, largo / 2 + g / 2, new THREE.Vector3(0, 0, -1)], // frente
      [g, largo, -ancho / 2 - g / 2, 0, new THREE.Vector3(1, 0, 0)], // izquierda
      [g, largo, ancho / 2 + g / 2, 0, new THREE.Vector3(-1, 0, 0)], // derecha
    ];
    for (const [w, d, x, z, haciaDentro] of definiciones) {
      const malla = new THREE.Mesh(new THREE.BoxGeometry(w, alto, d), materialPared);
      malla.position.set(x, alto / 2, z);
      malla.castShadow = true;
      malla.receiveShadow = true;
      this.grupo.add(malla);
      // Punto de la cara interior = centro de la pared desplazado medio grosor hacia dentro.
      const punto = new THREE.Vector3(x, 0, z).addScaledVector(haciaDentro, g / 2);
      this.paredes.push({ malla, punto, haciaDentro });
    }
  }

  /**
   * Oculta las paredes que quedan entre la cámara y el interior (vista "casa de
   * muñecas"), para que siempre se vea lo que hay dentro al girar la cámara.
   */
  actualizarParedes(camara: THREE.Camera): void {
    const aCamara = new THREE.Vector3();
    for (const pared of this.paredes) {
      aCamara.subVectors(camara.position, pared.punto);
      aCamara.y = 0;
      // Si la cámara está al otro lado de la pared (fuera), la ocultamos.
      pared.malla.visible = aCamara.dot(pared.haciaDentro) > 0;
    }
  }

  /**
   * Ajusta la posición (x, z) de un objeto para que no atraviese las paredes.
   * `medioX` y `medioZ` son la mitad de lo que ocupa el objeto en cada eje
   * (ya teniendo en cuenta su rotación).
   */
  limitar(x: number, z: number, medioX: number, medioZ: number): { x: number; z: number } {
    const limiteX = this.datos.ancho / 2 - medioX;
    const limiteZ = this.datos.largo / 2 - medioZ;
    // Si el objeto es más grande que la habitación, lo dejamos centrado en ese eje.
    return {
      x: limiteX > 0 ? THREE.MathUtils.clamp(x, -limiteX, limiteX) : 0,
      z: limiteZ > 0 ? THREE.MathUtils.clamp(z, -limiteZ, limiteZ) : 0,
    };
  }
}
