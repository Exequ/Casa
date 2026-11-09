// Suelos: formato, valores por defecto, área y escala real de la textura.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import datos from '../data/vivienda.json';
import { areaGeometria, construirVivienda } from '../src/escena/vivienda3d';
import { area } from '../src/vivienda/geometria';
import { validarVivienda, type Vivienda } from '../src/vivienda/modelo';
import {
  SUELOS, TIPOS_SUELO, mismoSuelo, predefinidoDe, repeticionesPorMetro, sueloDe, sueloPorDefecto, validarSuelo,
} from '../src/vivienda/suelos';

const vivienda = datos as Vivienda;
const casa = construirVivienda(vivienda);
const de = (id: string) => sueloDe(vivienda.estancias.find((e) => e.id === id)!);

describe('formato del suelo', () => {
  it('todas las estancias de vivienda.json tienen un suelo válido', () => {
    for (const e of vivienda.estancias) {
      expect(e.suelo, e.nombre).toBeDefined();
      expect(validarSuelo(e.suelo), e.nombre).toBeNull();
    }
    expect(validarVivienda(vivienda)).toEqual([]);
  });

  it('detecta suelos mal escritos', () => {
    expect(validarSuelo({ tipo: 'moqueta', color: '#ffffff', escala: 1 })).toMatch(/tipo/);
    expect(validarSuelo({ tipo: 'tarima', color: 'marrón', escala: 1 })).toMatch(/color/);
    expect(validarSuelo({ tipo: 'tarima', color: '#a97b4f', escala: 0 })).toMatch(/escala/);
    expect(validarSuelo({ tipo: 'tarima', color: '#a97b4f', escala: 1.2 })).toBeNull();
    const mala = structuredClone(vivienda);
    mala.estancias[0].suelo = { tipo: 'tarima', color: '#zzzzzz', escala: 1 };
    expect(validarVivienda(mala).join()).toMatch(/salon.*color/);
  });

  it('hay entre 6 y 8 suelos para elegir, todos válidos y de tipos distintos entre sí o de color distinto', () => {
    expect(SUELOS.length).toBeGreaterThanOrEqual(6);
    expect(SUELOS.length).toBeLessThanOrEqual(8);
    for (const s of SUELOS) expect(validarSuelo(s), s.nombre).toBeNull();
    expect(new Set(SUELOS.map((s) => s.id)).size).toBe(SUELOS.length);
    // Se usan todos los tipos que la app sabe dibujar
    expect(new Set(SUELOS.map((s) => s.tipo))).toEqual(new Set(TIPOS_SUELO));
  });
});

describe('suelos por defecto', () => {
  it('tarima de madera oscura en salón, dormitorio y distribuidor', () => {
    for (const id of ['salon', 'dormitorio', 'distribuidor']) {
      expect(de(id).tipo, id).toBe('tarima');
      expect(predefinidoDe(de(id))?.id, id).toBe('tarima-nogal');
    }
  });
  it('baldosa de mármol clara en baño, cocina y tendedero', () => {
    for (const id of ['bano', 'cocina', 'tendedero']) expect(predefinidoDe(de(id))?.id, id).toBe('marmol-blanco');
  });
  it('baldosa de exterior en el balcón', () => {
    expect(predefinidoDe(de('balcon'))?.id).toBe('gres-exterior');
  });
  it('si una estancia no tiene suelo, se elige uno según su tipo', () => {
    expect(mismoSuelo(sueloPorDefecto({ id: 'salon' }), de('salon'))).toBe(true);
    expect(mismoSuelo(sueloPorDefecto({ id: 'bano' }), de('bano'))).toBe(true);
    expect(mismoSuelo(sueloPorDefecto({ id: 'terraza', exterior: true }), de('balcon'))).toBe(true);
  });
});

describe('suelo de cada estancia en la escena', () => {
  for (const e of vivienda.estancias) {
    it(`${e.nombre}: tiene suelo con el área de su polígono y la textura en metros reales`, () => {
      const malla = casa.suelos.get(e.id)!;
      expect(malla).toBeDefined();
      expect(areaGeometria(malla)).toBeCloseTo(area(e.poligono), 4);
      // Coordenadas de textura = posición en planta en metros (u = x, v = -z):
      // así la textura no se deforma en polígonos irregulares y su escala es real.
      const pos = malla.geometry.getAttribute('position');
      const uv = malla.geometry.getAttribute('uv');
      expect(uv.count).toBe(pos.count);
      const p = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i);
        expect(uv.getX(i)).toBeCloseTo(p.x, 5);
        expect(uv.getY(i)).toBeCloseTo(-p.z, 5);
      }
      // Una repetición de textura ocupa exactamente `escala` metros.
      expect(repeticionesPorMetro(sueloDe(e)) * sueloDe(e).escala).toBeCloseTo(1, 9);
    });
  }
});
