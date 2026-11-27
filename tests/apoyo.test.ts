// Regla de apoyo: cada tapa o balda de un mueble tiene tamaño (ancho × fondo,
// con su desplazamiento) y altura libre, y un objeto solo se apoya en ella si
// su huella (con su giro) cabe y su alto no pasa de la altura libre. Formato
// antiguo (número) y nuevo (objeto), coffee corner y librería, migración de
// escenas con apoyos que ya no caben e interacción con las capas.

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
import {
  leerCatalogo, medioGirado, motivoNoCabe, superficiesDe, validarFicha, zonaEn, zonasDe, type FichaObjeto, type ItemCatalogo,
} from '../src/catalogo/catalogo';
import { ID_BASE } from '../src/escena/capas';
import { GestorObjetos, textoNoApoyo, type ObjetoColocado } from '../src/escena/objetos';
import { AJUSTES_POR_DEFECTO, aplicar, serializar, type EscenaGuardada, type EstadoEscena } from '../src/escena/persistencia';
import { carasColgables } from '../src/vivienda/colgar';
import { EspacioLibre } from '../src/vivienda/espacio';
import type { Vivienda } from '../src/vivienda/modelo';

const vivienda = datos as Vivienda;
const espacio = new EspacioLibre(vivienda);
const caras = carasColgables(vivienda);
const catalogo = leerCatalogo();
const item = (id: string) => catalogo.find((i) => i.id === id)!;
/** Un objeto de superficie de prueba con las medidas dadas (m). */
const caja = (ancho: number, fondo: number, alto: number, nombre = 'Caja'): ItemCatalogo =>
  ({ ...item('jarron'), id: `caja-${ancho}-${fondo}-${alto}`, nombre, dimensiones: { ancho, fondo, alto } });
const cafe = () => item('cocina/coffee-corner');
const libreria = () => item('almacenaje/libreria');

const estadoDe = (g: GestorObjetos) => ({
  objetos: g,
  suelos: { cambios: () => ({}), restaurar: () => 0 },
  paredes: { cambios: () => ({}), restaurar: () => 0 },
  ajustes: { leer: () => AJUSTES_POR_DEFECTO, aplicar: () => {} },
}) as unknown as EstadoEscena;

let gestor: GestorObjetos;
beforeEach(() => {
  gestor = new GestorObjetos(new THREE.Scene(), espacio, caras);
  gestor.capas.ponerBloqueada(ID_BASE, false);
});

