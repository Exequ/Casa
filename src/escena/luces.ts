// Luces de la vivienda:
//   - Luz natural: un "sol" con sombras. En la vista exterior (casa de
//     muñecas) viene casi desde arriba para que se vea todo; en la vista
//     interior viene bajo y de lado, y como los techos dan sombra, solo entra
//     por las ventanas reales.
//   - Focos: una o dos luces por estancia (no una por foco, para que el móvil
//     vaya fluido), con interruptor general y por estancia.
//   - Como mucho 3 luces con sombras a la vez: el sol y, en la vista interior
//     con calidad normal, las de la estancia donde está la cámara.
//   - Para que vaya fluido, los focos solo dan luz en la vista interior y solo
//     los de la estancia donde está la cámara (y los de las que forman un mismo
//     espacio con ella, como salón y cocina). Fuera, se ven los discos encendidos.

import * as THREE from 'three';
import { ladosCompartidos } from '../vivienda/caras';
import { alturaEstancia, type Punto, type Vivienda } from '../vivienda/modelo';
import type { Calidad, Escena } from './escena';
import { COLOR_LUZ, encenderFocos, type Techos3D } from './techos';

/** Estado de los interruptores, tal como se guarda en la escena. */
export interface EstadoLuces {
  /** Interruptor general. */
  encendidas: boolean;
  /** Estancias con la luz apagada aunque el general esté encendido. */
  apagadas: string[];
}

/** Intensidad (candelas) que aporta cada foco a la luz de su estancia. */
const INTENSIDAD_FOCO = 2.6;

type Oyente = () => void;

export class GestorLuces {
  private general = true;
  private apagadas = new Set<string>();
  private oyentes: Oyente[] = [];
  /** Luces de cada estancia. */
  private porEstancia = new Map<string, THREE.Light[]>();
  private interior: boolean | null = null;
  private estanciaConSombras: string | null = null;
  /** Estancia donde está la cámara en la vista interior (null = fuera). */
  private estanciaActual: string | null = null;
  /** Estancias que forman un mismo espacio abierto con cada una (ella incluida). */
  private espacio = new Map<string, Set<string>>();
  private escena: Escena;
  private techos: Techos3D;
  private calidad: Calidad;
  private centro: THREE.Vector3;

  constructor(escena: Escena, vivienda: Vivienda, techos: Techos3D, centro: Punto) {
    this.escena = escena;
    this.techos = techos;
    this.calidad = escena.calidad;
    this.centro = new THREE.Vector3(centro[0], 0, centro[1]);
    for (const e of vivienda.estancias) this.espacio.set(e.id, new Set([e.id]));
    for (const { estancias: [a, b] } of ladosCompartidos(vivienda)) {
      this.espacio.get(a)?.add(b);
      this.espacio.get(b)?.add(a);
    }

    for (const e of vivienda.estancias) {
      if (e.exterior || !e.focos?.length) continue;
      const alto = alturaEstancia(e, vivienda);
      // Con calidad normal y 4 focos o más, dos luces (una por mitad); si no, una en el centro.
      const ordenados = [...e.focos].sort((p, q) => (p[0] - q[0]) || (p[1] - q[1]));
      const grupos = this.calidad !== 'ligera' && ordenados.length >= 4
        ? [ordenados.slice(0, Math.ceil(ordenados.length / 2)), ordenados.slice(Math.ceil(ordenados.length / 2))]
        : [ordenados];
      const luces: THREE.Light[] = grupos.map((g) => {
        const x = g.reduce((s, p) => s + p[0], 0) / g.length, z = g.reduce((s, p) => s + p[1], 0) / g.length;
        // Foco ancho hacia abajo, con el borde muy difuminado
        const luz = new THREE.SpotLight(COLOR_LUZ, INTENSIDAD_FOCO * g.length, 9, 1.25, 0.9, 1.6);
        luz.position.set(x, alto - 0.03, z);
        luz.target.position.set(x, 0, z);
        luz.shadow.mapSize.set(512, 512);
        luz.shadow.bias = -0.003;
        luz.shadow.camera.near = 0.2;
        luz.shadow.camera.far = 6;
        escena.escena.add(luz, luz.target);
        return luz;
      });
      // Apliques (p. ej. el LED sobre el espejo del baño): una luz puntual pequeña, solo con calidad normal.
      if (this.calidad !== 'ligera') {
        for (const ap of e.apliques ?? []) {
          const luz = new THREE.PointLight(COLOR_LUZ, 0.9, 3, 1.8);
          luz.position.set((ap.desde[0] + ap.hasta[0]) / 2, ap.altura - 0.05, (ap.desde[1] + ap.hasta[1]) / 2 + 0.08);
          escena.escena.add(luz);
          luces.push(luz);
        }
      }
      this.porEstancia.set(e.id, luces);
    }
    this.aplicar();
    this.modoInterior(false, null);
  }

