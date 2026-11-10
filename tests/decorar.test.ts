// Fase 4: colgar en paredes, apoyar sobre muebles, movimiento conjunto,
// duplicar, guardar (v5) y deshacer/rehacer.

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
import { leerCatalogo, superficiesDe, validarFicha, type ItemCatalogo } from '../src/catalogo/catalogo';
import { Historial, PASOS_HISTORIAL } from '../src/escena/historial';
import { GestorObjetos, type ObjetoColocado } from '../src/escena/objetos';
import { AJUSTES_POR_DEFECTO, colocarObjetos, migrar, serializar, type EscenaGuardada, type EstadoEscena } from '../src/escena/persistencia';
import {
  carasColgables, caraEnRayo, caraMasCercana, problemaEnPared, puntoEnPared, type CaraColgable,
} from '../src/vivienda/colgar';
import { EspacioLibre } from '../src/vivienda/espacio';
import type { Vivienda } from '../src/vivienda/modelo';

const vivienda = datos as Vivienda;
const espacio = new EspacioLibre(vivienda);
const caras = carasColgables(vivienda);
const catalogo = leerCatalogo();
const item = (id: string) => catalogo.find((i) => i.id === id)!;

/** Cara de una estancia sobre un muro, la que contiene el punto (x, z) más cercano. */
function cara(estancia: string, elemento: string, x?: number, z?: number): CaraColgable {
  const lista = caras.filter((c) => c.estancia === estancia && c.elemento === elemento);
  if (x === undefined || z === undefined) return lista[0];
  return caraMasCercana(lista, x, z)!.cara;
}

/** Posición u de un punto del mundo en una cara. */
const uDe = (c: CaraColgable, x: number, z: number) => (x - c.a[0]) * c.dir[0] + (z - c.a[1]) * c.dir[1];

let gestor: GestorObjetos;
beforeEach(() => { gestor = new GestorObjetos(new THREE.Scene(), espacio, caras); });

describe('catálogo: colocación', () => {
  it('los objetos de ejemplo tienen su colocación, y los antiguos van al suelo', () => {
    expect(item('cuadro').colocacion).toBe('pared');
    expect(item('cuadro').dimensiones).toMatchObject({ ancho: 0.4, alto: 0.3 });
    expect(item('espejo').colocacion).toBe('pared');
    expect(item('espejo').dimensiones).toMatchObject({ ancho: 0.6, alto: 0.9 });
    expect(item('jarron').colocacion).toBe('superficie');
    expect(item('jarron').dimensiones.alto).toBe(0.25);
    expect(item('planta').colocacion).toBe('superficie');
    expect(item('planta').dimensiones.alto).toBe(0.45);
    expect(item('armario').colocacion).toBe('suelo'); // su .json no dice nada
    expect(superficiesDe(item('armario'))).toEqual([2]); // el borde superior
    expect(superficiesDe(item('mesa'))).toEqual([0.75]);
    expect(superficiesDe(item('cuadro'))).toEqual([]);
  });

  it('valida los campos nuevos', () => {
    const base = { nombre: 'x', categoria: 'y', glb: 'x.glb', dimensiones: { ancho: 1, fondo: 0.5, alto: 1 } };
    expect(validarFicha(base)).toBeNull();
    expect(validarFicha({ ...base, colocacion: 'techo' as never })).toMatch(/colocacion/);
    expect(validarFicha({ ...base, colocacion: 'pared', alturaCentro: 0.2 })).toMatch(/alturaCentro/);
    expect(validarFicha({ ...base, superficies: [0.4, 0.9] })).toBeNull();
    expect(validarFicha({ ...base, superficies: [1.5] })).toMatch(/superficies/);
    expect(validarFicha({ ...base, colocacion: 'pared', superficies: [0.5] })).toMatch(/superficies/);
  });
});

