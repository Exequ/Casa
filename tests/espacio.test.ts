// Comprueba que los muebles respetan paredes, pilares, puertas y ventanas.

import { describe, expect, it } from 'vitest';
import datos from '../data/vivienda.json';
import { EspacioLibre, calcularBordes } from '../src/vivienda/espacio';
import { area, huellaRectangulo, puntoEnPoligono } from '../src/vivienda/geometria';
import type { Punto, Vivienda } from '../src/vivienda/modelo';

const vivienda = datos as Vivienda;
const espacio = new EspacioLibre(vivienda);
const mesa = { ancho: 1.2, fondo: 0.8, giro: 0 };
const estancia = (id: string) => vivienda.estancias.find((e) => e.id === id)!;

describe('geometría básica', () => {
  it('área de un rectángulo', () => {
    expect(area([[0, 0], [4, 0], [4, 3.5], [0, 3.5]])).toBeCloseTo(14, 9);
  });
  it('punto en polígono con forma de L', () => {
    const l: Punto[] = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]];
    expect(puntoEnPoligono([0.5, 1.5], l)).toBe(true);
    expect(puntoEnPoligono([1.5, 1.5], l)).toBe(false);
  });
  it('la huella girada 90° intercambia ancho y fondo', () => {
    const h = huellaRectangulo(0, 0, 2, 1, Math.PI / 2);
    const xs = h.map((p) => p[0]), zs = h.map((p) => p[1]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1, 9);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(2, 9);
  });
  it('el borde compartido entre dos polígonos desaparece', () => {
    const a: Punto[] = [[0, 0], [2, 0], [2, 2], [0, 2]];
    const b: Punto[] = [[2, 0], [4, 0], [4, 2], [2, 2]];
    const bordes = calcularBordes([a, b]);
    const largo = bordes.reduce((s, [p, q]) => s + Math.hypot(q[0] - p[0], q[1] - p[1]), 0);
    expect(largo).toBeCloseTo(12, 9); // perímetro del rectángulo 4 x 2
  });
});

describe('muebles en la vivienda', () => {
  it('una mesa cabe en el centro del salón', () => {
    expect(espacio.esValida({ ...mesa, x: 3, z: 1.5 })).toBe(true);
  });

  it('una mesa no puede atravesar la pared entre salón y baño', () => {
    expect(espacio.esValida({ ...mesa, x: 6.0, z: 1.0 })).toBe(false);
  });

  it('una mesa no puede quedarse en el hueco de una puerta', () => {
    // Puerta del salón al distribuidor: pared en x = 6, hueco entre z ≈ 1.88 y 2.69
    expect(espacio.esValida({ ancho: 0.4, fondo: 0.4, giro: 0, x: 6.0, z: 2.3 })).toBe(false);
  });

  it('un mueble no puede salir por la balconera del dormitorio', () => {
    expect(espacio.esValida({ ancho: 0.6, fondo: 0.6, giro: 0, x: 12.45, z: 1.5 })).toBe(false);
  });

  it('no se puede meter en la muesca de un pilar', () => {
    // Pilar del salón en la fachada norte: x 3.97–4.36, z 0.23–0.42
    expect(espacio.esValida({ ancho: 0.6, fondo: 0.4, giro: 0, x: 4.16, z: 0.45 })).toBe(false);
    expect(espacio.esValida({ ancho: 0.6, fondo: 0.4, giro: 0, x: 4.16, z: 0.63 })).toBe(true);
  });

  it('salón y cocina abierta son un solo espacio: se puede poner algo a caballo', () => {
    // El borde salón-cocina está en z = 3.23 entre x = 1.83 y 3.48
    expect(espacio.esValida({ ancho: 1.0, fondo: 0.6, giro: 0, x: 2.6, z: 3.23 })).toBe(true);
  });

  it('al empujar contra una pared, el mueble se queda pegado a ella', () => {
    // Mesa en el salón empujada hacia el este (pared en x = 5.93)
    const p = espacio.mover({ ...mesa, x: 3, z: 1.5 }, 8, 1.5);
    expect(p.x + mesa.ancho / 2).toBeCloseTo(5.93, 2);
    expect(p.x + mesa.ancho / 2).toBeLessThanOrEqual(5.93 + 0.001); // como mucho 1 mm
    expect(p.z).toBeCloseTo(1.5, 6);
  });

  it('al empujar en diagonal contra una pared, se desliza a lo largo de ella', () => {
    const p = espacio.mover({ ...mesa, x: 3, z: 1.5 }, 8, 1.8);
    expect(p.x + mesa.ancho / 2).toBeCloseTo(5.93, 2);
    expect(p.z).toBeCloseTo(1.8, 2);
  });

  it('al arrastrar, un mueble nunca salta un muro aunque el destino esté libre', () => {
    // Del salón hacia el dormitorio (destino libre, pero hay muros en medio)
    const p = espacio.mover({ ...mesa, x: 3, z: 1.0 }, 10.5, 1.0);
    expect(p.x + mesa.ancho / 2).toBeCloseTo(5.93, 2);
  });

  it('hay paso por las 4 puertas interiores (no por la de entrada)', () => {
    expect(espacio.pasos).toHaveLength(4);
  });

  it('un mueble pasa por una puerta si cabe...', () => {
    const caja = { ancho: 0.4, fondo: 0.4, giro: 0 };
    // Del salón al distribuidor por la puerta del salón (hueco en z 1.88–2.69)
    expect(espacio.mover({ ...caja, x: 5.5, z: 2.3 }, 6.8, 2.3)).toEqual({ x: 6.8, z: 2.3 });
  });

  it('...y no pasa si es más ancho que la puerta', () => {
    const grande = { ancho: 1.0, fondo: 1.0, giro: 0 };
    const p = espacio.mover({ ...grande, x: 5.3, z: 2.3 }, 6.8, 2.3);
    expect(p.x + 0.5).toBeLessThanOrEqual(5.93 + 0.001);
  });

  it('si se suelta en el hueco de una puerta, se coloca en el sitio libre más cercano', () => {
    const enPuerta = { ancho: 0.4, fondo: 0.4, giro: 0, x: 6.0, z: 2.3 };
    expect(espacio.esValida(enPuerta, true)).toBe(true); // se puede pasar por ahí...
    expect(espacio.esValida(enPuerta)).toBe(false); // ...pero no quedarse
    const sitio = espacio.asentar(enPuerta)!;
    expect(espacio.esValida({ ...enPuerta, ...sitio })).toBe(true);
    expect(Math.hypot(sitio.x - 6, sitio.z - 2.3)).toBeLessThan(0.4);
  });

  it('buscarSitio encuentra hueco cerca si el punto pedido no vale', () => {
    const sitio = espacio.buscarSitio({ ...mesa, x: 5.9, z: 1.5 }, 2);
    expect(sitio).not.toBeNull();
    expect(espacio.esValida({ ...mesa, ...sitio! })).toBe(true);
  });

  it('un mueble largo no cabe girado 45° en el distribuidor, pero sí en el salón', () => {
    const armario = { ancho: 0.8, fondo: 0.4, giro: Math.PI / 4 };
    const [cx, cz] = [7.34, 2.31]; // centro del distribuidor
    expect(espacio.esValida({ ...armario, x: cx, z: cz })).toBe(true);
    expect(espacio.esValida({ ancho: 2.2, fondo: 0.6, giro: Math.PI / 4, x: cx, z: cz })).toBe(false);
    expect(espacio.esValida({ ancho: 2.2, fondo: 0.6, giro: Math.PI / 4, x: 3, z: 1.5 })).toBe(true);
  });

  it('todas las estancias tienen sitio para un mueble pequeño en su interior', () => {
    for (const e of vivienda.estancias) {
      const xs = e.poligono.map((p) => p[0]), zs = e.poligono.map((p) => p[1]);
      const sitio = espacio.buscarSitio({ ancho: 0.3, fondo: 0.3, giro: 0, x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 }, 1);
      expect(sitio, e.nombre).not.toBeNull();
      expect(espacio.estanciaEn(sitio!.x, sitio!.z)).toBe(e.id);
    }
    expect(estancia('salon')).toBeDefined();
  });
});

