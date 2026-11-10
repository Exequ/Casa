// La altura de cada pared sale de la altura de techo de las estancias que toca.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import datos from '../data/vivienda.json';
import { construirVivienda } from '../src/escena/vivienda3d';
import { alturaEstancia, altoPared, altoPilar, estanciasDePared, type Vivienda } from '../src/vivienda/modelo';

const original = datos as Vivienda;
/** Copia de la vivienda con otras alturas de techo. */
function conAlturas(alturas: Record<string, number>): Vivienda {
  const v = structuredClone(original);
  for (const e of v.estancias) if (alturas[e.id]) e.alturaTecho = alturas[e.id];
  return v;
}
const pared = (v: Vivienda, id: string) => v.paredes.find((p) => p.id === id)!;
const pilar = (v: Vivienda, id: string) => v.pilares!.find((p) => p.id === id)!;

describe('altura de las paredes', () => {
  it('cada pared sabe qué estancias toca', () => {
    const ids = (id: string) => estanciasDePared(pared(original, id), original).map((e) => e.id).sort();
    expect(ids('salon-este')).toEqual(['bano', 'distribuidor', 'salon']);
    expect(ids('bano-distribuidor')).toEqual(['bano', 'distribuidor']);
    expect(ids('fachada-norte')).toEqual(['bano', 'dormitorio', 'salon']);
    expect(ids('cocina-tendedero')).toEqual(['cocina', 'tendedero']);
    expect(ids('rellano')).toEqual(['distribuidor', 'salon']);
  });

  it('con todas las estancias a 2,50 m, todas las paredes miden 2,50 m (salvo la barandilla)', () => {
    const v = conAlturas({ cocina: 2.5, distribuidor: 2.5 });
    for (const p of v.paredes) {
      expect(altoPared(p, v), p.id).toBe(p.id.startsWith('barandilla') ? 1 : 2.5);
    }
  });

  it('las paredes que solo tocan estancias con falso techo (2,40 m) miden 2,40 m', () => {
    expect(alturaEstancia(original.estancias.find((e) => e.id === 'cocina')!, original)).toBe(2.4);
    expect(alturaEstancia(original.estancias.find((e) => e.id === 'distribuidor')!, original)).toBe(2.4);
    expect(altoPared(pared(original, 'cocina-sur'), original)).toBe(2.4);
    expect(altoPared(pared(original, 'rellano'), original)).toBe(2.5); // también toca el salón
  });

  it('una pared entre dos estancias usa la mayor altura de techo', () => {
    const v = conAlturas({ salon: 2.7, bano: 2.3, distribuidor: 2.4, dormitorio: 2.6 });
    expect(altoPared(pared(v, 'salon-este'), v)).toBe(2.7); // salón 2,70 | baño 2,30 y distribuidor 2,40
    expect(altoPared(pared(v, 'bano-distribuidor'), v)).toBe(2.4); // baño 2,30 | distribuidor 2,40
    expect(altoPared(pared(v, 'dormitorio-oeste'), v)).toBe(2.6); // baño y distribuidor | dormitorio 2,60
    expect(altoPared(pared(v, 'fachada-norte'), v)).toBe(2.7); // salón, baño y dormitorio
    expect(altoPared(pared(v, 'barandilla-este'), v)).toBe(1); // altura propia: no cambia
    expect(altoPilar(pilar(v, 'pilar-salon-n'), v)).toBe(2.7);
    expect(altoPilar(pilar(v, 'patinillo-bano'), v)).toBe(2.3);
  });

  it('la pared 3D tiene esa altura (y sus huecos siguen dentro)', () => {
    const v = conAlturas({ salon: 2.7, bano: 2.3, distribuidor: 2.5 });
    const casa = construirVivienda(v);
    const alto = (id: string) => {
      const el = casa.verticales.find((x) => x.objeto.name === id)!;
      el.objeto.updateMatrixWorld(true);
      const b = new THREE.Box3();
      el.nucleo.traverse((o) => { if ((o as THREE.Mesh).isMesh) b.expandByObject(o); });
      return b.max.y - b.min.y;
    };
    expect(alto('pared:salon-este')).toBeCloseTo(2.7, 6);
    expect(alto('pared:bano-distribuidor')).toBeCloseTo(2.5, 6);
    expect(alto('pilar:patinillo-bano')).toBeCloseTo(2.3, 6);
  });
});