// ---------------------------------------------------------------------------------------
describe('formato de "superficies"', () => {
  const base: FichaObjeto = { nombre: 'Estantería', categoria: 'x', glb: 'x.glb', dimensiones: { ancho: 0.8, fondo: 0.4, alto: 1.2 } };

  it('formato antiguo (números): planta completa y altura libre hasta la siguiente; la de arriba, sin límite', () => {
    const z = zonasDe({ ...base, superficies: [0.7, 0.3, 1.2] });
    expect(z.map((s) => s.altura)).toEqual([0.3, 0.7, 1.2]);
    for (const s of z) expect([s.ancho, s.fondo, s.x, s.z]).toEqual([0.8, 0.4, 0, 0]);
    expect(z[0].alturaLibre).toBeCloseTo(0.4);
    expect(z[1].alturaLibre).toBeCloseTo(0.5);
    expect(z[2].alturaLibre).toBe(Infinity);
    // Sin "superficies": el borde de arriba, entero
    expect(zonasDe(base)).toEqual([{ altura: 1.2, ancho: 0.8, fondo: 0.4, x: 0, z: 0, alturaLibre: Infinity }]);
    expect(zonasDe({ ...base, superficies: [] })).toEqual([]);
    expect(zonasDe({ ...base, colocacion: 'superficie' })).toEqual([]);
  });

  it('formato nuevo (objeto) con sus valores por defecto, y mezclado con números', () => {
    const z = zonasDe({ ...base, superficies: [{ altura: 0.3, ancho: 0.5, fondo: 0.2, desplazamientoX: 0.1, desplazamientoZ: -0.1, alturaLibre: 0.25 }, { altura: 0.7 }, 1.2] });
    expect(z[0]).toEqual({ altura: 0.3, ancho: 0.5, fondo: 0.2, x: 0.1, z: -0.1, alturaLibre: 0.25 });
    expect(z[1]).toMatchObject({ ancho: 0.8, fondo: 0.4, x: 0, z: 0 });
    expect(z[1].alturaLibre).toBeCloseTo(0.5); // por defecto, hasta la siguiente
    expect(z[2].alturaLibre).toBe(Infinity);
    expect(superficiesDe({ ...base, superficies: [{ altura: 0.7 }, 0.3] })).toEqual([0.3, 0.7]);
    expect(zonaEn({ ...base, superficies: [{ altura: 0.7 }, 0.3] }, 0.7)?.altura).toBe(0.7);
    expect(zonaEn({ ...base, superficies: [0.3] }, 0.5)).toBeUndefined();
  });

  it('validación: formato, que no se salga de la planta, valores positivos y sin alturas repetidas', () => {
    const v = (superficies: unknown) => validarFicha({ ...base, superficies: superficies as FichaObjeto['superficies'] });
    expect(v([0.3, { altura: 0.7, ancho: 0.8, fondo: 0.4, alturaLibre: 0.4 }, 1.2])).toBeNull();
    expect(v([{ altura: 1.2, ancho: 0.4, fondo: 0.1, desplazamientoZ: -0.15 }])).toBeNull();
    expect(v([{ altura: 1.5 }])).toMatch(/superficies/);
    expect(v([{ ancho: 0.4 }])).toMatch(/superficies/);
    expect(v(['0.3'])).toMatch(/superficies/);
    expect(v([{ altura: 0.5, ancho: 0.9 }])).toMatch(/se sale/);
    expect(v([{ altura: 0.5, ancho: 0.4, desplazamientoX: 0.3 }])).toMatch(/se sale/);
    expect(v([{ altura: 0.5, fondo: 0.1, desplazamientoZ: -0.2 }])).toMatch(/se sale/);
    expect(v([{ altura: 0.5, alturaLibre: 0 }])).toMatch(/mayores que 0/);
    expect(v([{ altura: 0.5, ancho: -1 }])).toMatch(/mayores que 0/);
    expect(v([{ altura: 0.5, desplazamientoX: 'a' }])).toMatch(/números/);
    expect(v([{ altura: 0.5, alto: 0.3 }])).toMatch(/desconocido "alto"/);
    expect(v([0.5, { altura: 0.5 }])).toMatch(/misma altura/);
  });

  it('todas las fichas del catálogo son válidas y todos los muebles soporte tienen sus superficies en formato objeto (estimadas)', () => {
    const soportes = catalogo.filter((i) => superficiesDe(i).length > 0);
    expect(soportes.map((i) => i.id).sort()).toEqual([
      'almacenaje/libreria', 'almacenaje/mueble-tv', 'almacenaje/zapatero', 'armario', 'cocina/coffee-corner',
      'dormitorio/comoda-alta', 'dormitorio/mesita-noche', 'dormitorio/puf', 'exterior/mesa-balcon', 'mesa',
      'mesas/mesa-centro', 'mesas/mesa-comedor-cristal', 'mesas/mesita-alambre', 'mesas/mesita-bandeja', 'tendedero/lavadora',
    ]);
    for (const i of soportes) {
      expect(validarFicha(i), i.id).toBeNull();
      expect(i.superficies, i.id).toBeDefined();
      for (const s of i.superficies!) {
        expect(typeof s, i.id).toBe('object');
        expect(s, i.id).toHaveProperty('ancho');
        expect(s, i.id).toHaveProperty('fondo');
      }
    }
  });
});

