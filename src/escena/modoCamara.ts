// Modo cámara (candado global): con el candado puesto, los clics, arrastres
// y toques solo mueven la cámara. No se selecciona, mueve, gira, borra,
// duplica ni añade ningún objeto, y las teclas de edición no hacen nada.
// El estado se recuerda entre visitas (localStorage); por defecto, apagado.
//
// Aquí está la parte sin DOM (estado, guardado y qué hace cada tecla), para
// poder probarla con tests. La interfaz está en src/ui/barra.ts y la
// interacción con el ratón y el dedo en src/escena/interaccion.ts.

/** Clave del navegador donde se recuerda si el candado está puesto. */
export const CLAVE_MODO_CAMARA = 'casa3d:modoCamara';

/** Lo mínimo de `localStorage` que se usa (para poder probarlo sin navegador). */
export interface Almacen {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

/** `localStorage` si se puede usar (en modo privado o sin navegador puede fallar). */
export function almacenNavegador(): Almacen | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

type Oyente = (activo: boolean) => void;

export class ModoCamara {
  private _activo = false;
  private oyentes: Oyente[] = [];

  constructor(private almacen: Almacen | null = almacenNavegador()) {
    try {
      this._activo = almacen?.getItem(CLAVE_MODO_CAMARA) === '1';
    } catch {
      this._activo = false;
    }
  }

  get activo() { return this._activo; }

  /** Pone o quita el candado (y lo recuerda). Avisa solo si cambia. */
  poner(activo: boolean) {
    if (activo === this._activo) return;
    this._activo = activo;
    try {
      this.almacen?.setItem(CLAVE_MODO_CAMARA, activo ? '1' : '0');
    } catch {
      // Sin almacenamiento: funciona igual, pero no se recuerda.
    }
    for (const fn of this.oyentes) fn(activo);
  }

  alternar() { this.poner(!this._activo); }

  /** Se llama cada vez que cambia el estado. */
  alCambiar(fn: Oyente) { this.oyentes.push(fn); }
}

/** Lo que hace una tecla sobre la escena. */
export type AccionTecla =
  | { tipo: 'deshacer' }
  | { tipo: 'rehacer' }
  | { tipo: 'borrar' }
  | { tipo: 'deseleccionar' }
  | { tipo: 'duplicar' }
  /** `sentido` 1 = antihorario (Q), -1 = horario (E); `fino` = 1° en vez de 15°. */
  | { tipo: 'girar'; sentido: 1 | -1; fino: boolean }
  /** Tecla de edición pulsada con el Modo cámara puesto: no hace nada (se avisa). */
  | { tipo: 'bloqueada' };

export interface TeclaPulsada {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

/**
 * Qué hace una tecla, o null si no es un atajo de la escena.
 * `haySeleccion` = hay un objeto seleccionado; `modoCamara` = el candado está puesto.
 * Con el candado, deshacer y rehacer tampoco funcionan (cambiarían los objetos).
 */
export function accionDeTecla(e: TeclaPulsada, haySeleccion: boolean, modoCamara: boolean): AccionTecla | null {
  const tecla = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && !e.altKey) {
    let accion: AccionTecla | null = null;
    if (tecla === 'z' && !e.shiftKey) accion = { tipo: 'deshacer' };
    else if ((tecla === 'z' && e.shiftKey) || tecla === 'y') accion = { tipo: 'rehacer' };
    if (accion && modoCamara) return { tipo: 'bloqueada' };
    return accion;
  }
  if (e.altKey) return null;
  if (e.key === 'Escape') return haySeleccion ? { tipo: 'deseleccionar' } : null;
  let accion: AccionTecla | null = null;
  if (e.key === 'Delete' || e.key === 'Backspace') accion = { tipo: 'borrar' };
  else if (tecla === 'd') accion = { tipo: 'duplicar' };
  else if (tecla === 'q' || tecla === 'e') accion = { tipo: 'girar', sentido: tecla === 'q' ? 1 : -1, fino: !!e.shiftKey };
  if (!accion) return null;
  if (modoCamara) return { tipo: 'bloqueada' };
  return haySeleccion ? accion : null;
}

/** Texto del aviso cuando se intenta editar con el candado puesto. */
export const AVISO_MODO_CAMARA = 'Modo cámara: solo se mueve la cámara. Quita el candado 🔒 para editar.';
