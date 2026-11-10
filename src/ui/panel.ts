// Panel lateral: catálogo, objeto seleccionado, guardar/cargar, comprobación
// con el plano y ayuda. En el móvil es un cajón que se abre con el botón ☰.
// Es HTML normal construido a mano; los estilos están en src/ui/estilos.css.

import type { ItemCatalogo } from '../catalogo/catalogo';
import type { GestorObjetos } from '../escena/objetos';
import type { Vivienda } from '../vivienda/modelo';
import { area } from '../vivienda/geometria';
import { el, m } from './util';

/** Texto en minúsculas y sin tildes, para buscar sin preocuparse de acentos. */
const sinAcentos = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export interface AccionesPanel {
  agregar(item: ItemCatalogo): void;
  guardar(): void;
  cargar(archivo: File): void;
  vaciar(): void;
  duplicar(): void;
  /** Muestra u oculta el plano superpuesto. */
  verPlano(visible: boolean): void;
  opacidadPlano(valor: number): void;
}

export interface Panel {
  /** Abre o cierra el cajón (solo tiene efecto visible en pantallas estrechas). */
  abrir(abierto: boolean): void;
  /** Sección vacía donde va el selector de acabados (suelo, paredes, luz). */
  seccionAcabados: HTMLElement;
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

  // --- Catálogo (categorías plegables y buscador) --------------------------------
  const secCatalogo = el('section', 'catalogo');
  secCatalogo.append(el('h2', '', 'Catálogo'));
  secCatalogo.append(el('p', 'nota', 'Toca un objeto para ponerlo en la estancia elegida arriba (o en el salón): los muebles en el suelo, los cuadros en una pared libre y los jarrones o plantas sobre un mueble libre.'));
  const buscador = el('input', 'buscador');
  buscador.type = 'search';
  buscador.placeholder = 'Buscar por nombre…';
  buscador.setAttribute('aria-label', 'Buscar en el catálogo');
  secCatalogo.append(buscador);
  const sinResultados = el('p', 'nota', 'Ningún objeto coincide con la búsqueda.');
  sinResultados.hidden = true;
  if (catalogo.length === 0) {
    secCatalogo.append(el('p', 'nota', 'No hay objetos. Añade archivos .json + .glb a la carpeta catalogo/.'));
  }
  const DONDE: Record<string, string> = { pared: ' · pared', superficie: ' · sobre mueble' };
  const categorias = new Map<string, { detalles: HTMLDetailsElement; items: { boton: HTMLButtonElement; texto: string }[] }>();
  for (const item of catalogo) {
    let cat = categorias.get(item.categoria);
    if (!cat) {
      const detalles = el('details', 'categoria');
      detalles.open = true;
      detalles.append(el('summary', '', item.categoria));
      secCatalogo.append(detalles);
      cat = { detalles, items: [] };
      categorias.set(item.categoria, cat);
    }
    const boton = el('button', 'item-catalogo');
    boton.title = 'Añadir a la vivienda';
    boton.dataset.catalogo = item.id;
    boton.append(
      el('span', 'item-nombre', item.nombre),
      el('span', 'item-medidas', `${m(item.dimensiones.ancho)} × ${m(item.dimensiones.fondo)} × ${m(item.dimensiones.alto)} m${DONDE[item.colocacion] ?? ''}`),
    );
    boton.addEventListener('click', () => {
      acciones.agregar(item);
      abrir(false); // en el móvil, cerramos el cajón para ver el objeto
    });
    cat.detalles.append(boton);
    cat.items.push({ boton, texto: sinAcentos(item.nombre) });
  }
  secCatalogo.append(sinResultados);
  panel.append(secCatalogo);
  // Mientras se busca, se abren las categorías con resultados y se ocultan las demás.
  const abiertas = new Map<HTMLDetailsElement, boolean>();
  buscador.addEventListener('input', () => {
    const q = sinAcentos(buscador.value.trim());
    let total = 0;
    for (const { detalles, items } of categorias.values()) {
      let n = 0;
      for (const { boton, texto } of items) {
        const ve = !q || texto.includes(q);
        boton.hidden = !ve;
        if (ve) n++;
      }
      total += n;
      if (q) {
        if (!abiertas.has(detalles)) abiertas.set(detalles, detalles.open);
        detalles.hidden = n === 0;
        detalles.open = true;
      } else {
        detalles.hidden = false;
        if (abiertas.has(detalles)) detalles.open = abiertas.get(detalles)!;
      }
    }
    if (!q) abiertas.clear();
    sinResultados.hidden = !q || total > 0;
  });

  // --- Acabados (lo rellena src/ui/selectorAcabados.ts) ------------------------------
  const seccionAcabados = el('section', 'seccion-acabados');
  panel.append(seccionAcabados);

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