// ---------------------------------------------------------------------------------------
describe('la regla de apoyo (motivoNoCabe)', () => {
  const balda = { altura: 0.4, ancho: 0.43, fondo: 0.12, x: 0, z: 0, alturaLibre: 0.3 };

  it('cabe, no cabe por tamaño y no cabe por altura (el límite exacto, sí)', () => {
    expect(motivoNoCabe({ ancho: 0.1, fondo: 0.1, alto: 0.2 }, 0, balda)).toBeNull();
    expect(motivoNoCabe({ ancho: 0.43, fondo: 0.12, alto: 0.3 }, 0, balda)).toBeNull();
    expect(motivoNoCabe({ ancho: 0.44, fondo: 0.1, alto: 0.2 }, 0, balda)).toBe('grande');
    expect(motivoNoCabe({ ancho: 0.1, fondo: 0.13, alto: 0.2 }, 0, balda)).toBe('grande');
    expect(motivoNoCabe({ ancho: 0.1, fondo: 0.1, alto: 0.31 }, 0, balda)).toBe('alto');
    // Si no cabe ni de tamaño ni de alto, se dice primero el tamaño
    expect(motivoNoCabe({ ancho: 0.5, fondo: 0.5, alto: 0.5 }, 0, balda)).toBe('grande');
    expect(motivoNoCabe({ ancho: 0.1, fondo: 0.1, alto: 9 }, 0, { ...balda, alturaLibre: Infinity })).toBeNull();
  });

  it('con giro: 40 × 10 cabe recto en una balda de 43 × 12, pero no girado 90° ni 45°', () => {
    const tabla = { ancho: 0.4, fondo: 0.1, alto: 0.05 };
    expect(motivoNoCabe(tabla, 0, balda)).toBeNull();
    expect(motivoNoCabe(tabla, 180, balda)).toBeNull();
    expect(motivoNoCabe(tabla, 90, balda)).toBe('grande');
    expect(motivoNoCabe(tabla, 270, balda)).toBe('grande');
    expect(motivoNoCabe(tabla, 45, balda)).toBe('grande');
    // Y al revés: 10 × 40 solo cabe girado 90°
    expect(motivoNoCabe({ ancho: 0.1, fondo: 0.4, alto: 0.05 }, 0, balda)).toBe('grande');
    expect(motivoNoCabe({ ancho: 0.1, fondo: 0.4, alto: 0.05 }, 90, balda)).toBeNull();
    const m = medioGirado({ ancho: 0.24, fondo: 0.28 }, 45);
    expect(2 * m.x).toBeCloseTo((0.24 + 0.28) / Math.SQRT2);
  });
});

