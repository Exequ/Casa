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
import { conTamano, esAlfombra, leerCatalogo, superficiesDe, textoTamano, validarFicha, zonasDe, type FichaObjeto } from '../src/catalogo/catalogo';
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
    expect(catalogo.filter(esAlfombra).map((i) => i.id).sort()).toEqual([
      ALFOMBRA, 'alfombras/alfombra-shaggy-cuadros-rojo', 'alfombras/alfombra-shaggy-cuadros-verde', 'alfombras/alfombra-shaggy-lisa-verde',
    ]);
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

  it('dos alfombras pisándose no se mezclan al dibujarse: la añadida después queda 1 mm por encima', async () => {
    const a = (await gestor.agregar(item(ALFOMBRA), 3, 1.5))!;
    const b = (await gestor.agregar(item('alfombras/alfombra-shaggy-lisa-verde'), 3, 1.5))!;
    const c = (await gestor.agregar(item('alfombras/alfombra-shaggy-cuadros-rojo'), 3.2, 1.6))!;
    gestor.notificar();
    const arriba = (o: ObjetoColocado) => new THREE.Box3().setFromObject(o.raiz).max.y;
    expect(arriba(a)).toBeCloseTo(0.01, 6);
    expect(arriba(b)).toBeCloseTo(0.011, 6);
    expect(arriba(c)).toBeCloseTo(0.012, 6);
    expect([a, b, c].map((o) => o.raiz.position.y)).toEqual([0, 0, 0]); // siguen en el suelo
    gestor.borrar(a);
    expect(arriba(b)).toBeCloseTo(0.01, 6);
    expect(serializar(estadoDe(gestor)).objetos.every((o) => o.posicion.y === 0)).toBe(true);
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

describe('medidas a elegir ("tamanos")', () => {
  const base: FichaObjeto = { nombre: 'Alfombra', categoria: 'x', glb: 'a.glb', dimensiones: { ancho: 1.4, fondo: 2, alto: 0.01 } };
  const t = (ancho: number, fondo: number, glb = `a-${ancho}.glb`) => ({ ancho, fondo, glb });

  it('formato: lista de { ancho, fondo, glb } sin repetir, con la medida de la ficha y su mismo glb', () => {
    expect(validarFicha({ ...base, tamanos: [t(0.8, 1.5), t(1.4, 2, 'a.glb')] })).toBeNull();
    expect(validarFicha({ ...base, tamanos: [] })).toMatch(/tamanos/);
    expect(validarFicha({ ...base, tamanos: [t(0.8, 1.5)] })).toMatch(/incluya la medida/);
    expect(validarFicha({ ...base, tamanos: [t(1.4, 2, 'otro.glb')] })).toMatch(/mismo "glb"/);
    expect(validarFicha({ ...base, tamanos: [t(1.4, 2, 'a.glb'), t(1.4, 2, 'b.glb')] })).toMatch(/sin repetir/);
    expect(validarFicha({ ...base, tamanos: [t(1.4, 2, 'a.glb'), { ...t(0.8, 1.5), alto: 1 } as never] })).toMatch(/campo desconocido "alto"/);
    expect(validarFicha({ ...base, tamanos: [t(1.4, 2, 'a.glb'), t(0, 1.5)] })).toMatch(/tamanos/);
  });

  it('conTamano: mismo objeto (mismo id) con otras medidas y otro modelo; null si no tiene esa medida', () => {
    const alf = item(ALFOMBRA);
    const grande = conTamano(alf, 2, 2.5)!;
    expect(grande.id).toBe(alf.id);
    expect(grande.dimensiones).toEqual({ ancho: 2, fondo: 2.5, alto: 0.01 });
    expect(grande.urlGlb).not.toBe(alf.urlGlb);
    expect(conTamano(grande, 1.4, 2)!.urlGlb).toBe(alf.urlGlb);
    expect(conTamano(alf, 1.4, 2)).toBe(alf);
    expect(conTamano(alf, 1, 1)).toBeNull();
    expect(conTamano(item('mesas/mesa-centro'), 1, 0.7)).toBeNull(); // sin medidas a elegir
    expect(textoTamano({ ancho: 0.8, fondo: 1.5 })).toBe('80 × 150 cm');
  });

  it('cambiar la medida de una alfombra bajo los muebles: mismo sitio y giro, sin mover nada', async () => {
    const mesa = (await gestor.agregar(item('mesas/mesa-centro'), 3, 1.5))!;
    const alf = (await gestor.agregar(item(ALFOMBRA), 3, 1.5, 90))!;
    const antes = pos(mesa);
    for (const [ancho, fondo] of [[0.8, 1.5], [1.2, 1.7], [1.6, 2.3], [2, 2.5], [1.4, 2]]) {
      expect(await gestor.cambiarTamano(alf, ancho, fondo), `${ancho} × ${fondo}`).toBe(true);
      expect(alf.item.dimensiones).toEqual({ ancho, fondo, alto: 0.01 });
      expect(pos(alf)).toEqual([3, 1.5]);
      expect(alf.rotacion).toBe(90);
      expect(gestor.objetos.filter((o) => o.item.id === ALFOMBRA)).toHaveLength(1);
    }
    expect(pos(mesa)).toEqual(antes);
    expect(await gestor.cambiarTamano(alf, 1, 1)).toBe(false); // no es una de sus medidas
    gestor.notificar();
    expect(gestor.solapes()).toEqual([]);
  });

  it('si con la nueva medida no cabe junto a una pared, se aparta lo justo; si no cabe en la estancia, no cambia', async () => {
    // Salón: de z = 0,23 a 2,84 en la zona de la derecha. Pegada a la pared de atrás, 80 × 150 de fondo:
    const alf = (await gestor.agregar(item(ALFOMBRA), 4.6, 1, 0))!;
    expect(await gestor.cambiarTamano(alf, 0.8, 1.5)).toBe(true);
    gestor.mover(alf, 4.6, 0.98);
    gestor.asentar(alf);
    const z0 = alf.raiz.position.z;
    expect(await gestor.cambiarTamano(alf, 1.4, 2)).toBe(true); // 25 cm más de fondo por cada lado: se aparta de la pared
    expect(alf.raiz.position.z).toBeGreaterThan(z0);
    expect(alf.raiz.position.z - z0).toBeLessThanOrEqual(0.5);
    // En el baño no cabe una de 200 × 250: no cambia
    const banio = (await gestor.agregar(item(ALFOMBRA), 0, 0, 0))!;
    await gestor.cambiarTamano(banio, 0.8, 1.5);
    const p = vivienda.estancias.find((e) => e.id === 'bano')!.poligono;
    const [bx, bz] = [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
    gestor.mover(banio, bx, bz);
    gestor.asentar(banio);
    const antes = pos(banio);
    expect(await gestor.cambiarTamano(banio, 2, 2.5)).toBe(false);
    expect(banio.item.dimensiones.ancho).toBe(0.8);
    expect(pos(banio)).toEqual(antes);
  });

  it('la medida se guarda en la escena (deshacer y archivos) y vuelve al cargar; duplicar copia la medida', async () => {
    const alf = (await gestor.agregar(item('alfombras/alfombra-shaggy-cuadros-verde'), 3, 1.5))!;
    await gestor.cambiarTamano(alf, 2, 2.5);
    const copia = (await gestor.duplicar(alf))!;
    expect(copia.item.dimensiones).toEqual({ ancho: 2, fondo: 2.5, alto: 0.01 });
    const lisa = (await gestor.agregar(item('alfombras/alfombra-shaggy-lisa-verde'), 2, 1.5))!;
    const guardada = serializar(estadoDe(gestor));
    expect(guardada.objetos.map((o) => o.tamano)).toEqual([{ ancho: 2, fondo: 2.5 }, { ancho: 2, fondo: 2.5 }, { ancho: 1.4, fondo: 2 }]);
    const otro = new GestorObjetos(new THREE.Scene(), espacio, caras);
    await aplicar(estadoDe(otro), guardada, catalogo, { x: 0, z: 0 });
    expect(otro.objetos.map((o) => [o.item.id, o.item.dimensiones.ancho, o.item.dimensiones.fondo, ...pos(o)])).toEqual(
      [alf, copia, lisa].map((o) => [o.item.id, o.item.dimensiones.ancho, o.item.dimensiones.fondo, ...pos(o)]));
    // Una medida que ya no existe: la de la ficha
    const rara = { ...guardada, objetos: [{ ...guardada.objetos[0], tamano: { ancho: 3, fondo: 3 } }] };
    const tercero = new GestorObjetos(new THREE.Scene(), espacio, caras);
    await aplicar(estadoDe(tercero), rara, catalogo, { x: 0, z: 0 });
    expect(tercero.objetos[0].item.dimensiones).toEqual({ ancho: 1.4, fondo: 2, alto: 0.01 });
  });
});
