/// <reference types="node" />
// El catálogo completo: que todo carga, que cada .glb mide lo que dice su
// .json, que los modelos son ligeros y que las superficies tienen sentido.

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, getBounds } from '@gltf-transform/core';

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
import { leerCatalogo, superficiesDe, validarFicha, type FichaObjeto } from '../src/catalogo/catalogo';
import { GestorObjetos } from '../src/escena/objetos';
import { carasColgables } from '../src/vivienda/colgar';
import { EspacioLibre } from '../src/vivienda/espacio';
import type { Vivienda } from '../src/vivienda/modelo';

const CATALOGO = fileURLToPath(new URL('../catalogo', import.meta.url));

/** Rutas (sin extensión) de todas las fichas .json del catálogo. */
function fichas(dir = CATALOGO): string[] {
  return readdirSync(dir).flatMap((f: string) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return fichas(p);
    return f.endsWith('.json') ? [relative(CATALOGO, p).replace(/\.json$/, '')] : [];
  }).sort();
}

const LOTE1 = [
  'sofas/sofa-3-plazas', 'sofas/sillon', 'mesas/mesa-centro', 'almacenaje/libreria', 'almacenaje/mueble-tv',
  'electronica/television', 'mesas/mesa-comedor-cristal', 'sillas/silla-comedor', 'iluminacion/lampara-pie-semiesfera',
  'iluminacion/lampara-tripode', 'mesas/mesita-alambre', 'mesas/mesita-bandeja', 'pared/espejo-marco-negro',
  'pared/cuadro-marco-blanco', 'pared/perchero-pared', 'pared/espejo-marco-plateado',
];

const io = new NodeIO();
/** Caja envolvente, triángulos y tamaño de un .glb. */
async function medirGlb(ruta: string) {
  const bytes = readFileSync(ruta);
  const doc = await io.readBinary(new Uint8Array(bytes));
  const escena = doc.getRoot().listScenes()[0];
  const { min, max } = getBounds(escena);
  let triangulos = 0;
  for (const malla of doc.getRoot().listMeshes()) {
    for (const p of malla.listPrimitives()) triangulos += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')!.getCount()) / 3;
  }
  return {
    ancho: max[0] - min[0], alto: max[1] - min[1], fondo: max[2] - min[2],
    centro: [(min[0] + max[0]) / 2, (min[2] + max[2]) / 2], suelo: min[1],
    triangulos, bytes: bytes.length, materiales: doc.getRoot().listMaterials().length,
  };
}

describe('catálogo completo', () => {
  const rutas = fichas();
  const items = leerCatalogo();

  it('se leen todas las fichas, sin errores, con su modelo y su miniatura', () => {
    expect(rutas.length).toBeGreaterThanOrEqual(22);
    expect(items.map((i) => i.id).sort()).toEqual(rutas);
    for (const i of items) {
      expect(validarFicha(i), i.id).toBeNull();
      expect(i.urlGlb, i.id).toMatch(/\.glb/);
      expect(i.urlMiniatura, `${i.id}: falta la miniatura .png`).toMatch(/\.png/);
    }
  });

  it('están los 16 muebles del lote 1, en su carpeta de categoría', () => {
    for (const r of LOTE1) expect(rutas, r).toContain(r);
  });

  for (const ruta of fichas()) {
    it(`${ruta}: el .glb y el .json son coherentes, y el modelo es ligero`, async () => {
      const ficha = JSON.parse(readFileSync(join(CATALOGO, `${ruta}.json`), 'utf8')) as FichaObjeto & { medidas?: string };
      const glb = join(CATALOGO, dirname(ruta), ficha.glb);
      expect(existsSync(glb), glb).toBe(true);
      const g = await medirGlb(glb);
      const d = ficha.dimensiones;
      // La app estira el modelo a la ficha: cada medida debe ser parecida (sin ejes cambiados
      // ni centímetros por metros); los que salen del script, exactamente iguales.
      for (const eje of ['ancho', 'fondo', 'alto'] as const) {
        const r = d[eje] / g[eje];
        expect(r, `${eje}: ficha ${d[eje]} m, modelo ${g[eje].toFixed(3)} m`).toBeGreaterThan(0.75);
        expect(r, `${eje}: ficha ${d[eje]} m, modelo ${g[eje].toFixed(3)} m`).toBeLessThan(1.33);
        if (LOTE1.includes(ruta) && ficha.medidas !== 'confirmadas') expect(g[eje], eje).toBeCloseTo(d[eje], 2);
      }
      if (LOTE1.includes(ruta)) {
        // Origen en el centro de la base
        expect(Math.abs(g.centro[0])).toBeLessThan(0.003);
        expect(Math.abs(g.centro[1])).toBeLessThan(0.003);
        expect(Math.abs(g.suelo)).toBeLessThan(0.003);
        expect(g.triangulos).toBeLessThan(20000);
        expect(g.bytes).toBeLessThan(300 * 1024);
      }
    });
  }
});

