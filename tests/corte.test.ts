// Las paredes que tapan la vista se bajan; las del fondo se quedan en pie.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import datos from '../data/vivienda.json';
import { CortadorParedes } from '../src/escena/corte';
import { construirVivienda } from '../src/escena/vivienda3d';
import { EspacioLibre } from '../src/vivienda/espacio';
import type { Vivienda } from '../src/vivienda/modelo';

const vivienda = datos as Vivienda;

/** Altura visible de cada pared/pilar tras actualizar el corte con una cámara. */
function alturas(camara: [number, number, number], objetivo: [number, number, number], modo: 'casa' | 'estancia' = 'casa', estancia?: string) {
  const casa = construirVivienda(vivienda);
  const espacio = new EspacioLibre(vivienda);
  const cortador = new CortadorParedes(casa.verticales, (p) => espacio.dentro(p));
  cortador.modo = modo;
  cortador.estancia = estancia ? vivienda.estancias.find((e) => e.id === estancia)!.poligono : null;
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(...camara);
  cortador.actualizar(cam, new THREE.Vector3(...objetivo));
  const r: Record<string, number> = {};
  for (const el of casa.verticales) r[el.objeto.name] = el.alto * el.objeto.scale.y;
  return r;
}

describe('corte automático de paredes', () => {
  // Vista general desde el sur-este, como al abrir la app
  const general = alturas([10, 9, 14], [6.8, 0, 3.6]);

  it('vista general: las fachadas del fondo se quedan en pie', () => {
    expect(general['pared:fachada-norte']).toBe(2.5);
    expect(general['pared:mirador-frente']).toBe(2.5);
  });

  it('vista general: las paredes que tapan suelo se bajan', () => {
    for (const id of ['rellano', 'salon-este', 'dormitorio-oeste', 'cocina-sur', 'bano-distribuidor']) {
      expect(general[`pared:${id}`], id).toBeLessThan(0.3);
    }
  });

  it('las paredes cortas que tapan (laterales del armario empotrado) también se bajan', () => {
    expect(general['pared:armario-der']).toBeLessThan(0.3);
    // Mirando el dormitorio desde el sur-oeste, el lateral izquierdo tapa el hueco del armario
    const dormitorio = alturas([8, 6, 9], [10.7, 0, 1.9], 'estancia', 'dormitorio');
    expect(dormitorio['pared:armario-izq']).toBeLessThan(0.3);
  });

  it('vista de una estancia: sus paredes del fondo se quedan en pie', () => {
    const salon = alturas([3.5, 6, 9], [3.0, 0, 1.6], 'estancia', 'salon');
    expect(salon['pared:fachada-norte']).toBe(2.5);
    expect(salon['pared:rellano']).toBeLessThan(0.3); // la de delante, sí se baja
  });

  it('la barandilla del balcón no se corta en la vista general', () => {
    expect(general['pared:barandilla-sur']).toBe(1);
  });

  it('mirando el balcón, la barandilla de delante se baja y la del fondo no', () => {
    const balcon = alturas([16, 5, 3], [13.03, 0, 1.47], 'estancia', 'balcon');
    expect(balcon['pared:barandilla-este']).toBeLessThan(0.3); // la de delante (este)
    expect(balcon['pared:barandilla-norte']).toBe(1); // la lateral del fondo
  });

  it('en vista cenital no se corta nada', () => {
    const planta = alturas([6.8, 20, 3.6001], [6.8, 0, 3.6]);
    expect(Object.values(planta).every((h) => h >= 1)).toBe(true);
  });
});