// ---------------------------------------------------------------------------------------
describe('coffee corner', () => {
  const poner = async () => (await gestor.agregar(cafe(), 3, 1.7))!;

  it('superficies estimadas: baldas de 40 × 30 con 25 y 30 cm libres, encimera de 48 × 33 y estante de 43 × 12 al fondo', () => {
    const z = zonasDe(cafe());
    expect(z.map((s) => [s.altura, s.ancho, s.fondo, s.alturaLibre])).toEqual([
      [0.1, 0.4, 0.3, 0.25], [0.366, 0.4, 0.3, 0.3], [0.795, 0.48, 0.33, 0.53], [1.345, 0.43, 0.12, Infinity],
    ]);
    // El estante va pegado al fondo del mueble (33 cm): de -16,5 a -4,5 cm
    expect(z[3].z - z[3].fondo / 2).toBeCloseTo(-0.165);
    expect(z[3].z + z[3].fondo / 2).toBeCloseTo(-0.045);
  });

  it('balda del medio: hasta 30 cm de alto (antes dejaba 43 cm, hasta la encimera)', async () => {
    const c = await poner();
    expect(gestor.sitioEnSoporte(caja(0.2, 0.2, 0.3), c, 0.366, 0, 0, 0)).not.toBeNull();
    expect(gestor.sitioEnSoporte(caja(0.2, 0.2, 0.31), c, 0.366, 0, 0, 0)).toBeNull();
    expect(gestor.sitioEnSoporte(caja(0.2, 0.2, 0.42), c, 0.366, 0, 0, 0)).toBeNull();
    expect(gestor.sitioEnSoporte(item('electronica/television'), c, 0.366, 0, 0, 0)).toBeNull();
    // La de abajo, 25 cm; el jarrón (25 cm) cabe justo
    expect(gestor.sitioEnSoporte(item('jarron'), c, 0.1, 0, 0, 0)).not.toBeNull();
    expect(gestor.sitioEnSoporte(caja(0.2, 0.2, 0.26), c, 0.1, 0, 0, 0)).toBeNull();
  });

  it('estante de arriba (12 cm de fondo): el jarrón de 14 × 14 no cabe; uno de 10 × 10 sí, y siempre al fondo', async () => {
    const c = await poner();
    expect(gestor.sitioEnSoporte(item('jarron'), c, 1.345, 0, 0, 0)).toBeNull();
    expect(gestor.sitioEnSoporte(item('decoracion/planta-pequena'), c, 1.345, 0, 0, 0)).toBeNull();
    const s = gestor.sitioEnSoporte(caja(0.1, 0.1, 0.2), c, 1.345, 0, 0.2, 0)!;
    expect(s).not.toBeNull();
    expect(s.z).toBeCloseTo(-0.095); // pedido delante (z 0,2): se queda en el estante, lo más adelante posible
    expect(s.z + 0.05).toBeLessThanOrEqual(-0.045 + 1e-9);
    // Con giro: una tabla de 40 × 10 cabe recta, no girada 90°
    expect(gestor.sitioEnSoporte(caja(0.4, 0.1, 0.05), c, 1.345, 0, 0, 0)).not.toBeNull();
    expect(gestor.sitioEnSoporte(caja(0.4, 0.1, 0.05), c, 1.345, 0, 0, 90)).toBeNull();
    expect(gestor.sitioEnSoporte(caja(0.1, 0.4, 0.05), c, 1.345, 0, 0, 90)).not.toBeNull();
  });

  it('el mueble girado: el giro que cuenta es el del objeto respecto al mueble', async () => {
    const c = await poner();
    gestor.rotar(c, 90);
    const tabla = caja(0.4, 0.1, 0.05);
    const [x, z] = gestor.aMundo(c, 0, -0.1);
    // En el mundo, girada 90° igual que el mueble: recta respecto a él, cabe
    expect(await gestor.agregarSobre(tabla, c, 1.345, x, z, 90)).not.toBeNull();
    // Girada 0° en el mundo (90° respecto al mueble): no cabe en el estante
    expect(await gestor.agregarSobre(tabla, c, 1.345, x, z, 0)).toBeNull();
  });

  it('por qué no se puede apoyar: demasiado alto, demasiado grande o sin sitio libre', async () => {
    const c = await poner();
    expect(gestor.motivoNoApoyo(item('planta'), c, 0)).toBeNull(); // la planta (45 cm) cabe en la encimera
    expect(gestor.motivoNoApoyo(caja(0.2, 0.2, 0.6), c, 0)).toBe('alto');
    expect(gestor.motivoNoApoyo(caja(0.5, 0.2, 0.1), c, 0)).toBe('grande');
    expect(gestor.motivoNoApoyo(caja(0.2, 0.5, 0.1), c, 90)).toBe('grande');
    expect(gestor.motivoNoApoyo(caja(0.2, 0.5, 0.1), c, 0)).toBe('grande');
    // 33 × 48 no cabe recto, pero girado 90° sí (en la encimera)
    expect(gestor.motivoNoApoyo(caja(0.33, 0.48, 0.1), c, 0)).toBe('grande');
    expect(gestor.motivoNoApoyo(caja(0.33, 0.48, 0.1), c, 90)).toBeNull();
    const alto = textoNoApoyo(caja(0.2, 0.2, 0.6, 'Cafetera'), cafe(), 'alto', 0);
    expect(alto).toContain('demasiado alto');
    expect(alto).toContain('60 cm');
    expect(alto).toContain('53 cm libres');
    const grande = textoNoApoyo(caja(0.5, 0.2, 0.1, 'Bandeja'), cafe(), 'grande', 0);
    expect(grande).toContain('demasiado grande');
    expect(grande).toContain('50 cm × 20 cm');
    expect(grande).toContain('48 cm × 33 cm');
    // Encimera y baldas llenas: "lleno"
    const tapa = caja(0.48, 0.33, 0.2);
    expect(await gestor.agregarSobre(tapa, c, 0.795, 3, 1.7)).not.toBeNull();
    expect(await gestor.agregarSobre(caja(0.4, 0.3, 0.2), c, 0.366, 3, 1.7)).not.toBeNull();
    expect(await gestor.agregarSobre(caja(0.4, 0.3, 0.2), c, 0.1, 3, 1.7)).not.toBeNull();
    expect(gestor.motivoNoApoyo(caja(0.3, 0.3, 0.2), c, 0)).toBe('lleno');
    expect(textoNoApoyo(item('jarron'), cafe(), 'lleno', 0)).toContain('no queda sitio libre');
  });

  it('al añadir, cada objeto va a la superficie más alta donde cabe', async () => {
    const c = await poner();
    const nivel = async (it: ItemCatalogo) => {
      const o = await gestor.agregarSegunTipo(it, 3, 1.7, null);
      const n = o?.apoyo?.nivel;
      if (o) gestor.borrar(o);
      return n;
    };
    expect(await nivel(caja(0.1, 0.1, 0.2))).toBe(1.345); // cabe en el estante
    expect(await nivel(item('jarron'))).toBe(0.795); // 14 × 14: no cabe en el estante (12 cm)
    expect(await nivel(item('planta'))).toBe(0.795);
    expect(await nivel(caja(0.2, 0.2, 0.6))).toBeUndefined(); // 60 cm: no cabe en ninguna (va al suelo)
    expect(gestor.objetos).toEqual([c]);
  });

  it('si no cabe en ninguna superficie, va al suelo (el mueble le estorba como un mueble más)', async () => {
    const c = await poner();
    const grande = (await gestor.agregar(caja(0.5, 0.5, 0.6), 3.8, 1.7))!;
    expect(gestor.apoyar(grande, c, 0.795, 3, 1.7)).toBe(false);
    expect(gestor.apoyar(grande, c, 0.366, 3, 1.7)).toBe(false);
    // Arrastrado por el suelo hacia el mueble: se queda pegado a él, sin solaparlo
    gestor.mover(grande, 3, 1.7);
    expect(grande.colocacion).toBe('suelo');
    expect(gestor.solapes()).toEqual([]);
    expect(Math.abs(grande.raiz.position.x - c.raiz.position.x)).toBeGreaterThanOrEqual(0.49 - 0.002);
  });
});

