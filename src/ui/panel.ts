// Panel lateral: catálogo, objeto seleccionado, guardar/cargar, comprobación
// con el plano y ayuda. En el móvil es un cajón que se abre con el botón ☰.
// Es HTML normal construido a mano; los estilos están en src/ui/estilos.css.

import { esAlfombra, type ItemCatalogo } from '../catalogo/catalogo';
import type { GestorObjetos } from '../escena/objetos';
import type { Vivienda } from '../vivienda/modelo';
import { area } from '../vivienda/geometria';
import { rellenarSelectorCapas } from './panelCapas';
import { PlegadoCatalogo } from './plegado';
import { el, m, rellenarSelectorTamano } from './util';

/**
 * El botón pide un segundo toque para confirmar (antes de 4 s): el primero
 * cambia su texto a "¿Seguro? Toca otra vez". `hacePregunta` = ¿hace falta confirmar?
 */
export function confirmarEnElBoton(boton: HTMLButtonElement, hacePregunta: () => boolean, accion: () => void) {
  const texto = boton.textContent ?? '';
  let hasta = 0;
  let temporizador: number | undefined;
  const volver = () => {
    hasta = 0;
    boton.textContent = texto;
    boton.classList.remove('peligro');
  };
  boton.addEventListener('click', () => {
    clearTimeout(temporizador);
    if (hacePregunta() && Date.now() > hasta) {
      hasta = Date.now() + 4000;
      boton.textContent = '¿Seguro? Toca otra vez';
      boton.classList.add('peligro');
      temporizador = window.setTimeout(volver, 4000);
      return;
    }
    volver();
    accion();
  });
}

/** Texto en minúsculas y sin tildes, para buscar sin preocuparse de acentos. */
const sinAcentos = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export interface AccionesPanel {
  agregar(item: ItemCatalogo): void;
  guardar(): void;
  cargar(archivo: File): void;
  vaciar(): void;
  /** Vuelve a poner los muebles como en las fotos (data/escena-inicial.json). */
  restaurar(): void;
  duplicar(): void;
  /** Pasa el objeto seleccionado a otra capa. */
  moverACapa(capa: string): void;
  /** Cambia la medida (ancho × fondo, m) del objeto seleccionado (alfombras). */
  cambiarTamano(ancho: number, fondo: number): void;
  /** Muestra u oculta el plano superpuesto. */
  verPlano(visible: boolean): void;
  opacidadPlano(valor: number): void;
}

export interface Panel {
  /** Abre o cierra el cajón (solo tiene efecto visible en pantallas estrechas). */
  abrir(abierto: boolean): void;
  /** Sección vacía donde va el selector de acabados (suelo, paredes, luz). */
  seccionAcabados: HTMLElement;
  /** Sección vacía donde va la lista de capas (src/ui/panelCapas.ts). */
  seccionCapas: HTMLElement;
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
  // Miniaturas del catálogo: en el móvil el panel es un cajón cerrado, así que
  // no se descargan hasta que se abre por primera vez (no retrasan el arranque).
  const miniaturasPendientes: HTMLImageElement[] = [];
  const cargarMiniaturas = () => {
    for (const img of miniaturasPendientes.splice(0)) img.src = img.dataset.src!;
  };
  const pantallaMovil = window.matchMedia('(max-width: 760px)');
  const esMovil = pantallaMovil.matches;
  // Si la ventana se ensancha, el panel pasa a verse siempre: entonces se cargan.
  pantallaMovil.addEventListener?.('change', (e) => { if (!e.matches) cargarMiniaturas(); });
  const abrir = (abierto: boolean) => {
    if (abierto) cargarMiniaturas();
    document.body.classList.toggle('panel-abierto', abierto);
  };

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

