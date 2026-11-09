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
import { claveSuelo, repeticionesPorMetro, type Suelo } from '../vivienda/suelos';

type RGB = [number, number, number];

// --- Utilidades ---------------------------------------------------------------

/** Generador aleatorio con semilla (mulberry32). */
function aleatorio(semilla: number) {
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
function semillaDe(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return h >>> 0;
}

const hexARgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const css = ([r, g, b]: RGB, a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
const aclarar = (c: RGB, f: number): RGB => c.map((v) => Math.max(0, Math.min(255, v * f))) as RGB;
const mezclar = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => v + (b[i] - v) * t) as RGB;

/**
 * Ruido suave y repetible: una rejilla de valores aleatorios de `periodo` ×
 * `periodo` que se repite. Varias capas (fbm) dan aspecto natural.
 */
function crearRuido(rnd: () => number, periodos: number[]) {
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
function pintarPixeles(ctx: CanvasRenderingContext2D, n: number, color: (u: number, v: number) => RGB) {
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
function rectRepetido(ctx: CanvasRenderingContext2D, n: number, x: number, y: number, w: number, h: number) {
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

/** Tarima: filas de tablas de unos 20 cm de ancho y 0,8–1,6 m de largo, con juntas al tresbolillo y veta. */
function tarima(ctx: CanvasRenderingContext2D, n: number, s: Suelo, rnd: () => number) {
  const base = hexARgb(s.color);
  const filas = Math.max(3, Math.round(s.escala / 0.2));
  const alto = n / filas;
  const ruido = crearRuido(rnd, [2, 4, 8, 16]);
  for (let f = 0; f < filas; f++) {
    const y = f * alto;
    // Dos tablas por fila (la textura es un tramo de `escala` metros), con las juntas desplazadas.
    const j1 = rnd() * n, j2 = j1 + n * (0.35 + rnd() * 0.3);
    for (const [xa, xb] of [[j1, j2], [j2, j1 + n]]) {
      ctx.fillStyle = css(aclarar(base, 0.92 + rnd() * 0.16));
      rectRepetido(ctx, n, xa, y, xb - xa, alto);
    }
    // Veta: líneas finas onduladas (periódicas en x para que case)
    ctx.lineWidth = Math.max(1, n / 512);
    for (let k = 0; k < 7; k++) {
      const yy = y + alto * (0.1 + 0.8 * rnd());
      const ondas = 1 + Math.floor(rnd() * 2), fase = rnd() * Math.PI * 2, amp = alto * (0.03 + rnd() * 0.06);
      ctx.strokeStyle = css(aclarar(base, 0.7 + rnd() * 0.15), 0.1 + rnd() * 0.12);
      ctx.beginPath();
      for (let x = 0; x <= n; x += 4) {
        const yv = yy + amp * Math.sin((2 * Math.PI * ondas * x) / n + fase);
        if (x === 0) ctx.moveTo(x, yv); else ctx.lineTo(x, yv);
      }
      ctx.stroke();
    }
    // Juntas: entre filas y entre tablas
    ctx.fillStyle = css(aclarar(base, 0.42), 0.9);
    rectRepetido(ctx, n, 0, y - 1, n, Math.max(1.5, n / 340));
    for (const jx of [j1, j2]) rectRepetido(ctx, n, jx - 1, y, Math.max(1.5, n / 340), alto);
  }
  // Variación suave de tono por encima
  const img = ctx.getImageData(0, 0, n, n);
  for (let p = 0; p < n * n; p++) {
    const f = 0.92 + 0.16 * ruido((p % n) / n, Math.floor(p / n) / n);
    for (let c = 0; c < 3; c++) img.data[p * 4 + c] = Math.min(255, img.data[p * 4 + c] * f);
  }
  ctx.putImageData(img, 0, 0);
}

/** Mármol: vetas finas y suaves, en baldosas de 60 cm. */
function marmol(ctx: CanvasRenderingContext2D, n: number, s: Suelo, rnd: () => number) {
  const base = hexARgb(s.color);
  const veta = aclarar(mezclar(base, [120, 120, 125], 0.6), 0.85);
  const ruido = crearRuido(rnd, [2, 4, 8, 16, 32]);
  const fino = crearRuido(rnd, [64, 128]);
  pintarPixeles(ctx, n, (u, v) => {
    const t = ruido(u, v);
    const onda = Math.sin(2 * Math.PI * (u * 1 + v * 1) + 4.5 * t);
    const intensidad = Math.pow(1 - Math.abs(onda), 24) * 0.4 + Math.pow(1 - Math.abs(onda), 5) * 0.08;
    const c = mezclar(base, veta, intensidad);
    return aclarar(c, 0.97 + 0.05 * fino(u, v));
  });
  juntas(ctx, n, Math.max(1, Math.round(s.escala / 0.6)), Math.max(1, n / 400), css(aclarar(base, 0.88)));
}

/** Baldosa porcelánica lisa de 60 cm con leve variación entre piezas. */
function baldosa(ctx: CanvasRenderingContext2D, n: number, s: Suelo, rnd: () => number) {
  const base = hexARgb(s.color);
  const piezas = Math.max(1, Math.round(s.escala / 0.6));
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
  const piezas = Math.max(1, Math.round(s.escala / 0.33));
  const tonos = Array.from({ length: piezas * piezas }, () => 0.9 + rnd() * 0.16);
  const ruido = crearRuido(rnd, [6, 24, 96, 192]);
  pintarPixeles(ctx, n, (u, v) => {
    const t = tonos[Math.floor(v * piezas) * piezas + Math.floor(u * piezas)];
    return aclarar(base, t * (0.88 + 0.22 * ruido(u, v)));
  });
  juntas(ctx, n, piezas, Math.max(2, n / 128), css(mezclar(aclarar(base, 0.75), [150, 145, 135], 0.6)));
}

const DIBUJOS: Record<Suelo['tipo'], typeof tarima> = { tarima, marmol, baldosa, microcemento, terrazo, exterior };

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
  tarima: 0.7, marmol: 0.3, baldosa: 0.45, microcemento: 0.65, terrazo: 0.4, exterior: 0.9,
};

const materiales = new Map<string, THREE.MeshStandardMaterial>();

/**
 * Material de un suelo (se reutiliza entre estancias con el mismo suelo).
 * `tamano` es la resolución de la textura en píxeles (menor en el móvil).
 */
export function materialSuelo(s: Suelo, tamano = 512): THREE.MeshStandardMaterial {
  const clave = `${claveSuelo(s)}|${tamano}`;
  let m = materiales.get(clave);
  if (!m) {
    const textura = new THREE.CanvasTexture(dibujarSuelo(s, tamano));
    textura.wrapS = textura.wrapT = THREE.RepeatWrapping;
    textura.repeat.set(repeticionesPorMetro(s), repeticionesPorMetro(s));
    textura.colorSpace = THREE.SRGBColorSpace;
    textura.anisotropy = 8;
    m = new THREE.MeshStandardMaterial({ map: textura, roughness: RUGOSIDAD[s.tipo] });
    m.name = `suelo:${clave}`;
    materiales.set(clave, m);
  }
  return m;
}
