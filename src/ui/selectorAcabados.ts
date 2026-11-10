// Acabados de una estancia: elegir su suelo y el color de sus paredes, y
// encender o apagar su luz. Cada opción lleva una vista previa pequeña.

import type { GestorLuces } from '../escena/luces';
import type { GestorParedes } from '../escena/paredes3d';
import type { GestorSuelos } from '../escena/suelos3d';
import { dibujarSuelo } from '../escena/texturasSuelo';
import { COLORES_PARED } from '../vivienda/acabados';
import type { Vivienda } from '../vivienda/modelo';
import { SUELOS, mismoSuelo, predefinidoDe } from '../vivienda/suelos';
import { el } from './util';

export interface SelectorAcabados {
  /** Muestra los acabados de esta estancia (p. ej. al elegirla en la barra superior). */
  elegirEstancia(id: string): void;
}

export function crearSelectorAcabados(
  seccion: HTMLElement, vivienda: Vivienda, suelos: GestorSuelos, paredes: GestorParedes, luces: GestorLuces,
): SelectorAcabados {
  seccion.append(el('h2', '', 'Acabados'));

  const fila = el('label', 'fila');
  const selector = el('select');
  selector.id = 'acabados-estancia';
  for (const e of vivienda.estancias) selector.append(new Option(e.nombre, e.id));
  fila.append(el('span', '', 'Estancia'), selector);
  seccion.append(fila);

  // --- Suelo ------------------------------------------------------------------------
  seccion.append(el('h3', '', 'Suelo'));
  const rejilla = el('div', 'rejilla-suelos');
  rejilla.setAttribute('role', 'radiogroup');
  rejilla.setAttribute('aria-label', 'Suelo de la estancia');
  const botones = SUELOS.map((s) => {
    const boton = el('button', 'muestra-suelo');
    boton.type = 'button';
    boton.dataset.suelo = s.id;
    const lado = Math.min(1.2, s.escala).toLocaleString('es-ES');
    boton.title = `${s.nombre} (la muestra son ${lado} × ${lado} m)`;
    boton.setAttribute('role', 'radio');
    // Vista previa pequeña: un recorte de 1,2 × 1,2 m reales (o el dibujo entero si es menor),
    // para que todos los suelos se vean a una escala parecida.
    const completo = dibujarSuelo(s, 256);
    const px = 256 * Math.min(1, 1.2 / s.escala);
    const vista = el('canvas');
    vista.width = vista.height = 96;
    vista.getContext('2d')!.drawImage(completo, 0, 0, px, px, 0, 0, 96, 96);
    vista.className = 'vista-suelo';
    vista.setAttribute('aria-hidden', 'true');
    boton.append(vista, el('span', '', s.nombre));
    boton.addEventListener('click', () => suelos.cambiar(selector.value, s));
    rejilla.append(boton);
    return boton;
  });
  const pieSuelo = el('div', 'fila');
  const sueloOriginal = el('button', '', 'Suelo original');
  sueloOriginal.type = 'button';
  sueloOriginal.id = 'suelo-original';
  const notaSuelo = el('span', 'nota');
  pieSuelo.append(sueloOriginal, notaSuelo);
  sueloOriginal.addEventListener('click', () => suelos.cambiar(selector.value, null));
  seccion.append(rejilla, pieSuelo);

  // --- Paredes ----------------------------------------------------------------------
  const bloquePared = el('div', 'bloque-pared');
  bloquePared.append(el('h3', '', 'Color de las paredes'));
  const colores = el('div', 'rejilla-colores');
  colores.setAttribute('role', 'radiogroup');
  colores.setAttribute('aria-label', 'Color de las paredes');
  const muestras = COLORES_PARED.map((c) => {
    const boton = el('button', 'muestra-color');
    boton.type = 'button';
    boton.dataset.color = c.id;
    boton.title = c.nombre;
    boton.setAttribute('role', 'radio');
    boton.setAttribute('aria-label', c.nombre);
    boton.style.background = c.color;
    boton.addEventListener('click', () => paredes.cambiar(selector.value, c.color));
    colores.append(boton);
    return boton;
  });
  const filaLibre = el('label', 'fila');
  const libre = el('input');
  libre.type = 'color';
  libre.id = 'color-pared';
  const nombreColor = el('span', 'nota');
  filaLibre.append(el('span', '', 'Otro color'), libre, nombreColor);
  // "input" se dispara mientras se arrastra en el selector de color del sistema
  libre.addEventListener('input', () => paredes.cambiar(selector.value, libre.value));
  const paredOriginal = el('button', '', 'Color original');
  paredOriginal.type = 'button';
  paredOriginal.id = 'pared-original';
  paredOriginal.addEventListener('click', () => paredes.cambiar(selector.value, null));
  const notaPared = el('p', 'nota', 'El alicatado del baño y el frente de la cocina no cambian.');
  bloquePared.append(colores, filaLibre, paredOriginal, notaPared);
  seccion.append(bloquePared);

  // --- Luz ---------------------------------------------------------------------------
  const filaLuz = el('label', 'fila');
  const luz = el('input');
  luz.type = 'checkbox';
  luz.id = 'luz-estancia';
  filaLuz.append(luz, el('span', '', 'Luz de esta estancia encendida'));
  luz.addEventListener('change', () => luces.ponerEstancia(selector.value, luz.checked));
  seccion.append(filaLuz);

  /** Marca lo que lleva ahora la estancia elegida. */
  function refrescar() {
    const id = selector.value;
    // Suelo
    const actual = suelos.actual(id);
    for (const b of botones) {
      const activo = mismoSuelo(SUELOS.find((x) => x.id === b.dataset.suelo)!, actual);
      b.classList.toggle('activo', activo);
      b.setAttribute('aria-checked', String(activo));
    }
    const orig = suelos.original(id);
    sueloOriginal.disabled = mismoSuelo(actual, orig);
    notaSuelo.textContent = `Original: ${predefinidoDe(orig)?.nombre ?? 'personalizado'}`;
    // Paredes (las estancias exteriores no tienen)
    const pintable = paredes.estancias().includes(id);
    bloquePared.hidden = !pintable;
    if (pintable) {
      const color = paredes.actual(id);
      for (const b of muestras) {
        const activo = COLORES_PARED.find((c) => c.id === b.dataset.color)!.color.toLowerCase() === color;
        b.classList.toggle('activo', activo);
        b.setAttribute('aria-checked', String(activo));
      }
      libre.value = color;
      nombreColor.textContent = COLORES_PARED.find((c) => c.color.toLowerCase() === color)?.nombre ?? color;
      paredOriginal.disabled = color === paredes.original(id);
    }
    // Luz
    const conLuz = luces.estancias().includes(id);
    filaLuz.hidden = !conLuz;
    luz.checked = luces.interruptor(id);
    luz.disabled = !luces.generalEncendido();
  }

  selector.addEventListener('change', refrescar);
  suelos.alCambiar(refrescar);
  paredes.alCambiar(refrescar);
  luces.alCambiar(refrescar);
  refrescar();

  return {
    elegirEstancia(id) {
      if (!vivienda.estancias.some((e) => e.id === id)) return;
      selector.value = id;
      refrescar();
    },
  };
}
