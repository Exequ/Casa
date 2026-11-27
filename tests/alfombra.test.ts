// Alfombras ("alfombra": true en la ficha): van debajo de los muebles. No
// chocan con ningún objeto ni ninguno choca con ellas (solo las limitan
// paredes, puertas y fijos), nunca se marcan como solapadas y lo que queda
// encima sigue en el suelo (no se mueve con ellas).

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
import { esAlfombra, leerCatalogo, superficiesDe, validarFicha, zonasDe, type FichaObjeto } from '../src/catalogo/catalogo';
import { ID_BASE } from '../src/escena/capas';
import { GestorObjetos, type ObjetoColocado } from '../src/escena/objetos';
import { AJUSTES_POR_DEFECTO, aplicar, serializar, type EscenaGuardada, type EstadoEscena } from '../src/escena/persistencia';
import { carasColgables } from '../src/vivienda/colgar';
import { EspacioLibre } from '../src/vivienda/espacio';
import type { Vivienda } from '../src/vivienda/modelo';

const vivienda = datos as Vivienda;
const espacio = new EspacioLibre(vivienda);
const caras = carasColgables(vivienda);
const catalogo = leerCatalogo();
const item = (id: string) => catalogo.find((i) => i.id === id)!;
const ALFOMBRA = 'alfombras/alfombra-cuadros-rosa-rojo';

const estadoDe = (g: GestorObjetos) => ({
  objetos: g,
  suelos: { cambios: () => ({}), restaurar: () => 0 },
  paredes: { cambios: () => ({}), restaurar: () => 0 },
  ajustes: { leer: () => AJUSTES_POR_DEFECTO, aplicar: () => {} },
}) as unknown as EstadoEscena;

/** Posición (x, z) redondeada al mm. */
const pos = (o: ObjetoColocado) => [Math.round(o.raiz.position.x * 1000) / 1000, Math.round(o.raiz.position.z * 1000) / 1000];

let gestor: GestorObjetos;
beforeEach(() => {
  gestor = new GestorObjetos(new THREE.Scene(), espacio, caras);
  gestor.capas.ponerBloqueada(ID_BASE, false);
});

describe('ficha de alfombra', () => {
  const base: FichaObjeto = { nombre: 'Alfombra', categoria: 'x', glb: 'x.glb', dimensiones: { ancho: 1.4, fondo: 2, alto: 0.01 } };

  it('"alfombra" es un sí/no, solo en objetos de suelo y sin superficies', () => {
    expect(validarFicha({ ...base, alfombra: true })).toBeNull();
    expect(validarFicha({ ...base, alfombra: false })).toBeNull();
    expect(validarFicha({ ...base, alfombra: 'si' as unknown as boolean })).toMatch(/true o false/);
    expect(validarFicha({ ...base, alfombra: true, colocacion: 'superficie' })).toMatch(/solo vale en objetos de suelo/);
    expect(validarFicha({ ...base, alfombra: true, superficies: [0.01] })).toMatch(/no admite "superficies"/);
    expect(validarFicha({ ...base, alfombra: true, superficies: [] })).toBeNull();
  });

  it('una alfombra no es soporte (ni siquiera por defecto): lo de encima va en el suelo', () => {
    expect(zonasDe({ ...base, alfombra: true })).toEqual([]);
    expect(zonasDe(base)).toHaveLength(1); // sin "alfombra", la tapa por defecto
    expect(esAlfombra(item(ALFOMBRA))).toBe(true);
    expect(item(ALFOMBRA).colocacion).toBe('suelo');
    expect(superficiesDe(item(ALFOMBRA))).toEqual([]);
    expect(catalogo.filter(esAlfombra).map((i) => i.id)).toEqual([ALFOMBRA]);
  });
});