describe('caras de pared', () => {
  it('cada estancia interior tiene caras para colgar; el balcón y las barandillas no', () => {
    for (const id of ['salon', 'cocina', 'tendedero', 'bano', 'distribuidor', 'dormitorio']) {
      expect(caras.some((c) => c.estancia === id), id).toBe(true);
    }
    expect(caras.some((c) => c.estancia === 'balcon')).toBe(false);
    expect(caras.some((c) => c.elemento.startsWith('pared:barandilla'))).toBe(false);
  });

  it('no se puede tapar una puerta (con su tapajuntas) ni una ventana; sí al lado', () => {
    const este = cara('salon', 'pared:salon-este');
    // Puerta del salón: de z = 1,88 a 2,69 (más 7 cm de tapajuntas)
    const uPuerta = uDe(este, 5.93, 2.285);
    expect(problemaEnPared({ cara: este, u: uPuerta, y: 1.5, ancho: 0.4, alto: 0.3 })).toBe('hueco');
    expect(problemaEnPared({ cara: este, u: uDe(este, 5.93, 1.88 - 0.07 - 0.21), y: 1.5, ancho: 0.4, alto: 0.3 })).toBeNull();
    expect(problemaEnPared({ cara: este, u: uDe(este, 5.93, 1.88 - 0.05), y: 1.5, ancho: 0.4, alto: 0.3 })).toBe('hueco');
    // Encima de la puerta (2,05 + 0,07) cabe un cuadro bajito
    expect(problemaEnPared({ cara: este, u: uPuerta, y: 2.3, ancho: 0.4, alto: 0.3 })).toBeNull();
    // El mirador es una ventana de suelo a techo en toda la cara: no cabe nada
    const mirador = cara('salon', 'pared:mirador-frente');
    expect(problemaEnPared({ cara: mirador, u: mirador.largo / 2, y: 1.5, ancho: 0.4, alto: 0.3 })).toBe('hueco');
  });

  it('no se puede salir de la cara ni del techo', () => {
    const norte = cara('salon', 'pared:fachada-norte', 2, 0.23);
    expect(problemaEnPared({ cara: norte, u: 0.1, y: 1.5, ancho: 0.4, alto: 0.3 })).toBe('fuera');
    expect(problemaEnPared({ cara: norte, u: 1, y: 2.4, ancho: 0.4, alto: 0.3 })).toBe('fuera');
    expect(problemaEnPared({ cara: norte, u: 1, y: 2.35, ancho: 0.4, alto: 0.3 })).toBeNull();
  });

  it('el objeto queda pegado a la pared, mirando a la estancia', () => {
    const norte = cara('salon', 'pared:fachada-norte', 2, 0.23);
    const p = puntoEnPared(norte, 1, 1.5, 0.3, 0.03);
    expect(p.z).toBeCloseTo(0.23 + norte.adelanto + 0.003 + 0.015, 6);
    expect(p.y).toBeCloseTo(1.35, 6);
    // Frente (+Z del modelo) hacia +z (hacia dentro del salón)
    expect(Math.sin(p.giro)).toBeCloseTo(0, 6);
    expect(Math.cos(p.giro)).toBeCloseTo(1, 6);
  });

  it('un rayo que mira a una pared la encuentra por delante, no por detrás', () => {
    const r = caraEnRayo(caras, { x: 3, y: 1.5, z: 2 }, { x: 0, y: 0, z: -1 });
    expect(r?.cara.elemento).toBe('pared:fachada-norte');
    expect(r?.cara.estancia).toBe('salon');
    expect(r?.y).toBeCloseTo(1.5, 6);
    // Desde fuera de la casa, mirando a la fachada por detrás: no cuenta
    const fuera = caraEnRayo(caras, { x: 3, y: 1.5, z: -2 }, { x: 0, y: 0, z: 1 }, (c) => c.estancia !== 'salon');
    expect(fuera?.cara.estancia ?? null).not.toBe('salon');
  });
});

