// Comprueba la migración de escenas guardadas y el catálogo.

import { describe, expect, it } from 'vitest';
import { leerCatalogo } from '../src/catalogo/catalogo';
import { migrar, type EscenaGuardada } from '../src/escena/persistencia';

const centro = { x: 3, z: 1.6 };

describe('escenas guardadas', () => {
  it('una escena de la fase 1 se recoloca respecto al centro del salón y pasa a v3', () => {
    const v1 = {
      version: 1,
      objetos: [{ catalogo: 'mesa', posicion: { x: 0.5, y: 0, z: -0.25 }, rotacion: 90 }],
    } as EscenaGuardada;
    const v3 = migrar(v1, centro);
    expect(v3.version).toBe(3);
    expect(v3.suelos).toEqual({});
    expect(v3.objetos[0]).toEqual({ catalogo: 'mesa', posicion: { x: 3.5, y: 0, z: 1.35 }, rotacion: 90 });
  });

  it('una escena sin número de versión se trata como de la fase 1', () => {
    const sinVersion = { objetos: [{ catalogo: 'armario', posicion: { x: 0, y: 0, z: 0 }, rotacion: 0 }] } as unknown as EscenaGuardada;
    expect(migrar(sinVersion, centro).objetos[0].posicion).toEqual({ x: 3, y: 0, z: 1.6 });
  });

  it('una escena v2 pasa a v3 sin mover nada y sin suelos cambiados', () => {
    const v2: EscenaGuardada = { version: 2, objetos: [{ catalogo: 'mesa', posicion: { x: 9, y: 0, z: 2 }, rotacion: 15 }] };
    expect(migrar(v2, centro)).toEqual({ ...v2, version: 3, suelos: {} });
  });

  it('una escena v3 conserva sus suelos', () => {
    const v3: EscenaGuardada = {
      version: 3, objetos: [],
      suelos: { salon: { tipo: 'microcemento', color: '#bcb5aa', escala: 2 } },
    };
    expect(migrar(v3, centro)).toEqual(v3);
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
