// Acabados de la fase 3b: paredes por cara, revestimientos, techos, focos, carpintería y luces.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import datos from '../data/vivienda.json';
import { construirVivienda } from '../src/escena/vivienda3d';
import { GestorParedes } from '../src/escena/paredes3d';
import { GestorLuces } from '../src/escena/luces';
import type { Escena } from '../src/escena/escena';
import { carasDeEstancia, ladoDe, type Lado } from '../src/vivienda/caras';
import { COLORES_PARED, validarAcabado } from '../src/vivienda/acabados';
import { alturaEstancia, altoPared, estanciasDePared, estiloDe, validarVivienda, type Vivienda } from '../src/vivienda/modelo';

const vivienda = datos as Vivienda;
const casa = construirVivienda(vivienda);
const estancia = (id: string) => vivienda.estancias.find((e) => e.id === id)!;
const interiores = vivienda.estancias.filter((e) => !e.exterior);
const LADOS: Lado[] = ['izquierda', 'derecha'];

/** Caja de todas las mallas de un objeto cuyo nombre empieza por `prefijo`. */
function cajaDe(raiz: THREE.Object3D, filtro: (o: THREE.Mesh) => boolean): THREE.Box3 {
  raiz.updateMatrixWorld(true);
  const b = new THREE.Box3();
  raiz.traverse((o) => { if ((o as THREE.Mesh).isMesh && filtro(o as THREE.Mesh)) b.expandByObject(o); });
  return b;
}

