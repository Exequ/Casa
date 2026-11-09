// "Corte" de paredes: las paredes que tapan la vista se bajan a una altura
// pequeña (como en un plano), para ver siempre el interior.
//
// Idea principal, la "sombra" de la pared vista desde la cámara: se trazan
// rayos desde la cámara que rozan el borde superior de la pared y se mira dónde
// caen en el suelo, detrás de ella. Esa franja de suelo es la que la pared
// tapa. Si en esa franja hay suelo de la vivienda, la pared estorba y se corta.
// Así se cortan también las paredes cortas (como los laterales del armario
// empotrado) y se quedan en pie las fachadas del fondo, que solo tapan el exterior.
//
// Según lo que se esté mirando:
//   - Vista de toda la vivienda: se corta la pared si su sombra cae sobre el
//     suelo de cualquier estancia.
//   - Vista de una estancia: se corta si su recta deja a un lado la cámara y al
//     otro el punto al que mira la cámara, o si su sombra cae sobre el suelo
//     de esa estancia. Las paredes del fondo de la estancia se quedan en pie.
// Los pilares se cortan si se corta alguna pared que tocan o si tapan suelo.
// Las barandillas y muretes (≤ 1,2 m) solo se bajan en el modo huella o si
// quedan justo delante de la estancia que se está mirando.

import * as THREE from 'three';
import type { Punto } from '../vivienda/modelo';
import { puntoEnPoligono } from '../vivienda/geometria';
import type { ElementoVertical } from './vivienda3d';

/** Altura a la que se quedan las paredes cortadas (m). */
const ALTURA_CORTE = 0.25;
/** Altura en el modo "comprobar con el plano": apenas la huella del muro. */
const ALTURA_HUELLA = 0.02;
/** Hasta dónde se mira la sombra detrás de una pared (m), si la cámara está por debajo de su borde. */
const SOMBRA_MAXIMA = 6;

/**
 * - 'casa': vista general.
 * - 'estancia': vista de una estancia (ver `estancia`).
 * - 'huella': todo a ras de suelo (para comparar con el plano).
 */
export type ModoCorte = 'casa' | 'estancia' | 'huella';

export class CortadorParedes {
  modo: ModoCorte = 'casa';
  /** Polígono de la estancia que se está mirando (modo 'estancia'). */
  estancia: Punto[] | null = null;
  private elementos: ElementoVertical[];
  /** Función que dice si un punto está sobre el suelo de alguna estancia. */
  private dentro: (p: Punto) => boolean;
  /** Muestras a lo largo de cada pared (fracciones del largo). */
  private static MUESTRAS = [0.1, 0.3, 0.5, 0.7, 0.9];
  /** Muestras a lo largo de la sombra (fracciones de su longitud). */
  private static MUESTRAS_SOMBRA = [0.15, 0.4, 0.7, 1];

  constructor(elementos: ElementoVertical[], dentro: (p: Punto) => boolean) {
    this.elementos = elementos;
    this.dentro = dentro;
  }

  /** Decide qué paredes se cortan según la posición de la cámara y su objetivo. */
  actualizar(camara: THREE.Camera, objetivo: THREE.Vector3) {
    const c = camara.position;
    // Con la cámara casi encima del objetivo (vista en planta) no se corta nada.
    const vistaCenital = Math.hypot(c.x - objetivo.x, c.z - objetivo.z) < 0.5;

    const cortados = new Set<ElementoVertical>();
    // Primero las paredes; después los pilares, que siguen a las paredes que tocan.
    const orden = [...this.elementos.filter((e) => !e.vecinos), ...this.elementos.filter((e) => e.vecinos)];
    for (const el of orden) {
      let altura = el.alto;
      if (this.modo === 'huella') {
        altura = ALTURA_HUELLA;
      } else if (!vistaCenital && el.alto > 1.2) {
        const porVecino = el.vecinos?.some((v) => cortados.has(v)) ?? false;
        if (porVecino || this.tapa(el, c, objetivo)) altura = ALTURA_CORTE;
      } else if (!vistaCenital && this.modo === 'estancia' && this.separa(el, c, objetivo)) {
        // Barandillas: solo se bajan si están justo delante de la estancia que se mira.
        altura = Math.min(el.alto, ALTURA_CORTE);
      }
      if (altura < el.alto) cortados.add(el);
      el.objeto.scale.y = altura / el.alto;
      // Cristales: con la pared entera; en el modo huella también (marcan las ventanas en azul).
      const huella = this.modo === 'huella';
      for (const cr of el.cristales) cr.visible = huella || altura === el.alto;
      // En el modo huella quitamos antepechos y dinteles: los huecos se ven como huecos.
      for (const s of el.sobreHuecos) s.visible = !huella;
    }
  }

  /** ¿Deja la recta del elemento a un lado la cámara y al otro el objetivo? */
  private separa(el: ElementoVertical, c: THREE.Vector3, objetivo: THREE.Vector3): boolean {
    const dx = el.b[0] - el.a[0], dz = el.b[1] - el.a[1];
    const nx = -dz, nz = dx;
    const ladoCamara = nx * (c.x - el.a[0]) + nz * (c.z - el.a[1]);
    const ladoObjetivo = nx * (objetivo.x - el.a[0]) + nz * (objetivo.z - el.a[1]);
    return ladoCamara * ladoObjetivo < 0;
  }

  /** ¿Tapa este elemento la vista? */
  tapa(el: ElementoVertical, c: THREE.Vector3, objetivo: THREE.Vector3): boolean {
    if (this.modo === 'estancia') {
      if (this.separa(el, c, objetivo)) return true;
      const estancia = this.estancia;
      return estancia ? this.sombraPisa(el, c, (p) => puntoEnPoligono(p, estancia)) : false;
    }
    return this.sombraPisa(el, c, this.dentro);
  }

  /**
   * ¿Cae la "sombra" de la pared (el suelo que tapa, visto desde la cámara)
   * sobre algún punto que cumpla `suelo`?
   */
  private sombraPisa(el: ElementoVertical, c: THREE.Vector3, suelo: (p: Punto) => boolean): boolean {
    const dx = el.b[0] - el.a[0], dz = el.b[1] - el.a[1];
    for (const t of CortadorParedes.MUESTRAS) {
      const wx = el.a[0] + dx * t, wz = el.a[1] + dz * t;
      const hx = wx - c.x, hz = wz - c.z;
      const dist = Math.hypot(hx, hz);
      if (dist < 1e-6) continue;
      const ux = hx / dist, uz = hz / dist;
      // Longitud de la sombra: por semejanza de triángulos entre la cámara y el borde de la pared.
      const largo = c.y > el.alto ? Math.min(SOMBRA_MAXIMA, (dist * el.alto) / (c.y - el.alto)) : SOMBRA_MAXIMA;
      const inicio = el.grosor / 2 + 0.05; // justo detrás de la pared
      if (largo <= inicio) continue;
      for (const f of CortadorParedes.MUESTRAS_SOMBRA) {
        const s = inicio + (largo - inicio) * f;
        if (suelo([wx + ux * s, wz + uz * s])) return true;
      }
    }
    return false;
  }
}