describe('colocación y superficies del lote 1', () => {
  const items = leerCatalogo();
  const item = (id: string) => items.find((i) => i.id === id)!;

  it('cada objeto tiene la colocación pedida', () => {
    expect(item('electronica/television').colocacion).toBe('superficie');
    for (const id of ['pared/espejo-marco-negro', 'pared/cuadro-marco-blanco', 'pared/perchero-pared', 'pared/espejo-marco-plateado']) {
      expect(item(id).colocacion, id).toBe('pared');
    }
    expect(item('pared/espejo-marco-negro').alturaCentro).toBe(1.3);
    expect(item('pared/perchero-pared').alturaCentro).toBe(1.65);
    for (const id of LOTE1.filter((r) => !r.startsWith('pared/') && r !== 'electronica/television')) {
      expect(item(id).colocacion, id).toBe('suelo');
    }
  });

  it('sofá, sillón, silla y lámparas no admiten nada encima; los soportes tienen sus tapas y baldas', () => {
    for (const id of ['sofas/sofa-3-plazas', 'sofas/sillon', 'sillas/silla-comedor', 'iluminacion/lampara-pie-semiesfera', 'iluminacion/lampara-tripode']) {
      expect(superficiesDe(item(id)), id).toEqual([]);
    }
    expect(superficiesDe(item('mesas/mesa-centro'))).toEqual([0.45]);
    expect(superficiesDe(item('mesas/mesa-comedor-cristal'))).toEqual([0.75]);
    expect(superficiesDe(item('almacenaje/libreria')).length).toBeGreaterThanOrEqual(5);
    expect(superficiesDe(item('almacenaje/mueble-tv')).length).toBeGreaterThanOrEqual(2);
    for (const i of items) {
      for (const s of superficiesDe(i)) {
        expect(s, i.id).toBeGreaterThan(0);
        expect(s, i.id).toBeLessThanOrEqual(i.dimensiones.alto + 1e-9);
      }
    }
  });

  it('en la app: la tele se apoya en el mueble de TV, y nada se apoya en el sofá', async () => {
    const vivienda = datos as Vivienda;
    const gestor = new GestorObjetos(new THREE.Scene(), new EspacioLibre(vivienda), carasColgables(vivienda));
    const mueble = (await gestor.agregar(item('almacenaje/mueble-tv'), 3, 1.7))!;
    const tele = (await gestor.agregarSobre(item('electronica/television'), mueble, 0.55, 3, 1.7))!;
    expect(tele.raiz.position.y).toBe(0.55);
    const sofa = (await gestor.agregar(item('sofas/sofa-3-plazas'), 3, 1.0))!;
    expect(gestor.esSoporte(sofa)).toBe(false);
    expect(gestor.apoyar(tele, sofa, 0.85, sofa.raiz.position.x, sofa.raiz.position.z)).toBe(false);
    // La librería: un objeto bajo cabe en la balda de abajo; la tele (48 cm), no
    const libreria = (await gestor.agregar(item('almacenaje/libreria'), 1.5, 0.6))!;
    expect(gestor.sitioEnSoporte(item('electronica/television'), libreria, 0.33, 0, 0, 0)).toBeNull();
    expect(gestor.sitioEnSoporte(item('jarron'), libreria, 0.33, 0, 0, 0)).not.toBeNull();
  });
});
