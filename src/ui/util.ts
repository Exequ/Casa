// Pequeñas utilidades para construir la interfaz.

import { textoTamano, type ItemCatalogo } from '../catalogo/catalogo';

/** Crea un elemento HTML con clase y texto opcionales. */
export function el<K extends keyof HTMLElementTagNameMap>(etiqueta: K, clase = '', texto = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto) e.textContent = texto;
  return e;
}

/** Formatea metros al estilo español: 3.5 → "3,5". `|| 0` evita mostrar "-0". */
export const m = (n: number) => (Math.round(n * 100) / 100 || 0).toLocaleString('es-ES');

/**
 * Rellena un desplegable con las medidas de un objeto (valor "ancho x fondo",
 * en m) y marca la actual. Devuelve false si el objeto no tiene varias medidas.
 */
export function rellenarSelectorTamano(selector: HTMLSelectElement, item: ItemCatalogo): boolean {
  const lista = item.medidasDisponibles ?? [];
  if (lista.length < 2) return false;
  const firma = lista.map((t) => `${t.ancho}x${t.fondo}`).join('|');
  if (selector.dataset.firma !== firma) {
    selector.replaceChildren(...lista.map((t) => {
      const o = document.createElement('option');
      o.value = `${t.ancho}x${t.fondo}`;
      o.textContent = textoTamano(t);
      return o;
    }));
    selector.dataset.firma = firma;
  }
  selector.value = `${item.dimensiones.ancho}x${item.dimensiones.fondo}`;
  return true;
}
