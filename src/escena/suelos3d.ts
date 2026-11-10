// Pone el suelo de cada estancia (textura y material) y recuerda los cambios
// que el usuario hace desde la interfaz, para guardarlos en la escena.

import type * as THREE from 'three';
import type { Vivienda } from '../vivienda/modelo';
import { giroDe, mismoSuelo, soloSuelo, sueloDe, validarSuelo, type Suelo } from '../vivienda/suelos';
import { materialSuelo } from './texturasSuelo';

type Oyente = () => void;

export class GestorSuelos {
  private actuales = new Map<string, Suelo>();
  private oyentes: Oyente[] = [];
  private vivienda: Vivienda;
  private mallas: Map<string, THREE.Mesh>;
  /** Trozos de suelo bajo puertas y balconeras, por la estancia de la que toman el suelo. */
  private umbrales: Map<string, THREE.Mesh[]>;
  /** Resolución de las texturas (px). */
  private tamano: number;

  constructor(vivienda: Vivienda, mallas: Map<string, THREE.Mesh>, tamanoTextura = 512, umbrales: Map<string, THREE.Mesh[]> = new Map()) {
    this.vivienda = vivienda;
    this.mallas = mallas;
    this.umbrales = umbrales;
    this.tamano = tamanoTextura;
    for (const e of vivienda.estancias) this.poner(e.id, sueloDe(e));
  }

  /** Se llama cuando cambia el suelo de alguna estancia. */
  alCambiar(fn: Oyente) { this.oyentes.push(fn); }

  /** Suelo de la estancia según vivienda.json. */
  original(id: string): Suelo {
    const e = this.vivienda.estancias.find((x) => x.id === id);
    if (!e) throw new Error(`No existe la estancia "${id}"`);
    return sueloDe(e);
  }

  /** Suelo que lleva ahora la estancia. */
  actual(id: string): Suelo {
    return this.actuales.get(id) ?? this.original(id);
  }

  /** Cambia el suelo de una estancia (null = volver al de vivienda.json). */
  cambiar(id: string, s: Suelo | null) {
    this.poner(id, s ? soloSuelo(s) : this.original(id));
    for (const fn of this.oyentes) fn();
  }

  /** Los suelos que el usuario ha cambiado respecto a vivienda.json (lo que se guarda en la escena). */
  cambios(): Record<string, Suelo> {
    const r: Record<string, Suelo> = {};
    for (const e of this.vivienda.estancias) {
      const s = this.actual(e.id);
      if (!mismoSuelo(s, this.original(e.id))) r[e.id] = soloSuelo(s);
    }
    return r;
  }

  /**
   * Restaura los suelos de una escena guardada: las estancias que no aparecen
   * vuelven a su suelo original. Ignora estancias que no existen y suelos no
   * válidos (y devuelve cuántos ha ignorado).
   */
  restaurar(cambios: Record<string, unknown> | undefined): number {
    let ignorados = 0;
    const ids = new Set(this.vivienda.estancias.map((e) => e.id));
    for (const [id, s] of Object.entries(cambios ?? {})) {
      if (!ids.has(id) || validarSuelo(s)) ignorados++;
    }
    for (const e of this.vivienda.estancias) {
      const s = cambios?.[e.id];
      this.poner(e.id, s && !validarSuelo(s) ? soloSuelo(s as Suelo) : this.original(e.id));
    }
    for (const fn of this.oyentes) fn();
    return ignorados;
  }

  private poner(id: string, s: Suelo) {
    this.actuales.set(id, s);
    const e = this.vivienda.estancias.find((x) => x.id === id);
    if (!e) return;
    const material = materialSuelo(s, this.tamano, giroDe(s, e));
    const malla = this.mallas.get(id);
    if (malla) malla.material = material;
    // Umbrales de puertas y balconeras que llevan el suelo de esta estancia
    for (const u of this.umbrales.get(id) ?? []) u.material = material;
  }
}