describe('objetos de pared', () => {
  it('se cuelgan en la pared más cercana y se arrastran a lo largo sin tapar la puerta', async () => {
    const c = await gestor.agregarEnParedCerca(item('cuadro'), 5.5, 2.3, 'salon');
    expect(c?.colocacion).toBe('pared');
    expect(c?.pared?.cara.elemento).toBe('pared:salon-este');
    expect(c!.pared!.y).toBe(1.5);
    // Arrastrarlo encima de la puerta: se queda al lado (fuera del tapajuntas)
    const este = c!.pared!.cara;
    gestor.colgar(c!, este, uDe(este, 5.93, 2.285));
    const z = c!.raiz.position.z;
    expect(z + 0.2 <= 1.88 - 0.07 + 1e-6 || z - 0.2 >= 2.69 + 0.07 - 1e-6).toBe(true);
    expect(c!.raiz.position.x).toBeLessThan(5.93);
  });

  it('dos objetos de pared no se solapan, y uno en otra pared no estorba', async () => {
    const norte = cara('salon', 'pared:fachada-norte', 2, 0.23);
    const a = await gestor.agregarEnPared(item('espejo'), norte, 1.5);
    const b = await gestor.agregarEnPared(item('cuadro'), norte, 1.5);
    expect(a && b).toBeTruthy();
    expect(Math.abs(a!.pared!.u - b!.pared!.u)).toBeGreaterThanOrEqual((0.6 + 0.4) / 2 - 1e-6);
    // Mover el cuadro encima del espejo: se queda pegado a él, sin solaparse
    gestor.colgar(b!, norte, a!.pared!.u);
    expect(Math.abs(a!.pared!.u - b!.pared!.u)).toBeGreaterThanOrEqual(0.5 - 1e-6);
    // Más arriba que el espejo (que llega a 1,90 m) sí puede ir en su misma vertical
    expect(gestor.ponerAltura(b!, 2.2)).toBe(true);
    expect(gestor.colgar(b!, norte, a!.pared!.u)).toBe(true);
    expect(b!.pared!.u).toBeCloseTo(a!.pared!.u, 6);
  });

  it('la altura se ajusta, sin salir del techo ni pisar otro objeto o un hueco', async () => {
    const este = cara('salon', 'pared:salon-este');
    const c = await gestor.agregarEnPared(item('cuadro'), este, uDe(este, 5.93, 1.3));
    expect(gestor.ponerAltura(c!, 1.8)).toBe(true);
    expect(c!.pared!.y).toBe(1.8);
    expect(c!.raiz.position.y).toBeCloseTo(1.65, 6);
    // Por encima del techo se queda en el máximo
    gestor.ponerAltura(c!, 5);
    expect(c!.pared!.y).toBeCloseTo(2.5 - 0.15, 6);
    // Otro cuadro justo debajo: no se puede bajar el primero encima
    const d = await gestor.agregarEnPared(item('cuadro'), este, c!.pared!.u, 1.2);
    expect(d?.pared?.u).toBeCloseTo(c!.pared!.u, 6);
    expect(gestor.ponerAltura(c!, 1.3)).toBe(false);
    expect(c!.pared!.y).toBeCloseTo(2.35, 6);
  });

  it('no son obstáculo para los muebles del suelo, ni los muebles para ellos', async () => {
    const norte = cara('salon', 'pared:fachada-norte', 2, 0.23);
    await gestor.agregarEnPared(item('espejo'), norte, 1.5);
    expect(gestor.obstaculos()).toHaveLength(0);
    const armario = await gestor.agregar(item('armario'), 1.5, 0.6);
    expect(armario!.raiz.position.distanceTo(new THREE.Vector3(1.5, 0, 0.6))).toBeLessThan(1e-9);
  });

  it('no se giran', async () => {
    const c = await gestor.agregarEnParedCerca(item('cuadro'), 3, 0.5, 'salon');
    const antes = c!.rotacion;
    expect(gestor.rotar(c!, antes + 90)).toBe(false);
    expect(c!.rotacion).toBe(antes);
  });
});

