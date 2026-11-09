// Etiquetas HTML con el nombre, la superficie y la altura de techo de cada estancia.

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { Vivienda } from '../vivienda/modelo';
import { alturaEstancia } from '../vivienda/modelo';
import { area, puntoInterior } from '../vivienda/geometria';

const m2 = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export function crearEtiquetas(v: Vivienda): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = 'etiquetas';
  for (const e of v.estancias) {
    const div = document.createElement('div');
    div.className = 'etiqueta-estancia';
    const nombre = document.createElement('strong');
    nombre.textContent = e.nombre;
    const datos = document.createElement('span');
    datos.textContent = e.exterior
      ? `${m2(area(e.poligono))} m² · exterior`
      : `${m2(area(e.poligono))} m² · techo ${m2(alturaEstancia(e, v))} m`;
    div.append(nombre, datos);
    const etiqueta = new CSS2DObject(div);
    const [x, z] = puntoInterior(e.poligono);
    etiqueta.position.set(x, 0.05, z);
    grupo.add(etiqueta);
  }
  return grupo;
}
