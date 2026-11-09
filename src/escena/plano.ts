// Modo de comprobación: la imagen del plano original, semitransparente y a
// escala, sobre el suelo. Sirve para ver si la geometría coincide con el plano.

import * as THREE from 'three';
import type { Plano } from '../vivienda/modelo';

// Vite nos da la URL final de cada imagen de la carpeta planos/.
const imagenes = import.meta.glob<string>(['/planos/*.{png,jpg,jpeg,webp}', '!/planos/*-original.*'], { eager: true, query: '?url', import: 'default' });

/** Altura a la que se dibuja: justo por encima de la huella de los muros. */
const ALTURA = 0.03;

export function crearCapaPlano(plano: Plano): THREE.Mesh | null {
  const url = imagenes['/' + plano.imagen.replace(/^\/+/, '')];
  if (!url) {
    console.warn(`No se encuentra la imagen del plano: ${plano.imagen}`);
    return null;
  }
  const ancho = plano.anchoPx / plano.pixelesPorMetro;
  const alto = plano.altoPx / plano.pixelesPorMetro;
  const textura = new THREE.TextureLoader().load(url);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;

  const geometria = new THREE.PlaneGeometry(ancho, alto);
  geometria.rotateX(-Math.PI / 2); // tumbado sobre el suelo, con la parte de arriba de la imagen hacia -z
  const capa = new THREE.Mesh(
    geometria,
    new THREE.MeshBasicMaterial({ map: textura, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }),
  );
  // El píxel origenPx debe caer en (0, 0): el centro de la imagen queda desplazado.
  capa.position.set(
    (plano.anchoPx / 2 - plano.origenPx[0]) / plano.pixelesPorMetro,
    ALTURA,
    (plano.altoPx / 2 - plano.origenPx[1]) / plano.pixelesPorMetro,
  );
  capa.renderOrder = 10;
  capa.name = 'plano';
  capa.visible = false;
  return capa;
}