describe('alfombra debajo de los muebles', () => {
  it('se pone justo donde se pide aunque haya muebles, y no se marca nada en rojo', async () => {
    const mesa = (await gestor.agregar(item('mesas/mesa-centro'), 3, 1.7))!;
    const sillon = (await gestor.agregar(item('sofas/sillon'), 3.2, 2.6))!;
    const antes = [pos(mesa), pos(sillon)];
    const alf = (await gestor.agregar(item(ALFOMBRA), 3, 1.9))!;
    expect(pos(alf)).toEqual([3, 1.9]); // debajo de la mesa y del sillón, sin apartarse
    expect([pos(mesa), pos(sillon)]).toEqual(antes);
    expect(gestor.esSoporte(alf)).toBe(false);
    gestor.notificar();
    expect(gestor.solapes()).toEqual([]);
  });

  it('un mueble se pone encima de la alfombra donde se pide (antes lo apartaba)', async () => {
    const alf = (await gestor.agregar(item(ALFOMBRA), 3, 1.9))!;
    const mesa = (await gestor.agregar(item('mesas/mesa-centro'), 3, 1.9))!;
    expect(pos(mesa)).toEqual([3, 1.9]);
    expect(pos(alf)).toEqual([3, 1.9]);
    const sofa = (await gestor.agregar(item('sofas/sofa-3-plazas'), 3, 1.0))!;
    expect(sofa).not.toBeNull();
    gestor.notificar();
    expect(gestor.solapes()).toEqual([]);
  });

  it('la alfombra se mueve y gira libremente por debajo, sin mover lo de encima', async () => {
    const mesa = (await gestor.agregar(item('mesas/mesa-centro'), 3, 1.7))!;
    const planta = (await gestor.agregarSobre(item('decoracion/planta-pequena'), mesa, 0.45, 3, 1.7))!;
    const sillon = (await gestor.agregar(item('sofas/sillon'), 4.2, 1.7))!;
    const alf = (await gestor.agregar(item(ALFOMBRA), 2.2, 1.5))!;
    expect(pos(alf)).toEqual([2.2, 1.5]);
    const antes = [pos(mesa), pos(planta), pos(sillon)];
    // Arrastre por debajo de la mesa hasta debajo del sillón (el salón mide 2,6 m de fondo ahí)
    for (const x of [2.6, 3, 3.4, 3.8, 4.2]) gestor.mover(alf, x, 1.5, false);
    gestor.asentar(alf);
    expect(pos(alf)).toEqual([4.2, 1.5]);
    expect(gestor.rotar(alf, 90)).toBe(true);
    expect(pos(alf)).toEqual([4.2, 1.5]);
    expect([pos(mesa), pos(planta), pos(sillon)]).toEqual(antes);
    expect(planta.apoyo?.soporte).toBe(mesa);
    gestor.notificar();
    expect(gestor.solapes()).toEqual([]);
  });

  it('los muebles y los objetos se mueven libremente por encima', async () => {
    const alf = (await gestor.agregar(item(ALFOMBRA), 3, 1.9))!;
    const mesa = (await gestor.agregar(item('mesas/mesa-centro'), 4.3, 1.9))!;
    for (const x of [4, 3.6, 3.2, 3]) gestor.mover(mesa, x, 1.9, false);
    gestor.asentar(mesa);
    expect(pos(mesa)).toEqual([3, 1.9]);
    expect(gestor.rotar(mesa, 45)).toBe(true);
    expect(pos(mesa)).toEqual([3, 1.9]);
    // Un objeto de superficie que se baja al suelo encima de la alfombra se queda donde se suelta, en el suelo
    const jarron = (await gestor.agregar(item('jarron'), 4.3, 1.2))!;
    expect(gestor.bajarAlSuelo(jarron, 3.4, 2.5)).toBe(true);
    expect(pos(jarron)).toEqual([3.4, 2.5]);
    expect(jarron.raiz.position.y).toBe(0);
    expect(pos(alf)).toEqual([3, 1.9]);
    gestor.notificar();
    expect(gestor.solapes()).toEqual([]);
  });

  it('dos alfombras pueden pisarse; las paredes sí las limitan', async () => {
    const a = (await gestor.agregar(item(ALFOMBRA), 3, 1.9))!;
    const b = (await gestor.agregar(item(ALFOMBRA), 3.1, 2.1))!;
    expect(pos(b)).toEqual([3.1, 2.1]);
    gestor.notificar();
    expect(gestor.solapes()).toEqual([]);
    // Lejos, fuera de la vivienda: no sale de ella
    gestor.mover(a, -10, 1.9);
    gestor.asentar(a);
    expect(a.raiz.position.x).toBeGreaterThan(-1);
  });

  it('sigue siendo de suelo para el resto: los muebles chocan entre sí como siempre', async () => {
    await gestor.agregar(item(ALFOMBRA), 3, 1.9);
    const mesa = (await gestor.agregar(item('mesas/mesa-centro'), 3, 1.9))!;
    const otra = (await gestor.agregar(item('mesas/mesa-centro'), 3, 1.9))!;
    expect(pos(otra)).not.toEqual(pos(mesa)); // la segunda mesa se aparta de la primera
  });
});

describe('alfombra en la casa amueblada y al guardar', () => {
  it('se pone bajo la mesa de centro de la escena inicial y guardar y cargar no mueve nada', async () => {
    await aplicar(estadoDe(gestor), datosEscenaInicial as EscenaGuardada, catalogo, { x: 0, z: 0 });
    const mesa = gestor.objetos.find((o) => o.item.id === 'mesas/mesa-centro')!;
    const [mx, mz] = pos(mesa);
    const alf = (await gestor.agregar(item(ALFOMBRA), mx, mz, 90))!;
    expect(pos(alf)).toEqual([mx, mz]);
    gestor.notificar();
    expect(gestor.solapes()).toEqual([]);
    const guardada = serializar(estadoDe(gestor));
    const antes = gestor.objetos.map((o) => [o.item.id, ...pos(o), o.rotacion]);
    const otro = new GestorObjetos(new THREE.Scene(), espacio, caras);
    const r = await aplicar(estadoDe(otro), guardada, catalogo, { x: 0, z: 0 });
    expect(r.omitidos).toEqual([]);
    expect(otro.objetos.map((o) => [o.item.id, ...pos(o), o.rotacion])).toEqual(antes);
    otro.notificar();
    expect(otro.solapes()).toEqual([]);
  });
});
