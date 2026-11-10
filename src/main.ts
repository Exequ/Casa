// Punto de entrada: monta la vivienda, el catálogo, la interfaz y el guardado.

import './ui/estilos.css';
import datosVivienda from '../data/vivienda.json';
import datosEscenaInicial from '../data/escena-inicial.json';
import { leerCatalogo, type ItemCatalogo } from './catalogo/catalogo';
import { CortadorParedes, type ModoCorte } from './escena/corte';
import { crearEscena, type Caja2D } from './escena/escena';
import { crearEtiquetas } from './escena/etiquetas';
import { activarInteraccion } from './escena/interaccion';
import { GestorObjetos } from './escena/objetos';
import {
  aplicar, autoguardar, colocarObjetos, migrar, type EscenaGuardada, descargarArchivo, leerArchivo, leerAutoguardado, serializar, VERSION_ESCENA,
  type EstadoEscena, type ResultadoCarga,
} from './escena/persistencia';
import { Historial } from './escena/historial';
import { carasColgables, type CaraColgable } from './vivienda/colgar';
import { crearCapaPlano } from './escena/plano';
import * as THREE from 'three';
import { construirVivienda, resaltarMuros } from './escena/vivienda3d';
import { GestorLuces } from './escena/luces';
import { GestorParedes } from './escena/paredes3d';
import { crearBarra, type Interruptor } from './ui/barra';
import { crearPanel } from './ui/panel';
import { crearSelectorAcabados } from './ui/selectorAcabados';
import { GestorSuelos } from './escena/suelos3d';
import { EspacioLibre } from './vivienda/espacio';
import { caja, puntoEnPoligono, puntoInterior } from './vivienda/geometria';
import { puntoDeVista } from './vivienda/vista';
import { alturaEstancia, validarVivienda, type Vivienda } from './vivienda/modelo';

const vivienda = datosVivienda as Vivienda;
/** La casa amueblada como en las fotos (fase 5, lote 3). */
const escenaInicial = datosEscenaInicial as unknown as EscenaGuardada;
const catalogo = leerCatalogo();
const visor = document.getElementById('visor')!;

// 0. Si vivienda.json tiene errores, los mostramos en pantalla (y seguimos si se puede).
const errores = validarVivienda(vivienda);
if (errores.length) {
  console.error('Errores en data/vivienda.json:', errores);
  const aviso = document.createElement('pre');
  aviso.className = 'aviso-error';
  aviso.textContent = `Errores en data/vivienda.json:\n- ${errores.join('\n- ')}`;
  visor.append(aviso);
}

// 1. Escena 3D y vivienda
const espacio = new EspacioLibre(vivienda);
const total: Caja2D = espacio.cajaTotal();
const escena = crearEscena(visor, total);
const casa = construirVivienda(vivienda, escena.tamanoTextura, escena.calidad === 'ligera');
escena.escena.add(casa.grupo);
const etiquetas = crearEtiquetas(vivienda);
escena.escena.add(etiquetas);
const capaPlano = vivienda.plano ? crearCapaPlano(vivienda.plano) : null;
if (capaPlano) escena.escena.add(capaPlano);

// Suelos con textura y color de las paredes (los de vivienda.json, o los que se elijan en el panel)
const suelos = new GestorSuelos(vivienda, casa.suelos, escena.tamanoTextura, casa.acabados.umbrales);
const paredes = new GestorParedes(vivienda, casa.acabados.pintura);

// Luces: sol, entorno y focos de cada estancia
const centroCasa: [number, number] = [(total.minX + total.maxX) / 2, (total.minZ + total.maxZ) / 2];
const luces = new GestorLuces(escena, vivienda, casa.techos, centroCasa);

// Las paredes que tapan la vista se bajan solas en cada fotograma. Si la cámara
// está dentro de la vivienda (vista interior), no se baja ninguna, se ven los
// techos y la luz entra por las ventanas.
const alturaMaxima = Math.max(...vivienda.estancias.map((e) => alturaEstancia(e, vivienda)));
const cercaDeCasa = (p: [number, number]) =>
  [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]].some(([dx, dz]) => espacio.dentro([p[0] + dx, p[1] + dz]));
