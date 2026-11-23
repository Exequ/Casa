// Fase 6, parte B: capas (visibilidad, bloqueo, choques entre capas,
// soportes, duplicar, borrar, mover a otra capa, restaurar Base, migración,
// guardar y cargar, deshacer).

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

// Los modelos .glb no se pueden cargar en Node: cada objeto es una caja de sus medidas.
vi.mock('../src/catalogo/modelos', () => ({
  crearModelo: async (item: { dimensiones: { ancho: number; fondo: number; alto: number } }) => {
    const { ancho, fondo, alto } = item.dimensiones;
    const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo));
    m.position.y = alto / 2;
    const raiz = new THREE.Group();
    raiz.add(m);
    return raiz;
  },
}));

import datos from '../data/vivienda.json';
import datosEscenaInicial from '../data/escena-inicial.json';
import { leerCatalogo } from '../src/catalogo/catalogo';
import { capasPorDefecto, COLORES_CAPA, GestorCapas, ID_BASE, normalizarCapas } from '../src/escena/capas';
import { Historial } from '../src/escena/historial';
import { GestorObjetos, type ObjetoColocado } from '../src/escena/objetos';
import {
  AJUSTES_POR_DEFECTO, aplicar, colocarObjetos, migrar, serializar, type EscenaGuardada, type EstadoEscena,
} from '../src/escena/persistencia';
import { carasColgables } from '../src/vivienda/colgar';
import { EspacioLibre } from '../src/vivienda/espacio';
import type { Vivienda } from '../src/vivienda/modelo';

const vivienda = datos as Vivienda;
const espacio = new EspacioLibre(vivienda);
const caras = carasColgables(vivienda);
const catalogo = leerCatalogo();
const item = (id: string) => catalogo.find((i) => i.id === id)!;
const centro = { x: 0, z: 0 };

let gestor: GestorObjetos;
let capas: GestorCapas;
beforeEach(() => {
  gestor = new GestorObjetos(new THREE.Scene(), espacio, caras);
  capas = gestor.capas;
});

const estadoDe = (g: GestorObjetos) => ({
  objetos: g,
  suelos: { cambios: () => ({}), restaurar: () => 0 },
  paredes: { cambios: () => ({}), restaurar: () => 0 },
  ajustes: { leer: () => AJUSTES_POR_DEFECTO, aplicar: () => {} },
}) as unknown as EstadoEscena;

const pos = (o: ObjetoColocado) => [o.raiz.position.x, o.raiz.position.z].map((n) => Math.round(n * 1000) / 1000);

