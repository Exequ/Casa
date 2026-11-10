// Elementos fijos de la vivienda (fase 3c): formato, que caben en su
// estancia sin atravesar paredes ni huecos, que no se cruzan entre sí, que
// los muebles no pueden meterse en ellos y que la escena inicial no los pisa.

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

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
import inicial from '../data/escena-inicial.json';
import { leerCatalogo } from '../src/catalogo/catalogo';
import { construirVivienda } from '../src/escena/vivienda3d';
import { GestorObjetos } from '../src/escena/objetos';
import { colocarObjetos, migrar, type EscenaGuardada } from '../src/escena/persistencia';
import { carasColgables, problemaEnPared } from '../src/vivienda/colgar';
import { EspacioLibre } from '../src/vivienda/espacio';
import {
  cajaFijo, cajasSeCruzan, esColgado, huellaFijo, problemasDeFijo, TIPOS_FIJO, validarFijos, type Fijo,
} from '../src/vivienda/fijos';
import { convexosSeSolapan, encoger, huellaRectangulo } from '../src/vivienda/geometria';
import { validarVivienda, type Vivienda } from '../src/vivienda/modelo';

const vivienda = datos as unknown as Vivienda;
const fijos = vivienda.fijos ?? [];
const espacio = new EspacioLibre(vivienda);
const caras = carasColgables(vivienda);
const catalogo = leerCatalogo();
const item = (id: string) => catalogo.find((i) => i.id === id)!;
const fijo = (id: string) => fijos.find((f) => f.id === id)!;
const nuevoGestor = () => new GestorObjetos(new THREE.Scene(), espacio, caras, fijos);

describe('formato de los elementos fijos', () => {
  it('vivienda.json es válida y tiene elementos fijos', () => {
    expect(validarVivienda(vivienda)).toEqual([]);
    expect(fijos.length).toBeGreaterThanOrEqual(5);
    for (const f of fijos) {
      expect(TIPOS_FIJO, f.id).toContain(f.tipo);
      expect(f.medidas, f.id).toBe('estimadas');
    }
  });

  it('detecta fijos mal escritos', () => {
    const conFijo = (f: Partial<Fijo>) => validarFijos({ ...vivienda, fijos: [{ ...fijos[0], ...f } as Fijo] });
    expect(conFijo({})).toEqual([]);
    expect(conFijo({ tipo: 'nevera' as Fijo['tipo'] }).join()).toMatch(/tipo/);
    expect(conFijo({ estancia: 'garaje' }).join()).toMatch(/estancia/);
    expect(conFijo({ giro: 45 }).join()).toMatch(/giro/);
    expect(conFijo({ dimensiones: { ancho: 0, fondo: 1, alto: 1 } }).join()).toMatch(/dimensiones/);
    expect(conFijo({ altura: 2, dimensiones: { ancho: 1, fondo: 1, alto: 1 } }).join()).toMatch(/techo/);
    expect(conFijo({ pared: 'no-existe' }).join()).toMatch(/pared/);
    expect(conFijo({ modulos: [{ tipo: 'puertas', ancho: 0.1 }] }).join()).toMatch(/modulos/);
    expect(validarFijos({ ...vivienda, fijos: [fijos[0], fijos[0]] }).join()).toMatch(/repetido/);
  });
});

