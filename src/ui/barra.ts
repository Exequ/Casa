// Barras flotantes sobre la vista 3D:
//   - Barra superior: menú (móvil), selector de estancia, vistas (planta,
//     interior, plano) e interruptores (luces, puertas, cortinas).
//   - Herramientas (abajo a la derecha): deshacer, rehacer, imagen de la vista
//     y el candado del Modo cámara (con su etiqueta encima cuando está puesto).
//   - Barra del objeto (móvil): girar (o subir y bajar si es de pared),
//     duplicar y borrar el objeto seleccionado.

import type { GestorObjetos } from '../escena/objetos';
import type { Vivienda } from '../vivienda/modelo';
import { el, m } from './util';

/** Botones de la barra que se quedan marcados. */
export type Interruptor = 'planta' | 'interior' | 'plano' | 'luces' | 'puertas' | 'cortinas';

export interface AccionesBarra {
  /** Se ha elegido otra estancia (null = toda la vivienda). */
  estancia(id: string | null): void;
  /** Se ha pulsado un interruptor: `activo` es su nuevo estado. */
  pulsar(cual: Interruptor, activo: boolean): void;
  abrirMenu(): void;
  deshacer(): void;
  rehacer(): void;
  /** Descargar una imagen de la vista actual. */
  captura(): void;
  duplicar(): void;
  /** Pone o quita el candado del Modo cámara. */
  alternarModoCamara(): void;
}

export interface Barra {
  /** Id de la estancia elegida (o null = toda la vivienda). */
  estancia(): string | null;
  /** ¿Está marcado el interruptor? */
  activo(cual: Interruptor): boolean;
  /** Marca o desmarca un interruptor (sin avisar). */
  marcar(cual: Interruptor, activo: boolean): void;
  /** Activa o desactiva los botones de deshacer y rehacer. */
  historial(puedeDeshacer: boolean, puedeRehacer: boolean): void;
  /** Muestra el candado cerrado (Modo cámara) o abierto. */
  modoCamara(activo: boolean): void;
  /** Aviso breve flotante sobre la vista (se va solo). */
  aviso(texto: string): void;
}

