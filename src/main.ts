// Punto de entrada: monta la vivienda, el catálogo, la interfaz y el guardado.

import './ui/estilos.css';
import datosVivienda from '../data/vivienda.json';
import { leerCatalogo, type ItemCatalogo } from './catalogo/catalogo';
import { CortadorParedes, type ModoCorte } from './escena/corte';
import { crearEscena, type Caja2D } from './escena/escena';
import { crearEtiquetas } from './escena/etiquetas';
import { activarInteraccion } from './escena/interaccion';
import { GestorObjetos } from './escena/objetos';
import { aplicar, autoguardar, descargarArchivo, leerArchivo, leerAutoguardado, type EstadoEscena, type ResultadoCarga } from './escena/persistencia';
import { crearCapaPlano } from './escena/plano';
import { construirVivienda, resaltarMuros } from './escena/vivienda3d';
import { crearBarra } from './ui/barra';
import { crearPanel } from './ui/panel';
import { crearSelectorSuelo } from './ui/selectorSuelo';
import { GestorSuelos } from './escena/suelos3d';
import { EspacioLibre } from './vivienda/espacio';
import { caja, puntoInterior } from './vivienda/geometria';
import { validarVivienda, type Vivienda } from './vivienda/modelo';

const vivienda = datosVivienda as Vivienda;
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
const casa = construirVivienda(vivienda);
escena.escena.add(casa.grupo);
escena.escena.add(crearEtiquetas(vivienda));
const capaPlano = vivienda.plano ? crearCapaPlano(vivienda.plano) : null;
if (capaPlano) escena.escena.add(capaPlano);

// Las paredes que tapan la vista se bajan solas en cada fotograma.
const cortador = new CortadorParedes(casa.verticales, (p) => espacio.dentro(p));
escena.cadaFotograma(() => cortador.actualizar(escena.camara, escena.controles.target));

// Suelos con textura (los de vivienda.json, o los que se elijan en el panel)
const suelos = new GestorSuelos(vivienda, casa.suelos, escena.tamanoTextura);

// 2. Objetos colocados + interacción con ratón, dedo y teclado
const gestor = new GestorObjetos(escena.escena, espacio);
activarInteraccion(escena, gestor);
const estado: EstadoEscena = { objetos: gestor, suelos, nombreVivienda: vivienda.nombre };

// 3. Autoguardado: cada cambio (muebles o suelos) se guarda en el navegador, agrupando cambios seguidos.
let temporizador: number | undefined;
const programarAutoguardado = () => {
  clearTimeout(temporizador);
  temporizador = window.setTimeout(() => autoguardar(estado), 300);
};
gestor.alCambiar(programarAutoguardado);
suelos.alCambiar(programarAutoguardado);

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
function puntoParaNuevo(): { x: number; z: number; estancia: string } {
  const e = estanciaPorId(barra.estancia()) ?? salon;
  const [x, z] = puntoInterior(e.poligono);
  return { x, z, estancia: e.nombre };
}

/** Explica lo que no se ha podido poner al cargar una escena. */
function textoCarga(r: ResultadoCarga): string {
  const partes = [`${gestor.objetos.length} objetos`];
  if (r.omitidos.length) partes.push(`no caben o no existen: ${r.omitidos.join(', ')}`);
  if (r.suelosIgnorados) partes.push(`${r.suelosIgnorados} suelos no válidos ignorados`);
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
  barra.marcarPlano(visible);
}

// 4. Interfaz
const panel = crearPanel(document.getElementById('panel')!, catalogo, vivienda, gestor, {
  async agregar(item: ItemCatalogo) {
    const p = puntoParaNuevo();
    const obj = await gestor.agregar(item, p.x, p.z, 0);
    if (!obj) {
      panel.avisar(`No hay sitio libre para "${item.nombre}" en ninguna estancia. Aparta o borra algún mueble.`, true);
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
      panel.avisar(`Escena "${archivo.name}" cargada: ${textoCarga(r)}.`, r.omitidos.length > 0);
    } catch (e) {
      panel.avisar(`No se pudo cargar "${archivo.name}": ${(e as Error).message}. Comprueba que es un archivo guardado con esta app.`, true);
    }
  },
  vaciar: () => gestor.vaciar(),
  verPlano,
  opacidadPlano(valor) {
    if (capaPlano) (capaPlano.material as { opacity: number }).opacity = valor;
  },
});

const selectorSuelo = crearSelectorSuelo(panel.seccionSuelo, vivienda, suelos);

const barra = crearBarra(visor, vivienda, gestor, {
  enfocar: (id, planta) => {
    if (cortador.modo !== 'huella') cortador.modo = id ? 'estancia' : 'casa';
    cortador.estancia = estanciaPorId(id)?.poligono ?? null;
    if (id) selectorSuelo.elegirEstancia(id);
    escena.encuadrar(cajaDe(id), planta, true, id === null);
  },
  verPlano,
  abrirMenu: () => panel.abrir(true),
});

// En el móvil, tocar fuera del cajón lo cierra.
document.getElementById('fondo-panel')!.addEventListener('click', () => panel.abrir(false));

// Vista inicial: toda la vivienda.
escena.encuadrar(total, false, false, true);

// 5. Recuperar la última escena autoguardada (si la hay)
const guardada = leerAutoguardado();
if (guardada) {
  aplicar(estado, guardada, catalogo, centroV1)
    .then((r) => { if (r.omitidos.length) panel.avisar(`Al recuperar la última escena: ${textoCarga(r)}.`, true); })
    .catch((e) => console.warn('Autoguardado no válido', e));
}

// Acceso desde la consola del navegador, útil para depurar y para las pruebas automáticas.
Object.assign(window, { casa: { escena, vivienda, espacio, gestor, suelos, catalogo, cortador, capaPlano, verPlano } });
