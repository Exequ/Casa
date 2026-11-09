// Punto de entrada: monta la escena, la habitación, el catálogo y el panel.

import './ui/estilos.css';
import datosHabitacion from '../data/habitacion.json';
import { leerCatalogo } from './catalogo/catalogo';
import { crearEscena } from './escena/escena';
import { Habitacion, type DatosHabitacion } from './escena/habitacion';
import { activarInteraccion } from './escena/interaccion';
import { GestorObjetos } from './escena/objetos';
import { aplicar, autoguardar, descargarArchivo, leerArchivo, leerAutoguardado } from './escena/persistencia';
import { crearPanel } from './ui/panel';

const datos = datosHabitacion as DatosHabitacion;
const catalogo = leerCatalogo();

// 1. Escena 3D y habitación
const escena = crearEscena(document.getElementById('visor')!, datos);
const habitacion = new Habitacion(datos);
escena.escena.add(habitacion.grupo);
escena.cadaFotograma(() => habitacion.actualizarParedes(escena.camara));

// 2. Objetos colocados + interacción con ratón y teclado
const gestor = new GestorObjetos(escena.escena, habitacion);
activarInteraccion(escena, gestor);

// 3. Autoguardado: cada cambio se guarda en el navegador (agrupando cambios seguidos).
let temporizador: number | undefined;
gestor.alCambiar(() => {
  clearTimeout(temporizador);
  temporizador = window.setTimeout(() => autoguardar(gestor), 300);
});

// 4. Panel lateral
crearPanel(document.getElementById('panel')!, catalogo, datos, gestor, {
  async agregar(item) {
    // Aparece en el centro de la habitación, ya seleccionado.
    const obj = await gestor.agregar(item, 0, 0, 0);
    gestor.seleccionar(obj);
    gestor.notificar();
  },
  guardar: () => descargarArchivo(gestor),
  async cargar(archivo) {
    try {
      await aplicar(gestor, await leerArchivo(archivo), catalogo);
    } catch (e) {
      alert(`No se pudo cargar el archivo: ${(e as Error).message}`);
    }
  },
  vaciar: () => gestor.vaciar(),
});

// 5. Recuperar la última escena autoguardada (si la hay)
const guardada = leerAutoguardado();
if (guardada) aplicar(gestor, guardada, catalogo).catch((e) => console.warn('Autoguardado no válido', e));

// Acceso desde la consola del navegador, útil para depurar.
Object.assign(window, { casa: { escena, habitacion, gestor, catalogo } });
