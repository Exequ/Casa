// Texturas de los revestimientos de pared (alicatados), dibujadas por código
// igual que las de los suelos: repetibles y a escala real.
//
// Las coordenadas de textura de las paredes van en metros: u = distancia a lo
// largo del perímetro de la estancia (así las piezas siguen al doblar la
// esquina) y v = altura sobre el suelo.

import * as THREE from 'three';
import type { MaterialPared } from '../vivienda/acabados';
import {
  RUGOSIDAD_ACABADO, aclarar, aleatorio, crearRuido, css, fondoGranito, hexARgb, mezclar, rectRepetido, semillaDe, type RGB,
} from './texturasSuelo';

/** Tamaño de pieza por defecto [ancho, alto] en metros. */
const PIEZA: [number, number] = [0.6, 0.3];

/** Identificador único de un material de pared. */
export function claveMaterialPared(m: MaterialPared): string {
  return `${m.tipo}|${m.color.toLowerCase()}|${(m.pieza ?? PIEZA).join('x')}|${m.acabado ?? ''}`;
}

/**
 * Metros reales [ancho, alto] que ocupa una repetición de la textura: un
 * número entero de piezas que ronde los 2,4 m.
 */
export function tamanoTextura(m: MaterialPared): [number, number] {
  if (m.tipo === 'granito') return [1.5, 1.5];
  const [pw, ph] = m.pieza ?? PIEZA;
  return [Math.max(1, Math.round(2.4 / pw)) * pw, Math.max(1, Math.round(2.4 / ph)) * ph];
}

/** Dibuja un revestimiento en un canvas de n × n píxeles. */
export function dibujarPared(m: MaterialPared, n = 512): HTMLCanvasElement {
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = n;
  const ctx = lienzo.getContext('2d')!;
  const rnd = aleatorio(semillaDe(claveMaterialPared(m)));
  const base = hexARgb(m.color);

  if (m.tipo === 'granito') {
    fondoGranito(ctx, n, base, rnd);
    return lienzo;
  }

  const [pw, ph] = m.pieza ?? PIEZA;
  const [tw, th] = tamanoTextura(m);
  const columnas = Math.round(tw / pw), filas = Math.round(th / ph);
  const ancho = n / columnas, alto = n / filas;
  const variado = m.tipo === 'alicatado';
  // Tonos del alicatado: blanco veteado, gris claro, gris medio y blanco algo verdoso.
  const tonos: RGB[] = variado
    ? [aclarar(base, 1.07), aclarar(base, 1.07), base, aclarar(base, 0.9), aclarar(base, 0.82), mezclar(base, [222, 230, 214], 0.5)]
    : [base];
  for (let f = 0; f < filas; f++) {
    // Despiece irregular: cada hilada arranca desplazada un cuarto de pieza al azar.
    const desfase = variado ? (Math.floor(rnd() * 4) * ancho) / 4 : 0;
    for (let c = 0; c < columnas; c++) {
      const x = c * ancho + desfase, y = f * alto;
      const color = aclarar(tonos[Math.floor(rnd() * tonos.length)], variado ? 0.98 + rnd() * 0.04 : 0.99 + rnd() * 0.02);
      ctx.fillStyle = css(color);
      rectRepetido(ctx, n, x, y, ancho, alto);
      if (variado) {
        // Vetas suaves en diagonal, recortadas a la pieza
        for (const [dx, dy] of [[-n, 0], [0, 0], [n, 0]]) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x + dx, y + dy, ancho, alto);
          ctx.clip();
          for (let k = 0; k < 3; k++) {
            ctx.strokeStyle = css(aclarar(color, rnd() < 0.5 ? 0.86 : 1.06), 0.35);
            ctx.lineWidth = Math.max(1, (n / 512) * (1 + rnd() * 3));
            const x0 = x + dx + rnd() * ancho, pendiente = (rnd() - 0.5) * 1.6;
            ctx.beginPath();
            ctx.moveTo(x0 - ancho * 0.6, y + dy - alto * 0.6 * pendiente);
            ctx.bezierCurveTo(x0 - ancho * 0.2, y + dy + alto * rnd(), x0 + ancho * 0.2, y + dy + alto * rnd(), x0 + ancho * 0.6, y + dy + alto + alto * 0.6 * pendiente);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
      // Junta vertical
      ctx.fillStyle = css(aclarar(base, variado ? 0.78 : 0.86));
      rectRepetido(ctx, n, x - 0.5, y, Math.max(1, n / 512), alto);
    }
    // Junta horizontal
    ctx.fillStyle = css(aclarar(base, variado ? 0.78 : 0.86));
    rectRepetido(ctx, n, 0, f * alto - 0.5, n, Math.max(1, n / 512));
  }
  // Un velo de ruido muy suave para que no quede plano
  const ruido = crearRuido(rnd, [8, 32]);
  const img = ctx.getImageData(0, 0, n, n);
  for (let p = 0; p < n * n; p++) {
    const k = 0.97 + 0.06 * ruido((p % n) / n, Math.floor(p / n) / n);
    for (let c = 0; c < 3; c++) img.data[p * 4 + c] = Math.min(255, img.data[p * 4 + c] * k);
  }
  ctx.putImageData(img, 0, 0);
  return lienzo;
}

const materiales = new Map<string, THREE.MeshStandardMaterial>();

/** Material de un revestimiento (se reutiliza). Sin navegador (tests), va sin textura. */
export function materialPared(m: MaterialPared, tamano = 512): THREE.MeshStandardMaterial {
  const clave = `${claveMaterialPared(m)}|${tamano}`;
  let material = materiales.get(clave);
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      color: typeof document === 'undefined' ? m.color : 0xffffff,
      roughness: RUGOSIDAD_ACABADO[m.acabado ?? 'satinado'],
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    if (typeof document !== 'undefined') {
      const textura = new THREE.CanvasTexture(dibujarPared(m, tamano));
      const [tw, th] = tamanoTextura(m);
      textura.wrapS = textura.wrapT = THREE.RepeatWrapping;
      textura.repeat.set(1 / tw, 1 / th);
      textura.colorSpace = THREE.SRGBColorSpace;
      textura.anisotropy = 8;
      material.map = textura;
    }
    material.name = `revestimiento:${clave}`;
    materiales.set(clave, material);
  }
  return material;
}
