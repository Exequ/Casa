// Acabados de las estancias: pintura de paredes, revestimientos (alicatados),
// rodapié y luces. Solo datos y validación, sin 3D ni DOM.
//
// El formato está explicado en el README (sección "Acabados").

/** Punto en planta [x, z] (se repite aquí para no depender de modelo.ts). */
type Punto = [number, number];

/** Tipos de revestimiento de pared que la app sabe dibujar. */
export const TIPOS_REVESTIMIENTO = ['alicatado', 'azulejo', 'granito'] as const;
export type TipoRevestimiento = (typeof TIPOS_REVESTIMIENTO)[number];

export type Acabado = 'mate' | 'satinado' | 'pulido';
export const ACABADOS: Acabado[] = ['mate', 'satinado', 'pulido'];

/**
 * Material de un revestimiento de pared.
 * - `alicatado`: piezas rectangulares en varios tonos del color, veteadas, con despiece irregular.
 * - `azulejo`: piezas lisas de un solo color.
 * - `granito`: piedra oscura moteada, sin juntas.
 */
export interface MaterialPared {
  tipo: TipoRevestimiento;
  /** Color base (#rrggbb). */
  color: string;
  /** Tamaño de la pieza [ancho, alto] en metros. Por defecto [0.6, 0.3]. */
  pieza?: [number, number];
  acabado?: Acabado;
}

/** Un revestimiento: una franja de pared con otro material (alicatado, frente de cocina…). */
export interface Revestimiento {
  nombre?: string;
  material: MaterialPared;
  /** Altura a la que empieza (m). Por defecto 0 (el suelo). */
  desde?: number;
  /** Altura a la que termina (m), o "techo". Por defecto "techo". */
  hasta?: number | 'techo';
  /**
   * Zona en planta [x1, z1, x2, z2]: solo se revisten los trozos de pared de
   * la estancia que caen dentro de ese rectángulo. Sin zona: toda la estancia.
   */
  zona?: [number, number, number, number];
}

/** Aplique lineal de pared (p. ej. el LED sobre el espejo del baño). */
export interface Aplique {
  desde: Punto;
  hasta: Punto;
  /** Altura sobre el suelo (m). */
  altura: number;
}

export interface AcabadoEstancia {
  /** Pintura de las paredes. */
  pared?: { color: string };
  /** Rodapié. `null` = sin rodapié. Si falta: blanco de 10 cm. */
  rodapie?: { alto: number; color: string } | null;
  /** Revestimientos; si se solapan, gana el último de la lista. */
  revestimientos?: Revestimiento[];
}

/** Color de pintura por defecto: blanco roto con un matiz gris. */
export const COLOR_PARED = '#eeede9';
/** Rodapié por defecto: blanco liso de 10 cm. */
export const RODAPIE = { alto: 0.1, color: '#f7f7f5' };

/** Colores de pared que se ofrecen en la interfaz. */
export const COLORES_PARED: { id: string; nombre: string; color: string }[] = [
  { id: 'blanco-roto', nombre: 'Blanco roto', color: COLOR_PARED },
  { id: 'gris-perla', nombre: 'Gris perla', color: '#d9dadb' },
  { id: 'arena', nombre: 'Arena', color: '#e3d8c4' },
  { id: 'greige', nombre: 'Greige', color: '#cdc5b9' },
  { id: 'verde-salvia', nombre: 'Verde salvia', color: '#bfcab9' },
  { id: 'azul-niebla', nombre: 'Azul niebla', color: '#bfccd6' },
  { id: 'terracota', nombre: 'Terracota suave', color: '#d9b49e' },
  { id: 'antracita', nombre: 'Antracita', color: '#6e7175' },
];

const esColor = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
const esNumero = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Color de pintura de una estancia (o el de por defecto). */
export function colorPared(a: AcabadoEstancia | undefined): string {
  return a?.pared?.color ?? COLOR_PARED;
}

/** Rodapié de una estancia: el suyo, ninguno (null) o el de por defecto. */
export function rodapieDe(a: AcabadoEstancia | undefined): { alto: number; color: string } | null {
  return a?.rodapie === undefined ? RODAPIE : a.rodapie;
}

/** Comprueba un color de pared de una escena guardada. Devuelve el error o null. */
export function validarColorPared(p: unknown): string | null {
  const x = p as { color?: unknown };
  if (!x || typeof x !== 'object' || !esColor(x.color)) return 'el color de pared debe ser como "#d9dadb"';
  return null;
}

/** Comprueba el acabado de una estancia. Devuelve la lista de errores. */
export function validarAcabado(a: unknown): string[] {
  const errores: string[] = [];
  const x = a as AcabadoEstancia;
  if (!x || typeof x !== 'object') return ['"acabado" debe ser un objeto'];
  if (x.pared !== undefined && !esColor(x.pared?.color)) errores.push('"acabado.pared.color" debe ser un color como "#eeede9"');
  if (x.rodapie !== undefined && x.rodapie !== null) {
    if (!(esNumero(x.rodapie.alto) && x.rodapie.alto > 0 && x.rodapie.alto <= 0.5)) errores.push('"acabado.rodapie.alto" debe estar entre 0 y 0,5 m');
    if (!esColor(x.rodapie.color)) errores.push('"acabado.rodapie.color" debe ser un color como "#ffffff"');
  }
  if (x.revestimientos !== undefined && !Array.isArray(x.revestimientos)) errores.push('"acabado.revestimientos" debe ser una lista');
  for (const [i, r] of (Array.isArray(x.revestimientos) ? x.revestimientos : []).entries()) {
    const donde = `revestimiento ${r?.nombre ?? i}`;
    const m = r?.material;
    if (!m || !TIPOS_REVESTIMIENTO.includes(m.tipo)) errores.push(`${donde}: "material.tipo" debe ser uno de: ${TIPOS_REVESTIMIENTO.join(', ')}`);
    if (!esColor(m?.color)) errores.push(`${donde}: "material.color" debe ser un color como "#d9dadb"`);
    if (m?.pieza !== undefined && !(Array.isArray(m.pieza) && m.pieza.length === 2 && m.pieza.every((n) => esNumero(n) && n > 0.02))) {
      errores.push(`${donde}: "material.pieza" debe ser [ancho, alto] en metros`);
    }
    if (m?.acabado !== undefined && !ACABADOS.includes(m.acabado)) errores.push(`${donde}: "material.acabado" debe ser mate, satinado o pulido`);
    const desde = r?.desde ?? 0;
    if (!(esNumero(desde) && desde >= 0)) errores.push(`${donde}: "desde" debe ser una altura ≥ 0`);
    if (r?.hasta !== undefined && r.hasta !== 'techo' && !(esNumero(r.hasta) && r.hasta > desde)) {
      errores.push(`${donde}: "hasta" debe ser "techo" o una altura mayor que "desde"`);
    }
    if (r?.zona !== undefined && !(Array.isArray(r.zona) && r.zona.length === 4 && r.zona.every(esNumero))) {
      errores.push(`${donde}: "zona" debe ser [x1, z1, x2, z2]`);
    }
  }
  return errores;
}
