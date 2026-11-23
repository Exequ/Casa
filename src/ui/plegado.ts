// Plegado del catálogo (fase 6, parte C), sin DOM para poder probarlo:
//
//   - Una cabecera general "Catálogo" que pliega o despliega todo el catálogo.
//   - "Desplegar todo" y "Plegar todo" abren o cierran todas las categorías
//     sin cerrar la cabecera (si estaba plegada, "Desplegar todo" la abre).
//   - Mientras se busca, se ven abiertas solo las categorías con resultados
//     (las vacías se ocultan); al borrar la búsqueda vuelve el estado de antes.
//   - El estado (cabecera y categorías abiertas) se recuerda entre visitas.
//     Por defecto: catálogo abierto y todas las categorías plegadas.

import { almacenNavegador, type Almacen } from '../escena/modoCamara';

/** Clave del navegador donde se recuerda el plegado del catálogo. */
export const CLAVE_PLEGADO_CATALOGO = 'casa3d:catalogo';

/** Lo que se guarda. */
export interface EstadoGuardado {
  abierto: boolean;
  /** Categorías desplegadas. */
  abiertas: string[];
}

/** Cómo debe verse cada parte ahora. */
export interface VistaCategoria {
  abierta: boolean;
  visible: boolean;
}

export class PlegadoCatalogo {
  private abierto = true;
  private abiertas = new Set<string>();
  /** Mientras se busca: categorías con resultados, y lo que el usuario ha abierto o cerrado a mano. */
  private busqueda: { conResultados: Set<string>; aMano: Map<string, boolean> } | null = null;

  constructor(private categorias: string[], private almacen: Almacen | null = almacenNavegador()) {
    try {
      const texto = almacen?.getItem(CLAVE_PLEGADO_CATALOGO);
      if (texto) {
        const g = JSON.parse(texto) as Partial<EstadoGuardado>;
        this.abierto = g.abierto !== false;
        if (Array.isArray(g.abiertas)) this.abiertas = new Set(g.abiertas.filter((c) => categorias.includes(c)));
      }
    } catch {
      // Estado guardado ilegible: el de por defecto
    }
  }

  private guardar() {
    try {
      const g: EstadoGuardado = { abierto: this.abierto, abiertas: this.categorias.filter((c) => this.abiertas.has(c)) };
      this.almacen?.setItem(CLAVE_PLEGADO_CATALOGO, JSON.stringify(g));
    } catch {
      // Sin almacenamiento: funciona igual, pero no se recuerda
    }
  }

  /** ¿Está desplegado el catálogo entero (la cabecera)? */
  get catalogoAbierto() { return this.abierto; }
  get buscando() { return this.busqueda !== null; }

  /** Cómo debe verse una categoría ahora. */
  vista(categoria: string): VistaCategoria {
    if (this.busqueda) {
      const conResultados = this.busqueda.conResultados.has(categoria);
      return { visible: conResultados, abierta: conResultados && (this.busqueda.aMano.get(categoria) ?? true) };
    }
    return { visible: true, abierta: this.abiertas.has(categoria) };
  }

  /** Pliega o despliega la cabecera general. */
  ponerCatalogo(abierto: boolean) {
    if (this.abierto === abierto) return;
    this.abierto = abierto;
    this.guardar();
  }

  alternarCatalogo() { this.ponerCatalogo(!this.abierto); }

  /** El usuario abre o cierra una categoría (durante una búsqueda, no se recuerda). */
  ponerCategoria(categoria: string, abierta: boolean) {
    if (this.busqueda) {
      this.busqueda.aMano.set(categoria, abierta);
      return;
    }
    if (this.abiertas.has(categoria) === abierta) return;
    if (abierta) this.abiertas.add(categoria);
    else this.abiertas.delete(categoria);
    this.guardar();
  }

  /** Abre todas las categorías (y la cabecera, si estaba plegada). */
  desplegarTodo() {
    this.abierto = true;
    this.abiertas = new Set(this.categorias);
    this.busqueda?.aMano.clear();
    this.guardar();
  }

  /** Cierra todas las categorías, sin cerrar la cabecera. */
  plegarTodo() {
    this.abiertas.clear();
    if (this.busqueda) for (const c of this.categorias) this.busqueda.aMano.set(c, false);
    this.guardar();
  }

  /**
   * Empieza o actualiza una búsqueda: `conResultados` son las categorías con
   * algún objeto que coincide. Con null, la búsqueda termina y vuelve el
   * estado de antes.
   */
  buscar(conResultados: Iterable<string> | null) {
    if (conResultados === null) {
      this.busqueda = null;
      return;
    }
    const aMano = this.busqueda?.aMano ?? new Map<string, boolean>();
    this.busqueda = { conResultados: new Set(conResultados), aMano };
  }
}
