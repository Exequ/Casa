// Punto de entrada: monta la vivienda, el catálogo, la interfaz y el guardado.

import './ui/estilos.css';
import datosVivienda from '../data/vivienda.json';
import { leerCatalogo, type ItemCatalogo } from './catalogo/catalogo';
import { CortadorParedes, type ModoCorte } from './escena/corte';
import { crearEscena, type Caja2D } from './escena/escena';
import { crearEtiquetas } from './escena/etiquetas';
import { activarInteraccion } from './escena/interaccion';
import { GestorObjetos } from './escena/objetos';
import { aplicar, autoguardar, descargarArchivo, leerArchivo, leerAutoguardado } from './escena/persistencia';
import { crearCapaPlano } from './escena/plano';
import { construirVivienda, resaltarMuros } from './escena/vivienda3d';
import { crearBarra } from './ui/barra';
import { crearPanel } from './ui/panel';
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

// 2. Objetos colocados + interacción con ratón, dedo y teclado
const gestor = new GestorObjetos(escena.escena, espacio);
activarInteraccion(escena, gestor);

// 3. Autoguardado: cada cambio se guarda en el navegador (agrupando cambios seguidos).
let temporizador: number | undefined;
gestor.alCambiar(() => {
  clearTimeout(temporizador);
  temporizador = window.setTimeout(() => autoguardar(gestor, vivienda.nombre), 300);
});

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

/** Dónde poner un objeto nuevo: en la estancia elegida o en la que mira la cámara. */
function puntoParaNuevo(): { x: number; z: number } {
  const t = escena.controles.target;
  const id = barra.estancia() ?? espacio.estanciaEn(t.x, t.z);
  const e = estanciaPorId(id);
  if (e) {
    const [x, z] = puntoInterior(e.poligono);
    return { x, z };
  }
  return centroV1;
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
    gestor.seleccionar(obj);
    gestor.notificar();
  },
  guardar: () => descargarArchivo(gestor, vivienda.nombre),
  async cargar(archivo) {
    try {
      await aplicar(gestor, await leerArchivo(archivo), catalogo, centroV1);
    } catch (e) {
      alert(`No se pudo cargar el archivo: ${(e as Error).message}`);
    }
  },
  vaciar: () => gestor.vaciar(),
  verPlano,
  opacidadPlano(valor) {
    if (capaPlano) (capaPlano.material as { opacity: number }).opacity = valor;
  },
});

const barra = crearBarra(visor, vivienda, gestor, {
  enfocar: (id, planta) => {
    if (cortador.modo !== 'huella') cortador.modo = id ? 'estancia' : 'casa';
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
if (guardada) aplicar(gestor, guardada, catalogo, centroV1).catch((e) => console.warn('Autoguardado no válido', e));

// Acceso desde la consola del navegador, útil para depurar y para las pruebas automáticas.
Object.assign(window, { casa: { escena, vivienda, espacio, gestor, catalogo, cortador, capaPlano, verPlano } });
