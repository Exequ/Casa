// Panel lateral: catálogo, objeto seleccionado, guardar/cargar y ayuda.
// Es HTML normal construido a mano; los estilos están en src/ui/estilos.css.

import type { ItemCatalogo } from '../catalogo/catalogo';
import type { DatosHabitacion } from '../escena/habitacion';
import type { GestorObjetos } from '../escena/objetos';

export interface AccionesPanel {
  agregar(item: ItemCatalogo): void;
  guardar(): void;
  cargar(archivo: File): void;
  vaciar(): void;
}

/** Formatea metros al estilo español: 3.5 → "3,5". */
const m = (n: number) => (Math.round(n * 100) / 100 || 0).toLocaleString('es-ES'); // `|| 0` evita "-0"

/** Crea un elemento HTML con clase y texto opcionales. */
function el<K extends keyof HTMLElementTagNameMap>(etiqueta: K, clase = '', texto = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto) e.textContent = texto;
  return e;
}

export function crearPanel(
  panel: HTMLElement,
  catalogo: ItemCatalogo[],
  habitacion: DatosHabitacion,
  gestor: GestorObjetos,
  acciones: AccionesPanel,
) {
  panel.innerHTML = '';

  // --- Cabecera ---------------------------------------------------------------
  panel.append(el('h1', '', 'Casa 3D'));
  panel.append(el('p', 'nota',
    `${habitacion.nombre ?? 'Habitación'}: ${m(habitacion.ancho)} × ${m(habitacion.largo)} m, ${m(habitacion.alto)} m de alto`));

  // --- Catálogo (agrupado por categoría) ----------------------------------------
  const secCatalogo = el('section');
  secCatalogo.append(el('h2', '', 'Catálogo'));
  if (catalogo.length === 0) {
    secCatalogo.append(el('p', 'nota', 'No hay objetos. Añade archivos .json + .glb a la carpeta catalogo/.'));
  }
  let categoriaActual = '';
  for (const item of catalogo) {
    if (item.categoria !== categoriaActual) {
      categoriaActual = item.categoria;
      secCatalogo.append(el('h3', '', categoriaActual));
    }
    const boton = el('button', 'item-catalogo');
    boton.title = 'Clic para añadirlo a la habitación';
    boton.append(
      el('span', 'item-nombre', item.nombre),
      el('span', 'item-medidas', `${m(item.dimensiones.ancho)} × ${m(item.dimensiones.fondo)} × ${m(item.dimensiones.alto)} m`),
    );
    boton.addEventListener('click', () => acciones.agregar(item));
    secCatalogo.append(boton);
  }
  panel.append(secCatalogo);

  // --- Objeto seleccionado ------------------------------------------------------
  const secSeleccion = el('section', 'seleccion');
  secSeleccion.append(el('h2', '', 'Objeto seleccionado'));
  const sinSeleccion = el('p', 'nota', 'Haz clic en un objeto de la habitación para seleccionarlo.');
  const conSeleccion = el('div');
  const nombreSel = el('p', 'sel-nombre');
  const posicionSel = el('p', 'nota');

  // Rotación: botones de 15° + deslizador y número para giro libre.
  const filaBotones = el('div', 'fila');
  const btnIzq = el('button', '', '⟲ 15°');
  const btnDer = el('button', '', '⟳ 15°');
  btnIzq.title = 'Girar 15° a la izquierda (tecla Q)';
  btnDer.title = 'Girar 15° a la derecha (tecla E)';
  filaBotones.append(btnIzq, btnDer);

  const filaLibre = el('label', 'fila');
  const deslizador = el('input');
  deslizador.type = 'range';
  deslizador.min = '0';
  deslizador.max = '359';
  deslizador.step = '1';
  const numero = el('input', 'numero');
  numero.type = 'number';
  numero.min = '0';
  numero.max = '359.9';
  numero.step = '0.1';
  filaLibre.append(el('span', '', 'Giro'), deslizador, numero, el('span', '', '°'));

  const btnBorrar = el('button', 'peligro', 'Borrar (Supr)');

  conSeleccion.append(nombreSel, posicionSel, el('h3', '', 'Rotación'), filaBotones, filaLibre, btnBorrar);
  secSeleccion.append(sinSeleccion, conSeleccion);
  panel.append(secSeleccion);

  btnIzq.addEventListener('click', () => gestor.seleccionado && gestor.girar(gestor.seleccionado, 15));
  btnDer.addEventListener('click', () => gestor.seleccionado && gestor.girar(gestor.seleccionado, -15));
  deslizador.addEventListener('input', () => gestor.seleccionado && gestor.rotar(gestor.seleccionado, Number(deslizador.value)));
  numero.addEventListener('change', () => {
    const valor = Number(numero.value);
    if (gestor.seleccionado && Number.isFinite(valor)) gestor.rotar(gestor.seleccionado, valor);
  });
  btnBorrar.addEventListener('click', () => gestor.seleccionado && gestor.borrar(gestor.seleccionado));

  /** Refresca la sección con los datos del objeto seleccionado. */
  function actualizarSeleccion() {
    const sel = gestor.seleccionado;
    sinSeleccion.hidden = !!sel;
    conSeleccion.hidden = !sel;
    if (!sel) return;
    nombreSel.textContent = sel.item.nombre;
    const p = sel.raiz.position;
    posicionSel.textContent = `Posición: x ${m(p.x)} m · z ${m(p.z)} m`;
    const grados = Math.round(sel.rotacion * 10) / 10;
    // No pisamos el campo mientras el usuario lo está editando.
    if (document.activeElement !== numero) numero.value = String(grados);
    deslizador.value = String(Math.round(grados));
  }
  gestor.alSeleccionar(actualizarSeleccion);
  actualizarSeleccion();

  // --- Guardar / cargar ---------------------------------------------------------
  const secEscena = el('section');
  secEscena.append(el('h2', '', 'Escena'));
  const filaArchivo = el('div', 'fila');
  const btnGuardar = el('button', '', 'Guardar…');
  const btnCargar = el('button', '', 'Cargar…');
  const btnVaciar = el('button', '', 'Vaciar');
  btnGuardar.title = 'Descarga la escena como archivo .json';
  btnCargar.title = 'Abre un archivo .json guardado antes';
  btnVaciar.title = 'Quita todos los objetos de la habitación';
  const selectorArchivo = el('input');
  selectorArchivo.type = 'file';
  selectorArchivo.accept = '.json,application/json';
  selectorArchivo.hidden = true;
  filaArchivo.append(btnGuardar, btnCargar, btnVaciar, selectorArchivo);
  secEscena.append(filaArchivo, el('p', 'nota', 'Los cambios se guardan solos en este navegador.'));
  panel.append(secEscena);

  btnGuardar.addEventListener('click', () => acciones.guardar());
  btnCargar.addEventListener('click', () => selectorArchivo.click());
  selectorArchivo.addEventListener('change', () => {
    const archivo = selectorArchivo.files?.[0];
    if (archivo) acciones.cargar(archivo);
    selectorArchivo.value = ''; // permite volver a cargar el mismo archivo
  });
  btnVaciar.addEventListener('click', () => {
    if (gestor.objetos.length === 0 || confirm('¿Quitar todos los objetos de la habitación?')) acciones.vaciar();
  });

  // --- Ayuda ------------------------------------------------------------------------
  const ayuda = el('section', 'ayuda');
  ayuda.innerHTML = `
    <h2>Controles</h2>
    <ul>
      <li><b>Cámara:</b> arrastrar = girar · rueda = zoom · botón derecho = desplazar</li>
      <li><b>Objeto:</b> clic = seleccionar · arrastrar = mover</li>
      <li><kbd>Q</kbd> / <kbd>E</kbd> girar 15° · con <kbd>Mayús</kbd> 1°</li>
      <li><kbd>Supr</kbd> borrar · <kbd>Esc</kbd> deseleccionar</li>
    </ul>`;
  panel.append(ayuda);
}
