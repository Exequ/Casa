// Panel lateral: catálogo, objeto seleccionado, guardar/cargar, comprobación
// con el plano y ayuda. En el móvil es un cajón que se abre con el botón ☰.
// Es HTML normal construido a mano; los estilos están en src/ui/estilos.css.

import type { ItemCatalogo } from '../catalogo/catalogo';
import type { GestorObjetos } from '../escena/objetos';
import type { Vivienda } from '../vivienda/modelo';
import { area } from '../vivienda/geometria';
import { el, m } from './util';

export interface AccionesPanel {
  agregar(item: ItemCatalogo): void;
  guardar(): void;
  cargar(archivo: File): void;
  vaciar(): void;
  /** Muestra u oculta el plano superpuesto. */
  verPlano(visible: boolean): void;
  opacidadPlano(valor: number): void;
}

export interface Panel {
  /** Abre o cierra el cajón (solo tiene efecto visible en pantallas estrechas). */
  abrir(abierto: boolean): void;
  /** Sección vacía donde va el selector de suelo. */
  seccionSuelo: HTMLElement;
  /** Sincroniza la casilla del plano si se activa desde otro sitio. */
  marcarPlano(visible: boolean): void;
  /** Muestra un mensaje arriba del panel (error = en rojo). En el móvil abre el cajón. */
  avisar(texto: string, error?: boolean): void;
}

