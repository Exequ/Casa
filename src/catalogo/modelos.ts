// Carga de los modelos .glb del catálogo.
//
// Cada .glb se descarga una sola vez; después se clona cada vez que se coloca
// en la escena (los clones comparten geometría y materiales, así que es barato).
//
// Al cargarlo, el modelo se "normaliza" para que:
//   - mida exactamente lo que dice su JSON (ancho, fondo, alto), y
//   - su origen quede en el centro de la base (y = 0 es el suelo).
// Así da igual cómo se exportó el modelo: siempre encaja con sus dimensiones reales.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { ItemCatalogo } from './catalogo';

const cargador = new GLTFLoader();
/** Plantillas ya cargadas (o cargándose), por id del catálogo. */
const plantillas = new Map<string, Promise<THREE.Object3D>>();

/** Ajusta el tamaño y el origen del modelo según las dimensiones de la ficha. */
function normalizar(modelo: THREE.Object3D, item: ItemCatalogo): THREE.Object3D {
  const caja = new THREE.Box3().setFromObject(modelo);
  const tam = caja.getSize(new THREE.Vector3());
  const centro = caja.getCenter(new THREE.Vector3());
  const { ancho, fondo, alto } = item.dimensiones;

  // Escala por eje para que coincida con las medidas reales.
  const escala = new THREE.Vector3(
    tam.x > 0 ? ancho / tam.x : 1,
    tam.y > 0 ? alto / tam.y : 1,
    tam.z > 0 ? fondo / tam.z : 1,
  );

  // `ajuste` escala y desplaza el modelo; `raiz` queda con el origen en la base.
  const ajuste = new THREE.Group();
  ajuste.add(modelo);
  ajuste.scale.copy(escala);
  ajuste.position.set(-centro.x * escala.x, -caja.min.y * escala.y, -centro.z * escala.z);

  const raiz = new THREE.Group();
  raiz.add(ajuste);

  // Todas las mallas proyectan y reciben sombras.
  raiz.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return raiz;
}

/** Si un .glb no se puede cargar, mostramos una caja gris con sus dimensiones. */
function cajaDeRepuesto(item: ItemCatalogo): THREE.Object3D {
  const { ancho, fondo, alto } = item.dimensiones;
  const malla = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, alto, fondo),
    new THREE.MeshStandardMaterial({ color: 0x999999 }),
  );
  malla.position.y = alto / 2;
  malla.castShadow = malla.receiveShadow = true;
  const raiz = new THREE.Group();
  raiz.add(malla);
  return raiz;
}

/**
 * Carga un .glb. Si viene incrustado en la propia página (una URL "data:",
 * como en la versión de un solo archivo), se decodifica aquí: algunos
 * visores prohíben pedir URLs "data:" con fetch.
 */
async function leerGlb(url: string) {
  if (!url.startsWith('data:')) return cargador.loadAsync(url);
  const binario = atob(url.slice(url.indexOf(',') + 1));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return cargador.parseAsync(bytes.buffer, '');
}

/** Devuelve una copia nueva del modelo de un objeto del catálogo. */
export async function crearModelo(item: ItemCatalogo): Promise<THREE.Object3D> {
  let plantilla = plantillas.get(item.id);
  if (!plantilla) {
    plantilla = leerGlb(item.urlGlb)
      .then((gltf) => normalizar(gltf.scene, item))
      .catch((error) => {
        console.error(`No se pudo cargar ${item.urlGlb}`, error);
        return cajaDeRepuesto(item);
      });
    plantillas.set(item.id, plantilla);
  }
  return (await plantilla).clone(true);
}
