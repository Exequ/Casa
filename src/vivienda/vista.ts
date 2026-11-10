// Desde dónde mirar una estancia en la vista interior.
//
// Se busca la diagonal más larga que cabe dentro de la estancia (a 30 cm de
// las paredes y sin atravesarlas): mirando a lo largo de ella se ve la mayor
// parte de la estancia, también en las alargadas (tendedero) o en L (salón).
// La cámara se pone en el extremo más cercano a la puerta, como al entrar.

import { distanciaASegmento, puntoEnPoligono } from './geometria';
import type { Punto } from './modelo';

const MARGEN = 0.3;

function dentroConMargen(p: Punto, poligono: Punto[]): boolean {
  if (!puntoEnPoligono(p, poligono, -1)) return false;
  for (let i = 0; i < poligono.length; i++) {
    if (distanciaASegmento(p, poligono[i], poligono[(i + 1) % poligono.length]) < MARGEN) return false;
  }
  return true;
}

/** Puntos de una rejilla (paso en metros) que caen dentro del polígono, lejos de sus lados. */
function rejilla(poligono: Punto[], paso: number): Punto[] {
  const xs = poligono.map((p) => p[0]), zs = poligono.map((p) => p[1]);
  const r: Punto[] = [];
  for (let x = Math.min(...xs) + MARGEN; x <= Math.max(...xs) - MARGEN + 1e-9; x += paso) {
    for (let z = Math.min(...zs) + MARGEN; z <= Math.max(...zs) - MARGEN + 1e-9; z += paso) {
      if (dentroConMargen([x, z], poligono)) r.push([x, z]);
    }
  }
  return r;
}

/** ¿Se ve b desde a sin salir de la estancia? */
function seVe(a: Punto, b: Punto, poligono: Punto[]): boolean {
  const pasos = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.15);
  for (let i = 1; i < pasos; i++) {
    const t = i / pasos;
    if (!puntoEnPoligono([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], poligono, -1)) return false;
  }
  return true;
}

/**
 * Punto de vista para una estancia: `desde` (donde va la cámara) y `hacia`
 * (el otro extremo de la diagonal). `puerta` = un punto junto a la puerta de
 * entrada, si se conoce. Null si la estancia es demasiado pequeña.
 */
export function puntoDeVista(poligono: Punto[], puerta: Punto | null = null): { desde: Punto; hacia: Punto } | null {
  const xs = poligono.map((p) => p[0]), zs = poligono.map((p) => p[1]);
  const lado = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  const puntos = rejilla(poligono, Math.max(0.15, lado / 24));
  if (puntos.length < 2) return null;
  let mejor: [Punto, Punto] | null = null;
  let largo = -1;
  for (let i = 0; i < puntos.length; i++) {
    for (let j = i + 1; j < puntos.length; j++) {
      const [a, b] = [puntos[i], puntos[j]];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d > largo + 1e-9 && seVe(a, b, poligono)) { mejor = [a, b]; largo = d; }
    }
  }
  if (!mejor) return null;
  let [desde, hacia] = mejor;
  if (puerta) {
    const dist = (p: Punto) => Math.hypot(p[0] - puerta[0], p[1] - puerta[1]);
    if (dist(hacia) < dist(desde)) [desde, hacia] = [hacia, desde];
  }
  return { desde, hacia };
}
