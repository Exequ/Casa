// Texturas de suelo dibujadas por código (con un <canvas>), sin descargar
// imágenes: pesan 0 KB en el repositorio y se generan en el navegador.
//
// Cada textura es "repetible" (sus bordes casan entre sí) y representa
// `escala` metros reales. Como las coordenadas de textura del suelo van en
// metros en planta (ver vivienda3d.ts), basta con repetirla 1/escala veces
// por metro para que todo salga a tamaño real y sin deformarse, sea cual sea
// la forma de la estancia.
//
// Los dibujos usan un generador aleatorio con semilla, así que el mismo suelo
// sale siempre igual.

import * as THREE from 'three';
import { claveSuelo, piezaDe, repeticionesPorMetro, type Suelo } from '../vivienda/suelos';

export type RGB = [number, number, number];

// --- Utilidades ---------------------------------------------------------------

/** Generador aleatorio con semilla (mulberry32). */
export function aleatorio(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semilla estable a partir de un texto. */
export function semillaDe(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const hexARgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
export const css = ([r, g, b]: RGB, a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
export const aclarar = (c: RGB, f: number): RGB => c.map((v) => Math.max(0, Math.min(255, v * f))) as RGB;
export const mezclar = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => v + (b[i] - v) * t) as RGB;

/**
 * Ruido suave y repetible: una rejilla de valores aleatorios de `periodo` ×
 * `periodo` que se repite. Varias capas (fbm) dan aspecto natural.
 */
export function crearRuido(rnd: () => number, periodos: number[]) {
  const capas = periodos.map((p) => ({ p, v: Float32Array.from({ length: p * p }, rnd) }));
  const suave = (t: number) => t * t * (3 - 2 * t);
  /** Valor entre 0 y 1 en (u, v), con u y v entre 0 y 1 (se repite). */
  return (u: number, v: number) => {
    let total = 0, peso = 0, amp = 1;
    for (const { p, v: val } of capas) {
      const x = u * p, y = v * p;
      const x0 = Math.floor(x), y0 = Math.floor(y);
      const fx = suave(x - x0), fy = suave(y - y0);
      const i = (xx: number, yy: number) => val[(((yy % p) + p) % p) * p + (((xx % p) + p) % p)];
      const a = i(x0, y0) + (i(x0 + 1, y0) - i(x0, y0)) * fx;
      const b = i(x0, y0 + 1) + (i(x0 + 1, y0 + 1) - i(x0, y0 + 1)) * fx;
      total += (a + (b - a) * fy) * amp;
      peso += amp;
      amp *= 0.5;
    }
    return total / peso;
  };
}

/** Recorre todos los píxeles y les pone el color que devuelve `color(u, v)`. */
export function pintarPixeles(ctx: CanvasRenderingContext2D, n: number, color: (u: number, v: number) => RGB) {
  const img = ctx.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const [r, g, b] = color(x / n, y / n);
      const k = (y * n + x) * 4;
      img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Dibuja un rectángulo que, si se sale por un borde, reaparece por el contrario (para que la textura case). */
export function rectRepetido(ctx: CanvasRenderingContext2D, n: number, x: number, y: number, w: number, h: number) {
  for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) ctx.fillRect(x + dx, y + dy, w, h);
}

/** Juntas de una cuadrícula de `piezas` × `piezas` baldosas. */
function juntas(ctx: CanvasRenderingContext2D, n: number, piezas: number, grosor: number, color: string) {
  ctx.fillStyle = color;
  const lado = n / piezas;
  for (let i = 0; i < piezas; i++) {
    rectRepetido(ctx, n, i * lado - grosor / 2, 0, grosor, n);
    rectRepetido(ctx, n, 0, i * lado - grosor / 2, n, grosor);
  }
}

// --- Dibujos por tipo -----------------------------------------------------------

/**
 * Tarima: filas de lamas del ancho indicado (`pieza`), de largos variados y
 * con juntas al tresbolillo. Cada lama tiene su tono (en maderas como el ipé
 * cambia mucho de una a otra) y una veta fina.
 */
function tarima(ctx: CanvasRenderingContext2D, n: number, s: Suelo, rnd: () => number) {
  const base = hexARgb(s.color);
  const filas = Math.max(3, Math.round(s.escala / piezaDe(s)));
  const alto = n / filas;
  const estrecha = piezaDe(s) < 0.12; // listón estrecho: más cambio de tono entre lamas
  const ruido = crearRuido(rnd, [2, 4, 8, 16]);
  const junta = Math.max(1, n / 520);
  for (let f = 0; f < filas; f++) {
    const y = f * alto;
    // Lamas de la fila: largos entre 0,5 y 1,3 m (en píxeles), empezando en un punto al azar.
    const cortes: number[] = [];
    let x = rnd() * n;
    const fin = x + n;
    while (x < fin - (0.35 * n) / s.escala) {
      cortes.push(x);
      x += ((0.5 + rnd() * 0.8) * n) / s.escala;
    }
    cortes.forEach((xa, i) => {
      const xb = i + 1 < cortes.length ? cortes[i + 1] : fin;
      const tono = estrecha ? 0.74 + rnd() * 0.36 : 0.92 + rnd() * 0.16;
      // Algunas lamas tiran a rojizo y otras a marrón
      const color = mezclar(aclarar(base, tono), [base[0] * 1.1, base[1] * 0.88, base[2] * 0.8], estrecha ? rnd() * 0.4 : 0);
      ctx.fillStyle = css(color);
      rectRepetido(ctx, n, xa, y, xb - xa, alto);
      // Veta: un par de líneas finas a lo largo de la lama
      ctx.fillStyle = css(aclarar(color, 0.8), 0.35);
      for (let k = 0; k < 2; k++) rectRepetido(ctx, n, xa, y + alto * (0.2 + 0.6 * rnd()), xb - xa, Math.max(1, alto * 0.06));
      // Junta de testa
      ctx.fillStyle = css(aclarar(base, 0.4), 0.9);
      rectRepetido(ctx, n, xa - junta / 2, y, junta, alto);
    });
    // Junta entre filas
    ctx.fillStyle = css(aclarar(base, 0.4), 0.85);
    rectRepetido(ctx, n, 0, y - junta / 2, n, junta);
  }
  // Variación suave de tono por encima
  const img = ctx.getImageData(0, 0, n, n);
  for (let p = 0; p < n * n; p++) {
    const f = 0.93 + 0.14 * ruido((p % n) / n, Math.floor(p / n) / n);
    for (let c = 0; c < 3; c++) img.data[p * 4 + c] = Math.min(255, img.data[p * 4 + c] * f);
  }
  ctx.putImageData(img, 0, 0);
}

/** Mármol o piedra veteada en baldosas: vetas finas, más oscuras en piedra clara y más claras en piedra oscura. */
function marmol(ctx: CanvasRenderingContext2D, n: number, s: Suelo, rnd: () => number) {
  const base = hexARgb(s.color);
  const oscura = base[0] + base[1] + base[2] < 380;
  const veta: RGB = oscura ? mezclar(base, [215, 208, 196], 0.75) : aclarar(mezclar(base, [120, 120, 125], 0.6), 0.85);
  const piezas = Math.max(1, Math.round(s.escala / piezaDe(s)));
  const tonos = Array.from({ length: piezas * piezas }, () => 0.94 + rnd() * 0.1);
  const ruido = crearRuido(rnd, [2, 4, 8, 16, 32]);
  const fino = crearRuido(rnd, [64, 128]);
  pintarPixeles(ctx, n, (u, v) => {
    const t = ruido(u, v);
    const onda = Math.sin(2 * Math.PI * (u * 1 + v * 1) + 4.5 * t);
    const intensidad = Math.pow(1 - Math.abs(onda), 24) * 0.4 + Math.pow(1 - Math.abs(onda), 5) * 0.08;
    const c = mezclar(base, veta, intensidad);
    const tono = tonos[Math.floor(v * piezas) * piezas + Math.floor(u * piezas)];
    return aclarar(c, tono * (0.97 + 0.05 * fino(u, v)));
  });
  juntas(ctx, n, piezas, Math.max(1, n / 400), css(aclarar(base, oscura ? 0.7 : 0.86)));
}

/** Baldosa porcelánica lisa de 60 cm con leve variación entre piezas. */
function baldosa(ctx: CanvasRenderingContext2D, n: number, s: Suelo, rnd: () => number) {
  const base = hexARgb(s.color);
  const piezas = Math.max(1, Math.round(s.escala / piezaDe(s)));
  const tonos = Array.from({ length: piezas * piezas }, () => 0.95 + rnd() * 0.08);
  const ruido = crearRuido(rnd, [8, 32, 128]);
  pintarPixeles(ctx, n, (u, v) => {
    const t = tonos[Math.floor(v * piezas) * piezas + Math.floor(u * piezas)];
    return aclarar(base, t * (0.96 + 0.08 * ruido(u, v)));
  });
  juntas(ctx, n, piezas, Math.max(1.5, n / 256), css(aclarar(base, 0.7)));
}

/** Microcemento: superficie continua con manchas suaves de llana. */
function microcemento(ctx: CanvasRenderingContext2D, n: number, s: Suelo, rnd: () => number) {
  const base = hexARgb(s.color);
  const manchas = crearRuido(rnd, [2, 4, 8]);
  const grano = crearRuido(rnd, [64, 128, 256]);
  pintarPixeles(ctx, n, (u, v) => aclarar(base, 0.9 + 0.17 * manchas(u, v) + 0.05 * (grano(u, v) - 0.5)));
}

/** Terrazo: fondo claro con trocitos de piedra de colores. */
function terrazo(ctx: CanvasRenderingContext2D, n: number, s: Suelo, rnd: () => number) {
  const base = hexARgb(s.color);
  const ruido = crearRuido(rnd, [16, 64]);
  pintarPixeles(ctx, n, (u, v) => aclarar(base, 0.97 + 0.06 * ruido(u, v)));
  const paleta: RGB[] = [aclarar(base, 0.6), [122, 111, 100], [185, 165, 143], [246, 244, 240], [80, 72, 63], [160, 120, 96]];
  const trozos = Math.round(260 * (n / 512) ** 2);
  for (let i = 0; i < trozos; i++) {
    const cx = rnd() * n, cy = rnd() * n, r = (n / 512) * (2 + rnd() ** 2 * 7);
    const lados = 5 + Math.floor(rnd() * 3);
    const puntos = Array.from({ length: lados }, (_, k) => {
      const a = (2 * Math.PI * k) / lados + rnd() * 0.6, rr = r * (0.6 + rnd() * 0.6);
      return [Math.cos(a) * rr, Math.sin(a) * rr];
    });
    ctx.fillStyle = css(paleta[Math.floor(rnd() * paleta.length)]);
    for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) {
      if (cx + dx < -r || cx + dx > n + r || cy + dy < -r || cy + dy > n + r) continue;
      ctx.beginPath();
      puntos.forEach(([px, py], k) => (k ? ctx.lineTo(cx + dx + px, cy + dy + py) : ctx.moveTo(cx + dx + px, cy + dy + py)));
      ctx.fill();
    }
  }
}

/** Gres de exterior: baldosas de 33 cm algo rugosas, con juntas anchas. */
function exterior(ctx: CanvasRenderingContext2D, n: number, s: Suelo, rnd: () => number) {
  const base = hexARgb(s.color);
  const piezas = Math.max(1, Math.round(s.escala / piezaDe(s)));
  const tonos = Array.from({ length: piezas * piezas }, () => 0.9 + rnd() * 0.16);
  const ruido = crearRuido(rnd, [6, 24, 96, 192]);
  pintarPixeles(ctx, n, (u, v) => {
    const t = tonos[Math.floor(v * piezas) * piezas + Math.floor(u * piezas)];
    return aclarar(base, t * (0.88 + 0.22 * ruido(u, v)));
  });
  juntas(ctx, n, piezas, Math.max(2, n / 128), css(mezclar(aclarar(base, 0.75), [150, 145, 135], 0.6)));
}

/** Granito pulido: fondo oscuro con un moteado fino y juntas casi invisibles. */
function granito(ctx: CanvasRenderingContext2D, n: number, s: Suelo, rnd: () => number) {
  const base = hexARgb(s.color);
  const piezas = Math.max(1, Math.round(s.escala / piezaDe(s)));
  fondoGranito(ctx, n, base, rnd);
  juntas(ctx, n, piezas, Math.max(1, n / 512), css(mezclar(base, [60, 60, 64], 0.5)));
}

/** Fondo de granito (sin juntas): también se usa en el frente de la cocina. */
export function fondoGranito(ctx: CanvasRenderingContext2D, n: number, base: RGB, rnd: () => number) {
  const ruido = crearRuido(rnd, [8, 32, 128]);
  pintarPixeles(ctx, n, (u, v) => aclarar(mezclar(base, [70, 72, 78], 0.1 * ruido(u, v)), 1));
  // Motas claras y brillantes, muy pequeñas
  for (let i = 0; i < 900 * (n / 512) ** 2; i++) {
    const g = 60 + rnd() * 120;
    ctx.fillStyle = css([g, g, g + 6], 0.25 + rnd() * 0.45);
    const t = Math.max(1, (n / 512) * (0.6 + rnd() * 1.2));
    ctx.fillRect(rnd() * n, rnd() * n, t, t);
  }
}

/** Pizarra: baldosa gris oscuro con la superficie algo irregular y cambios de tono entre piezas. */
function pizarra(ctx: CanvasRenderingContext2D, n: number, s: Suelo, rnd: () => number) {
  const base = hexARgb(s.color);
  const piezas = Math.max(1, Math.round(s.escala / piezaDe(s)));
  const tonos = Array.from({ length: piezas * piezas }, () => 0.82 + rnd() * 0.36);
  const lajas = crearRuido(rnd, [4, 8, 16, 64]);
  const grano = crearRuido(rnd, [128, 256]);
  pintarPixeles(ctx, n, (u, v) => {
    const t = tonos[Math.floor(v * piezas) * piezas + Math.floor(u * piezas)];
    return aclarar(base, t * (0.86 + 0.22 * lajas(u, v) + 0.06 * grano(u, v)));
  });
  juntas(ctx, n, piezas, Math.max(1.5, n / 256), css(aclarar(base, 0.55)));
}

const DIBUJOS: Record<Suelo['tipo'], typeof tarima> = { tarima, marmol, baldosa, microcemento, terrazo, exterior, granito, pizarra };

/** Dibuja un suelo en un canvas nuevo de `n` × `n` píxeles. */
export function dibujarSuelo(s: Suelo, n = 512): HTMLCanvasElement {
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = n;
  const ctx = lienzo.getContext('2d')!;
  DIBUJOS[s.tipo](ctx, n, s, aleatorio(semillaDe(claveSuelo(s))));
  return lienzo;
}

// --- Materiales -------------------------------------------------------------------

/** Rugosidad de cada tipo (0 = brillo de espejo, 1 = mate). */
const RUGOSIDAD: Record<Suelo['tipo'], number> = {
  tarima: 0.7, marmol: 0.3, baldosa: 0.45, microcemento: 0.65, terrazo: 0.4, exterior: 0.9, granito: 0.12, pizarra: 0.85,
};
/** Rugosidad según el acabado indicado en el suelo. */
export const RUGOSIDAD_ACABADO = { mate: 0.9, satinado: 0.45, pulido: 0.07 } as const;

const materiales = new Map<string, THREE.MeshStandardMaterial>();

/**
 * Material de un suelo (se reutiliza entre estancias con el mismo suelo).
 * `tamano` es la resolución de la textura en píxeles (menor en el móvil).
 */
export function materialSuelo(s: Suelo, tamano = 512, giro: 0 | 90 = 0): THREE.MeshStandardMaterial {
  const clave = `${claveSuelo(s)}|${tamano}|${giro}`;
  let m = materiales.get(clave);
  if (!m) {
    const textura = new THREE.CanvasTexture(dibujarSuelo(s, tamano));
    textura.wrapS = textura.wrapT = THREE.RepeatWrapping;
    textura.repeat.set(repeticionesPorMetro(s), repeticionesPorMetro(s));
    textura.colorSpace = THREE.SRGBColorSpace;
    textura.anisotropy = 8;
    if (giro === 90) textura.rotation = Math.PI / 2;
    m = new THREE.MeshStandardMaterial({
      map: textura,
      roughness: s.acabado ? RUGOSIDAD_ACABADO[s.acabado] : RUGOSIDAD[s.tipo],
    });
    m.name = `suelo:${clave}`;
    materiales.set(clave, m);
  }
  return m;
}
