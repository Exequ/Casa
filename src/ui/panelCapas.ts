// Sección "Capas" del panel (en el móvil, menú ☰): lista ordenada de capas
// con su color, nombre, número de objetos, ojo (mostrar u ocultar) y candado
// (bloquear), la capa activa marcada, y botones para crear, duplicar,
// renombrar, reordenar y borrar la capa activa. Avisa de los solapes y de lo
// que se ha quedado apoyado en muebles de capas ocultas.
//
// En Modo cámara solo funcionan el ojo y elegir la capa activa: los demás
// botones llevan data-edicion (ver main.ts).

import type { GestorObjetos } from '../escena/objetos';
import { ID_BASE, LARGO_NOMBRE } from '../escena/capas';
import { confirmarEnElBoton } from './panel';
import { el } from './util';

/** Clave del navegador donde se recuerda si la sección está plegada. */
const CLAVE_PLEGADO = 'casa3d:seccionCapas';

export interface PanelCapas {
  /** Despliega la sección y la trae a la vista. */
  mostrar(): void;
  /** Vuelve a dibujar la lista si algo ha cambiado. */
  actualizar(): void;
}

/** Rellena un desplegable con las capas (las ocultas o bloqueadas, desactivadas salvo la actual). */
export function rellenarSelectorCapas(selector: HTMLSelectElement, gestor: GestorObjetos, actual: string) {
  const firma = JSON.stringify([actual, gestor.capas.capas]);
  if (selector.dataset.firma === firma) return;
  selector.dataset.firma = firma;
  selector.innerHTML = '';
  for (const c of gestor.capas.capas) {
    const estado = !c.visible ? ' (oculta)' : c.bloqueada ? ' (bloqueada)' : '';
    const opcion = new Option(`${c.nombre}${estado}`, c.id, false, c.id === actual);
    opcion.disabled = c.id !== actual && !gestor.capas.editable(c.id);
    selector.append(opcion);
  }
}

