// Pequeñas utilidades para construir la interfaz.

/** Crea un elemento HTML con clase y texto opcionales. */
export function el<K extends keyof HTMLElementTagNameMap>(etiqueta: K, clase = '', texto = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto) e.textContent = texto;
  return e;
}

/** Formatea metros al estilo español: 3.5 → "3,5". `|| 0` evita mostrar "-0". */
export const m = (n: number) => (Math.round(n * 100) / 100 || 0).toLocaleString('es-ES');
