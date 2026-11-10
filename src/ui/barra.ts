// Barras flotantes sobre la vista 3D:
//   - Barra superior: menú (móvil), selector de estancia, vistas (planta,
//     interior, plano) e interruptores (luces, puertas, cortinas).
//   - Barra del objeto (móvil): girar y borrar el objeto seleccionado.

import type { GestorObjetos } from '../escena/objetos';
import type { Vivienda } from '../vivienda/modelo';
import { el } from './util';

/** Botones de la barra que se quedan marcados. */
export type Interruptor = 'planta' | 'interior' | 'plano' | 'luces' | 'puertas' | 'cortinas';

export interface AccionesBarra {
  /** Se ha elegido otra estancia (null = toda la vivienda). */
  estancia(id: string | null): void;
  /** Se ha pulsado un interruptor: `activo` es su nuevo estado. */
  pulsar(cual: Interruptor, activo: boolean): void;
  abrirMenu(): void;
}

export interface Barra {
  /** Id de la estancia elegida (o null = toda la vivienda). */
  estancia(): string | null;
  /** ¿Está marcado el interruptor? */
  activo(cual: Interruptor): boolean;
  /** Marca o desmarca un interruptor (sin avisar). */
  marcar(cual: Interruptor, activo: boolean): void;
}

const BOTONES: { id: Interruptor; texto: string; titulo: string }[] = [
  { id: 'planta', texto: 'Planta', titulo: 'Ver desde arriba' },
  { id: 'interior', texto: 'Interior', titulo: 'Entrar en la estancia: vista a la altura de los ojos, con techo' },
  { id: 'luces', texto: 'Luces', titulo: 'Encender o apagar todos los focos' },
  { id: 'puertas', texto: 'Puertas', titulo: 'Ver las puertas abiertas o cerradas' },
  { id: 'cortinas', texto: 'Cortinas', titulo: 'Mostrar u ocultar las cortinas' },
  { id: 'plano', texto: 'Plano', titulo: 'Superponer el plano original para comprobar' },
];

export function crearBarra(contenedor: HTMLElement, vivienda: Vivienda, gestor: GestorObjetos, acciones: AccionesBarra): Barra {
  // --- Barra superior -----------------------------------------------------------
  const barra = el('div', 'barra');
  const btnMenu = el('button', 'solo-movil', '☰');
  btnMenu.title = 'Menú: catálogo, acabados, guardar y cargar';
  btnMenu.setAttribute('aria-label', 'Menú');
  btnMenu.addEventListener('click', () => acciones.abrirMenu());

  const selector = el('select');
  selector.title = 'Centrar la cámara en una estancia';
  selector.setAttribute('aria-label', 'Estancia');
  selector.append(new Option('Toda la vivienda', ''));
  for (const e of vivienda.estancias) selector.append(new Option(e.nombre, e.id));
  selector.addEventListener('change', () => acciones.estancia(selector.value || null));
  barra.append(btnMenu, selector);

  const botones = new Map<Interruptor, HTMLButtonElement>();
  for (const b of BOTONES) {
    const boton = el('button', 'alternar', b.texto);
    boton.title = b.titulo;
    boton.dataset.interruptor = b.id;
    boton.setAttribute('aria-pressed', 'false');
    boton.addEventListener('click', () => {
      const activo = !boton.classList.contains('activo');
      marcar(b.id, activo);
      acciones.pulsar(b.id, activo);
    });
    botones.set(b.id, boton);
    barra.append(boton);
  }
  if (!vivienda.plano) botones.get('plano')!.hidden = true;
  contenedor.append(barra);

  function marcar(cual: Interruptor, activo: boolean) {
    const boton = botones.get(cual)!;
    boton.classList.toggle('activo', activo);
    boton.setAttribute('aria-pressed', String(activo));
  }

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
    activo: (cual) => botones.get(cual)!.classList.contains('activo'),
    marcar,
  };
}