describe('objetos apoyados sobre muebles', () => {
  async function mesaEnSalon() {
    return (await gestor.agregar(item('mesa'), 3, 1.7, 0))!;
  }

  it('se apoyan a la altura de la tapa, dentro de ella y sin solaparse', async () => {
    const mesa = await mesaEnSalon();
    const j1 = (await gestor.agregarSobre(item('jarron'), mesa, 0.75, 3, 1.7))!;
    expect(j1.colocacion).toBe('superficie');
    expect(j1.raiz.position.y).toBe(0.75);
    const j2 = (await gestor.agregarSobre(item('jarron'), mesa, 0.75, 3, 1.7))!;
    expect(j2.raiz.position.distanceTo(j1.raiz.position)).toBeGreaterThanOrEqual(0.14 - 1e-6);
    // Arrastrar uno fuera de la mesa: se queda en el borde
    gestor.apoyar(j2, mesa, 0.75, 10, 1.7);
    expect(j2.raiz.position.x).toBeCloseTo(3 + 0.6 - 0.07, 6);
    // Ni las patas ni nada del suelo cuentan: los apoyados no son obstáculo
    expect(gestor.obstaculos(mesa)).toHaveLength(0);
  });

  it('cuando la mesa está llena, no cabe más', async () => {
    const mesa = await mesaEnSalon();
    let n = 0;
    while (n < 100 && await gestor.agregarSobre(item('planta'), mesa, 0.75, 3, 1.7)) n++;
    // En 1,20 × 0,80 caben como mucho 4 × 2 macetas de 30 cm (se colocan cerca del centro, sin buscar el mejor reparto)
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(8);
    const plantas = gestor.apoyadosEn(mesa);
    for (const p of plantas) {
      expect(Math.abs(p.apoyo!.x) + 0.15).toBeLessThanOrEqual(0.6 + 1e-6);
      expect(Math.abs(p.apoyo!.z) + 0.15).toBeLessThanOrEqual(0.4 + 1e-6);
      for (const q of plantas) if (p !== q) expect(Math.max(Math.abs(p.apoyo!.x - q.apoyo!.x), Math.abs(p.apoyo!.z - q.apoyo!.z))).toBeGreaterThanOrEqual(0.3 - 0.002);
    }
    expect(await gestor.agregarSobre(item('planta'), mesa, 0.75, 3, 1.7)).toBeNull();
  });

  it('se mueven y giran con el mueble', async () => {
    const mesa = await mesaEnSalon();
    const j = (await gestor.agregarSobre(item('jarron'), mesa, 0.75, 3.4, 1.7))!;
    gestor.mover(mesa, 2.5, 1.5);
    expect(j.raiz.position.x).toBeCloseTo(mesa.raiz.position.x + 0.4, 6);
    expect(j.raiz.position.z).toBeCloseTo(mesa.raiz.position.z, 6);
    expect(gestor.rotar(mesa, 90)).toBe(true);
    // Girada 90° (antihorario visto desde arriba): +x local apunta a -z del mundo
    expect(j.raiz.position.x).toBeCloseTo(mesa.raiz.position.x, 6);
    expect(j.raiz.position.z).toBeCloseTo(mesa.raiz.position.z - 0.4, 6);
    expect(j.rotacion).toBe(90);
    expect(j.raiz.position.y).toBe(0.75);
  });

  it('al borrar el mueble, lo que tenía encima pasa a otro mueble cercano o al suelo', async () => {
    const mesa = await mesaEnSalon();
    const otra = (await gestor.agregar(item('mesa'), 3, 1.7 + 1.0, 0))!;
    const j = (await gestor.agregarSobre(item('jarron'), mesa, 0.75, 3, 1.7))!;
    gestor.borrar(mesa);
    expect(j.colocacion).toBe('superficie');
    expect(j.apoyo?.soporte).toBe(otra);
    gestor.borrar(otra);
    expect(j.colocacion).toBe('suelo');
    expect(j.raiz.position.y).toBe(0);
    expect(gestor.objetos).toContain(j);
    // Ahora en el suelo sí es obstáculo
    expect(gestor.obstaculos()).toHaveLength(1);
  });

  it('baldas: cada objeto va a una balda donde quepa en altura', async () => {
    const estanteria: ItemCatalogo = {
      ...item('mesa'), id: 'estanteria', nombre: 'Estantería', superficies: [0.3, 0.7, 1.2],
      dimensiones: { ancho: 0.8, fondo: 0.35, alto: 1.2 },
    };
    const e = (await gestor.agregar(estanteria, 3, 1.7))!;
    // Planta de 45 cm: no cabe entre 0,30 y 0,70; sí entre 0,70 y 1,20 y arriba
    expect(gestor.sitioEnSoporte(item('planta'), e, 0.3, 0, 0, 0)).toBeNull();
    expect(gestor.sitioEnSoporte(item('planta'), e, 0.7, 0, 0, 0)).not.toBeNull();
    expect(gestor.sitioEnSoporte(item('jarron'), e, 0.3, 0, 0, 0)).not.toBeNull();
    // Una altura que no es una balda no vale
    expect(gestor.sitioEnSoporte(item('jarron'), e, 0.5, 0, 0, 0)).toBeNull();
    // buscarApoyo prueba de arriba abajo
    expect(gestor.buscarApoyo(item('planta'), 3, 1.7)?.nivel).toBe(1.2);
  });

  it('un objeto de superficie sin mueble va al suelo, y se puede subir a un mueble', async () => {
    const planta = (await gestor.agregarSegunTipo(item('planta'), 3, 1.7, 'salon'))!;
    expect(planta.colocacion).toBe('suelo');
    const mesa = (await gestor.agregar(item('mesa'), 3, 1.7))!;
    expect(mesa.raiz.position.distanceTo(planta.raiz.position)).toBeGreaterThan(0.3); // no se solapan en el suelo
    expect(gestor.apoyar(planta, mesa, 0.75, mesa.raiz.position.x, mesa.raiz.position.z)).toBe(true);
    expect(planta.raiz.position.y).toBe(0.75);
    expect(gestor.bajarAlSuelo(planta, 1.5, 1.5)).toBe(true);
    expect(planta.colocacion).toBe('suelo');
  });
});

