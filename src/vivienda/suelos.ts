// Suelos: formato del campo `suelo` de cada estancia y suelos disponibles.
// Sin 3D ni DOM (las texturas se dibujan en src/escena/texturasSuelo.ts).

import { ACABADOS, type Acabado } from './acabados';
import type { Estancia } from './modelo';
import { caja } from './geometria';

/** Tipos de suelo que sabe dibujar la app (cada uno con su propio dibujo procedural). */
export const TIPOS_SUELO = ['tarima', 'baldosa', 'marmol', 'microcemento', 'terrazo', 'exterior', 'granito', 'pizarra'] as const;
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
  /**
   * Tamaño de la pieza (m): ancho de la lama en la tarima, lado de la baldosa
   * en los demás. Si falta, uno típico de cada tipo (lama de 20 cm, baldosa de 60…).
   */
  pieza?: number;
  /** Brillo: mate, satinado o pulido (reflectante). Si falta, el típico del tipo. */
  acabado?: Acabado;
  /**
   * Giro del dibujo en grados (0 o 90). En la tarima, 0 = lamas a lo largo del
   * eje x del plano. Si falta, la tarima se orienta sola a lo largo del lado
   * mayor de la estancia.
   */
  giro?: 0 | 90;
}

/** Un suelo del selector de la interfaz. */
export interface SueloPredefinido extends Suelo {
  id: string;
  nombre: string;
}

/** Los suelos que se pueden elegir en la interfaz. */
export const SUELOS: SueloPredefinido[] = [
  { id: 'tarima-ipe', nombre: 'Tarima ipé oscura', tipo: 'tarima', color: '#56301e', escala: 2.4, pieza: 0.08, acabado: 'satinado' },
  { id: 'tarima-roble', nombre: 'Tarima roble natural', tipo: 'tarima', color: '#a97b4f', escala: 2.4, pieza: 0.2 },
  { id: 'tarima-ceniza', nombre: 'Tarima gris ceniza', tipo: 'tarima', color: '#8d8781', escala: 2.4, pieza: 0.2 },
  { id: 'granito-negro', nombre: 'Granito negro pulido', tipo: 'granito', color: '#121214', escala: 1.2, pieza: 0.6, acabado: 'pulido' },
  { id: 'marmol-claro', nombre: 'Mármol gris claro mate', tipo: 'marmol', color: '#dcdddb', escala: 0.9, pieza: 0.45, acabado: 'mate' },
  { id: 'piedra-oscura', nombre: 'Piedra gris oscuro', tipo: 'marmol', color: '#5d5750', escala: 1.2, pieza: 0.6, acabado: 'mate' },
  { id: 'porcelanico-gris', nombre: 'Porcelánico gris 60×60', tipo: 'baldosa', color: '#8f8d89', escala: 1.2 },
  { id: 'microcemento', nombre: 'Microcemento', tipo: 'microcemento', color: '#bcb5aa', escala: 2 },
  { id: 'terrazo', nombre: 'Terrazo claro', tipo: 'terrazo', color: '#dcd6ca', escala: 0.8 },
  { id: 'pizarra', nombre: 'Pizarra gris exterior', tipo: 'pizarra', color: '#5a5d5f', escala: 1.2, pieza: 0.4, acabado: 'mate' },
];

const porId = (id: string) => SUELOS.find((s) => s.id === id)!;

/** Solo los campos del formato (sin id ni nombre). */
export function soloSuelo(s: Suelo): Suelo {
  const { tipo, color, escala, pieza, acabado, giro } = s;
  return {
    tipo, color, escala,
    ...(pieza !== undefined ? { pieza } : {}),
    ...(acabado !== undefined ? { acabado } : {}),
    ...(giro !== undefined ? { giro } : {}),
  };
}

/**
 * Suelo por defecto de una estancia sin campo `suelo`: tarima oscura en las
 * zonas de estar, mármol claro en las húmedas y pizarra en las exteriores.
 */
export function sueloPorDefecto(e: Pick<Estancia, 'id' | 'exterior'>): Suelo {
  if (e.exterior) return soloSuelo(porId('pizarra'));
  if (['bano', 'aseo'].includes(e.id)) return soloSuelo(porId('marmol-claro'));
  if (e.id === 'cocina') return soloSuelo(porId('granito-negro'));
  if (['tendedero', 'lavadero'].includes(e.id)) return soloSuelo(porId('piedra-oscura'));
  return soloSuelo(porId('tarima-ipe'));
}

/** El suelo que lleva una estancia según vivienda.json (o el de por defecto). */
export function sueloDe(e: Estancia): Suelo {
  return e.suelo ?? sueloPorDefecto(e);
}

/** Tamaño de pieza típico de cada tipo (m), si el suelo no lo indica. */
const PIEZA: Record<TipoSuelo, number> = {
  tarima: 0.2, baldosa: 0.6, marmol: 0.6, microcemento: 0, terrazo: 0, exterior: 0.33, granito: 0.6, pizarra: 0.4,
};

/** Tamaño de la pieza de un suelo (m). */
export function piezaDe(s: Suelo): number {
  return s.pieza ?? PIEZA[s.tipo];
}

/**
 * Giro del dibujo (grados) para una estancia: el del suelo si lo indica; si
 * no, la tarima se pone a lo largo del lado mayor de la estancia.
 */
export function giroDe(s: Suelo, e: Pick<Estancia, 'poligono'>): 0 | 90 {
  if (s.giro !== undefined) return s.giro;
  if (s.tipo !== 'tarima') return 0;
  const c = caja(e.poligono);
  return c.fondo > c.ancho ? 90 : 0;
}

/** Cuántas veces se repite la textura por metro (las coordenadas de textura van en metros). */
export function repeticionesPorMetro(s: Suelo): number {
  return 1 / s.escala;
}

/** Identificador único de un suelo (para no repetir texturas). */
export function claveSuelo(s: Suelo): string {
  return `${s.tipo}|${s.color.toLowerCase()}|${s.escala}|${s.pieza ?? ''}|${s.acabado ?? ''}|${s.giro ?? ''}`;
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
  if (x.pieza !== undefined && !(typeof x.pieza === 'number' && x.pieza >= 0.03 && x.pieza <= x.escala)) return '"suelo.pieza" debe ser un tamaño en metros entre 0,03 y la escala';
  if (x.acabado !== undefined && !ACABADOS.includes(x.acabado)) return '"suelo.acabado" debe ser mate, satinado o pulido';
  if (x.giro !== undefined && x.giro !== 0 && x.giro !== 90) return '"suelo.giro" debe ser 0 o 90';
  return null;
}