describe('cada fijo en su sitio', () => {
  it('cabe en su estancia sin atravesar paredes, pilares, puertas ni ventanas', () => {
    for (const f of fijos) expect(problemasDeFijo(vivienda, f), f.id).toEqual([]);
  });

  it('el detector de problemas funciona (un fijo en mitad de una puerta o fuera de su estancia)', () => {
    // Delante de la puerta del salón (pared salon-este, z 1,88–2,69)
    const enPuerta: Fijo = { id: 'x', tipo: 'cocina-bajo', estancia: 'salon', posicion: [5.95, 2.3], dimensiones: { ancho: 0.6, fondo: 0.3, alto: 0.9 } };
    expect(problemasDeFijo(vivienda, enPuerta).join()).toMatch(/hueco|atraviesa|sale/);
    const fuera: Fijo = { ...enPuerta, posicion: [3, 1.5], estancia: 'bano' };
    expect(problemasDeFijo(vivienda, fuera).join()).toMatch(/sale/);
  });

  it('los fijos no se cruzan entre sí', () => {
    for (let i = 0; i < fijos.length; i++) {
      for (let j = i + 1; j < fijos.length; j++) {
        expect(cajasSeCruzan(cajaFijo(fijos[i]), cajaFijo(fijos[j])), `${fijos[i].id} × ${fijos[j].id}`).toBe(false);
      }
    }
  });

  it('el 3D de cada fijo cabe en su caja (±2 mm) y los colgados van con su pared', () => {
    const casa = construirVivienda(vivienda, 64);
    for (const f of fijos) {
      const g = casa.fijos.porId.get(f.id)!;
      expect(g, f.id).toBeDefined();
      g.updateWorldMatrix(true, true);
      const b = new THREE.Box3().setFromObject(g);
      const c = cajaFijo(f);
      for (const [k, e] of (['x', 'y', 'z'] as const).entries()) {
        expect(b.min[e], `${f.id} mín ${e}`).toBeGreaterThanOrEqual(c.min[k] - 0.002);
        expect(b.max[e], `${f.id} máx ${e}`).toBeLessThanOrEqual(c.max[k] + 0.002);
      }
      // Ocupa casi toda su caja (no está desplazado ni girado al revés)
      expect(b.max.y - b.min.y, f.id).toBeGreaterThan(f.dimensiones.alto * 0.8);
      if (esColgado(f)) {
        expect(g.parent?.name, f.id).toBe('acabados');
        expect(g.parent?.parent?.name, f.id).toBe(`pared:${f.pared}`);
      }
    }
  });
});

describe('choques con los muebles', () => {
  it('ningún mueble puede ponerse dentro de un fijo del suelo', () => {
    for (const f of fijos.filter((x) => !esColgado(x))) {
      const [x, z] = f.posicion;
      expect(espacio.esValida({ x, z, ancho: 0.3, fondo: 0.3, giro: 0 }), f.id).toBe(false);
    }
  });

  it('un mueble no se puede arrastrar dentro de la cocina ni añadirse encima de ella', async () => {
    const gestor = nuevoGestor();
    const mesa = (await gestor.agregar(item('mesas/mesa-comedor-cristal'), 2.65, 4.6, 0))!;
    expect(espacio.esValida(gestor.huella(mesa), false, gestor.obstaculos(mesa))).toBe(true);
    // Arrastrarla hacia los muebles del fondo y de la derecha: se para antes
    gestor.mover(mesa, 2.65, 6.0);
    expect(mesa.raiz.position.z + 0.35).toBeLessThanOrEqual(5.57 + 0.003);
    gestor.mover(mesa, 3.9, mesa.raiz.position.z);
    expect(mesa.raiz.position.x + 0.6).toBeLessThanOrEqual(3.46 + 0.003);
    // Añadir una silla justo encima del horno: va al sitio libre más cercano
    const silla = (await gestor.agregar(item('sillas/silla-comedor'), 2.63, 5.87, 0))!;
    const h = huellaRectangulo(silla.raiz.position.x, silla.raiz.position.z, 0.48, 0.55, 0);
    for (const f of fijos.filter((x) => !esColgado(x))) expect(convexosSeSolapan(encoger(h, 0.001), huellaFijo(f)), f.id).toBe(false);
  });

  it('los colgados solo estorban a los muebles más altos que su base', () => {
    // Un colgado de prueba a 1,60 m sobre suelo libre del salón
    const colgado: Fijo = { id: 'prueba', tipo: 'split-interior', estancia: 'salon', posicion: [3, 1.6], altura: 1.6, dimensiones: { ancho: 0.9, fondo: 0.3, alto: 0.3 } };
    const gestor = new GestorObjetos(new THREE.Scene(), espacio, caras, [...fijos, colgado]);
    const h = { x: 3, z: 1.6, ancho: 0.4, fondo: 0.4, giro: 0 };
    const con = (alto: number) => espacio.esValida(h, false, gestor.obstaculos({ item: { dimensiones: { ancho: 0.4, fondo: 0.4, alto } } } as never));
    expect(con(0.75)).toBe(true); // una mesa cabe debajo
    expect(con(2.0)).toBe(false); // una librería, no
    // Los colgados de verdad están por encima de 0,5 m
    for (const f of fijos.filter(esColgado)) expect(cajaFijo(f).min[1], f.id).toBeGreaterThanOrEqual(0.5);
  });

  it('no se puede colgar un cuadro donde hay un fijo pegado a la pared', () => {
    const gestor = nuevoGestor();
    const rects = gestor.rectsPared();
    for (const f of fijos.filter((x) => x.tipo === 'cocina-alto')) {
      const c = cajaFijo(f);
      const cara = caras.find((k) => k.estancia === f.estancia && k.elemento === `pared:${f.pared}`)!;
      const centro = [(c.min[0] + c.max[0]) / 2, (c.min[2] + c.max[2]) / 2];
      const u = (centro[0] - cara.a[0]) * cara.dir[0] + (centro[1] - cara.a[1]) * cara.dir[1];
      expect(problemaEnPared({ cara, u, y: 1.9, ancho: 0.3, alto: 0.3 }, rects), f.id).toBe('solape');
    }
  });
});