describe('duplicar', () => {
  it('duplica en el suelo, en la misma pared y en el mismo mueble, sin solapes', async () => {
    const mesa = (await gestor.agregar(item('mesa'), 3, 1.7))!;
    const m2 = (await gestor.duplicar(mesa))!;
    expect(m2.item.id).toBe('mesa');
    expect(gestor.obstaculos(m2).length).toBe(1);
    expect(espacio.esValida(gestor.huella(m2), false, gestor.obstaculos(m2))).toBe(true);
    const j = (await gestor.agregarSobre(item('jarron'), mesa, 0.75, 3, 1.7))!;
    const j2 = (await gestor.duplicar(j))!;
    expect(j2.apoyo?.soporte).toBe(mesa);
    const c = (await gestor.agregarEnParedCerca(item('cuadro'), 3, 0.5, 'salon'))!;
    const c2 = (await gestor.duplicar(c))!;
    expect(c2.pared?.cara).toBe(c.pared?.cara);
    expect(Math.abs(c2.pared!.u - c.pared!.u)).toBeGreaterThanOrEqual(0.4 - 1e-6);
    expect(gestor.objetos).toHaveLength(6);
  });
});

describe('escena v5', () => {
  const estadoDe = (g: GestorObjetos) => ({
    objetos: g,
    suelos: { cambios: () => ({}) },
    paredes: { cambios: () => ({}) },
    ajustes: { leer: () => AJUSTES_POR_DEFECTO, aplicar: () => {} },
  }) as unknown as EstadoEscena;

  it('guarda colocación, pared, altura y soporte, y al cargar todo vuelve a su sitio', async () => {
    const mesa = (await gestor.agregar(item('mesa'), 3, 1.7, 30))!;
    const j = (await gestor.agregarSobre(item('jarron'), mesa, 0.75, 3.3, 1.8))!;
    const c = (await gestor.agregarEnParedCerca(item('cuadro'), 5.5, 1, 'salon'))!;
    gestor.ponerAltura(c, 1.7);
    const guardada = serializar(estadoDe(gestor));
    expect(guardada.version).toBe(5);
    const [gm, gj, gc] = guardada.objetos;
    expect(gm).toMatchObject({ catalogo: 'mesa', colocacion: 'suelo' });
    expect(gj).toMatchObject({ catalogo: 'jarron', colocacion: 'superficie', soporte: 0, nivel: 0.75 });
    expect(gc).toMatchObject({ catalogo: 'cuadro', colocacion: 'pared', pared: 'pared:salon-este', estancia: 'salon', altura: 1.7 });

    const otro = new GestorObjetos(new THREE.Scene(), espacio, caras);
    const omitidos = await colocarObjetos(otro, migrar(JSON.parse(JSON.stringify(guardada)), { x: 0, z: 0 }).objetos, catalogo);
    expect(omitidos).toEqual([]);
    const por = (id: string) => otro.objetos.find((o) => o.item.id === id)!;
    const cerca = (a: ObjetoColocado, b: ObjetoColocado) => a.raiz.position.distanceTo(b.raiz.position);
    expect(cerca(por('mesa'), mesa)).toBeLessThan(0.002);
    expect(cerca(por('jarron'), j)).toBeLessThan(0.002);
    expect(por('jarron').apoyo?.soporte).toBe(por('mesa'));
    expect(cerca(por('cuadro'), c)).toBeLessThan(0.002);
    expect(por('cuadro').pared?.y).toBe(1.7);
    expect(por('jarron').rotacion).toBeCloseTo(j.rotacion, 1);
    // Guardar lo cargado da exactamente el mismo archivo (mismo orden, mismas posiciones)
    expect(serializar(estadoDe(otro)).objetos).toEqual(guardada.objetos);
  });

  it('una escena v4 pasa a v5 con todos los objetos en el suelo', () => {
    const v4: EscenaGuardada = { version: 4, objetos: [{ catalogo: 'mesa', posicion: { x: 3, y: 0, z: 1.6 }, rotacion: 0 }] };
    const v5 = migrar(v4, { x: 0, z: 0 });
    expect(v5.version).toBe(5);
    expect(v5.objetos[0].colocacion).toBe('suelo');
    expect(migrar({ version: 1, objetos: [{ catalogo: 'mesa', posicion: { x: 0, y: 0, z: 0 }, rotacion: 0 }] } as EscenaGuardada, { x: 3, z: 1.6 }).objetos[0])
      .toMatchObject({ posicion: { x: 3, z: 1.6 }, colocacion: 'suelo' });
  });

  it('un cuadro guardado como objeto de suelo (escena antigua) se cuelga en la pared más cercana', async () => {
    const omitidos = await colocarObjetos(gestor, [{ catalogo: 'cuadro', posicion: { x: 3, y: 0, z: 0.5 }, rotacion: 0, colocacion: 'suelo' }], catalogo);
    expect(omitidos).toEqual([]);
    expect(gestor.objetos[0].colocacion).toBe('pared');
  });

  it('un objeto apoyado cuyo mueble no está se queda en el suelo o en otro mueble', async () => {
    const omitidos = await colocarObjetos(gestor, [
      { catalogo: 'jarron', posicion: { x: 3, y: 0.75, z: 1.7 }, rotacion: 0, colocacion: 'superficie', soporte: 7, nivel: 0.75 },
    ], catalogo);
    expect(omitidos).toEqual([]);
    expect(gestor.objetos[0].colocacion).toBe('suelo');
  });
});