  const bloqueGiro = el('div');
  bloqueGiro.append(el('h3', '', 'Rotación'), filaBotones, filaLibre);

  // Altura de los objetos de pared (centro del objeto sobre el suelo)
  const bloqueAltura = el('div');
  const filaAltura = el('label', 'fila');
  const deslizadorAltura = el('input');
  deslizadorAltura.type = 'range';
  deslizadorAltura.step = '0.01';
  deslizadorAltura.id = 'altura-pared';
  const numeroAltura = el('input', 'numero');
  numeroAltura.type = 'number';
  numeroAltura.step = '0.01';
  filaAltura.append(el('span', '', 'Centro a'), deslizadorAltura, numeroAltura, el('span', '', 'm'));
  bloqueAltura.append(el('h3', '', 'Altura en la pared'), filaAltura,
    el('p', 'nota', 'Arrástralo para moverlo por la pared o llevarlo a otra.'));

  const filaAcciones = el('div', 'fila');
  const btnDuplicar = el('button', '', 'Duplicar (D)');
  btnDuplicar.id = 'duplicar';
  const btnBorrar = el('button', 'peligro', 'Borrar (Supr)');
  filaAcciones.append(btnDuplicar, btnBorrar);

  conSeleccion.append(nombreSel, posicionSel, bloqueGiro, bloqueAltura, filaAcciones);
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
  btnDuplicar.addEventListener('click', () => acciones.duplicar());
  // Mientras se arrastra el deslizador no se guarda; al soltarlo, sí (un solo paso de deshacer).
  deslizadorAltura.addEventListener('input', () => gestor.seleccionado && gestor.ponerAltura(gestor.seleccionado, Number(deslizadorAltura.value), false));
  deslizadorAltura.addEventListener('change', () => gestor.seleccionado && gestor.ponerAltura(gestor.seleccionado, Number(deslizadorAltura.value)));
  numeroAltura.addEventListener('change', () => {
    const valor = Number(numeroAltura.value);
    if (gestor.seleccionado && Number.isFinite(valor)) gestor.ponerAltura(gestor.seleccionado, valor);
  });

  /** Refresca la sección con los datos del objeto seleccionado. */
  function actualizarSeleccion() {
    const sel = gestor.seleccionado;
    sinSeleccion.hidden = !!sel;
    conSeleccion.hidden = !sel;
    if (!sel) return;
    nombreSel.textContent = sel.item.nombre;
    const p = sel.raiz.position;
    const donde = sel.colocacion === 'pared' ? ' · en la pared'
      : sel.colocacion === 'superficie' && sel.apoyo ? ` · sobre ${sel.apoyo.soporte.item.nombre.toLowerCase()} (${m(sel.apoyo.nivel)} m)` : '';
    posicionSel.textContent = `Posición: x ${m(p.x)} m · z ${m(p.z)} m${donde}`;
    const enPared = sel.colocacion === 'pared' && !!sel.pared;
    bloqueGiro.hidden = enPared;
    bloqueAltura.hidden = !enPared;
    if (enPared) {
      const alto = sel.item.dimensiones.alto;
      deslizadorAltura.min = numeroAltura.min = String(Math.ceil((alto / 2) * 100) / 100);
      deslizadorAltura.max = numeroAltura.max = String(Math.floor((sel.pared!.cara.alto - alto / 2) * 100) / 100);
      deslizadorAltura.value = String(sel.pared!.y);
      if (document.activeElement !== numeroAltura) numeroAltura.value = String(sel.pared!.y);
    }
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
      <li><kbd>D</kbd> duplicar · <kbd>Supr</kbd> borrar · <kbd>Esc</kbd> deseleccionar</li>
      <li><kbd>Ctrl</kbd>+<kbd>Z</kbd> deshacer · <kbd>Ctrl</kbd>+<kbd>Mayús</kbd>+<kbd>Z</kbd> rehacer</li>
      <li>Cuadros y espejos: arrastrar a lo largo de la pared o a otra pared</li>
      <li>Jarrones y plantas: arrastrar encima de un mueble para apoyarlos</li>
    </ul>
    <ul class="solo-movil">
      <li><b>Cámara:</b> un dedo = girar · dos dedos = zoom y desplazar</li>
      <li><b>Objeto:</b> tócalo para seleccionarlo y arrástralo para moverlo</li>
      <li>Girar, subir o bajar (cuadros), duplicar y borrar: barra inferior</li>
      <li>Deshacer, rehacer e imagen: botones ↶ ↷ 📷 de abajo a la derecha</li>
    </ul>`;
  panel.append(ayuda);

  return {
    abrir,
    seccionAcabados,
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
