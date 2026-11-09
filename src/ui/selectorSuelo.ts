// Selector de suelo: elegir una estancia y cambiar su suelo entre los
// predefinidos, con una vista previa pequeña de cada uno.

import type { GestorSuelos } from '../escena/suelos3d';
import { dibujarSuelo } from '../escena/texturasSuelo';
import type { Vivienda } from '../vivienda/modelo';
import { SUELOS, mismoSuelo, predefinidoDe } from '../vivienda/suelos';
import { el } from './util';

export interface SelectorSuelo {
  /** Muestra el suelo de esta estancia (p. ej. al elegirla en la barra superior). */
  elegirEstancia(id: string): void;
}

export function crearSelectorSuelo(seccion: HTMLElement, vivienda: Vivienda, suelos: GestorSuelos): SelectorSuelo {
  seccion.append(el('h2', '', 'Suelo'));

  const fila = el('label', 'fila');
  const selector = el('select');
  selector.id = 'suelo-estancia';
  for (const e of vivienda.estancias) selector.append(new Option(e.nombre, e.id));
  fila.append(el('span', '', 'Estancia'), selector);

  const rejilla = el('div', 'rejilla-suelos');
  rejilla.setAttribute('role', 'radiogroup');
  rejilla.setAttribute('aria-label', 'Suelo de la estancia');
  const botones = SUELOS.map((s) => {
    const boton = el('button', 'muestra-suelo');
    boton.type = 'button';
    boton.dataset.suelo = s.id;
    boton.title = `${s.nombre} (la muestra son ${Math.min(1.2, s.escala).toLocaleString('es-ES')} × ${Math.min(1.2, s.escala).toLocaleString('es-ES')} m)`;
    boton.setAttribute('role', 'radio');
    // Vista previa pequeña: un recorte de 1,2 × 1,2 m reales (o el dibujo entero si es menor),
    // para que todos los suelos se vean a una escala parecida.
    const completo = dibujarSuelo(s, 192);
    const lado = 192 * Math.min(1, 1.2 / s.escala);
    const vista = el('canvas');
    vista.width = vista.height = 96;
    vista.getContext('2d')!.drawImage(completo, 0, 0, lado, lado, 0, 0, 96, 96);
    vista.className = 'vista-suelo';
    vista.setAttribute('aria-hidden', 'true');
    boton.append(vista, el('span', '', s.nombre));
    boton.addEventListener('click', () => suelos.cambiar(selector.value, s));
    rejilla.append(boton);
    return boton;
  });

  const pie = el('div', 'fila');
  const original = el('button', '', 'Volver al original');
  original.type = 'button';
  const nota = el('span', 'nota');
  pie.append(original, nota);
  original.addEventListener('click', () => suelos.cambiar(selector.value, null));

  seccion.append(fila, rejilla, pie);

  /** Marca el suelo actual de la estancia elegida. */
  function refrescar() {
    const id = selector.value;
    const actual = suelos.actual(id);
    for (const b of botones) {
      const s = SUELOS.find((x) => x.id === b.dataset.suelo)!;
      const activo = mismoSuelo(s, actual);
      b.classList.toggle('activo', activo);
      b.setAttribute('aria-checked', String(activo));
    }
    const orig = suelos.original(id);
    const esOriginal = mismoSuelo(actual, orig);
    original.disabled = esOriginal;
    nota.textContent = `Original: ${predefinidoDe(orig)?.nombre ?? 'personalizado'}`;
  }

  selector.addEventListener('change', refrescar);
  suelos.alCambiar(refrescar);
  refrescar();

  return {
    elegirEstancia(id) {
      if (!vivienda.estancias.some((e) => e.id === id)) return;
      selector.value = id;
      refrescar();
    },
  };
}