const cortador = new CortadorParedes(casa.verticales, (p) => espacio.dentro(p), cercaDeCasa, alturaMaxima);
escena.cadaFotograma(() => {
  cortador.actualizar(escena.camara, escena.controles.target);
  const c = escena.camara.position;
  luces.modoInterior(cortador.interior, cortador.interior ? espacio.estanciaEn(c.x, c.z) : null);
  etiquetas.visible = !cortador.interior;
});

// 2. Objetos colocados + interacción con ratón, dedo y teclado
const gestor = new GestorObjetos(escena.escena, espacio, carasColgables(vivienda), vivienda.fijos ?? []);
/** ¿Se ve la cara de pared? (no, si su muro está bajado por el corte) */
const verticalPorNombre = new Map(casa.verticales.map((v) => [v.objeto.name, v]));
const caraVisible = (c: CaraColgable) => {
  const v = verticalPorNombre.get(c.elemento);
  return !v || (v.acabados.visible && v.nucleo.scale.y > 0.9);
};
/** ¿Se ve la cara de frente desde la cámara? (para colgar los objetos nuevos donde se vean) */
const caraDeFrente = (c: CaraColgable) => {
  const cam = escena.camara.position;
  const px = c.a[0] + c.n[0] * c.adelanto, pz = c.a[1] + c.n[1] * c.adelanto;
  return caraVisible(c) && (cam.x - px) * c.n[0] + (cam.z - pz) * c.n[1] > 0.2;
};
activarInteraccion(escena, gestor, { espacio, caraVisible, deshacer, rehacer, duplicar });
// Los cuadros y espejos de un muro bajado se ocultan (si no, flotarían en el aire)
escena.cadaFotograma(() => {
  for (const o of gestor.objetos) if (o.colocacion === 'pared' && o.pared) o.raiz.visible = caraVisible(o.pared.cara);
});
const estado: EstadoEscena = {
  objetos: gestor, suelos, paredes, nombreVivienda: vivienda.nombre,
  ajustes: {
    leer: () => ({ luces: luces.estado(), puertasAbiertas: barra.activo('puertas'), cortinas: barra.activo('cortinas') }),
    aplicar(a) {
      luces.restaurar(a?.luces);
      barra.marcar('luces', luces.generalEncendido());
      ponerPuertas(a?.puertasAbiertas ?? false);
      ponerCortinas(a?.cortinas ?? true);
    },
  },
};

// 3. Autoguardado: cada cambio (muebles o suelos) se guarda en el navegador, agrupando cambios seguidos.
let temporizador: number | undefined;
const programarAutoguardado = () => {
  clearTimeout(temporizador);
  temporizador = window.setTimeout(() => autoguardar(estado), 300);
};
gestor.alCambiar(programarAutoguardado);
suelos.alCambiar(programarAutoguardado);
paredes.alCambiar(programarAutoguardado);
luces.alCambiar(programarAutoguardado);

// 3b. Deshacer y rehacer: una "foto" de muebles, suelos y colores tras cada cambio.
const fotoEscena = () => {
  const g = serializar(estado);
  return JSON.stringify({ objetos: g.objetos, suelos: g.suelos, paredes: g.paredes });
};
const historial = new Historial(fotoEscena, async (foto) => {
  // Se intenta volver a seleccionar el mismo objeto (el del mismo tipo más cercano)
  const sel = gestor.seleccionado;
  const antes = sel ? { id: sel.item.id, p: sel.raiz.position.clone() } : null;
  await aplicar(estado, { version: VERSION_ESCENA, ...JSON.parse(foto) }, catalogo, centroV1, false);
  if (antes) {
    const mismo = gestor.objetos
      .filter((o) => o.item.id === antes.id)
      .sort((a, b) => a.raiz.position.distanceTo(antes.p) - b.raiz.position.distanceTo(antes.p))[0];
    gestor.seleccionar(mismo && mismo.raiz.position.distanceTo(antes.p) < 1 ? mismo : null);
  }
});
const anotarCambio = () => historial.cambio();
gestor.alCambiar(anotarCambio);
suelos.alCambiar(anotarCambio);
paredes.alCambiar(anotarCambio);