  // --- Catálogo (cabecera plegable, categorías plegables y buscador) ------------------
  // El estado de plegado (y lo que hace el buscador) está en src/ui/plegado.ts.
  const secCatalogo = el('section', 'catalogo');
  const cabCatalogo = el('div', 'cabecera-catalogo');
  const btnCatalogo = el('button', 'titulo-catalogo');
  btnCatalogo.type = 'button';
  btnCatalogo.setAttribute('aria-controls', 'catalogo-contenido');
  const flecha = el('span', 'flecha', '▾');
  btnCatalogo.append(flecha, el('h2', '', 'Catálogo'));
  const btnDesplegar = el('button', 'desplegar-todo', 'Desplegar todo');
  btnDesplegar.type = 'button';
  btnDesplegar.title = 'Abrir todas las categorías';
  const btnPlegar = el('button', 'plegar-todo', 'Plegar todo');
  btnPlegar.type = 'button';
  btnPlegar.title = 'Cerrar todas las categorías';
  const botonesPlegado = el('div', 'botones-plegado');
  botonesPlegado.append(btnDesplegar, btnPlegar);
  cabCatalogo.append(btnCatalogo, botonesPlegado);
  secCatalogo.append(cabCatalogo);
  const contenido = el('div', 'catalogo-contenido');
  contenido.id = 'catalogo-contenido';
  secCatalogo.append(contenido);
  contenido.append(el('p', 'nota', 'Toca un objeto para ponerlo en la estancia elegida arriba (o en el salón) y en la capa activa: los muebles en el suelo, los cuadros en una pared libre y los jarrones o plantas sobre un mueble libre.'));
  const buscador = el('input', 'buscador');
  buscador.type = 'search';
  buscador.placeholder = 'Buscar por nombre…';
  buscador.setAttribute('aria-label', 'Buscar en el catálogo');
  contenido.append(buscador);
  const sinResultados = el('p', 'nota', 'Ningún objeto coincide con la búsqueda.');
  sinResultados.hidden = true;
  if (catalogo.length === 0) {
    contenido.append(el('p', 'nota', 'No hay objetos. Añade archivos .json + .glb a la carpeta catalogo/.'));
  }
  const DONDE: Record<string, string> = { pared: ' · pared', superficie: ' · sobre mueble' };
  const categorias = new Map<string, { detalles: HTMLDetailsElement; items: { boton: HTMLButtonElement; texto: string }[] }>();
  for (const item of catalogo) {
    let cat = categorias.get(item.categoria);
    if (!cat) {
      const detalles = el('details', 'categoria');
      detalles.dataset.categoria = item.categoria;
      detalles.append(el('summary', '', item.categoria));
      contenido.append(detalles);
      cat = { detalles, items: [] };
      categorias.set(item.categoria, cat);
    }
    const boton = el('button', 'item-catalogo');
    boton.title = 'Añadir a la vivienda';
    boton.dataset.catalogo = item.id;
    boton.dataset.edicion = ''; // en Modo cámara no se añade nada
    const textos = el('span', 'item-textos');
    textos.append(
      el('span', 'item-nombre', item.nombre),
      el('span', 'item-medidas', `${m(item.dimensiones.ancho)} × ${m(item.dimensiones.fondo)} × ${m(item.dimensiones.alto)} m${esAlfombra(item) ? ' · bajo los muebles' : DONDE[item.colocacion] ?? ''}${(item.medidasDisponibles?.length ?? 0) > 1 ? ` · ${item.medidasDisponibles!.length} medidas` : ''}`),
    );
    if (item.urlMiniatura) {
      const img = el('img', 'item-miniatura');
      img.dataset.src = item.urlMiniatura;
      if (esMovil) miniaturasPendientes.push(img);
      else img.src = item.urlMiniatura;
      img.alt = '';
      img.loading = 'lazy'; // solo se descarga al abrir su categoría
      img.width = img.height = 56;
      boton.append(img);
    }
    boton.append(textos);
    boton.addEventListener('click', () => {
      acciones.agregar(item);
      abrir(false); // en el móvil, cerramos el cajón para ver el objeto
    });
    cat.detalles.append(boton);
    cat.items.push({ boton, texto: sinAcentos(item.nombre) });
  }
  contenido.append(sinResultados);
  panel.append(secCatalogo);

