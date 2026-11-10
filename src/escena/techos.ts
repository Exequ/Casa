// Techos: una losa por estancia a su altura de techo (con los falsos techos
// más bajos donde los haya), los focos empotrados y los apliques.
//
// El techo solo se ve desde abajo: su cara mira al suelo, así que desde arriba
// (vista general o en planta) es invisible y deja ver el interior. Además,
// main.ts solo lo muestra cuando la cámara está dentro de la vivienda.
//
// No usa el DOM, así que también se puede usar en los tests.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ladosCompartidos } from '../vivienda/caras';
import { alturaEstancia, type Estancia, type Vivienda } from '../vivienda/modelo';

/** Radio de los focos empotrados (m): unos 8 cm de diámetro. */
const RADIO_FOCO = 0.04;
/** Color de un foco encendido (luz cálida neutra, ~3000 K) y apagado. */
export const COLOR_LUZ = 0xffdcb0;
const COLOR_FOCO_ENCENDIDO = 0xfff1d6;
const COLOR_FOCO_APAGADO = 0xc4c4c0;

export interface TechoEstancia {
  /** Losa del techo. */
  techo: THREE.Mesh;
  /** Discos luminosos de los focos y apliques (null si la estancia no tiene). */
  focos: THREE.Mesh | null;
}

export interface Techos3D {
  grupo: THREE.Group;
  porEstancia: Map<string, TechoEstancia>;
}

const materialTecho = new THREE.MeshStandardMaterial({ color: 0xfbfbf9, roughness: 0.95, name: 'techo' });
const materialTabica = new THREE.MeshStandardMaterial({ color: 0xfbfbf9, roughness: 0.95, side: THREE.DoubleSide, name: 'tabica' });
const materialAro = new THREE.MeshStandardMaterial({ color: 0xe4e4e0, roughness: 0.6, name: 'aro' });

/** Losa del techo de una estancia, mirando hacia abajo, a la altura `alto`. */
export function crearTecho(e: Estancia, alto: number): THREE.Mesh {
  const forma = new THREE.Shape(e.poligono.map(([x, z]) => new THREE.Vector2(x, z)));
  const g = new THREE.ShapeGeometry(forma);
  g.rotateX(Math.PI / 2); // (x, z, 0) → (x, 0, z), con la cara hacia abajo
  g.translate(0, alto, 0);
  const techo = new THREE.Mesh(g, materialTecho);
  techo.name = `techo:${e.id}`;
  techo.receiveShadow = true;
  return techo;
}

/** Construye los techos de todas las estancias interiores. */
export function construirTechos(v: Vivienda): Techos3D {
  const grupo = new THREE.Group();
  grupo.name = 'techos';
  const porEstancia = new Map<string, TechoEstancia>();

  for (const e of v.estancias) {
    if (e.exterior) continue;
    const alto = alturaEstancia(e, v);
    const techo = crearTecho(e, alto);
    grupo.add(techo);

    // Focos: disco luminoso y aro, un pelo por debajo del techo
    const discos: THREE.BufferGeometry[] = [], aros: THREE.BufferGeometry[] = [];
    for (const [x, z] of e.focos ?? []) {
      const d = new THREE.CircleGeometry(RADIO_FOCO, 20);
      d.rotateX(Math.PI / 2);
      d.translate(x, alto - 0.004, z);
      discos.push(d);
      const a = new THREE.RingGeometry(RADIO_FOCO, RADIO_FOCO + 0.014, 24);
      a.rotateX(Math.PI / 2);
      a.translate(x, alto - 0.003, z);
      aros.push(a);
    }
    // Apliques: una barra luminosa en la pared
    for (const ap of e.apliques ?? []) {
      const largo = Math.hypot(ap.hasta[0] - ap.desde[0], ap.hasta[1] - ap.desde[1]);
      const b = new THREE.BoxGeometry(largo, 0.03, 0.04);
      b.rotateY(Math.atan2(-(ap.hasta[1] - ap.desde[1]), ap.hasta[0] - ap.desde[0]));
      b.translate((ap.desde[0] + ap.hasta[0]) / 2, ap.altura, (ap.desde[1] + ap.hasta[1]) / 2);
      discos.push(b.toNonIndexed());
    }
    let focos: THREE.Mesh | null = null;
    if (discos.length) {
      focos = new THREE.Mesh(
        mergeGeometries(discos.map((g) => g.toNonIndexed())),
        new THREE.MeshBasicMaterial({ color: COLOR_FOCO_ENCENDIDO, toneMapped: false }),
      );
      focos.name = `focos:${e.id}`;
      grupo.add(focos);
    }
    if (aros.length) {
      const m = new THREE.Mesh(mergeGeometries(aros), materialAro);
      m.name = `aros:${e.id}`;
      grupo.add(m);
    }
    porEstancia.set(e.id, { techo, focos });
  }

  // Tabicas: el escalón vertical entre dos techos de distinta altura que se tocan sin muro (salón y cocina).
  for (const { a, b, estancias } of ladosCompartidos(v)) {
    const [e1, e2] = estancias.map((id) => v.estancias.find((e) => e.id === id)!);
    if (e1.exterior || e2.exterior) continue;
    const h1 = alturaEstancia(e1, v), h2 = alturaEstancia(e2, v);
    if (Math.abs(h1 - h2) < 1e-6) continue;
    const y1 = Math.min(h1, h2), y2 = Math.max(h1, h2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([a[0], y1, a[1], b[0], y1, b[1], b[0], y2, b[1], a[0], y2, a[1]], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    const tabica = new THREE.Mesh(g, materialTabica);
    tabica.name = `tabica:${estancias.join('-')}`;
    grupo.add(tabica);
  }
  return { grupo, porEstancia };
}

/** Enciende o apaga los discos de los focos de una estancia. */
export function encenderFocos(t: Techos3D, id: string, encendidos: boolean) {
  const focos = t.porEstancia.get(id)?.focos;
  if (focos) (focos.material as THREE.MeshBasicMaterial).color.setHex(encendidos ? COLOR_FOCO_ENCENDIDO : COLOR_FOCO_APAGADO);
}