describe('choques entre muebles', () => {
  const mesaEn = (x: number, z: number) => huellaRectangulo(x, z, 1.2, 0.8, 0);

  it('un mueble no puede pisar a otro', () => {
    const otros = [mesaEn(3, 1.5)];
    expect(espacio.esValida({ ...mesa, x: 3.5, z: 1.5 }, false, otros)).toBe(false);
    expect(espacio.esValida({ ...mesa, x: 4.3, z: 1.5 }, false, otros)).toBe(true);
  });

  it('dos muebles pueden quedar pegados (tocarse no es solaparse)', () => {
    expect(espacio.esValida({ ...mesa, x: 4.2, z: 1.5 }, false, [mesaEn(3, 1.5)])).toBe(true);
  });

  it('al arrastrar contra otro mueble se queda pegado a él', () => {
    const p = espacio.mover({ ...mesa, x: 1.5, z: 1.5 }, 4.5, 1.5, [mesaEn(3.5, 1.5)]);
    expect(p.x + 0.6).toBeCloseTo(3.5 - 0.6, 2);
  });

  it('girar dentro de otro mueble no vale', () => {
    const otros = [mesaEn(3, 2.2)];
    expect(espacio.esValida({ ...mesa, x: 3, z: 1.4 }, false, otros)).toBe(true);
    expect(espacio.esValida({ ...mesa, x: 3, z: 1.4, giro: Math.PI / 2 }, false, otros)).toBe(false);
  });

  it('el sitio libre más cercano evita los otros muebles', () => {
    const otros = [mesaEn(3, 1.6)];
    const sitio = espacio.buscarSitio({ ...mesa, x: 3, z: 1.6 }, espacio.radioTotal(), otros)!;
    expect(sitio).not.toBeNull();
    expect(espacio.esValida({ ...mesa, ...sitio }, false, otros)).toBe(true);
    expect(Math.hypot(sitio.x - 3, sitio.z - 1.6)).toBeLessThan(1.3);
  });

  it('si la vivienda está llena, no hay sitio', () => {
    // Un mueble de 6 × 6 m no cabe en ninguna estancia
    expect(espacio.buscarSitio({ ancho: 6, fondo: 6, giro: 0, x: 3, z: 1.6 }, espacio.radioTotal())).toBeNull();
  });
});

