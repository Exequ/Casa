// Capas de la escena (fase 6, parte B).
//
// La escena tiene una lista ORDENADA de capas. Siempre existe la capa "Base"
// (id "base"): no se puede borrar ni renombrar, y lleva los muebles de la
// disposición original de la casa. Cada capa tiene nombre, visibilidad (ojo),
// bloqueo (candado) y color de etiqueta. Hay una sola capa activa: los
// objetos nuevos (añadir, duplicar) van a ella.
//
//   - Capa oculta: sus objetos no se dibujan, no se seleccionan y no cuentan
//     para choques ni como soporte.
//   - Capa bloqueada: sus objetos se ven y cuentan para choques, pero no se
//     pueden seleccionar ni mover.
//   - Los elementos fijos de la vivienda no pertenecen a ninguna capa.
//
// Aquí solo está la lista de capas (sin 3D ni DOM). Qué objeto va en qué
// capa lo lleva GestorObjetos (src/escena/objetos.ts).

/** Id de la capa Base. */
export const ID_BASE = 'base';
export const NOMBRE_BASE = 'Base';
/** Colores de etiqueta que se van asignando a las capas nuevas. */
export const COLORES_CAPA = ['#2f7cf6', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0891b2', '#65a30d', '#dc2626'];
/** Largo máximo de un nombre de capa. */
export const LARGO_NOMBRE = 40;

export interface Capa {
  id: string;
  nombre: string;
  visible: boolean;
  bloqueada: boolean;
  /** Color de la etiqueta (#rrggbb). */
  color: string;
}

/** Lista de capas y capa activa, tal como se guardan. */
export interface DatosCapas {
  capas: Capa[];
  activa: string;
}

/** La capa Base de una escena nueva o migrada: visible y BLOQUEADA. */
export const capaBase = (bloqueada = true): Capa => ({ id: ID_BASE, nombre: NOMBRE_BASE, visible: true, bloqueada, color: COLORES_CAPA[0] });

/** Capas de una escena sin capas (versiones anteriores a la 6): solo Base, bloqueada. */
export const capasPorDefecto = (): DatosCapas => ({ capas: [capaBase()], activa: ID_BASE });

const esColor = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

/**
 * Limpia una lista de capas leída de un archivo: ids únicos, nombres no
 * vacíos, la Base siempre presente y con su nombre, y una capa activa que
 * exista. Lo que no se entiende se descarta.
 */
export function normalizarCapas(capas: unknown, activa: unknown): DatosCapas {
  const lista: Capa[] = [];
  const ids = new Set<string>();
  if (Array.isArray(capas)) {
    for (const [i, c] of capas.entries()) {
      if (!c || typeof c !== 'object') continue;
      const d = c as Partial<Capa>;
      const id = typeof d.id === 'string' && d.id.trim() ? d.id.trim() : null;
      if (!id || ids.has(id)) continue;
      ids.add(id);
      const nombre = id === ID_BASE ? NOMBRE_BASE
        : typeof d.nombre === 'string' && d.nombre.trim() ? d.nombre.trim().slice(0, LARGO_NOMBRE) : `Capa ${i + 1}`;
      lista.push({
        id,
        nombre,
        visible: d.visible !== false,
        bloqueada: d.bloqueada === true,
        color: esColor(d.color) ? d.color : COLORES_CAPA[lista.length % COLORES_CAPA.length],
      });
    }
  }
  if (!ids.has(ID_BASE)) lista.unshift(capaBase());
  const act = typeof activa === 'string' && lista.some((c) => c.id === activa) ? activa : ID_BASE;
  return { capas: lista, activa: act };
}

type Oyente = () => void;

export class GestorCapas {
  private lista: Capa[];
  private _activa: string;
  private oyentes: Oyente[] = [];

  /**
   * Sin datos: solo la capa Base, desbloqueada (lo cómodo para los tests y
   * para empezar; al cargar una escena se ponen sus capas, con Base bloqueada).
   */
  constructor(datos: DatosCapas = { capas: [capaBase(false)], activa: ID_BASE }) {
    const n = normalizarCapas(datos.capas, datos.activa);
    this.lista = n.capas;
    this._activa = n.activa;
  }

  /** Las capas, en orden (copia: para cambiarlas, usar los métodos). */
  get capas(): readonly Capa[] { return this.lista; }
  get activa(): string { return this._activa; }
  capaActiva(): Capa { return this.get(this._activa)!; }

  get(id: string): Capa | undefined { return this.lista.find((c) => c.id === id); }
  existe(id: string) { return this.lista.some((c) => c.id === id); }
  /** ¿Se ven los objetos de esa capa? (una capa que no existe cuenta como visible) */
  visible(id: string) { return this.get(id)?.visible ?? true; }
  bloqueada(id: string) { return this.get(id)?.bloqueada ?? false; }
  /** ¿Se pueden seleccionar, mover y añadir objetos en esa capa? */
  editable(id: string) { return this.visible(id) && !this.bloqueada(id); }

  alCambiar(fn: Oyente) { this.oyentes.push(fn); }
  private avisar() { for (const fn of this.oyentes) fn(); }

  /** Nombre libre "Capa N" (N = el menor desde 2 que no esté usado). */
  nombreLibre(): string {
    const usados = new Set(this.lista.map((c) => c.nombre.toLowerCase()));
    for (let n = 2; ; n++) if (!usados.has(`capa ${n}`)) return `Capa ${n}`;
  }

  private idLibre(): string {
    for (let n = this.lista.length + 1; ; n++) if (!this.existe(`capa-${n}`)) return `capa-${n}`;
  }

  private colorLibre(): string {
    const usados = this.lista.map((c) => c.color);
    return COLORES_CAPA.find((c) => !usados.includes(c)) ?? COLORES_CAPA[this.lista.length % COLORES_CAPA.length];
  }

  /** Crea una capa nueva (visible y desbloqueada) justo después de la activa y la hace activa. */
  crear(nombre?: string): Capa {
    const capa: Capa = {
      id: this.idLibre(),
      nombre: nombre?.trim().slice(0, LARGO_NOMBRE) || this.nombreLibre(),
      visible: true,
      bloqueada: false,
      color: this.colorLibre(),
    };
    const i = this.lista.findIndex((c) => c.id === this._activa);
    this.lista.splice(i + 1, 0, capa);
    this._activa = capa.id;
    this.avisar();
    return capa;
  }

  /**
   * Crea la capa copia de otra ("Nombre (copia)") justo después, visible,
   * desbloqueada y activa. Los objetos los copia GestorObjetos.duplicarCapa.
   */
  crearCopia(id: string): Capa | null {
    const origen = this.get(id);
    if (!origen) return null;
    const base = `${origen.nombre} (copia)`.slice(0, LARGO_NOMBRE);
    let nombre = base;
    for (let n = 2; this.lista.some((c) => c.nombre === nombre); n++) nombre = `${base} ${n}`;
    const capa: Capa = { id: this.idLibre(), nombre, visible: true, bloqueada: false, color: this.colorLibre() };
    this.lista.splice(this.lista.indexOf(origen) + 1, 0, capa);
    this._activa = capa.id;
    this.avisar();
    return capa;
  }

  /** Cambia el nombre (no el de Base). Devuelve false si no se puede. */
  renombrar(id: string, nombre: string): boolean {
    const capa = this.get(id);
    const limpio = nombre.trim().slice(0, LARGO_NOMBRE);
    if (!capa || id === ID_BASE || !limpio) return false;
    if (capa.nombre === limpio) return true;
    capa.nombre = limpio;
    this.avisar();
    return true;
  }

  /**
   * Quita una capa de la lista (no Base). Sus objetos los borra
   * GestorObjetos.borrarCapa. Si era la activa, pasa a serlo la de al lado.
   */
  quitar(id: string): boolean {
    const i = this.lista.findIndex((c) => c.id === id);
    if (i === -1 || id === ID_BASE) return false;
    this.lista.splice(i, 1);
    if (this._activa === id) this._activa = (this.lista[i - 1] ?? this.lista[0]).id;
    this.avisar();
    return true;
  }

  /** Sube (-1) o baja (+1) una capa en la lista. False si ya está en el borde. */
  mover(id: string, paso: -1 | 1): boolean {
    const i = this.lista.findIndex((c) => c.id === id);
    const j = i + paso;
    if (i === -1 || j < 0 || j >= this.lista.length) return false;
    [this.lista[i], this.lista[j]] = [this.lista[j], this.lista[i]];
    this.avisar();
    return true;
  }

  ponerVisible(id: string, visible: boolean) {
    const capa = this.get(id);
    if (!capa || capa.visible === visible) return;
    capa.visible = visible;
    this.avisar();
  }

  ponerBloqueada(id: string, bloqueada: boolean) {
    const capa = this.get(id);
    if (!capa || capa.bloqueada === bloqueada) return;
    capa.bloqueada = bloqueada;
    this.avisar();
  }

  /** Pasa al siguiente color de etiqueta. */
  siguienteColor(id: string) {
    const capa = this.get(id);
    if (!capa) return;
    capa.color = COLORES_CAPA[(COLORES_CAPA.indexOf(capa.color) + 1) % COLORES_CAPA.length];
    this.avisar();
  }

  activar(id: string) {
    if (!this.existe(id) || this._activa === id) return;
    this._activa = id;
    this.avisar();
  }

  /** Lo que se guarda: capas (en orden) y capa activa. */
  datos(): DatosCapas {
    return { capas: this.lista.map((c) => ({ ...c })), activa: this._activa };
  }

  /** Sustituye todas las capas (al cargar una escena o al deshacer). */
  restaurar(datos: DatosCapas) {
    const n = normalizarCapas(datos.capas, datos.activa);
    const antes = JSON.stringify(this.datos());
    this.lista = n.capas;
    this._activa = n.activa;
    if (JSON.stringify(this.datos()) !== antes) this.avisar();
  }
}