describe('la escena inicial y los fijos', () => {
  it('ningún objeto de la escena inicial se cruza con un fijo', async () => {
    const gestor = nuevoGestor();
    const omitidos = await colocarObjetos(gestor, migrar(structuredClone(inicial as unknown as EscenaGuardada), { x: 0, z: 0 }).objetos, catalogo);
    expect(omitidos).toEqual([]);
    for (const o of gestor.objetos) {
      o.raiz.updateWorldMatrix(true, true);
      const b = new THREE.Box3().setFromObject(o.raiz);
      const caja = { min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z] };
      for (const f of fijos) expect(cajasSeCruzan(caja, cajaFijo(f), 0.002), `${o.item.id} × ${f.id}`).toBe(false);
    }
  });
});

describe('cocina (parte A)', () => {
  it('forma de L: columna, bajos y altos en las paredes este y sur, horno con placa y cajonera de 4', () => {
    expect(fijo('cocina-columna').tipo).toBe('columna-frigorifico');
    const sur = fijo('cocina-bajo-sur');
    expect(sur.modulos!.map((m) => m.tipo)).toEqual(['puertas', 'horno', 'cajones']);
    expect(sur.modulos![1].placa).toBe(true);
    expect(sur.modulos![2].n).toBe(4);
    expect(fijo('cocina-bajo-este').modulos![0].tipo).toBe('lavavajillas');
    expect(fijo('cocina-alto-sur').modulos!.map((m) => m.tipo)).toContain('estantes');
    for (const id of ['cocina-alto-este', 'cocina-alto-sur']) expect(esColgado(fijo(id)), id).toBe(true);
  });

  it('el frente de azulejo ya no queda detrás de la columna del frigorífico', () => {
    const cocina = vivienda.estancias.find((e) => e.id === 'cocina')!;
    const col = cajaFijo(fijo('cocina-columna'));
    for (const r of cocina.acabado?.revestimientos ?? []) {
      if (!r.zona) continue;
      const [, z1, , z2] = r.zona;
      const enPared = r.zona[0] < col.max[0] && r.zona[2] > col.min[0];
      if (enPared) expect(z1 >= col.max[2] - 1e-6 || z2 <= col.min[2] + 1e-6, r.nombre).toBe(true);
    }
  });
});