function deshacer() { void historial.deshacer(); }
function rehacer() { void historial.rehacer(); }

/** Duplica el objeto seleccionado y selecciona la copia. */
async function duplicar() {
  const sel = gestor.seleccionado;
  if (!sel) return;
  const copia = await gestor.duplicar(sel);
  if (!copia) {
    panel.avisar(`No hay sitio libre para duplicar "${sel.item.nombre}".`, true);
    return;
  }
  gestor.seleccionar(copia);
  gestor.notificar();
}

/** Descarga una imagen PNG de la vista actual, sin la interfaz (barras, etiquetas ni la caja de selección). */
function captura() {
  gestor.mostrarResaltado(false);
  escena.renderer.render(escena.escena, escena.camara);
  const url = escena.renderer.domElement.toDataURL('image/png');
  gestor.mostrarResaltado(true);
  const f = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `casa-${f.getFullYear()}${dos(f.getMonth() + 1)}${dos(f.getDate())}-${dos(f.getHours())}${dos(f.getMinutes())}${dos(f.getSeconds())}.png`;
  enlace.click();
}

// --- Puertas y cortinas -----------------------------------------------------------------
function ponerPuertas(abiertas: boolean) {
  for (const p of casa.puertas) p.pivote.rotation.y = abiertas ? p.abierta : 0;
  barra.marcar('puertas', abiertas);
}
function ponerCortinas(visibles: boolean) {
  for (const c of casa.cortinas) c.visible = visibles;
  barra.marcar('cortinas', visibles);
}

// --- Vista interior -------------------------------------------------------------------
/** Coloca la cámara dentro de una estancia, a la altura de los ojos, mirando a lo largo de ella. */
function entrarEn(id: string | null) {
  const e = estanciaPorId(id) ?? salon;
  const [cx, cz] = puntoInterior(e.poligono);
  // A lo largo de la diagonal más larga de la estancia, desde el lado de la puerta.
  const vista = puntoDeVista(e.poligono, puntoDePuerta(e.poligono));
  const desde: [number, number] = vista?.desde ?? [cx, cz];
  const hacia: [number, number] = vista?.hacia ?? [cx, cz + 1];
  const alto = alturaEstancia(e, vivienda);
  escena.limitesInterior(true);
  // Casi en horizontal. La cámara gira alrededor de un punto a media diagonal
  // (al menos a 1,8 m, aunque quede tras la pared, para no mirar al suelo).
  const ojo = Math.min(1.55, alto - 0.3);
  const [dx, dz] = [hacia[0] - desde[0], hacia[1] - desde[1]];
  const d = Math.hypot(dx, dz) || 1;
  const k = Math.max(1.8, d / 2) / d;
  escena.mirarDesdeDentro(new THREE.Vector3(desde[0] + dx * k, ojo - 0.3, desde[1] + dz * k), new THREE.Vector3(desde[0], ojo, desde[1]));
}

/** Un punto a 40 cm dentro de la estancia frente a una de sus puertas (o null si no tiene). */
function puntoDePuerta(poligono: [number, number][]): [number, number] | null {
  for (const p of vivienda.paredes) {
    const dx = p.hasta[0] - p.desde[0];
    const dz = p.hasta[1] - p.desde[1];
    const largo = Math.hypot(dx, dz) || 1;
    const [ux, uz] = [dx / largo, dz / largo];
    for (const h of p.huecos ?? []) {
      if (h.tipo !== 'puerta') continue;
      const t = h.distancia + h.ancho / 2;
      const [mx, mz] = [p.desde[0] + ux * t, p.desde[1] + uz * t];
      for (const lado of [1, -1]) {
        const d = p.grosor / 2 + 0.4;
        const q: [number, number] = [mx - uz * d * lado, mz + ux * d * lado];
        if (puntoEnPoligono(q, poligono, -1)) return q;
      }
    }
  }
  return null;
}

