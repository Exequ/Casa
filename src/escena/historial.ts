// Deshacer y rehacer.
//
// Se guarda una "foto" de la escena (muebles con su colocación, suelos y
// colores de pared, en el mismo formato que el archivo de escena) después de
// cada cambio. Deshacer vuelve a la foto anterior y rehacer a la siguiente.
// Los cambios muy seguidos (p. ej. al arrastrar el selector de color) se
// juntan en uno solo. Las luces, puertas y cortinas no entran en el historial.

type Oyente = () => void;

/** Pasos que se recuerdan (el mínimo pedido son 50). */
export const PASOS_HISTORIAL = 100;

export class Historial {
  private pila: string[] = [];
  private indice = -1;
  private restaurando = false;
  private temporizador: ReturnType<typeof setTimeout> | undefined;
  private oyentes: Oyente[] = [];

  /**
   * `leer` devuelve la foto del estado actual (texto); `restaurar` vuelve a
   * una foto. `espera` = ms para juntar cambios seguidos.
   */
  constructor(
    private leer: () => string,
    private restaurar: (foto: string) => Promise<void>,
    private espera = 250,
    private maximo = PASOS_HISTORIAL,
  ) {}

  /** Empieza de cero con el estado actual (p. ej. tras cargar una escena). */
  iniciar() {
    clearTimeout(this.temporizador);
    this.pila = [this.leer()];
    this.indice = 0;
    this.avisar();
  }

  /** Se llama cuando cambia lo que se puede deshacer (para activar o desactivar botones). */
  alCambiar(fn: Oyente) { this.oyentes.push(fn); }

  /** Avisa de que algo ha cambiado: se apunta tras una pequeña espera (juntando cambios seguidos). */
  cambio() {
    if (this.restaurando) return;
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.apuntar(), this.espera);
    this.avisar();
  }

  /** Apunta ya el estado actual si es distinto del último apuntado. */
  apuntar() {
    clearTimeout(this.temporizador);
    this.temporizador = undefined;
    if (this.restaurando) return;
    const foto = this.leer();
    if (this.indice >= 0 && foto === this.pila[this.indice]) return;
    this.pila.length = this.indice + 1; // lo que se podía rehacer se pierde
    this.pila.push(foto);
    if (this.pila.length > this.maximo + 1) this.pila.shift();
    this.indice = this.pila.length - 1;
    this.avisar();
  }

  puedeDeshacer() { return !this.restaurando && (this.indice > 0 || this.temporizador !== undefined); }
  puedeRehacer() { return !this.restaurando && this.temporizador === undefined && this.indice < this.pila.length - 1; }
  /** Número de pasos que se pueden deshacer ahora. */
  pasosAtras() { return Math.max(0, this.indice); }

  async deshacer(): Promise<boolean> {
    if (this.restaurando) return false;
    if (this.temporizador !== undefined) this.apuntar(); // el último cambio aún no estaba apuntado
    if (this.indice <= 0) return false;
    await this.ir(this.indice - 1);
    return true;
  }

  async rehacer(): Promise<boolean> {
    if (this.restaurando || this.temporizador !== undefined || this.indice >= this.pila.length - 1) return false;
    await this.ir(this.indice + 1);
    return true;
  }

  private async ir(indice: number) {
    this.restaurando = true;
    this.avisar();
    try {
      await this.restaurar(this.pila[indice]);
    } finally {
      clearTimeout(this.temporizador);
      this.temporizador = undefined;
      this.indice = indice;
      // Si algo no ha podido quedar exactamente igual, la foto pasa a ser lo que hay.
      this.pila[indice] = this.leer();
      this.restaurando = false;
      this.avisar();
    }
  }

  private avisar() { for (const fn of this.oyentes) fn(); }
}