// ---------------------------------------------------------------------------------------
describe('librería', () => {
  const poner = async () => (await gestor.agregar(libreria(), 3, 1.7))!;

  it('baldas con su hueco interior (77 × 34) y altura libre; la tapa, entera y sin límite', async () => {
    const l = await poner();
    const tele = item('electronica/television'); // 73 × 20 × 48
    expect(gestor.sitioEnSoporte(tele, l, 2, 0, 0, 0)).not.toBeNull();
    for (const n of [0.37, 0.66, 0.98, 1.36]) expect(gestor.sitioEnSoporte(tele, l, n, 0, 0, 0), String(n)).toBeNull();
    const lampara = item('iluminacion/lampara-sobremesa'); // 45 cm
    expect(gestor.sitioEnSoporte(lampara, l, 1.36, 0, 0, 0)).not.toBeNull(); // 47 cm libres
    expect(gestor.sitioEnSoporte(lampara, l, 0.98, 0, 0, 0)).toBeNull(); // 35 cm libres
    expect(gestor.sitioEnSoporte(item('jarron'), l, 0.37, 0, 0, 0)).not.toBeNull(); // 25 de 26 cm
    // Fondo: 35 cm no cabe en la balda (34) y sí encima (40); girado 90°, un objeto de 80 × 20 tampoco
    expect(gestor.sitioEnSoporte(caja(0.3, 0.35, 0.1), l, 0.66, 0, 0, 0)).toBeNull();
    expect(gestor.sitioEnSoporte(caja(0.3, 0.35, 0.1), l, 2, 0, 0, 0)).not.toBeNull();
    expect(gestor.sitioEnSoporte(caja(0.76, 0.2, 0.1), l, 0.66, 0, 0, 0)).not.toBeNull();
    expect(gestor.sitioEnSoporte(caja(0.78, 0.2, 0.1), l, 0.66, 0, 0, 0)).toBeNull();
    expect(gestor.sitioEnSoporte(caja(0.76, 0.2, 0.1), l, 0.66, 0, 0, 90)).toBeNull();
    // Desplazada hacia atrás: lo que se pide delante se queda dentro del hueco (de -19 a +15 cm)
    const s = gestor.sitioEnSoporte(caja(0.2, 0.2, 0.1), l, 0.66, 0, 0.3, 0)!;
    expect(s.z).toBeCloseTo(0.05);
  });

  it('al añadir, va a la superficie más alta donde cabe', async () => {
    await poner();
    expect((await gestor.agregarSegunTipo(item('electronica/television'), 3, 1.7, null))?.apoyo?.nivel).toBe(2);
    // Con la tele encima, uno de 50 × 39 ya no cabe arriba y en las baldas es demasiado grande (34 de fondo): al suelo
    const ancho = await gestor.agregarSegunTipo(caja(0.5, 0.39, 0.1), 3, 1.7, null);
    expect(ancho?.colocacion).toBe('suelo');
    expect(gestor.motivoNoApoyo(caja(0.5, 0.39, 0.1), gestor.objetos[0], 0)).toBe('lleno');
    // La tapa llena de un objeto de 90 × 40: lo siguiente, en la balda más alta donde quepa
    const l2 = (await gestor.agregar(libreria(), 4.5, 1.7))!;
    expect(await gestor.agregarSobre(caja(0.9, 0.4, 0.1), l2, 2, 4.5, 1.7)).not.toBeNull();
    const lamp = await gestor.agregarSobre(item('iluminacion/lampara-sobremesa'), l2, 1.36, 4.5, 1.7);
    expect(lamp?.apoyo?.nivel).toBe(1.36);
    expect(gestor.buscarApoyo(item('jarron'), 4.5, 1.7, 0, 0.1)?.nivel).toBe(1.36);
    expect(gestor.buscarApoyo(caja(0.2, 0.2, 0.4), 4.5, 1.7, 0, 0.1)?.nivel).toBe(1.36); // al lado de la lámpara
    expect(gestor.buscarApoyo(caja(0.3, 0.3, 0.4), 4.5, 1.7, 0, 0.1)).toBeNull(); // al lado no cabe, y más abajo es demasiado alto
    expect(gestor.buscarApoyo(caja(0.4, 0.3, 0.3), 4.5, 1.7, 0, 0.1)?.nivel).toBe(0.98);
  });
});