export function crearPanel(
  panel: HTMLElement,
  catalogo: ItemCatalogo[],
  vivienda: Vivienda,
  gestor: GestorObjetos,
  acciones: AccionesPanel,
): Panel {
  panel.innerHTML = '';
  const abrir = (abierto: boolean) => document.body.classList.toggle('panel-abierto', abierto);

  // --- Cabecera ---------------------------------------------------------------
  const cabecera = el('div', 'cabecera');
  const btnCerrar = el('button', 'solo-movil cerrar', '✕');
  btnCerrar.title = 'Cerrar el menú';
  btnCerrar.addEventListener('click', () => abrir(false));
  cabecera.append(el('h1', '', 'Casa 3D'), btnCerrar);
  panel.append(cabecera);
  const interiores = vivienda.estancias.filter((e) => !e.exterior);
  const util = interiores.reduce((s, e) => s + area(e.poligono), 0);
  panel.append(el('p', 'nota', `${vivienda.nombre}: ${interiores.length} estancias, ${m(util)} m² útiles`));
  // Mensajes para el usuario (escena cargada, falta de sitio…), arriba del todo para que se vean.
  const mensaje = el('p', 'nota mensaje');
  mensaje.hidden = true;
  mensaje.setAttribute('role', 'status');
  panel.append(mensaje);

  // --- Catálogo (agrupado por categoría) ----------------------------------------
  const secCatalogo = el('section');
  secCatalogo.append(el('h2', '', 'Catálogo'));
  secCatalogo.append(el('p', 'nota', 'Toca un objeto para ponerlo en el sitio libre más cercano al centro de la estancia elegida arriba (o del salón).'));
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
    boton.title = 'Añadir a la vivienda';
    boton.append(
      el('span', 'item-nombre', item.nombre),
      el('span', 'item-medidas', `${m(item.dimensiones.ancho)} × ${m(item.dimensiones.fondo)} × ${m(item.dimensiones.alto)} m`),
    );
    boton.addEventListener('click', () => {
      acciones.agregar(item);
      abrir(false); // en el móvil, cerramos el cajón para ver el objeto
    });
    secCatalogo.append(boton);
  }
  panel.append(secCatalogo);

  // --- Suelo (lo rellena src/ui/selectorSuelo.ts) ----------------------------------
  const seccionSuelo = el('section', 'seccion-suelo');
  panel.append(seccionSuelo);

  // --- Objeto seleccionado ------------------------------------------------------
  const secSeleccion = el('section', 'seleccion');
  secSeleccion.append(el('h2', '', 'Objeto seleccionado'));
  const sinSeleccion = el('p', 'nota', 'Haz clic en un objeto para seleccionarlo.');
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
  btnVaciar.title = 'Quita todos los objetos';
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
  // Vaciar pide confirmación en el propio botón: un segundo toque en 4 s lo confirma.
  let confirmarHasta = 0;
  btnVaciar.addEventListener('click', () => {
    if (gestor.objetos.length > 0 && Date.now() > confirmarHasta) {
      confirmarHasta = Date.now() + 4000;
      btnVaciar.textContent = '¿Seguro? Toca otra vez';
      btnVaciar.classList.add('peligro');
      setTimeout(() => {
        btnVaciar.textContent = 'Vaciar';
        btnVaciar.classList.remove('peligro');
      }, 4000);
      return;
    }
    confirmarHasta = 0;
    btnVaciar.textContent = 'Vaciar';
    btnVaciar.classList.remove('peligro');
    acciones.vaciar();
  });

  // --- Comprobación con el plano ----------------------------------------------------
  const secPlano = el('section');
  secPlano.append(el('h2', '', 'Comprobar con el plano'));
  const filaPlano = el('label', 'fila');
  const casillaPlano = el('input');
  casillaPlano.type = 'checkbox';
  filaPlano.append(casillaPlano, el('span', '', 'Superponer el plano original'));
  const filaOpacidad = el('label', 'fila');
  const opacidad = el('input');
  opacidad.type = 'range';
  opacidad.min = '0.1';
  opacidad.max = '1';
  opacidad.step = '0.05';
  opacidad.value = '0.6';
  filaOpacidad.append(el('span', '', 'Opacidad'), opacidad);
  secPlano.append(filaPlano, filaOpacidad,
    el('p', 'nota', 'Las paredes se quedan a ras de suelo para comparar su huella con el dibujo.'));
  if (!vivienda.plano) secPlano.hidden = true;
  panel.append(secPlano);
  casillaPlano.addEventListener('change', () => acciones.verPlano(casillaPlano.checked));
  opacidad.addEventListener('input', () => acciones.opacidadPlano(Number(opacidad.value)));

  // --- Suposiciones ------------------------------------------------------------------
  if (vivienda.suposiciones?.length) {
    const secSup = el('section');
    const detalles = el('details');
    detalles.append(el('summary', '', `Suposiciones al leer el plano (${vivienda.suposiciones.length})`));
    const lista = el('ul', 'suposiciones');
    for (const s of vivienda.suposiciones) lista.append(el('li', '', s));
    detalles.append(lista);
    secSup.append(detalles);
    panel.append(secSup);
  }

  // --- Ayuda ------------------------------------------------------------------------
  const ayuda = el('section', 'ayuda');
  ayuda.innerHTML = `
    <h2>Controles</h2>
    <ul class="solo-escritorio">
      <li><b>Cámara:</b> arrastrar = girar · rueda = zoom · botón derecho = desplazar</li>
      <li><b>Objeto:</b> clic = seleccionar · arrastrar = mover</li>
      <li><kbd>Q</kbd> / <kbd>E</kbd> girar 15° · con <kbd>Mayús</kbd> 1°</li>
      <li><kbd>Supr</kbd> borrar · <kbd>Esc</kbd> deseleccionar</li>
    </ul>
    <ul class="solo-movil">
      <li><b>Cámara:</b> un dedo = girar · dos dedos = zoom y desplazar</li>
      <li><b>Objeto:</b> tócalo para seleccionarlo y arrástralo para moverlo</li>
      <li>Girar y borrar: botones de la barra inferior</li>
    </ul>`;
  panel.append(ayuda);

  return {
    abrir,
    seccionSuelo,
    marcarPlano: (visible) => { casillaPlano.checked = visible; },
    avisar(texto, error = false) {
      mensaje.textContent = texto;
      mensaje.classList.toggle('error', error);
      mensaje.hidden = false;
      mensaje.scrollIntoView({ block: 'nearest' });
      abrir(true); // en el móvil, para que se vea el mensaje
    },
  };
}