// --- Ayudas para estancias ---------------------------------------------------------
const estanciaPorId = (id: string | null) => vivienda.estancias.find((e) => e.id === id) ?? null;
const cajaDe = (id: string | null): Caja2D => {
  const e = estanciaPorId(id);
  return e ? caja(e.poligono) : total;
};
/** Las escenas de la fase 1 se colocan centradas en el salón (o en la primera estancia). */
const salon = estanciaPorId('salon') ?? vivienda.estancias[0];
const [cx1, cz1] = puntoInterior(salon.poligono);
const centroV1 = { x: cx1, z: cz1 };

/** Dónde poner un objeto nuevo: lo más cerca posible del centro de la estancia elegida (o del salón). */
function puntoParaNuevo(): { x: number; z: number; estancia: string; id: string } {
  const e = estanciaPorId(barra.estancia()) ?? salon;
  const [x, z] = puntoInterior(e.poligono);
  return { x, z, estancia: e.nombre, id: e.id };
}

/** Explica lo que no se ha podido poner al cargar una escena. */
function textoCarga(r: ResultadoCarga): string {
  const partes = [`${gestor.objetos.length} objetos`];
  if (r.omitidos.length) partes.push(`no caben o no existen: ${r.omitidos.join(', ')}`);
  if (r.suelosIgnorados) partes.push(`${r.suelosIgnorados} suelos no válidos ignorados`);
  if (r.paredesIgnoradas) partes.push(`${r.paredesIgnoradas} colores de pared no válidos ignorados`);
  return partes.join('; ');
}

/** Regla de corte de paredes según se mire una estancia o toda la vivienda. */
const modoCorte = (): ModoCorte => (barra.estancia() ? 'estancia' : 'casa');

function verPlano(visible: boolean) {
  if (!capaPlano) return;
  capaPlano.visible = visible;
  cortador.modo = visible ? 'huella' : modoCorte();
  resaltarMuros(visible);
  panel.marcarPlano(visible);
  barra.marcar('plano', visible);
  if (visible && barra.activo('interior')) salirDelInterior();
}

/** Vuelve a la vista desde fuera (la de la estancia elegida o toda la vivienda). */
function salirDelInterior() {
  barra.marcar('interior', false);
  escena.limitesInterior(false);
  escena.encuadrar(cajaDe(barra.estancia()), barra.activo('planta'), true, barra.estancia() === null);
}

/** Elegir una estancia en la barra superior: centra la cámara (o entra en ella en la vista interior). */
function elegirEstancia(id: string | null) {
  if (cortador.modo !== 'huella') cortador.modo = id ? 'estancia' : 'casa';
  cortador.estancia = estanciaPorId(id)?.poligono ?? null;
  if (id) selectorAcabados.elegirEstancia(id);
  if (barra.activo('interior')) entrarEn(id);
  else escena.encuadrar(cajaDe(id), barra.activo('planta'), true, id === null);
}

function pulsar(cual: Interruptor, activo: boolean) {
  switch (cual) {
    case 'planta':
      if (activo && barra.activo('interior')) { barra.marcar('interior', false); escena.limitesInterior(false); }
      escena.encuadrar(cajaDe(barra.estancia()), activo, true, barra.estancia() === null);
      break;
    case 'interior':
      if (activo) {
        barra.marcar('planta', false);
        if (barra.activo('plano')) verPlano(false);
        entrarEn(barra.estancia());
      } else salirDelInterior();
      break;
    case 'plano': verPlano(activo); break;
    case 'luces': luces.ponerGeneral(activo); break;
    case 'puertas': ponerPuertas(activo); programarAutoguardado(); break;
    case 'cortinas': ponerCortinas(activo); programarAutoguardado(); break;
  }
}

