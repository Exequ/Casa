// "Corte" de paredes: las paredes que tapan la vista se bajan a una altura
// pequeña (como en un plano), para ver siempre el interior.
//
// Dos reglas, según lo que se esté mirando:
//   - Vista de toda la vivienda: se corta toda pared que tenga suelo de la
//     vivienda detrás (vista desde la cámara). Así quedan en pie solo las
//     fachadas del fondo, como en una casa de muñecas.
//   - Vista de una estancia: se corta toda pared cuya recta deje a un lado la
//     cámara y al otro el punto al que mira la cámara.
// Las barandillas y muretes (≤ 1,2 m) no se cortan, salvo en el modo huella.

import * as THREE from 'three';
import type { Punto } from '../vivienda/modelo';
import type { ElementoVertical } from './vivienda3d';

/** Altura a la que se quedan las paredes cortadas (m). */
const ALTURA_CORTE = 0.25;
/** Altura en el modo "comprobar con el plano": apenas la huella del muro. */
const ALTURA_HUELLA = 0.02;

/**
 * - 'casa': regla de la casa de muñecas (vista general).
 * - 'estancia': regla cámara/objetivo (vista de una estancia).
 * - 'huella': todo a ras de suelo (para comparar con el plano).
 */
export type ModoCorte = 'casa' | 'estancia' | 'huella';

export class CortadorParedes {
  modo: ModoCorte = 'casa';
  private elementos: ElementoVertical[];
  /** Función que dice si un punto está sobre el suelo de alguna estancia. */
  private dentro: (p: Punto) => boolean;
  /** Muestras a lo largo de cada pared (fracciones del largo). */
  private static MUESTRAS = [0.15, 0.5, 0.85];

  constructor(elementos: ElementoVertical[], dentro: (p: Punto) => boolean) {
    this.elementos = elementos;
    this.dentro = dentro;
  }

  /** Decide qué paredes se cortan según la posición de la cámara y su objetivo. */
  actualizar(camara: THREE.Camera, objetivo: THREE.Vector3) {
    const cx = camara.position.x, cz = camara.position.z;
    const tx = objetivo.x, tz = objetivo.z;
    // Con la cámara casi encima del objetivo (vista en planta) no se corta nada.
    const vistaCenital = Math.hypot(cx - tx, cz - tz) < 0.5;

    const cortados = new Set<ElementoVertical>();
    // Primero las paredes; después los pilares, que siguen a las paredes que tocan.
    const orden = [...this.elementos.filter((e) => !e.vecinos), ...this.elementos.filter((e) => e.vecinos)];
    for (const el of orden) {
      let altura = el.alto;
      if (this.modo === 'huella') {
        altura = ALTURA_HUELLA;
      } else if (!vistaCenital && el.alto > 1.2) {
        const cortar = el.vecinos ? el.vecinos.some((v) => cortados.has(v)) : this.tapa(el, cx, cz, tx, tz);
        if (cortar) altura = ALTURA_CORTE;
      }
      if (altura < el.alto) cortados.add(el);
      el.objeto.scale.y = altura / el.alto;
      // Cristales: con la pared entera; en el modo huella también (marcan las ventanas en azul).
      const huella = this.modo === 'huella';
      for (const c of el.cristales) c.visible = huella || altura === el.alto;
      // En el modo huella quitamos antepechos y dinteles: los huecos se ven como huecos.
      for (const s of el.sobreHuecos) s.visible = !huella;
    }
  }

  /** ¿Tapa este elemento la vista? */
  private tapa(el: ElementoVertical, cx: number, cz: number, tx: number, tz: number): boolean {
    const dx = el.b[0] - el.a[0], dz = el.b[1] - el.a[1];
    const largo = Math.hypot(dx, dz) || 1;
    // Normal unitaria de la pared
    let nx = -dz / largo, nz = dx / largo;
    const ladoCamara = nx * (cx - el.a[0]) + nz * (cz - el.a[1]);
    if (this.modo === 'estancia') {
      const ladoObjetivo = nx * (tx - el.a[0]) + nz * (tz - el.a[1]);
      return ladoCamara * ladoObjetivo < 0;
    }
    // Modo casa: miramos si al otro lado de la pared (el que no ve la cámara) hay suelo.
    if (ladoCamara > 0) { nx = -nx; nz = -nz; } // n apunta ahora hacia el lado oculto
    const separacion = el.grosor / 2 + 0.1;
    return CortadorParedes.MUESTRAS.some((t) =>
      this.dentro([el.a[0] + dx * t + nx * separacion, el.a[1] + dz * t + nz * separacion]));
  }
}