describe('lista de capas', () => {
  it('siempre hay una Base que no se borra ni se renombra', () => {
    expect(capas.capas.map((c) => c.id)).toEqual([ID_BASE]);
    expect(capas.renombrar(ID_BASE, 'Otra')).toBe(false);
    expect(capas.quitar(ID_BASE)).toBe(false);
    expect(capas.get(ID_BASE)!.nombre).toBe('Base');
  });

  it('una escena sin capas empieza con Base bloqueada y activa', () => {
    expect(capasPorDefecto()).toEqual({ capas: [{ id: 'base', nombre: 'Base', visible: true, bloqueada: true, color: COLORES_CAPA[0] }], activa: 'base' });
  });

  it('crear: "Capa 2", "Capa 3"…, pasa a ser la activa y va después de la activa', () => {
    const c2 = capas.crear();
    expect(c2.nombre).toBe('Capa 2');
    expect(capas.activa).toBe(c2.id);
    const c3 = capas.crear();
    expect(c3.nombre).toBe('Capa 3');
    capas.activar(ID_BASE);
    const c4 = capas.crear();
    expect(c4.nombre).toBe('Capa 4');
    expect(capas.capas.map((c) => c.nombre)).toEqual(['Base', 'Capa 4', 'Capa 2', 'Capa 3']);
    expect(new Set(capas.capas.map((c) => c.color)).size).toBe(4);
    // Al borrar la "Capa 2", el siguiente nombre libre vuelve a ser ese
    gestor.borrarCapa(c2.id);
    expect(capas.crear().nombre).toBe('Capa 2');
  });

  it('renombrar, reordenar, color y borrar (la activa pasa a la de al lado)', () => {
    const c = capas.crear();
    expect(capas.renombrar(c.id, '  Salón nuevo  ')).toBe(true);
    expect(capas.get(c.id)!.nombre).toBe('Salón nuevo');
    expect(capas.renombrar(c.id, '   ')).toBe(false);
    expect(capas.mover(c.id, -1)).toBe(true);
    expect(capas.capas[0].id).toBe(c.id);
    expect(capas.mover(c.id, -1)).toBe(false);
    const color = capas.get(c.id)!.color;
    capas.siguienteColor(c.id);
    expect(capas.get(c.id)!.color).not.toBe(color);
    expect(capas.quitar(c.id)).toBe(true);
    expect(capas.activa).toBe(ID_BASE);
  });

  it('normalizar: añade Base si falta, quita ids repetidos y arregla colores y la activa', () => {
    const n = normalizarCapas([
      { id: 'x', nombre: 'X', visible: false, bloqueada: true, color: 'rojo' },
      { id: 'x', nombre: 'repetida' },
      { id: 'base', nombre: 'Mal nombre' },
      null,
    ], 'no-existe');
    expect(n.capas.map((c) => c.id)).toEqual(['x', 'base']);
    expect(n.capas[0]).toMatchObject({ nombre: 'X', visible: false, bloqueada: true });
    expect(n.capas[0].color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(n.capas[1].nombre).toBe('Base');
    expect(n.activa).toBe('base');
    expect(normalizarCapas(undefined, undefined).capas.map((c) => c.id)).toEqual(['base']);
  });

  it('avisa de cada cambio', () => {
    let avisos = 0;
    capas.alCambiar(() => avisos++);
    const c = capas.crear();
    capas.ponerVisible(c.id, false);
    capas.ponerVisible(c.id, false); // sin cambio
    capas.ponerBloqueada(c.id, true);
    capas.activar(ID_BASE);
    expect(avisos).toBe(4);
  });
});

describe('objetos en capas', () => {
  it('los objetos nuevos van a la capa activa; si está oculta o bloqueada no se puede añadir', async () => {
    const mesa = (await gestor.agregar(item('mesa'), 3, 1.7))!;
    expect(mesa.capa).toBe(ID_BASE);
    const c = capas.crear();
    const silla = (await gestor.agregar(item('armario'), 1.5, 1))!;
    expect(silla.capa).toBe(c.id);
    expect(gestor.puedeAnadir()).toBeNull();
    capas.ponerBloqueada(c.id, true);
    expect(gestor.puedeAnadir()).toMatch(/bloqueada/);
    capas.ponerBloqueada(c.id, false);
    capas.ponerVisible(c.id, false);
    expect(gestor.puedeAnadir()).toMatch(/oculta/);
  });

  it('duplicar un objeto deja la copia en la capa activa', async () => {
    const mesa = (await gestor.agregar(item('mesa'), 3, 1.7))!;
    const c = capas.crear();
    const copia = (await gestor.duplicar(mesa))!;
    expect(copia.capa).toBe(c.id);
  });

  it('capa oculta: no se dibuja, no se selecciona, no choca y no es soporte', async () => {
    const mesa = (await gestor.agregar(item('mesa'), 3, 1.7))!;
    const c = capas.crear();
    capas.activar(ID_BASE);
    gestor.ponerCapa(mesa, c.id);
    capas.ponerVisible(c.id, false);
    gestor.actualizarCapas();
    expect(mesa.raiz.visible).toBe(false);
    gestor.seleccionar(mesa);
    expect(gestor.seleccionado).toBeNull();
    // Otro mueble puede ponerse justo donde está la mesa oculta
    const otra = (await gestor.agregar(item('mesa'), 3, 1.7))!;
    expect(pos(otra)).toEqual(pos(mesa));
    // Un jarrón no se apoya en la mesa oculta (sí en la visible)
    const apoyo = gestor.buscarApoyo(item('jarron'), 3, 1.7);
    expect(apoyo?.soporte).toBe(otra);
    capas.ponerVisible(c.id, true);
    gestor.actualizarCapas();
    expect(mesa.raiz.visible).toBe(true);
    // Al mostrarla, las dos mesas se solapan y se marcan en rojo
    expect(gestor.solapes()).toEqual(expect.arrayContaining([mesa, otra]));
    expect(mesa.raiz.getObjectByName('marca-solape')?.visible).toBe(true);
  });

  it('capa bloqueada: se ve y choca, pero no se selecciona', async () => {
    const mesa = (await gestor.agregar(item('mesa'), 3, 1.7))!;
    capas.ponerBloqueada(ID_BASE, true);
    gestor.actualizarCapas();
    expect(mesa.raiz.visible).toBe(true);
    gestor.seleccionar(mesa);
    expect(gestor.seleccionado).toBeNull();
    expect(gestor.editable(mesa)).toBe(false);
    capas.crear();
    const otra = (await gestor.agregar(item('mesa'), 3, 1.7))!;
    expect(pos(otra)).not.toEqual(pos(mesa)); // se aparta: la bloqueada estorba
    expect(gestor.solapes()).toEqual([]);
  });

  it('al bloquear u ocultar la capa del seleccionado, se deselecciona', async () => {
    const mesa = (await gestor.agregar(item('mesa'), 3, 1.7))!;
    gestor.seleccionar(mesa);
    capas.ponerBloqueada(ID_BASE, true);
    gestor.actualizarCapas();
    expect(gestor.seleccionado).toBeNull();
  });
});

describe('choques entre capas', () => {
  /** Dos mesas en el mismo sitio, cada una en una capa, con la capa 2 oculta y luego mostrada. */
  async function solapadas() {
    const a = (await gestor.agregar(item('mesa'), 3, 1.7))!;
    const c = capas.crear();
    capas.ponerVisible(ID_BASE, false);
    gestor.actualizarCapas();
    const b = (await gestor.agregar(item('mesa'), 3, 1.7))!;
    capas.ponerVisible(ID_BASE, true);
    gestor.actualizarCapas();
    return { a, b, c };
  }

  it('mostrar una capa con solapes no los impide: se marcan', async () => {
    const { a, b } = await solapadas();
    expect(pos(a)).toEqual(pos(b));
    expect(gestor.solapes().length).toBe(2);
  });

  it('un objeto solapado se puede sacar arrastrándolo, y después ya no puede volver a meterse', async () => {
    const { a, b } = await solapadas();
    gestor.mover(b, 4.5, 1.7);
    gestor.asentar(b);
    expect(gestor.solapes()).toEqual([]);
    expect(pos(b)[0]).toBeGreaterThan(4);
    gestor.mover(b, 3, 1.7); // contra la otra mesa: se queda pegada
    expect(gestor.solapes()).toEqual([]);
    expect(Math.abs(b.raiz.position.x - a.raiz.position.x)).toBeGreaterThan(0.5);
  });

  it('arrastrar un objeto solapado no lo mete dentro de un tercero', async () => {
    const { b } = await solapadas();
    const tercero = (await gestor.agregar(item('armario'), 4.8, 1.2))!;
    const antes = gestor.solapes().length;
    for (let x = 3; x <= 5.5; x += 0.1) gestor.mover(b, x, 1.2, false);
    expect(gestor.calcularSolapes().get(tercero)).toBeUndefined();
    expect(gestor.solapes().length).toBeLessThanOrEqual(antes);
  });

  it('pasar un objeto a otra capa: no se mueve, y si queda solapado se marca', async () => {
    const mesa = (await gestor.agregar(item('mesa'), 3, 1.7))!;
    const c = capas.crear();
    const p = pos(mesa);
    expect(gestor.ponerCapa(mesa, c.id)).toBe(true);
    expect(mesa.capa).toBe(c.id);
    expect(pos(mesa)).toEqual(p);
    // A una capa bloqueada u oculta no se puede
    const bloqueada = capas.crear();
    capas.ponerBloqueada(bloqueada.id, true);
    expect(gestor.ponerCapa(mesa, bloqueada.id)).toBe(false);
    capas.ponerBloqueada(bloqueada.id, false);
    capas.ponerVisible(bloqueada.id, false);
    expect(gestor.ponerCapa(mesa, bloqueada.id)).toBe(false);
    expect(mesa.capa).toBe(c.id);
  });

  it('los cuadros de capas distintas en la misma pared se marcan si se solapan', async () => {
    const cuadro = (await gestor.agregarEnParedCerca(item('cuadro'), 3, 0.5, 'salon'))!;
    const c = capas.crear();
    capas.ponerVisible(ID_BASE, false);
    gestor.actualizarCapas();
    const otro = (await gestor.agregarEnParedCerca(item('cuadro'), 3, 0.5, 'salon'))!;
    expect(otro.pared!.cara).toBe(cuadro.pared!.cara);
    expect(Math.abs(otro.pared!.u - cuadro.pared!.u)).toBeLessThan(0.1);
    capas.ponerVisible(ID_BASE, true);
    gestor.actualizarCapas();
    expect(gestor.solapes()).toEqual(expect.arrayContaining([cuadro, otro]));
    expect(c.id).toBeTruthy();
  });
});

describe('apoyados en un mueble de otra capa', () => {
  async function jarronSobreMesa() {
    const mesa = (await gestor.agregar(item('mesa'), 3, 1.7))!;
    const c = capas.crear();
    const jarron = (await gestor.agregarSegunTipo(item('jarron'), 3, 1.7, 'salon'))!;
    expect(jarron.apoyo?.soporte).toBe(mesa);
    expect(jarron.capa).toBe(c.id);
    return { mesa, jarron, c };
  }

  it('siguen al mueble al moverlo y girarlo', async () => {
    const { mesa, jarron } = await jarronSobreMesa();
    const d = jarron.raiz.position.clone().sub(mesa.raiz.position);
    gestor.mover(mesa, 2.6, 1.6);
    expect(jarron.raiz.position.clone().sub(mesa.raiz.position).distanceTo(d)).toBeLessThan(1e-9);
    gestor.rotar(mesa, 90);
    expect(jarron.apoyo?.soporte).toBe(mesa);
  });

  it('si el mueble se oculta, se quedan en su sitio (visibles) y se avisa', async () => {
    const { jarron } = await jarronSobreMesa();
    const antes = jarron.raiz.position.clone();
    capas.ponerVisible(ID_BASE, false);
    gestor.actualizarCapas();
    expect(jarron.raiz.visible).toBe(true);
    expect(jarron.raiz.position.distanceTo(antes)).toBe(0);
    expect(gestor.apoyadosSobreOcultos()).toEqual([jarron]);
    capas.ponerVisible(ID_BASE, true);
    gestor.actualizarCapas();
    expect(gestor.apoyadosSobreOcultos()).toEqual([]);
  });

  it('si el mueble cambia de capa, no les afecta', async () => {
    const { mesa, jarron } = await jarronSobreMesa();
    const otra = capas.crear();
    const antes = jarron.raiz.position.clone();
    gestor.ponerCapa(mesa, otra.id);
    expect(jarron.apoyo?.soporte).toBe(mesa);
    expect(jarron.raiz.position.distanceTo(antes)).toBe(0);
  });

  it('si se borra la capa del mueble, pasan a otro mueble o al suelo', async () => {
    const { mesa, jarron, c } = await jarronSobreMesa();
    const otra = capas.crear();
    gestor.ponerCapa(mesa, otra.id);
    gestor.borrarCapa(otra.id);
    expect(gestor.objetos).not.toContain(mesa);
    expect(gestor.objetos).toContain(jarron);
    expect(jarron.colocacion).toBe('suelo');
    expect(jarron.capa).toBe(c.id);
  });
});

describe('duplicar y borrar capas', () => {
  it('duplicar copia todos los objetos en el mismo sitio, oculta la original y activa la copia', async () => {
    const mesa = (await gestor.agregar(item('mesa'), 3, 1.7))!;
    const jarron = (await gestor.agregarSobre(item('jarron'), mesa, 0.75, 3.1, 1.7))!;
    const cuadro = (await gestor.agregarEnParedCerca(item('cuadro'), 3, 0.5, 'salon'))!;
    const copia = (await gestor.duplicarCapa(ID_BASE))!;
    expect(copia.nombre).toBe('Base (copia)');
    expect(capas.activa).toBe(copia.id);
    expect(capas.visible(ID_BASE)).toBe(false);
    const nuevos = gestor.deCapa(copia.id);
    expect(nuevos.length).toBe(3);
    const de = (id: string) => nuevos.find((o) => o.item.id === id)!;
    expect(pos(de('mesa'))).toEqual(pos(mesa));
    expect(de('jarron').apoyo?.soporte).toBe(de('mesa')); // sobre la copia de la mesa
    expect(pos(de('jarron'))).toEqual(pos(jarron));
    expect(de('cuadro').pared).toEqual(cuadro.pared);
    expect(gestor.solapes()).toEqual([]);
    expect(mesa.raiz.visible).toBe(false);
  });

  it('borrar una capa borra sus objetos, y se puede deshacer', async () => {
    const estado = estadoDe(gestor);
    const foto = () => {
      const g = serializar(estado);
      return JSON.stringify({ objetos: g.objetos, capas: g.capas, capaActiva: g.capaActiva });
    };
    const h = new Historial(foto, async (f) => { await aplicar(estado, { version: 6, ...JSON.parse(f) }, catalogo, centro, false); }, 0);
    await gestor.agregar(item('mesa'), 3, 1.7);
    h.iniciar();
    const c = capas.crear(); h.apuntar();
    await gestor.agregar(item('armario'), 1.5, 1); h.apuntar();
    const antes = foto();
    expect(gestor.borrarCapa(c.id)).toBe(true); h.apuntar();
    expect(capas.existe(c.id)).toBe(false);
    expect(gestor.objetos.length).toBe(1);
    await h.deshacer();
    expect(foto()).toBe(antes);
    expect(gestor.deCapa(c.id).length).toBe(1);
    await h.rehacer();
    expect(capas.existe(c.id)).toBe(false);
    // Las operaciones de capas (ocultar, bloquear, activa, orden) también se deshacen
    capas.ponerVisible(ID_BASE, false); h.apuntar();
    capas.ponerBloqueada(ID_BASE, true); h.apuntar();
    await h.deshacer();
    expect(capas.bloqueada(ID_BASE)).toBe(false);
    await h.deshacer();
    expect(capas.visible(ID_BASE)).toBe(true);
  });

  it('Vaciar quita solo lo de capas visibles y desbloqueadas', async () => {
    await gestor.agregar(item('mesa'), 3, 1.7);
    capas.ponerBloqueada(ID_BASE, true);
    const c = capas.crear();
    await gestor.agregar(item('armario'), 1.5, 1);
    const oculta = capas.crear();
    await gestor.agregar(item('armario'), 8, 1.5);
    capas.ponerVisible(oculta.id, false);
    gestor.actualizarCapas();
    expect(gestor.vaciarEditables()).toBe(1);
    expect(gestor.deCapa(c.id)).toEqual([]);
    expect(gestor.deCapa(ID_BASE).length).toBe(1);
    expect(gestor.deCapa(oculta.id).length).toBe(1);
  });
});

describe('restaurar la capa Base', () => {
  const inicial = () => migrar(structuredClone(datosEscenaInicial) as unknown as EscenaGuardada, centro).objetos;

  it('restaura solo Base, sin tocar las demás capas', async () => {
    await colocarObjetos(gestor, inicial(), catalogo);
    const total = gestor.objetos.length;
    expect(gestor.deCapa(ID_BASE).length).toBe(total);
    // Se mueve y borra algo de Base, y se añade algo en otra capa
    const sofa = gestor.objetos.find((o) => o.item.id === 'sofas/sofa-3-plazas')!;
    const posSofa = pos(sofa);
    gestor.borrar(gestor.objetos.find((o) => o.item.id === 'tendedero/lavadora')!);
    const c = capas.crear();
    const cuadro = (await gestor.agregarEnParedCerca(item('cuadro'), 8.5, 3, 'dormitorio'))!;
    // Un jarrón de la capa 2 sobre la mesa de centro (de Base)
    const mesaCentro = gestor.objetos.find((o) => o.item.id === 'mesas/mesa-centro')!;
    const jarron = (await gestor.agregarSobre(item('jarron'), mesaCentro, 0.4, mesaCentro.raiz.position.x, mesaCentro.raiz.position.z))
      ?? (await gestor.agregarSegunTipo(item('jarron'), mesaCentro.raiz.position.x, mesaCentro.raiz.position.z, 'salon'))!;
    const soporteAntes = jarron.apoyo?.soporte;
    const posJarron = jarron.raiz.position.clone();
    capas.ponerBloqueada(ID_BASE, false);
    gestor.actualizarCapas();
    gestor.mover(sofa, posSofa[0] - 0.3, posSofa[1]);

    const objetos = inicial().map((o) => ({ ...o, capa: ID_BASE }));
    const omitidos = await gestor.reemplazarCapa(ID_BASE, () => colocarObjetos(gestor, objetos, catalogo));
    expect(omitidos).toEqual([]);
    expect(gestor.deCapa(ID_BASE).length).toBe(total);
    expect(pos(gestor.objetos.find((o) => o.item.id === 'sofas/sofa-3-plazas')!)).toEqual(posSofa);
    expect(gestor.deCapa(c.id)).toEqual(expect.arrayContaining([cuadro, jarron]));
    expect(gestor.objetos).toContain(cuadro);
    if (soporteAntes) {
      // Sigue apoyado en la mesa de centro restaurada, en el mismo sitio
      expect(jarron.apoyo?.soporte.item.id).toBe('mesas/mesa-centro');
      expect(gestor.objetos).toContain(jarron.apoyo?.soporte);
      expect(jarron.raiz.position.distanceTo(posJarron)).toBeLessThan(0.01);
    }
  });
});

describe('guardar y cargar con capas (v6)', () => {
  it('una escena v5 pasa entera a Base (bloqueada)', () => {
    const v5 = migrar(structuredClone(datosEscenaInicial) as unknown as EscenaGuardada, centro);
    expect(v5.version).toBe(6);
    expect(v5.capas).toEqual(capasPorDefecto().capas);
    expect(v5.capaActiva).toBe(ID_BASE);
    expect(v5.objetos.every((o) => o.capa === ID_BASE)).toBe(true);
  });

  it('un objeto con una capa que no existe va a Base', () => {
    const e = migrar({ version: 6, capas: [{ id: 'base', nombre: 'Base', visible: true, bloqueada: false, color: '#2f7cf6' }], objetos: [
      { catalogo: 'mesa', posicion: { x: 3, y: 0, z: 1.7 }, rotacion: 0, capa: 'fantasma' },
    ] }, centro);
    expect(e.objetos[0].capa).toBe(ID_BASE);
  });

  it('ida y vuelta: capas, visibilidad, bloqueo, activa y capa de cada objeto (con solapes entre capas)', async () => {
    const mesa = (await gestor.agregar(item('mesa'), 3, 1.7))!;
    await gestor.agregarSobre(item('jarron'), mesa, 0.75, 3.1, 1.7);
    const c2 = capas.crear('Variante sofá');
    capas.ponerVisible(ID_BASE, false);
    gestor.actualizarCapas();
    await gestor.agregar(item('mesa'), 3, 1.7); // en el mismo sitio que la de Base (oculta)
    capas.ponerVisible(ID_BASE, true);
    capas.ponerBloqueada(ID_BASE, true);
    const c3 = capas.crear();
    capas.ponerVisible(c3.id, false);
    capas.mover(c3.id, -1);
    capas.activar(c2.id);
    gestor.actualizarCapas();
    expect(gestor.solapes().length).toBe(2);

    const guardada = serializar(estadoDe(gestor));
    expect(guardada.version).toBe(6);
    expect(guardada.capaActiva).toBe(c2.id);
    expect(guardada.capas!.map((c) => [c.nombre, c.visible, c.bloqueada])).toEqual([
      ['Base', true, true], ['Capa 2', false, false], ['Variante sofá', true, false],
    ]);
    expect(guardada.objetos.map((o) => o.capa)).toEqual([ID_BASE, ID_BASE, c2.id]);

    const otro = new GestorObjetos(new THREE.Scene(), espacio, caras);
    await aplicar(estadoDe(otro), JSON.parse(JSON.stringify(guardada)), catalogo, centro);
    const vuelta = serializar(estadoDe(otro));
    expect(vuelta).toEqual(guardada);
    expect(otro.solapes().length).toBe(2); // los solapes siguen ahí (no se ha movido nada)
    expect(otro.capas.bloqueada(ID_BASE)).toBe(true);
    expect(otro.objetos.find((o) => o.item.id === 'jarron')!.apoyo?.soporte.item.id).toBe('mesa');
  });

  it('cargar una escena con una capa oculta coloca sus objetos exactamente (aunque se solapen con otros)', async () => {
    const escena: EscenaGuardada = {
      version: 6,
      capas: [
        { id: 'base', nombre: 'Base', visible: true, bloqueada: true, color: '#2f7cf6' },
        { id: 'capa-2', nombre: 'Otra', visible: false, bloqueada: false, color: '#16a34a' },
      ],
      capaActiva: 'capa-2',
      objetos: [
        { catalogo: 'mesa', posicion: { x: 3, y: 0, z: 1.7 }, rotacion: 0, colocacion: 'suelo', capa: 'base' },
        { catalogo: 'mesa', posicion: { x: 3, y: 0, z: 1.7 }, rotacion: 0, colocacion: 'suelo', capa: 'capa-2' },
      ],
    };
    await aplicar(estadoDe(gestor), escena, catalogo, centro);
    expect(gestor.objetos.map(pos)).toEqual([[3, 1.7], [3, 1.7]]);
    expect(gestor.objetos[1].raiz.visible).toBe(false);
    expect(gestor.solapes()).toEqual([]); // una está oculta
    expect(capas.activa).toBe('capa-2');
  });
});