  const plegado = new PlegadoCatalogo([...categorias.keys()]);
  /** Pone la vista como diga el estado de plegado. */
  const pintarPlegado = () => {
    const abierto = plegado.catalogoAbierto;
    contenido.hidden = !abierto;
    flecha.textContent = abierto ? '▾' : '▸';
    btnCatalogo.setAttribute('aria-expanded', String(abierto));
    btnCatalogo.title = abierto ? 'Plegar todo el catálogo' : 'Desplegar el catálogo';
    for (const [nombre, { detalles }] of categorias) {
      const v = plegado.vista(nombre);
      detalles.hidden = !v.visible;
      if (detalles.open !== v.abierta) detalles.open = v.abierta;
    }
  };
  // Abrir o cerrar una categoría a mano (el evento llega después del cambio; si
  // coincide con el estado, lo ha hecho pintarPlegado y no hay que apuntarlo).
  for (const [nombre, { detalles }] of categorias) {
    detalles.addEventListener('toggle', () => {
      if (detalles.hidden || detalles.open === plegado.vista(nombre).abierta) return;
      plegado.ponerCategoria(nombre, detalles.open);
    });
  }
  btnCatalogo.addEventListener('click', () => { plegado.alternarCatalogo(); pintarPlegado(); });
  btnDesplegar.addEventListener('click', () => { plegado.desplegarTodo(); pintarPlegado(); });
  btnPlegar.addEventListener('click', () => { plegado.plegarTodo(); pintarPlegado(); });
  // Mientras se busca, se abren las categorías con resultados y se ocultan las
  // demás; al borrar la búsqueda vuelve el plegado de antes.
  buscador.addEventListener('input', () => {
    const q = sinAcentos(buscador.value.trim());
    let total = 0;
    const conResultados: string[] = [];
    for (const [nombre, { items }] of categorias) {
      let n = 0;
      for (const { boton, texto } of items) {
        const ve = !q || texto.includes(q);
        boton.hidden = !ve;
        if (ve) n++;
      }
      total += n;
      if (n) conResultados.push(nombre);
    }
    plegado.buscar(q ? conResultados : null);
    pintarPlegado();
    sinResultados.hidden = !q || total > 0;
  });
  pintarPlegado();

  // --- Capas (lo rellena src/ui/panelCapas.ts) ----------------------------------------
  const seccionCapas = el('section', 'seccion-capas');
  panel.append(seccionCapas);

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
  // Por qué no se ha podido apoyar al arrastrarlo sobre un mueble (o por qué su apoyo no vale)
  const avisoApoyo = el('p', 'nota mensaje error aviso-apoyo');
  avisoApoyo.setAttribute('role', 'status');

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
  for (const b of [btnIzq, btnDer, btnDuplicar, btnBorrar]) b.dataset.edicion = '';

  const filaCapa = el('label', 'fila');
  const selectorCapa = el('select', 'selector-capa');
  selectorCapa.title = 'Pasar el objeto a otra capa (visible y desbloqueada)';
  selectorCapa.dataset.edicion = '';
  filaCapa.append(el('span', '', 'Capa'), selectorCapa);
  selectorCapa.addEventListener('change', () => acciones.moverACapa(selectorCapa.value));

  // Medida (objetos con varias, como las alfombras)
  const filaTamano = el('label', 'fila');
  const selectorTamano = el('select', 'selector-tamano');
  selectorTamano.title = 'Medida del objeto (ancho × fondo)';
  selectorTamano.dataset.edicion = '';
  filaTamano.append(el('span', '', 'Medida'), selectorTamano);
  selectorTamano.addEventListener('change', () => {
    const [ancho, fondo] = selectorTamano.value.split('x').map(Number);
    acciones.cambiarTamano(ancho, fondo);
  });