describe('formato de los acabados en vivienda.json', () => {
  it('la vivienda y los acabados de cada estancia son válidos', () => {
    expect(validarVivienda(vivienda)).toEqual([]);
    for (const e of vivienda.estancias) expect(validarAcabado(e.acabado ?? {}), e.id).toEqual([]);
  });

  it('detecta acabados mal escritos', () => {
    expect(validarAcabado({ pared: { color: 'blanco' } }).length).toBeGreaterThan(0);
    expect(validarAcabado({ revestimientos: [{ material: { tipo: 'papel', color: '#ffffff' } }] }).length).toBeGreaterThan(0);
    expect(validarAcabado({ revestimientos: [{ material: { tipo: 'alicatado', color: '#ffffff' }, hasta: -1 }] }).length).toBeGreaterThan(0);
    expect(validarAcabado({ rodapie: { alto: 0.07, color: '#5d5750' } })).toEqual([]);
  });

  it('hay al menos 6 colores de pared predefinidos, con blanco roto y gris perla', () => {
    expect(COLORES_PARED.length).toBeGreaterThanOrEqual(6);
    const nombres = COLORES_PARED.map((c) => c.nombre.toLowerCase());
    expect(nombres.some((n) => n.includes('blanco roto'))).toBe(true);
    expect(nombres.some((n) => n.includes('gris perla'))).toBe(true);
    for (const c of COLORES_PARED) expect(c.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('el baño va alicatado hasta 1,10 m y hasta el techo en la ducha; la cocina lleva frente de azulejo y granito', () => {
    const bano = estancia('bano').acabado!.revestimientos!;
    expect(bano.some((r) => r.hasta === 1.1 && !r.zona)).toBe(true);
    expect(bano.some((r) => r.hasta === 'techo' && r.zona)).toBe(true);
    const cocina = estancia('cocina').acabado!.revestimientos!;
    expect(cocina.some((r) => r.material.tipo === 'azulejo')).toBe(true);
    expect(cocina.some((r) => r.material.tipo === 'granito')).toBe(true);
  });

  it('rodapié blanco de 10 cm salvo en el baño (sin rodapié) y el tendedero (7 cm del material del suelo)', () => {
    expect(estancia('bano').acabado!.rodapie).toBeNull();
    expect(estancia('tendedero').acabado!.rodapie).toEqual({ alto: 0.07, color: estancia('tendedero').suelo!.color });
    for (const id of ['salon', 'cocina', 'distribuidor', 'dormitorio']) expect(estancia(id).acabado?.rodapie, id).toBeUndefined();
    expect(casa.acabados.rodapies.children.length).toBe(interiores.length - 1); // todas menos el baño
  });
});

describe('paredes por cara', () => {
  // Estancias que dan a cada cara larga de cada pared (sin contar las que solo tocan su testa).
  const lados = new Map(vivienda.paredes.map((p) => [p.id, { izquierda: [] as string[], derecha: [] as string[] }]));
  for (const e of vivienda.estancias) {
    for (const t of carasDeEstancia(vivienda, e)) {
      if (t.elemento?.tipo !== 'pared') continue;
      const p = vivienda.paredes.find((x) => x.id === t.elemento!.id)!;
      const paralela = Math.abs(t.dir[0] * (p.hasta[1] - p.desde[1]) - t.dir[1] * (p.hasta[0] - p.desde[0])) < 1e-6;
      if (paralela) lados.get(p.id)![ladoDe(p, t)].push(e.id);
    }
  }

  it('cada pared tiene material en sus dos caras', () => {
    for (const p of vivienda.paredes) {
      const caras = casa.acabados.carasPared.get(p.id)!;
      for (const lado of LADOS) expect(caras[lado].length, `${p.id} ${lado}`).toBeGreaterThan(0);
    }
  });

  it('las caras que dan a una estancia interior llevan su pintura o revestimiento (no el muro desnudo)', () => {
    let comprobadas = 0;
    for (const p of vivienda.paredes) {
      if (p.tipo === 'barandilla') continue;
      for (const lado of LADOS) {
        const ids = lados.get(p.id)![lado].filter((id) => !estancia(id).exterior);
        if (!ids.length) continue;
        const nombres = casa.acabados.carasPared.get(p.id)![lado].map((m) => m.name);
        for (const id of ids) {
          const deEstancia = nombres.some((n) => n === `pintura:${id}`) || nombres.some((n) => n.startsWith('revestimiento:'));
          expect(deEstancia, `${p.id} (${lado}) → ${id}: ${nombres.join(', ')}`).toBe(true);
        }
        comprobadas++;
      }
    }
    expect(comprobadas).toBeGreaterThan(20);
  });

  it('una pared entre dos estancias tiene un acabado distinto por cada lado (baño | distribuidor)', () => {
    const caras = casa.acabados.carasPared.get('bano-distribuidor')!;
    const nombres = LADOS.map((l) => caras[l].map((m) => m.name).sort().join(','));
    expect(nombres[0]).not.toBe(nombres[1]);
    expect(nombres.join(' ')).toContain('pintura:distribuidor');
    expect(nombres.join(' ')).toContain('pintura:bano');
  });

  it('el alicatado del baño llega a 1,10 m fuera de la ducha y al techo dentro', () => {
    const alto = alturaEstancia(estancia('bano'), vivienda);
    const mallas: THREE.Mesh[] = [];
    for (const lista of casa.acabados.porElemento.values()) mallas.push(...lista.filter((m) => m.name === 'acabado:bano'));
    const alicatado = mallas.filter((m) => (m.material as THREE.Material).name.startsWith('revestimiento:'));
    expect(alicatado.length).toBeGreaterThan(0);
    let maxY = 0;
    let hasta110 = false;
    for (const m of alicatado) {
      const pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        maxY = Math.max(maxY, pos.getY(i));
        if (Math.abs(pos.getY(i) - 1.1) < 1e-6) hasta110 = true;
      }
    }
    expect(maxY).toBeCloseTo(alto, 6);
    expect(hasta110).toBe(true);
  });

  it('cambiar el color de una estancia solo afecta a su pintura, y se guarda y restaura', () => {
    const paredes = new GestorParedes(vivienda, casa.acabados.pintura);
    const antes = paredes.actual('salon');
    paredes.cambiar('dormitorio', '#bfccd6');
    expect(paredes.actual('dormitorio')).toBe('#bfccd6');
    expect(paredes.actual('salon')).toBe(antes);
    expect(paredes.cambios()).toEqual({ dormitorio: { color: '#bfccd6' } });
    expect(paredes.restaurar({ salon: { color: '#d9d9d6' }, cocina: { color: 'rojo' }, garaje: { color: '#000000' } })).toBe(2);
    expect(paredes.cambios()).toEqual({ salon: { color: '#d9d9d6' } });
    paredes.restaurar({});
    expect(paredes.cambios()).toEqual({});
  });
});

describe('calidad ligera', () => {
  it('los materiales mates pasan a Lambert y el color de las paredes se sigue pudiendo cambiar', () => {
    const ligera = construirVivienda(vivienda, 256, true);
    const tipos = new Set<string>();
    ligera.grupo.traverse((o) => { if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).material) tipos.add(((o as THREE.Mesh).material as THREE.Material).type); });
    expect(tipos.has('MeshLambertMaterial')).toBe(true);
    for (const m of ligera.acabados.pintura.values()) expect(m.type).toBe('MeshLambertMaterial');
    const paredes = new GestorParedes(vivienda, ligera.acabados.pintura);
    paredes.cambiar('salon', '#bfccd6');
    expect(paredes.actual('salon')).toBe('#bfccd6');
    // Lo que tiene textura o brillo (suelos, alicatado, carpintería) sigue igual
    ligera.grupo.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if ((o as THREE.Mesh).isMesh && m?.name?.startsWith('revestimiento:')) expect(m.type).toBe('MeshStandardMaterial');
    });
  });
});