// 4. Interfaz
const panel = crearPanel(document.getElementById('panel')!, catalogo, vivienda, gestor, {
  async agregar(item: ItemCatalogo) {
    const p = puntoParaNuevo();
    const obj = await gestor.agregarSegunTipo(item, p.x, p.z, p.id, caraDeFrente);
    if (!obj) {
      panel.avisar(item.colocacion === 'pared'
        ? `No hay sitio libre para "${item.nombre}" en ninguna pared. Aparta o borra algún cuadro.`
        : `No hay sitio libre para "${item.nombre}" en ninguna estancia. Aparta o borra algún mueble.`, true);
      return;
    }
    gestor.seleccionar(obj);
    gestor.notificar();
  },
  async guardar() {
    const problema = await descargarArchivo(estado);
    if (problema) panel.avisar(problema, true);
  },
  async cargar(archivo) {
    try {
      const r = await aplicar(estado, await leerArchivo(archivo), catalogo, centroV1);
      historial.apuntar(); // cargar una escena también se puede deshacer
      panel.avisar(`Escena "${archivo.name}" cargada: ${textoCarga(r)}.`, r.omitidos.length > 0);
    } catch (e) {
      panel.avisar(`No se pudo cargar "${archivo.name}": ${(e as Error).message}. Comprueba que es un archivo guardado con esta app.`, true);
    }
  },
  vaciar: () => gestor.vaciar(),
  async restaurar() {
    // Solo los muebles: los suelos, colores y ajustes se quedan como estén. Se puede deshacer.
    gestor.vaciar();
    const omitidos = await colocarObjetos(gestor, migrar(structuredClone(escenaInicial), centroV1).objetos, catalogo);
    gestor.notificar();
    historial.apuntar();
    panel.avisar(omitidos.length
      ? `Disposición original restaurada, salvo: ${omitidos.join(', ')}.`
      : 'Disposición original restaurada. Puedes deshacerlo con ↶.', omitidos.length > 0);
  },
  duplicar,
  verPlano,
  opacidadPlano(valor) {
    if (capaPlano) (capaPlano.material as { opacity: number }).opacity = valor;
  },
});

const selectorAcabados = crearSelectorAcabados(panel.seccionAcabados, vivienda, suelos, paredes, luces);

const barra = crearBarra(visor, vivienda, gestor, {
  estancia: elegirEstancia,
  pulsar,
  abrirMenu: () => panel.abrir(true),
  deshacer,
  rehacer,
  captura,
  duplicar,
});
historial.alCambiar(() => barra.historial(historial.puedeDeshacer(), historial.puedeRehacer()));
barra.marcar('luces', true);
barra.marcar('cortinas', true);

// En el móvil, tocar fuera del cajón lo cierra.
document.getElementById('fondo-panel')!.addEventListener('click', () => panel.abrir(false));

// Vista inicial: toda la vivienda.
escena.encuadrar(total, false, false, true);

// 5. Recuperar la última escena autoguardada (si la hay)
// Si no hay nada autoguardado (primera visita o dispositivo nuevo), la casa
// viene amueblada como en las fotos (data/escena-inicial.json). Si hay
// autoguardado, se respeta, aunque esté vacío (después de "Vaciar").
const guardada = leerAutoguardado();
aplicar(estado, guardada ?? escenaInicial, catalogo, centroV1)
  .then((r) => { if (r.omitidos.length) panel.avisar(`Al ${guardada ? 'recuperar la última escena' : 'amueblar la casa'}: ${textoCarga(r)}.`, true); })
  .catch((e) => console.warn('Escena no válida', e))
  .finally(() => historial.iniciar());

// Acceso desde la consola del navegador, útil para depurar y para las pruebas automáticas.
Object.assign(window, {
  casa: { escena, vivienda, espacio, gestor, suelos, paredes, luces, catalogo, cortador, capaPlano, verPlano, vivienda3d: casa, barra, historial, captura, caraVisible },
});