describe('deshacer y rehacer', () => {
  it('recuerda al menos 50 pasos, en orden, y rehacer vuelve a ellos', async () => {
    let valor = 0;
    const h = new Historial(() => String(valor), async (f) => { valor = Number(f); }, 0);
    h.iniciar();
    for (let i = 1; i <= 60; i++) { valor = i; h.apuntar(); }
    expect(PASOS_HISTORIAL).toBeGreaterThanOrEqual(50);
    for (let i = 59; i >= 10; i--) {
      expect(await h.deshacer()).toBe(true);
      expect(valor).toBe(i);
    }
    expect(await h.rehacer()).toBe(true);
    expect(valor).toBe(11);
    // Un cambio nuevo borra lo que se podía rehacer
    valor = 100; h.apuntar();
    expect(h.puedeRehacer()).toBe(false);
    expect(await h.deshacer()).toBe(true);
    expect(valor).toBe(11);
  });

  it('los cambios muy seguidos se juntan en un paso', async () => {
    vi.useFakeTimers();
    let valor = 'a';
    const h = new Historial(() => valor, async (f) => { valor = f; }, 250);
    h.iniciar();
    for (const v of ['b', 'c', 'd']) { valor = v; h.cambio(); vi.advanceTimersByTime(50); }
    vi.advanceTimersByTime(300);
    expect(h.pasosAtras()).toBe(1);
    await h.deshacer();
    expect(valor).toBe('a');
    vi.useRealTimers();
  });

  it('deshace y rehace añadir, mover, girar, borrar, colgar y apoyar', async () => {
    const estado = {
      objetos: gestor, suelos: { cambios: () => ({}) }, paredes: { cambios: () => ({}) },
      ajustes: { leer: () => AJUSTES_POR_DEFECTO, aplicar: () => {} },
    } as unknown as EstadoEscena;
    const foto = () => JSON.stringify(serializar(estado).objetos);
    const h = new Historial(foto, async (f) => {
      gestor.vaciar();
      await colocarObjetos(gestor, JSON.parse(f), catalogo);
    }, 0);
    h.iniciar();
    const pasos: string[] = [foto()];
    const mesa = (await gestor.agregar(item('mesa'), 3, 1.7))!; h.apuntar(); pasos.push(foto());
    gestor.mover(mesa, 2.5, 1.5); h.apuntar(); pasos.push(foto());
    gestor.rotar(mesa, 45); h.apuntar(); pasos.push(foto());
    await gestor.agregarSobre(item('jarron'), mesa, 0.75, 2.5, 1.5); h.apuntar(); pasos.push(foto());
    await gestor.agregarEnParedCerca(item('cuadro'), 3, 0.5, 'salon'); h.apuntar(); pasos.push(foto());
    gestor.borrar(gestor.objetos[0]); h.apuntar(); pasos.push(foto());
    for (let i = pasos.length - 2; i >= 0; i--) {
      await h.deshacer();
      expect(foto(), `deshacer hasta el paso ${i}`).toBe(pasos[i]);
    }
    for (let i = 1; i < pasos.length; i++) {
      await h.rehacer();
      expect(JSON.parse(foto()).length, `rehacer el paso ${i}`).toBe(JSON.parse(pasos[i]).length);
    }
    expect(foto()).toBe(pasos[pasos.length - 1]);
  });
});