export function crearPanelCapas(
  seccion: HTMLElement,
  gestor: GestorObjetos,
  avisar: (texto: string, error?: boolean) => void,
): PanelCapas {
  const capas = gestor.capas;
  const detalles = el('details', 'plegable');
  let plegado = false;
  try { plegado = localStorage.getItem(CLAVE_PLEGADO) === '1'; } catch { /* sin almacenamiento */ }
  detalles.open = !plegado;
  detalles.addEventListener('toggle', () => {
    try { localStorage.setItem(CLAVE_PLEGADO, detalles.open ? '0' : '1'); } catch { /* sin almacenamiento */ }
  });
  const resumen = el('summary');
  resumen.append(el('h2', '', 'Capas'));
  detalles.append(resumen);
  seccion.append(detalles);

  const avisoSolapes = el('p', 'nota aviso-capas error');
  avisoSolapes.setAttribute('role', 'status');
  const avisoApoyados = el('p', 'nota aviso-capas');
  const avisoNoCaben = el('p', 'nota aviso-capas error aviso-no-caben');
  avisoNoCaben.setAttribute('role', 'status');
  const lista = el('ul', 'lista-capas');
  lista.setAttribute('aria-label', 'Capas');

  const boton = (texto: string, titulo: string, clase = '') => {
    const b = el('button', clase, texto);
    b.type = 'button';
    b.title = titulo;
    b.setAttribute('aria-label', titulo);
    b.dataset.edicion = '';
    return b;
  };
  const btnNueva = boton('＋ Nueva', 'Crear una capa nueva (pasa a ser la activa)', 'capa-nueva');
  const btnDuplicar = boton('Duplicar', 'Duplicar la capa activa con todos sus objetos', 'capa-duplicar');
  const btnRenombrar = boton('Renombrar', 'Cambiar el nombre de la capa activa', 'capa-renombrar');
  const btnSubir = boton('▲', 'Subir la capa activa en la lista', 'capa-subir');
  const btnBajar = boton('▼', 'Bajar la capa activa en la lista', 'capa-bajar');
  const btnBorrar = boton('Borrar', 'Borrar la capa activa y sus objetos (se puede deshacer)', 'capa-borrar peligro');
  // Los textos cortos caben en una fila en el móvil
  btnNueva.setAttribute('aria-label', 'Nueva capa');
  const acciones = el('div', 'fila acciones-capa');
  acciones.append(btnNueva, btnDuplicar, btnRenombrar, btnSubir, btnBajar, btnBorrar);
  detalles.append(avisoSolapes, avisoNoCaben, avisoApoyados, lista, acciones,
    el('p', 'nota', 'Toca una capa para hacerla activa: los objetos nuevos van a ella. Ojo = mostrar u ocultar; candado = bloquear (se ven pero no se mueven). Base tiene la casa amueblada como en las fotos.'));

  /** Id de la capa que se está renombrando (con un campo de texto en su fila). */
  let renombrando: string | null = null;
  let firma = '';

  function dibujar() {
    lista.innerHTML = '';
    for (const c of capas.capas) {
      const activa = c.id === capas.activa;
      const fila = el('li', `capa${activa ? ' activa' : ''}${c.visible ? '' : ' oculta'}`);
      fila.dataset.capa = c.id;

      const color = boton('', `Color de "${c.nombre}" (toca para cambiarlo)`, 'capa-color');
      color.style.background = c.color;
      color.addEventListener('click', () => capas.siguienteColor(c.id));

      let nombre: HTMLElement;
      if (renombrando === c.id) {
        const campo = el('input', 'capa-campo');
        campo.type = 'text';
        campo.value = c.nombre;
        campo.maxLength = LARGO_NOMBRE;
        campo.setAttribute('aria-label', 'Nombre de la capa');
        let hecho = false;
        const terminar = (guardar: boolean) => {
          if (hecho) return;
          hecho = true;
          renombrando = null;
          if (guardar && campo.value.trim()) capas.renombrar(c.id, campo.value);
          firma = '';
          actualizar();
        };
        campo.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); terminar(true); }
          if (e.key === 'Escape') { e.preventDefault(); terminar(false); }
        });
        campo.addEventListener('blur', () => terminar(true));
        nombre = campo;
        queueMicrotask(() => { campo.focus(); campo.select(); });
      } else {
        const elegir = el('button', 'capa-elegir');
        elegir.type = 'button';
        elegir.title = activa ? 'Capa activa: los objetos nuevos van aquí' : `Hacer activa "${c.nombre}"`;
        elegir.setAttribute('aria-pressed', String(activa));
        const n = gestor.deCapa(c.id).length;
        elegir.append(el('span', 'capa-nombre', c.nombre));
        if (activa) elegir.append(el('span', 'capa-activa', 'activa'));
        const num = el('span', 'capa-num', String(n));
        num.title = `${n} objetos`;
        elegir.append(num);
        elegir.addEventListener('click', () => capas.activar(c.id));
        nombre = elegir;
      }

      const ojo = el('button', `capa-ojo${c.visible ? '' : ' apagado'}`, '👁');
      ojo.type = 'button';
      ojo.title = c.visible ? `Ocultar "${c.nombre}"` : `Mostrar "${c.nombre}"`;
      ojo.setAttribute('aria-label', ojo.title);
      ojo.setAttribute('aria-pressed', String(c.visible));
      ojo.addEventListener('click', () => capas.ponerVisible(c.id, !c.visible));

      const candado = boton(c.bloqueada ? '🔒' : '🔓', c.bloqueada ? `Desbloquear "${c.nombre}"` : `Bloquear "${c.nombre}"`, `capa-candado${c.bloqueada ? ' activo' : ''}`);
      candado.setAttribute('aria-pressed', String(c.bloqueada));
      candado.addEventListener('click', () => capas.ponerBloqueada(c.id, !c.bloqueada));

      fila.append(color, nombre, ojo, candado);
      lista.append(fila);
    }
    if (document.body.classList.contains('modo-camara')) {
      for (const b of detalles.querySelectorAll('[data-edicion]')) b.setAttribute('aria-disabled', 'true');
    }
  }

  function actualizar() {
    const nueva = JSON.stringify([capas.capas, capas.activa, renombrando, capas.capas.map((c) => gestor.deCapa(c.id).length)]);
    if (nueva !== firma) {
      firma = nueva;
      dibujar();
    }
    const i = capas.capas.findIndex((c) => c.id === capas.activa);
    const esBase = capas.activa === ID_BASE;
    btnRenombrar.disabled = btnBorrar.disabled = esBase;
    btnRenombrar.title = esBase ? 'La capa Base no se puede renombrar' : 'Cambiar el nombre de la capa activa';
    btnBorrar.title = esBase ? 'La capa Base no se puede borrar' : 'Borrar la capa activa y sus objetos (se puede deshacer)';
    btnSubir.disabled = i <= 0;
    btnBajar.disabled = i >= capas.capas.length - 1;

    const solapes = gestor.solapes().length;
    avisoSolapes.hidden = solapes === 0;
    avisoSolapes.textContent = `⚠ ${solapes} objetos se solapan (marcados en rojo). Apártalos, pásalos a otra capa u oculta una capa.`;
    // Apoyos que no cumplen la regla (balda más pequeña o más baja que el objeto): no se mueven solos
    const noCaben = gestor.apoyosInvalidos();
    avisoNoCaben.hidden = noCaben.length === 0;
    const nombres = [...new Set(noCaben.map((o) => `«${o.item.nombre}» en «${o.apoyo!.soporte.item.nombre}»`))].join(', ');
    const bloqueados = noCaben.some((o) => !gestor.editable(o));
    avisoNoCaben.textContent = `⚠ ${noCaben.length === 1 ? '1 objeto apoyado no cabe' : `${noCaben.length} objetos apoyados no caben`} en su balda (demasiado grande o demasiado alto; marcado en rojo): ${nombres}. Arrástralo a otra superficie o al suelo${bloqueados ? ' (antes, desbloquea su capa)' : ''}.`;
    const apoyados = gestor.apoyadosSobreOcultos().length;
    avisoApoyados.hidden = apoyados === 0;
    avisoApoyados.textContent = apoyados === 1
      ? 'ℹ 1 objeto está apoyado en un mueble de una capa oculta: se queda en su sitio.'
      : `ℹ ${apoyados} objetos están apoyados en muebles de capas ocultas: se quedan en su sitio.`;
  }

  btnNueva.addEventListener('click', () => capas.crear());
  btnDuplicar.addEventListener('click', async () => {
    const origen = capas.capaActiva();
    const n = gestor.deCapa(origen.id).length;
    const copia = await gestor.duplicarCapa(origen.id);
    if (copia) avisar(`Capa "${copia.nombre}" creada con ${n} objetos. "${origen.nombre}" se ha ocultado para que no se solapen.`);
  });
  btnRenombrar.addEventListener('click', () => {
    if (capas.activa === ID_BASE) return;
    renombrando = capas.activa;
    actualizar();
  });
  btnSubir.addEventListener('click', () => capas.mover(capas.activa, -1));
  btnBajar.addEventListener('click', () => capas.mover(capas.activa, 1));
  confirmarEnElBoton(btnBorrar, () => capas.activa !== ID_BASE, () => {
    const c = capas.capaActiva();
    if (c.id === ID_BASE) return;
    const n = gestor.deCapa(c.id).length;
    if (gestor.borrarCapa(c.id)) avisar(`Capa "${c.nombre}" borrada con ${n} objetos. Puedes deshacerlo con ↶.`);
  });

  capas.alCambiar(actualizar);
  gestor.alSeleccionar(actualizar);
  actualizar();

  return {
    mostrar() {
      detalles.open = true;
      seccion.scrollIntoView({ block: 'start' });
    },
    actualizar,
  };
}