// ---------------------------------------------------------------------------------------
describe('migración de escenas con apoyos que ya no caben', () => {
  /** Una escena v6 (o v5) con un coffee corner, una librería y lo que se diga encima. */
  const escena = (version: 5 | 6, encima: object[]): EscenaGuardada => ({
    version,
    objetos: [
      { catalogo: 'cocina/coffee-corner', posicion: { x: 3, y: 0, z: 1.7 }, rotacion: 0, colocacion: 'suelo' },
      { catalogo: 'almacenaje/libreria', posicion: { x: 4.5, y: 0, z: 1.7 }, rotacion: 0, colocacion: 'suelo' },
      ...encima,
    ],
  } as EscenaGuardada);
  const sobre = (catalogo: string, soporte: number, nivel: number, x: number, z: number, rotacion = 0) =>
    ({ catalogo, posicion: { x, y: nivel, z }, rotacion, colocacion: 'superficie', soporte, nivel });

  it('la planta en la balda del medio (43 cm antes, 30 ahora) pasa a la encimera del mismo mueble y se anota', async () => {
    const r = await aplicar(estadoDe(gestor), escena(6, [
      sobre('planta', 0, 0.366, 3, 1.7),
      sobre('jarron', 0, 0.1, 3, 1.7), // este sí cabe (25 cm): no se mueve
    ]), catalogo, { x: 0, z: 0 });
    const planta = gestor.objetos.find((o) => o.item.id === 'planta')!;
    expect(planta.apoyo?.soporte.item.id).toBe('cocina/coffee-corner');
    expect(planta.apoyo?.nivel).toBe(0.795);
    expect(gestor.objetos.find((o) => o.item.id === 'jarron')!.apoyo?.nivel).toBe(0.1);
    expect(r.omitidos).toEqual([]);
    expect(r.movidos).toHaveLength(1);
    expect(r.movidos[0]).toMatch(/«Planta.*balda a 0,37 m de «Mueble cafetera \(coffee corner\)».*más alto que el hueco.*pasa a la balda a 0,8 m/);
    expect(gestor.apoyosInvalidos()).toEqual([]);
  });

  it('el jarrón en el estante de arriba (12 cm de fondo) baja a la encimera; uno que no existe la balda, a la más parecida', async () => {
    const r = await aplicar(estadoDe(gestor), escena(5, [
      sobre('jarron', 0, 1.345, 3, 1.6),
      sobre('jarron', 1, 1.5, 4.5, 1.7), // la librería no tiene balda a 1,50
    ]), catalogo, { x: 0, z: 0 });
    const [j1, j2] = gestor.objetos.filter((o) => o.item.id === 'jarron');
    expect(j1.apoyo?.nivel).toBe(0.795);
    expect(j2.apoyo?.soporte.item.id).toBe('almacenaje/libreria');
    expect(j2.apoyo?.nivel).toBe(1.36);
    expect(r.movidos).toHaveLength(2);
    expect(r.movidos[0]).toMatch(/más grande que la superficie/);
    expect(r.movidos[1]).toMatch(/ya no tiene esa balda/);
  });

  it('si no cabe en ningún otro sitio del mueble ni en otro mueble cercano, al suelo', async () => {
    // La librería y una caja de 60 cm de alto en su balda de abajo (antes: hasta la siguiente balda, 29 cm... ya no cabía; aquí, con giro 90° de 40 de fondo)
    const r = await aplicar(estadoDe(gestor), {
      version: 6,
      objetos: [
        { catalogo: 'almacenaje/libreria', posicion: { x: 3, y: 0, z: 1.7 }, rotacion: 0, colocacion: 'suelo' },
        sobre('electronica/television', 0, 0.98, 3, 1.7, 90),
      ],
    } as EscenaGuardada, catalogo, { x: 0, z: 0 });
    const tele = gestor.objetos.find((o) => o.item.id === 'electronica/television')!;
    // Girada 90° respecto a la librería mide 20 × 73: no cabe ni encima (40 de fondo)
    expect(tele.colocacion).toBe('suelo');
    expect(r.movidos[0]).toMatch(/pasa al suelo/);
    expect(gestor.solapes()).toEqual([]);
  });

  it('la escena inicial carga sin mover nada, y guardar y volver a cargar una escena migrada no mueve nada más', async () => {
    const r0 = await aplicar(estadoDe(gestor), structuredClone(datosEscenaInicial) as EscenaGuardada, catalogo, { x: 0, z: 0 });
    expect(r0.movidos).toEqual([]);
    expect(r0.omitidos).toEqual([]);
    expect(gestor.apoyosInvalidos()).toEqual([]);
    for (const o of gestor.objetos.filter((x) => x.colocacion === 'superficie')) expect(gestor.apoyoValido(o), o.item.id).toBe(true);
    await aplicar(estadoDe(gestor), escena(6, [sobre('planta', 0, 0.366, 3, 1.7)]), catalogo, { x: 0, z: 0 });
    const guardada = JSON.parse(JSON.stringify(serializar(estadoDe(gestor))));
    const otro = new GestorObjetos(new THREE.Scene(), espacio, caras);
    const r = await aplicar(estadoDe(otro), guardada, catalogo, { x: 0, z: 0 });
    expect(r.movidos).toEqual([]);
    expect(serializar(estadoDe(otro)).objetos).toEqual(guardada.objetos);
  });
});

