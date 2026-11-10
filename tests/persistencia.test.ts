// Comprueba la migración de escenas guardadas y el catálogo.

import { describe, expect, it } from 'vitest';
import { leerCatalogo } from '../src/catalogo/catalogo';
import { AJUSTES_POR_DEFECTO, migrar, type EscenaGuardada } from '../src/escena/persistencia';

const centro = { x: 3, z: 1.6 };

describe('escenas guardadas', () => {
  it('una escena de la fase 1 se recoloca respecto al centro del salón y pasa a v4', () => {
    const v1 = {
      version: 1,
      objetos: [{ catalogo: 'mesa', posicion: { x: 0.5, y: 0, z: -0.25 }, rotacion: 90 }],
    } as EscenaGuardada;
    const v4 = migrar(v1, centro);
    expect(v4.version).toBe(4);
    expect(v4.suelos).toEqual({});
    expect(v4.paredes).toEqual({});
    expect(v4.ajustes).toEqual(AJUSTES_POR_DEFECTO);
    expect(v4.objetos[0]).toEqual({ catalogo: 'mesa', posicion: { x: 3.5, y: 0, z: 1.35 }, rotacion: 90 });
  });

  it('una escena sin número de versión se trata como de la fase 1', () => {
    const sinVersion = { objetos: [{ catalogo: 'armario', posicion: { x: 0, y: 0, z: 0 }, rotacion: 0 }] } as unknown as EscenaGuardada;
    expect(migrar(sinVersion, centro).objetos[0].posicion).toEqual({ x: 3, y: 0, z: 1.6 });
  });

  it('una escena v2 pasa a v4 sin mover nada, sin suelos ni paredes cambiados y con los ajustes por defecto', () => {
    const v2: EscenaGuardada = { version: 2, objetos: [{ catalogo: 'mesa', posicion: { x: 9, y: 0, z: 2 }, rotacion: 15 }] };
    expect(migrar(v2, centro)).toEqual({ ...v2, version: 4, suelos: {}, paredes: {}, ajustes: AJUSTES_POR_DEFECTO });
  });

  it('una escena v3 conserva sus suelos y pasa a v4', () => {
    const v3: EscenaGuardada = {
      version: 3, objetos: [],
      suelos: { salon: { tipo: 'microcemento', color: '#bcb5aa', escala: 2 } },
    };
    expect(migrar(v3, centro)).toEqual({ ...v3, version: 4, paredes: {}, ajustes: AJUSTES_POR_DEFECTO });
  });

  it('una escena v4 conserva paredes y ajustes (y completa los que falten)', () => {
    const v4: EscenaGuardada = {
      version: 4, objetos: [],
      suelos: {},
      paredes: { dormitorio: { color: '#bfccd6' } },
      ajustes: { luces: { encendidas: false, apagadas: ['bano'] }, puertasAbiertas: true, cortinas: false },
    };
    expect(migrar(v4, centro)).toEqual(v4);
    const parcial = migrar({ version: 4, objetos: [], ajustes: { cortinas: false } }, centro);
    expect(parcial.ajustes).toEqual({ ...AJUSTES_POR_DEFECTO, cortinas: false });
  });

  it('una versión desconocida da un error claro', () => {
    expect(() => migrar({ version: 9, objetos: [] } as unknown as EscenaGuardada, centro)).toThrow(/Versión/);
  });

  it('un archivo sin lista de objetos da un error claro', () => {
    expect(() => migrar({} as EscenaGuardada, centro)).toThrow(/objetos/);
  });
});

describe('catálogo', () => {
  it('lee la mesa y el armario de ejemplo con sus medidas', () => {
    const items = leerCatalogo();
    const ids = items.map((i) => i.id).sort();
    expect(ids).toEqual(['armario', 'mesa']);
    for (const i of items) {
      expect(i.dimensiones.ancho).toBeGreaterThan(0);
      expect(i.urlGlb).toMatch(/\.glb/);
    }
  });
});
