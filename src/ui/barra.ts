// Barras flotantes sobre la vista 3D:
//   - Barra superior: menú (móvil), selector de estancia, vista en planta y plano.
//   - Barra del objeto (móvil): girar y borrar el objeto seleccionado.

import type { GestorObjetos } from '../escena/objetos';
import type { Vivienda } from '../vivienda/modelo';
import { el } from './util';

export interface AccionesBarra {
  /** Encuadra una estancia (por id) o toda la vivienda (null). */
  enfocar(id: string | null, planta: boolean): void;
  verPlano(visible: boolean): void;
  abrirMenu(): void;
}

export interface Barra {
  /** Id de la estancia elegida (o null = toda la vivienda). */
  estancia(): string | null;
  marcarPlano(visible: boolean): void;
}

export function crearBarra(contenedor: HTMLElement, vivienda: Vivienda, gestor: GestorObjetos, acciones: AccionesBarra): Barra {
  // --- Barra superior -----------------------------------------------------------
  const barra = el('div', 'barra');
  const btnMenu = el('button', 'solo-movil', '☰');
  btnMenu.title = 'Menú: catálogo, guardar y cargar';
  btnMenu.setAttribute('aria-label', 'Menú');

  const selector = el('select');
  selector.title = 'Centrar la cámara en una estancia';
  selector.setAttribute('aria-label', 'Estancia');
  selector.append(new Option('Toda la vivienda', ''));
  for (const e of vivienda.estancias) selector.append(new Option(e.nombre, e.id));

  const btnPlanta = el('button', 'alternar', 'Planta');
  btnPlanta.title = 'Ver desde arriba';
  const btnPlano = el('button', 'alternar', 'Plano');
  btnPlano.title = 'Superponer el plano original para comprobar';
  if (!vivienda.plano) btnPlano.hidden = true;

  barra.append(btnMenu, selector, btnPlanta, btnPlano);
  contenedor.append(barra);

  let planta = false;
  const enfocar = () => acciones.enfocar(selector.value || null, planta);
  selector.addEventListener('change', enfocar);
  btnPlanta.addEventListener('click', () => {
    planta = !planta;
    btnPlanta.classList.toggle('activo', planta);
    enfocar();
  });
  btnPlano.addEventListener('click', () => acciones.verPlano(!btnPlano.classList.contains('activo')));
  btnMenu.addEventListener('click', () => acciones.abrirMenu());

  // --- Barra del objeto seleccionado (solo móvil, por CSS) -----------------------
  const barraObj = el('div', 'barra-objeto');
  const nombre = el('span', 'nombre');
  const btnIzq = el('button', '', '⟲ 15°');
  const btnDer = el('button', '', '⟳ 15°');
  const btnBorrar = el('button', 'peligro', 'Borrar');
  const btnSoltar = el('button', '', '✕');
  btnSoltar.title = 'Deseleccionar';
  barraObj.append(nombre, btnIzq, btnDer, btnBorrar, btnSoltar);
  contenedor.append(barraObj);

  btnIzq.addEventListener('click', () => gestor.seleccionado && gestor.girar(gestor.seleccionado, 15));
  btnDer.addEventListener('click', () => gestor.seleccionado && gestor.girar(gestor.seleccionado, -15));
  btnBorrar.addEventListener('click', () => gestor.seleccionado && gestor.borrar(gestor.seleccionado));
  btnSoltar.addEventListener('click', () => gestor.seleccionar(null));
  const actualizar = () => {
    barraObj.classList.toggle('visible', !!gestor.seleccionado);
    nombre.textContent = gestor.seleccionado
      ? `${gestor.seleccionado.item.nombre} · ${Math.round(gestor.seleccionado.rotacion)}°`
      : '';
  };
  gestor.alSeleccionar(actualizar);
  actualizar();

  return {
    estancia: () => selector.value || null,
    marcarPlano: (visible) => btnPlano.classList.toggle('activo', visible),
  };
}