describe('baño (parte B)', () => {
  const x = (id: string) => fijo(id).posicion[0];
  it('están todas las piezas del baño', () => {
    const tipos = fijos.filter((f) => f.estancia === 'bano').map((f) => f.tipo).sort();
    expect(tipos).toEqual(['barra', 'barra', 'bide', 'espejo', 'griferia-ducha', 'inodoro', 'mampara', 'mueble-lavabo', 'plato-ducha']);
  });

  it('como en el plano: ducha a la izquierda, lavabo en el centro del fondo, inodoro y bidé a la derecha', () => {
    expect(x('bano-plato')).toBeLessThan(x('bano-lavabo'));
    expect(x('bano-lavabo')).toBeLessThan(x('bano-inodoro'));
    // Lavabo y grifería contra la pared del fondo (norte, z = 0,23)
    for (const id of ['bano-lavabo', 'bano-griferia', 'bano-espejo']) expect(cajaFijo(fijo(id)).min[2], id).toBeCloseTo(0.23, 3);
    // Inodoro y bidé contra la pared de la derecha (x = 8,61), mirando al baño
    for (const id of ['bano-inodoro', 'bano-bide']) {
      expect(cajaFijo(fijo(id)).max[0], id).toBeCloseTo(8.61, 3);
      expect(fijo(id).giro, id).toBe(270);
    }
  });

  it('el espejo cuelga sobre el lavabo, centrado y por debajo del aplique LED', () => {
    const espejo = cajaFijo(fijo('bano-espejo')), lavabo = cajaFijo(fijo('bano-lavabo'));
    expect(espejo.min[1]).toBeGreaterThan(lavabo.max[1]);
    expect((espejo.min[0] + espejo.max[0]) / 2).toBeCloseTo((lavabo.min[0] + lavabo.max[0]) / 2, 2);
    const aplique = vivienda.estancias.find((e) => e.id === 'bano')!.apliques![0];
    expect(espejo.max[1]).toBeLessThan(aplique.altura);
  });

  it('la mampara está sobre el plato, en su lado derecho, y la barra va de ella a la pared', () => {
    const plato = cajaFijo(fijo('bano-plato')), mampara = cajaFijo(fijo('bano-mampara')), barra = cajaFijo(fijo('bano-barra-mampara'));
    expect(mampara.min[1]).toBeCloseTo(plato.max[1], 3);
    expect(mampara.min[0]).toBeLessThan(plato.max[0] + 0.02);
    expect(barra.max[0]).toBeCloseTo(mampara.min[0], 3);
    expect(barra.min[0]).toBeCloseTo(plato.min[0], 2);
  });
});

describe('armario empotrado (parte C)', () => {
  it('ocupa el hueco del armario del plano, de suelo a techo, con el frente hacia la cama', () => {
    const a = fijo('dormitorio-armario');
    expect(a.tipo).toBe('armario-empotrado');
    expect(a.puertas).toBe(4);
    const c = cajaFijo(a);
    expect(c.min[0]).toBeCloseTo(9.03, 3);
    expect(c.max[0]).toBeCloseTo(11.22, 3);
    expect(c.min[2]).toBeCloseTo(2.93, 3);
    expect(c.max[2]).toBeCloseTo(3.5, 3);
    expect(c.min[1]).toBe(0);
    expect(2.5 - c.max[1]).toBeLessThan(0.02);
    expect(a.giro).toBe(180); // frente al norte, hacia la cama
  });

  it('la cama, la mesita y la cómoda de la escena inicial no lo tocan, y no se puede meter un mueble dentro', () => {
    expect(espacio.esValida({ x: 10.1, z: 3.2, ancho: 0.4, fondo: 0.4, giro: 0 })).toBe(false);
    expect(espacio.esValida({ x: 10.1, z: 2.6, ancho: 0.4, fondo: 0.4, giro: 0 })).toBe(true);
  });
});
