// Comprueba que la vivienda 3D coincide con data/vivienda.json y que los datos
// son coherentes con el plano original.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import datos from '../data/vivienda.json';
import { areaGeometria, construirVivienda } from '../src/escena/vivienda3d';
import { EspacioLibre } from '../src/vivienda/espacio';
import { area, caja } from '../src/vivienda/geometria';
import { altoPared, largoPared, validarVivienda, type Punto, type Vivienda } from '../src/vivienda/modelo';

const vivienda = datos as Vivienda;
const casa = construirVivienda(vivienda);
const espacio = new EspacioLibre(vivienda);

describe('vivienda.json', () => {
  it('tiene un formato válido', () => {
    expect(validarVivienda(vivienda)).toEqual([]);
  });

  it('tiene las 6 estancias del plano y el balcón', () => {
    expect(vivienda.estancias.map((e) => e.id).sort()).toEqual(
      ['balcon', 'bano', 'cocina', 'distribuidor', 'dormitorio', 'salon', 'tendedero'],
    );
  });

  it('las superficies medidas coinciden con las del plano (±5 %)', () => {
    for (const e of vivienda.estancias.filter((x) => x.superficiePlano)) {
      const medida = area(e.poligono);
      const error = Math.abs(medida / e.superficiePlano! - 1);
      expect(error, `${e.nombre}: ${medida.toFixed(2)} m² frente a ${e.superficiePlano} m² del plano`).toBeLessThan(0.05);
    }
  });

  it('la superficie útil total coincide con la del plano (±2 %)', () => {
    const conPlano = vivienda.estancias.filter((x) => x.superficiePlano);
    const medida = conPlano.reduce((s, e) => s + area(e.poligono), 0);
    const plano = conPlano.reduce((s, e) => s + e.superficiePlano!, 0);
    expect(Math.abs(medida / plano - 1)).toBeLessThan(0.02);
  });
});

describe('suelos de la escena 3D', () => {
  for (const e of vivienda.estancias) {
    describe(e.nombre, () => {
      const suelo = casa.suelos.get(e.id)!;

      it('existe y está a la altura del suelo', () => {
        expect(suelo).toBeDefined();
        const b = new THREE.Box3().setFromObject(suelo);
        expect(b.min.y).toBeCloseTo(0, 6);
        expect(b.max.y).toBeCloseTo(0, 6);
      });

      it('tiene el área de su polígono en vivienda.json', () => {
        expect(areaGeometria(suelo)).toBeCloseTo(area(e.poligono), 4); // la GPU usa float32
      });

      it('tiene el ancho y el fondo de su polígono en vivienda.json', () => {
        const b = new THREE.Box3().setFromObject(suelo);
        const c = caja(e.poligono);
        expect(b.min.x).toBeCloseTo(c.minX, 6);
        expect(b.max.x).toBeCloseTo(c.maxX, 6);
        expect(b.min.z).toBeCloseTo(c.minZ, 6);
        expect(b.max.z).toBeCloseTo(c.maxZ, 6);
      });
    });
  }
});

describe('paredes de la escena 3D', () => {
  /** Volumen macizo de una pared 3D: suma de los volúmenes de sus bloques (sin cristales). */
  function volumen(objeto: THREE.Object3D): number {
    let v = 0;
    objeto.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.name === 'cristal') return;
      const p = (m.geometry as THREE.BoxGeometry).parameters;
      v += p.width * p.height * p.depth;
    });
    return v;
  }

  for (const p of vivienda.paredes) {
    it(`${p.id}: mide lo que dice vivienda.json y tiene sus huecos`, () => {
      const el = casa.verticales.find((x) => x.objeto.name === `pared:${p.id}`)!;
      expect(el).toBeDefined();
      const alto = altoPared(p, vivienda);
      const largo = largoPared(p);
      const huecos = (p.huecos ?? []).reduce((s, h) => s + h.ancho * h.alto, 0);
      expect(volumen(el.objeto)).toBeCloseTo((largo * alto - huecos) * p.grosor, 6);

      // La caja de la pared: largo × alto × grosor, centrada en su eje.
      el.objeto.updateMatrixWorld(true);
      const b = new THREE.Box3();
      el.objeto.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o.name !== 'cristal') b.expandByObject(o);
      });
      expect(b.max.y - b.min.y).toBeCloseTo(alto, 6);
      const horizontal = Math.abs(p.hasta[1] - p.desde[1]) < 1e-9;
      if (horizontal) {
        expect(b.max.x - b.min.x).toBeCloseTo(largo, 6);
        expect(b.max.z - b.min.z).toBeCloseTo(p.grosor, 6);
      } else {
        expect(b.max.z - b.min.z).toBeCloseTo(largo, 6);
        expect(b.max.x - b.min.x).toBeCloseTo(p.grosor, 6);
      }
    });
  }

  it('ninguna pared invade el suelo de una estancia (más de 1,5 cm)', () => {
    for (const p of vivienda.paredes) {
      const largo = largoPared(p);
      const ux = (p.hasta[0] - p.desde[0]) / largo, uz = (p.hasta[1] - p.desde[1]) / largo;
      for (const e of vivienda.estancias) {
        // Puntos de prueba: vértices y puntos intermedios de los lados.
        const puntos: Punto[] = e.poligono.flatMap((a, i) => {
          const b = e.poligono[(i + 1) % e.poligono.length];
          return [0, 0.25, 0.5, 0.75].map((t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as Punto);
        });
        for (const [x, z] of puntos) {
          const u = (x - p.desde[0]) * ux + (z - p.desde[1]) * uz;
          const v = -(x - p.desde[0]) * uz + (z - p.desde[1]) * ux;
          const penetracion = Math.min(u, largo - u, p.grosor / 2 - Math.abs(v));
          expect(penetracion, `${p.id} invade ${e.id} en (${x}, ${z})`).toBeLessThan(0.015);
        }
      }
    }
  });

  it('cada puerta comunica estancias y no se puede ocupar con muebles', () => {
    for (const p of vivienda.paredes) {
      const largo = largoPared(p);
      const ux = (p.hasta[0] - p.desde[0]) / largo, uz = (p.hasta[1] - p.desde[1]) / largo;
      for (const h of (p.huecos ?? []).filter((x) => x.tipo === 'puerta')) {
        const d = h.distancia + h.ancho / 2;
        const centro: Punto = [p.desde[0] + ux * d, p.desde[1] + uz * d];
        const sep = p.grosor / 2 + 0.05;
        const lados = [1, -1].map((s) => espacio.estanciaEn(centro[0] - uz * sep * s, centro[1] + ux * sep * s));
        // En el hueco de la puerta no hay suelo de ninguna estancia...
        expect(espacio.estanciaEn(centro[0], centro[1]), `${h.nombre}`).toBeNull();
        // ...y a cada lado hay una estancia distinta (la de entrada da al rellano).
        if (h.nombre === 'Puerta de entrada') {
          expect(lados.filter(Boolean)).toEqual(['distribuidor']);
        } else {
          expect(lados[0], `${h.nombre}`).not.toBeNull();
          expect(lados[1], `${h.nombre}`).not.toBeNull();
          expect(lados[0]).not.toBe(lados[1]);
        }
      }
    }
  });
});