/** Paso de los botones ▲ ▼ de altura de los objetos de pared (m). */
export const PASO_ALTURA = 0.05;

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
  const boton = (texto: string, titulo: string, clase = '') => {
    const b = el('button', clase, texto);
    b.title = titulo;
    b.setAttribute('aria-label', titulo);
    return b;
  };
  const btnIzq = boton('⟲ 15°', 'Girar 15° a la izquierda');
  const btnDer = boton('⟳ 15°', 'Girar 15° a la derecha');
  const btnSubir = boton('▲', `Subir ${PASO_ALTURA * 100} cm`, 'altura-subir');
  const btnBajar = boton('▼', `Bajar ${PASO_ALTURA * 100} cm`, 'altura-bajar');
  const btnDuplicar = boton('⧉', 'Duplicar (tecla D)', 'duplicar');
  const btnBorrar = boton('Borrar', 'Borrar', 'peligro');
  const btnSoltar = boton('✕', 'Deseleccionar');
  barraObj.append(nombre, btnIzq, btnDer, btnSubir, btnBajar, btnDuplicar, btnBorrar, btnSoltar);
  // Botones que editan objetos: con el Modo cámara se ven apagados y avisan (ver main.ts)
  for (const b of [btnIzq, btnDer, btnSubir, btnBajar, btnDuplicar, btnBorrar]) b.dataset.edicion = '';
  contenedor.append(barraObj);

  btnIzq.addEventListener('click', () => gestor.seleccionado && gestor.girar(gestor.seleccionado, 15));
  btnDer.addEventListener('click', () => gestor.seleccionado && gestor.girar(gestor.seleccionado, -15));
  const cambiarAltura = (signo: number) => {
    const sel = gestor.seleccionado;
    if (sel?.pared) gestor.ponerAltura(sel, Math.round((sel.pared.y + signo * PASO_ALTURA) * 100) / 100);
  };
  btnSubir.addEventListener('click', () => cambiarAltura(1));
  btnBajar.addEventListener('click', () => cambiarAltura(-1));
  btnDuplicar.addEventListener('click', () => acciones.duplicar());
  btnBorrar.addEventListener('click', () => gestor.seleccionado && gestor.borrar(gestor.seleccionado));
  btnSoltar.addEventListener('click', () => gestor.seleccionar(null));

  // --- Herramientas: deshacer, rehacer e imagen -------------------------------------
  const herramientas = el('div', 'herramientas');
  const btnDeshacer = boton('↶', 'Deshacer (Ctrl+Z)', 'deshacer');
  const btnRehacer = boton('↷', 'Rehacer (Ctrl+Mayús+Z)', 'rehacer');
  const btnCaptura = boton('📷', 'Descargar una imagen PNG de la vista', 'captura');
  btnDeshacer.addEventListener('click', () => acciones.deshacer());
  btnRehacer.addEventListener('click', () => acciones.rehacer());
  btnCaptura.addEventListener('click', () => acciones.captura());
  btnDeshacer.dataset.edicion = btnRehacer.dataset.edicion = '';
  // Candado del Modo cámara: cerrado = solo se mueve la cámara
  const btnCandado = boton('🔓', '', 'candado');
  btnCandado.setAttribute('aria-pressed', 'false');
  btnCandado.addEventListener('click', () => acciones.alternarModoCamara());
  const etiquetaModo = el('span', 'etiqueta-modo', '🔒 Modo cámara');
  etiquetaModo.hidden = true;
  etiquetaModo.setAttribute('role', 'status');
  herramientas.append(etiquetaModo, btnDeshacer, btnRehacer, btnCaptura, btnCandado);
  contenedor.append(herramientas);

  // Aviso flotante (p. ej. al tocar un botón de edición en Modo cámara)
  const avisoFlotante = el('div', 'aviso-flotante');
  avisoFlotante.hidden = true;
  avisoFlotante.setAttribute('role', 'status');
  avisoFlotante.setAttribute('aria-live', 'polite');
  document.body.append(avisoFlotante);
  let temporizadorAviso: number | undefined;

  const actualizar = () => {
    const sel = gestor.seleccionado;
    barraObj.classList.toggle('visible', !!sel);
    const enPared = sel?.colocacion === 'pared';
    btnIzq.hidden = btnDer.hidden = enPared;
    btnSubir.hidden = btnBajar.hidden = !enPared;
    nombre.textContent = !sel ? ''
      : enPared && sel.pared ? `${sel.item.nombre} · centro a ${m(sel.pared.y)} m`
        : `${sel.item.nombre} · ${Math.round(sel.rotacion)}°`;
    // Las herramientas suben para no quedar debajo de la barra del objeto (en el móvil)
    requestAnimationFrame(() => {
      const visible = barraObj.offsetParent !== null && barraObj.classList.contains('visible');
      herramientas.style.bottom = visible ? `calc(${barraObj.offsetHeight + 20}px + env(safe-area-inset-bottom))` : '';
    });
  };
  gestor.alSeleccionar(actualizar);
  actualizar();

  return {
    estancia: () => selector.value || null,
    activo: (cual) => botones.get(cual)!.classList.contains('activo'),
    marcar,
    historial(puedeDeshacer, puedeRehacer) {
      btnDeshacer.disabled = !puedeDeshacer;
      btnRehacer.disabled = !puedeRehacer;
    },
    modoCamara(activo) {
      btnCandado.textContent = activo ? '🔒' : '🔓';
      btnCandado.classList.toggle('activo', activo);
      btnCandado.setAttribute('aria-pressed', String(activo));
      const titulo = activo
        ? 'Modo cámara puesto: solo se mueve la cámara. Toca para volver a editar'
        : 'Modo cámara: bloquear la edición para mover solo la cámara';
      btnCandado.title = titulo;
      btnCandado.setAttribute('aria-label', titulo);
      etiquetaModo.hidden = !activo;
      document.body.classList.toggle('modo-camara', activo);
      for (const b of document.querySelectorAll<HTMLElement>('[data-edicion]')) {
        if (activo) b.setAttribute('aria-disabled', 'true');
        else b.removeAttribute('aria-disabled');
      }
    },
    aviso(texto) {
      avisoFlotante.textContent = texto;
      avisoFlotante.hidden = false;
      clearTimeout(temporizadorAviso);
      temporizadorAviso = window.setTimeout(() => { avisoFlotante.hidden = true; }, 2800);
    },
  };
}