  /** Se llama cuando cambia algún interruptor. */
  alCambiar(fn: Oyente) { this.oyentes.push(fn); }

  /** Estancias que tienen luces. */
  estancias(): string[] { return [...this.porEstancia.keys()]; }

  /** ¿Está encendido el interruptor general? */
  generalEncendido(): boolean { return this.general; }

  /** ¿Tiene la estancia su interruptor encendido? (aunque el general esté apagado) */
  interruptor(id: string): boolean { return !this.apagadas.has(id); }

  /** ¿Están dando luz los focos de la estancia? */
  encendida(id: string): boolean { return this.general && !this.apagadas.has(id) && this.porEstancia.has(id); }

  ponerGeneral(encendidas: boolean) {
    this.general = encendidas;
    this.aplicar();
    for (const fn of this.oyentes) fn();
  }

  ponerEstancia(id: string, encendida: boolean) {
    if (encendida) this.apagadas.delete(id); else this.apagadas.add(id);
    this.aplicar();
    for (const fn of this.oyentes) fn();
  }

  estado(): EstadoLuces {
    return { encendidas: this.general, apagadas: [...this.apagadas].sort() };
  }

  restaurar(e: Partial<EstadoLuces> | undefined) {
    this.general = e?.encendidas ?? true;
    this.apagadas = new Set((e?.apagadas ?? []).filter((id) => this.porEstancia.has(id)));
    this.aplicar();
    for (const fn of this.oyentes) fn();
  }

  /**
   * Ajusta la luz natural y las sombras según la vista. `interior` = la cámara
   * está dentro de la vivienda; `estancia` = en cuál.
   */
  modoInterior(interior: boolean, estancia: string | null) {
    const actual = interior ? estancia : null;
    if (actual !== this.estanciaActual) {
      this.estanciaActual = actual;
      this.aplicar();
    }
    if (interior !== this.interior) {
      this.interior = interior;
      const { sol, cielo, escena } = this.escena;
      // Sin mapa de entorno (calidad ligera), el cielo pone toda la luz ambiental.
      const sinEntorno = escena.environment ? 0 : 0.45;
      this.techos.grupo.visible = interior;
      // Dentro, los techos dan sombra: la luz del sol solo entra por las ventanas.
      for (const t of this.techos.porEstancia.values()) t.techo.castShadow = interior;
      if (interior) {
        sol.position.copy(this.centro).add(new THREE.Vector3(-10, 6.2, 3.5)); // sol bajo, de poniente
        sol.intensity = 3.2;
        cielo.intensity = 0.75 + sinEntorno;
        escena.environmentIntensity = 0.75;
      } else {
        sol.position.copy(this.centro).add(new THREE.Vector3(3, 12, 4)); // casi cenital
        sol.intensity = 2.0;
        cielo.intensity = 1.0 + sinEntorno;
        escena.environmentIntensity = 0.55;
      }
    }
    // Sombras de los focos: solo los de la estancia donde está la cámara, y solo con calidad normal.
    const conSombras = interior && this.calidad !== 'ligera' ? estancia : null;
    if (conSombras !== this.estanciaConSombras) {
      this.estanciaConSombras = conSombras;
      for (const [id, luces] of this.porEstancia) {
        let n = 0;
        for (const luz of luces) {
          if (luz instanceof THREE.SpotLight) luz.castShadow = id === conSombras && n++ < 2;
        }
      }
    }
  }

  /** Luces con sombras encendidas ahora mismo (para comprobar el límite). */
  lucesConSombras(): number {
    let n = this.escena.sol.castShadow ? 1 : 0;
    for (const luces of this.porEstancia.values()) for (const l of luces) if (l.visible && l.castShadow) n++;
    return n;
  }

  /** Luces que dan luz ahora mismo (para comprobar el límite de rendimiento). */
  lucesActivas(): number {
    let n = 0;
    for (const luces of this.porEstancia.values()) for (const l of luces) if (l.visible) n++;
    return n;
  }

  private aplicar() {
    const cerca = this.estanciaActual ? this.espacio.get(this.estanciaActual) : null;
    for (const [id, luces] of this.porEstancia) {
      const on = this.encendida(id);
      for (const luz of luces) luz.visible = on && !!cerca?.has(id);
      encenderFocos(this.techos, id, on);
    }
  }
}
