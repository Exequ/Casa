// Suelos: formato del campo `suelo` de cada estancia y suelos disponibles.
// Sin 3D ni DOM (las texturas se dibujan en src/escena/texturasSuelo.ts).

import type { Estancia } from './modelo';

/** Tipos de suelo que sabe dibujar la app (cada uno con su propio dibujo procedural). */
export const TIPOS_SUELO = ['tarima', 'baldosa', 'marmol', 'microcemento', 'terrazo', 'exterior'] as const;
export type TipoSuelo = (typeof TIPOS_SUELO)[number];

/**
 * Suelo de una estancia.
 * - `tipo`: el dibujo (tarima, baldosa…).
 * - `color`: color base en hexadecimal ("#5c3b26").
 * - `escala`: metros reales que ocupa una repetición de la textura. Por
 *   ejemplo, en una baldosa de 60 × 60 cm con escala 1,2 la textura lleva
 *   2 × 2 baldosas; en tarima con escala 2,4, un tramo de 2,4 × 2,4 m con
 *   12 filas de tablas de 20 cm.
 */
export interface Suelo {
  tipo: TipoSuelo;
  color: string;
  escala: number;
}

/** Un suelo del selector de la interfaz. */
export interface SueloPredefinido extends Suelo {
  id: string;
  nombre: string;
}

/** Los suelos que se pueden elegir en la interfaz. */
export const SUELOS: SueloPredefinido[] = [
  { id: 'tarima-nogal', nombre: 'Tarima nogal oscuro', tipo: 'tarima', color: '#5c3b26', escala: 2.4 },
  { id: 'tarima-roble', nombre: 'Tarima roble natural', tipo: 'tarima', color: '#a97b4f', escala: 2.4 },
  { id: 'tarima-ceniza', nombre: 'Tarima gris ceniza', tipo: 'tarima', color: '#8d8781', escala: 2.4 },
  { id: 'marmol-blanco', nombre: 'Mármol blanco', tipo: 'marmol', color: '#e9e5df', escala: 1.2 },
  { id: 'porcelanico-gris', nombre: 'Porcelánico gris 60×60', tipo: 'baldosa', color: '#8f8d89', escala: 1.2 },
  { id: 'microcemento', nombre: 'Microcemento', tipo: 'microcemento', color: '#bcb5aa', escala: 2 },
  { id: 'terrazo', nombre: 'Terrazo claro', tipo: 'terrazo', color: '#dcd6ca', escala: 0.8 },
  { id: 'gres-exterior', nombre: 'Gres de exterior 33×33', tipo: 'exterior', color: '#a9714f', escala: 1 },
];

const porId = (id: string) => SUELOS.find((s) => s.id === id)!;

/** Solo los campos del formato (sin id ni nombre). */
export const soloSuelo = ({ tipo, color, escala }: Suelo): Suelo => ({ tipo, color, escala });

/**
 * Suelo por defecto de una estancia sin campo `suelo`: tarima oscura en las
 * zonas de estar, mármol claro en las húmedas y gres en las exteriores.
 */
export function sueloPorDefecto(e: Pick<Estancia, 'id' | 'exterior'>): Suelo {
  if (e.exterior) return soloSuelo(porId('gres-exterior'));
  if (['bano', 'cocina', 'tendedero', 'aseo', 'lavadero'].includes(e.id)) return soloSuelo(porId('marmol-blanco'));
  return soloSuelo(porId('tarima-nogal'));
}

/** El suelo que lleva una estancia según vivienda.json (o el de por defecto). */
export function sueloDe(e: Estancia): Suelo {
  return e.suelo ?? sueloPorDefecto(e);
}

/** Cuántas veces se repite la textura por metro (las coordenadas de textura van en metros). */
export function repeticionesPorMetro(s: Suelo): number {
  return 1 / s.escala;
}

/** Identificador único de un suelo (para no repetir texturas). */
export function claveSuelo(s: Suelo): string {
  return `${s.tipo}|${s.color.toLowerCase()}|${s.escala}`;
}

/** ¿Son el mismo suelo? */
export const mismoSuelo = (a: Suelo, b: Suelo) => claveSuelo(a) === claveSuelo(b);

/** El suelo predefinido que coincide con este (o undefined). */
export const predefinidoDe = (s: Suelo) => SUELOS.find((p) => mismoSuelo(p, s));

/** Comprueba un suelo. Devuelve el error o null. */
export function validarSuelo(s: unknown): string | null {
  const x = s as Partial<Suelo>;
  if (!x || typeof x !== 'object') return '"suelo" debe ser un objeto';
  if (!TIPOS_SUELO.includes(x.tipo as TipoSuelo)) return `"suelo.tipo" debe ser uno de: ${TIPOS_SUELO.join(', ')}`;
  if (typeof x.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(x.color)) return '"suelo.color" debe ser un color como "#a97b4f"';
  if (typeof x.escala !== 'number' || !(x.escala > 0) || x.escala > 20) return '"suelo.escala" debe ser un número de metros entre 0 y 20';
  return null;
}