  conSeleccion.append(nombreSel, posicionSel, avisoApoyo, filaCapa, filaTamano, bloqueGiro, bloqueAltura, filaAcciones);
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
      : sel.colocacion === 'superficie' && sel.apoyo ? ` · sobre ${sel.apoyo.soporte.item.nombre.toLowerCase()} (${m(sel.apoyo.nivel)} m)`
      : esAlfombra(sel.item) ? ' · bajo los muebles' : '';
    posicionSel.textContent = `Posición: x ${m(p.x)} m · z ${m(p.z)} m${donde}`;
    const aviso = gestor.avisoApoyo?.objeto === sel ? gestor.avisoApoyo.texto
      : !gestor.apoyoValido(sel) ? 'No cabe en esta balda (es demasiado grande o demasiado alto para ella): está marcado en rojo. Arrástralo a otra superficie o al suelo.' : '';
    avisoApoyo.hidden = !aviso;
    avisoApoyo.textContent = aviso;
    rellenarSelectorCapas(selectorCapa, gestor, sel.capa);
    selectorCapa.value = sel.capa;
    filaTamano.hidden = !rellenarSelectorTamano(selectorTamano, sel.item);
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
  btnVaciar.title = 'Quita los objetos de las capas visibles y desbloqueadas';
  const selectorArchivo = el('input');
  selectorArchivo.type = 'file';
  selectorArchivo.accept = '.json,application/json';
  selectorArchivo.hidden = true;
  filaArchivo.append(btnGuardar, btnCargar, btnVaciar, selectorArchivo);
  btnCargar.dataset.edicion = btnVaciar.dataset.edicion = '';
  const btnRestaurar = el('button', '', 'Restaurar disposición original');
  btnRestaurar.id = 'restaurar';
  btnRestaurar.dataset.edicion = '';
  btnRestaurar.title = 'Vuelve a poner la capa Base como en las fotos del piso, sin tocar las demás capas (se puede deshacer con ↶)';
  secEscena.append(filaArchivo, btnRestaurar,
    el('p', 'nota', 'Los cambios se guardan solos en este navegador. "Vaciar" quita los objetos de las capas visibles y desbloqueadas. "Restaurar" vuelve a colocar la capa Base como en las fotos, sin tocar las demás capas ni los suelos y colores.'));
  panel.append(secEscena);

  btnGuardar.addEventListener('click', () => acciones.guardar());
  btnCargar.addEventListener('click', () => selectorArchivo.click());
  selectorArchivo.addEventListener('change', () => {
    const archivo = selectorArchivo.files?.[0];
    if (archivo) acciones.cargar(archivo);
    selectorArchivo.value = ''; // permite volver a cargar el mismo archivo
  });
  // Vaciar y Restaurar piden confirmación en el propio botón: un segundo toque en 4 s lo confirma.
  confirmarEnElBoton(btnVaciar, () => gestor.objetos.some((o) => gestor.editable(o)), () => acciones.vaciar());
  confirmarEnElBoton(btnRestaurar, () => true, () => acciones.restaurar());

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
      <li>🔒 <b>Modo cámara</b> (abajo a la derecha): solo se mueve la cámara, sin tocar los objetos</li>
      <li><b>Capas:</b> los objetos nuevos van a la capa activa; las capas bloqueadas no se mueven</li>
      <li>Cuadros y espejos: arrastrar a lo largo de la pared o a otra pared</li>
      <li>Jarrones y plantas: arrastrar encima de un mueble para apoyarlos</li>
    </ul>
    <ul class="solo-movil">
      <li><b>Cámara:</b> un dedo = girar · dos dedos = zoom y desplazar</li>
      <li><b>Objeto:</b> tócalo para seleccionarlo y arrástralo para moverlo</li>
      <li>Girar, subir o bajar (cuadros), duplicar y borrar: barra inferior</li>
      <li>Deshacer, rehacer e imagen: botones ↶ ↷ 📷 de abajo a la derecha</li>
      <li>🔒 <b>Modo cámara:</b> los toques solo mueven la cámara, sin tocar los objetos</li>
      <li><b>Capas</b> (en este menú): la capa activa se ve abajo a la izquierda; tócala para ir a las capas</li>
    </ul>`;
  panel.append(ayuda);

  return {
    abrir,
    seccionAcabados,
    seccionCapas,
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