// ---------------------------------------------------------------------------------------
describe('regla de apoyo y capas', () => {
  /** Variante del coffee corner con la encimera más baja (como si se corrigiera su ficha): 20 cm libres. */
  const cafeCorregido = (): ItemCatalogo => {
    const c = cafe();
    return { ...c, superficies: (c.superficies as { altura: number }[]).map((s) => (s.altura === 0.795 ? { ...s, alturaLibre: 0.2 } : s)) };
  };
  const pos = (o: ObjetoColocado) => [o.raiz.position.x, o.raiz.position.y, o.raiz.position.z, o.rotacion].map((n) => Math.round(n * 1000) / 1000);

  it('la regla vale igual con el mueble en otra capa; solo cuentan los soportes de capas visibles', async () => {
    const c = (await gestor.agregar(cafe(), 3, 1.7))!; // Base
    const c2 = gestor.capas.crear();
    const planta = (await gestor.agregar(item('planta'), 3.8, 1.7))!;
    expect(planta.capa).toBe(c2.id);
    expect(gestor.apoyar(planta, c, 0.366, 3, 1.7)).toBe(false); // 45 cm en 30 libres
    expect(gestor.apoyar(planta, c, 0.795, 3, 1.7)).toBe(true);
    gestor.bajarAlSuelo(planta, 3.8, 1.7);
    gestor.capas.ponerVisible(ID_BASE, false);
    gestor.actualizarCapas();
    expect(gestor.esSoporte(c)).toBe(false);
    expect(gestor.apoyar(planta, c, 0.795, 3, 1.7)).toBe(false);
    expect(gestor.buscarApoyo(item('planta'), 3, 1.7)).toBeNull();
  });

  it('mostrar, ocultar, pasar de capa y duplicar no mueven nada: el apoyo que no cumple la regla se marca en rojo y se avisa', async () => {
    const c = (await gestor.agregar(cafe(), 3, 1.7))!;
    const c2 = gestor.capas.crear();
    const planta = (await gestor.agregarSobre(item('planta'), c, 0.795, 3, 1.7))!;
    expect(planta.capa).toBe(c2.id);
    expect(gestor.apoyosInvalidos()).toEqual([]);
    // La ficha del mueble cambia (encimera con 20 cm libres): la planta deja de caber, pero no se mueve sola
    c.item = cafeCorregido();
    const antes = pos(planta);
    gestor.notificar(false);
    expect(gestor.apoyosInvalidos()).toEqual([planta]);
    const marca = () => planta.raiz.getObjectByName('marca-solape');
    expect(marca()?.visible).toBe(true);
    // Ocultar su capa: ya no se marca (no se ve); mostrarla: vuelve a marcarse, sin moverse
    gestor.capas.ponerVisible(c2.id, false);
    gestor.actualizarCapas();
    expect(gestor.apoyosInvalidos()).toEqual([]);
    gestor.capas.ponerVisible(c2.id, true);
    gestor.actualizarCapas();
    expect(gestor.apoyosInvalidos()).toEqual([planta]);
    expect(pos(planta)).toEqual(antes);
    // Ocultar la capa del mueble: se queda donde está (y sigue marcada)
    gestor.capas.ponerVisible(ID_BASE, false);
    gestor.actualizarCapas();
    expect(pos(planta)).toEqual(antes);
    expect(gestor.apoyosInvalidos()).toEqual([planta]);
    gestor.capas.ponerVisible(ID_BASE, true);
    gestor.actualizarCapas();
    // Pasarla a otra capa: no se mueve
    const c3 = gestor.capas.crear();
    expect(gestor.ponerCapa(planta, c3.id)).toBe(true);
    expect(pos(planta)).toEqual(antes);
    expect(gestor.apoyosInvalidos()).toEqual([planta]);
    // Duplicar su capa: la copia también queda mal apoyada y marcada; la original, oculta
    const copia = (await gestor.duplicarCapa(c3.id))!;
    const plantaCopia = gestor.deCapa(copia.id)[0];
    expect(pos(plantaCopia)).toEqual(antes);
    expect(gestor.apoyosInvalidos()).toEqual([plantaCopia]);
    // Bloqueada: sigue marcada (no se puede mover hasta desbloquearla)
    gestor.capas.ponerBloqueada(copia.id, true);
    gestor.actualizarCapas();
    expect(gestor.apoyosInvalidos()).toEqual([plantaCopia]);
    expect(gestor.editable(plantaCopia)).toBe(false);
    // Desbloqueada, se arrastra a otra superficie donde cabe y deja de estar marcada
    gestor.capas.ponerBloqueada(copia.id, false);
    gestor.actualizarCapas();
    expect(gestor.apoyar(plantaCopia, c, 0.795, 3, 1.7)).toBe(false);
    expect(gestor.bajarAlSuelo(plantaCopia, 3.8, 1.7)).toBe(true);
    expect(gestor.apoyosInvalidos()).toEqual([]);
    expect(marca()?.visible ?? false).toBe(false); // la original está en una capa oculta
  });

  it('no se marcan como mal apoyados los que cumplen la regla, aunque su mueble esté oculto', async () => {
    const c = (await gestor.agregar(cafe(), 3, 1.7))!;
    gestor.capas.crear();
    await gestor.agregarSobre(item('planta'), c, 0.795, 3, 1.7);
    gestor.capas.ponerVisible(ID_BASE, false);
    gestor.actualizarCapas();
    expect(gestor.apoyadosSobreOcultos()).toHaveLength(1);
    expect(gestor.apoyosInvalidos()).toEqual([]);
  });
});