describe('techos y focos', () => {
  it('cada estancia interior tiene techo a la altura que dice vivienda.json (falso techo 2,40 en cocina y distribuidor)', () => {
    for (const e of interiores) {
      const t = casa.techos.porEstancia.get(e.id)!;
      expect(t, e.id).toBeDefined();
      const b = cajaDe(t.techo, () => true);
      const esperado = e.alturaTecho ?? vivienda.alturaTecho;
      expect(b.max.y, e.id).toBeCloseTo(esperado, 6);
      expect(b.min.y, e.id).toBeCloseTo(esperado, 6);
    }
    expect(estancia('cocina').alturaTecho).toBe(2.4);
    expect(estancia('distribuidor').alturaTecho).toBe(2.4);
    // El balcón no tiene techo
    expect(casa.techos.porEstancia.has('balcon')).toBe(false);
  });

  it('ninguna pared que toca una estancia es más baja que su techo', () => {
    for (const p of vivienda.paredes) {
      if (p.tipo === 'barandilla') continue;
      for (const e of estanciasDePared(p, vivienda)) {
        expect(altoPared(p, vivienda), `${p.id} / ${e.id}`).toBeGreaterThanOrEqual(alturaEstancia(e, vivienda));
      }
    }
  });

  it('número de focos: salón 5, cocina 2, distribuidor 2, dormitorio 4, baño 2 + aplique sobre el espejo', () => {
    const focos = (id: string) => estancia(id).focos?.length ?? 0;
    expect([focos('salon'), focos('cocina'), focos('distribuidor'), focos('dormitorio'), focos('bano')]).toEqual([5, 2, 2, 4, 2]);
    expect(estancia('bano').apliques?.length).toBe(1);
    // Los focos están dentro de su estancia y se dibujan justo bajo el techo
    for (const e of interiores) {
      const malla = casa.techos.porEstancia.get(e.id)!.focos;
      if (!e.focos?.length) { expect(malla, e.id).toBeNull(); continue; }
      const b = cajaDe(malla!, () => true);
      expect(b.max.y, e.id).toBeLessThanOrEqual(alturaEstancia(e, vivienda));
    }
  });
});

describe('carpintería', () => {
  it('cada puerta tiene su hoja abatible y cada hueco con cortina su cortina', () => {
    const huecos = vivienda.paredes.flatMap((p) => p.huecos ?? []);
    const conHoja = huecos.filter((h) => h.tipo === 'puerta' || estiloDe(h).startsWith('puerta'));
    expect(casa.puertas.length).toBe(conHoja.length);
    expect(casa.cortinas.length).toBe(huecos.filter((h) => h.cortina).length);
    expect(casa.cortinas.length).toBe(2); // mirador del salón y balconera del dormitorio
  });

  it('las puertas se abren y se cierran girando sobre las bisagras', () => {
    for (const p of casa.puertas) {
      expect(Math.abs(p.abierta), p.nombre).toBeGreaterThan(1);
      expect(Math.abs(p.abierta), p.nombre).toBeLessThanOrEqual(Math.PI / 2 + 1e-6);
      expect(p.pivote.rotation.y, p.nombre).toBe(0); // cerradas al empezar
    }
  });

  it('el tendedero tiene lamas, la cocina–tendedero puerta vidriera con fijos y el mirador hojas abatibles con travesaño', () => {
    const hueco = (pared: string) => vivienda.paredes.find((p) => p.id === pared)!.huecos!;
    expect(hueco('tendedero-oeste').some((h) => estiloDe(h) === 'lamas')).toBe(true);
    expect(hueco('cocina-tendedero').map(estiloDe)).toEqual(expect.arrayContaining(['fijo', 'puerta-vidriera']));
    const mirador = hueco('mirador-frente').find((h) => h.cortina)!;
    expect(mirador.alfeizar).toBe(0);
    expect(mirador.hojas).toBeGreaterThanOrEqual(2);
    expect(mirador.travesano).toBeGreaterThan(0);
  });
});

describe('luces', () => {
  /** Lo mínimo de la escena que necesita el gestor de luces (sin WebGL). */
  function escenaFalsa(calidad: 'normal' | 'ligera'): Escena {
    const sol = new THREE.DirectionalLight();
    sol.castShadow = true;
    return { escena: new THREE.Scene(), sol, cielo: new THREE.HemisphereLight(), calidad } as unknown as Escena;
  }

  it('dentro de cualquier estancia hay como mucho 3 luces con sombra (calidad normal) y 1 (ligera)', () => {
    for (const calidad of ['normal', 'ligera'] as const) {
      const luces = new GestorLuces(escenaFalsa(calidad), vivienda, casa.techos, [6, 2]);
      for (const e of interiores) {
        luces.modoInterior(true, e.id);
        expect(luces.lucesConSombras(), `${calidad} ${e.id}`).toBeLessThanOrEqual(calidad === 'normal' ? 3 : 1);
      }
      luces.modoInterior(false, null);
      expect(luces.lucesConSombras()).toBe(1); // solo el sol
    }
  });

  it('los focos solo dan luz dentro, en la estancia de la cámara y las abiertas a ella (salón y cocina)', () => {
    const luces = new GestorLuces(escenaFalsa('normal'), vivienda, casa.techos, [6, 2]);
    luces.modoInterior(false, null);
    expect(luces.lucesActivas()).toBe(0);
    luces.modoInterior(true, 'bano');
    const bano = luces.lucesActivas();
    expect(bano).toBeGreaterThan(0);
    luces.modoInterior(true, 'salon');
    const salon = luces.lucesActivas();
    luces.modoInterior(true, 'cocina');
    expect(luces.lucesActivas()).toBe(salon); // mismo espacio abierto
    luces.ponerEstancia('cocina', false);
    expect(luces.lucesActivas()).toBeLessThan(salon);
    // Con calidad ligera, como mucho una luz por estancia y sin apliques
    const ligera = new GestorLuces(escenaFalsa('ligera'), vivienda, casa.techos, [6, 2]);
    ligera.modoInterior(true, 'salon');
    expect(ligera.lucesActivas()).toBe(2);
    ligera.modoInterior(true, 'bano');
    expect(ligera.lucesActivas()).toBe(1);
  });

  it('interruptor general y por estancia, que se guardan y restauran', () => {
    const luces = new GestorLuces(escenaFalsa('normal'), vivienda, casa.techos, [6, 2]);
    expect(luces.estancias().sort()).toEqual(['bano', 'cocina', 'distribuidor', 'dormitorio', 'salon']);
    expect(luces.encendida('salon')).toBe(true);
    luces.ponerEstancia('bano', false);
    expect(luces.encendida('bano')).toBe(false);
    expect(luces.encendida('salon')).toBe(true);
    luces.ponerGeneral(false);
    expect(luces.encendida('salon')).toBe(false);
    expect(luces.estado()).toEqual({ encendidas: false, apagadas: ['bano'] });
    luces.restaurar({ encendidas: true, apagadas: ['cocina', 'garaje'] });
    expect(luces.estado()).toEqual({ encendidas: true, apagadas: ['cocina'] });
    expect(luces.encendida('bano')).toBe(true);
  });
});

describe('vista interior', () => {
  it('la cámara se pone dentro de cada estancia, mirando a lo largo de su diagonal más larga y sin atravesar paredes', async () => {
    const { puntoDeVista } = await import('../src/vivienda/vista');
    const { puntoEnPoligono } = await import('../src/vivienda/geometria');
    for (const e of vivienda.estancias) {
      const v = puntoDeVista(e.poligono);
      expect(v, e.id).not.toBeNull();
      expect(puntoEnPoligono(v!.desde, e.poligono), e.id).toBe(true);
      expect(puntoEnPoligono(v!.hacia, e.poligono), e.id).toBe(true);
      const xs = e.poligono.map((p) => p[0]), zs = e.poligono.map((p) => p[1]);
      const lado = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
      // La distancia de mira es al menos la mitad del lado mayor de la estancia
      expect(Math.hypot(v!.hacia[0] - v!.desde[0], v!.hacia[1] - v!.desde[1]), e.id).toBeGreaterThan(lado / 2);
    }
  });

  it('en una estancia alargada mira a lo largo, y desde el lado de la puerta', async () => {
    const { puntoDeVista } = await import('../src/vivienda/vista');
    const pasillo: [number, number][] = [[0, 0], [4, 0], [4, 1], [0, 1]];
    const v = puntoDeVista(pasillo, [4, 0.5])!;
    expect(v.desde[0]).toBeGreaterThan(3);
    expect(v.hacia[0]).toBeLessThan(1);
  });
});
