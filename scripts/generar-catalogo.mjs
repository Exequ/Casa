// Genera los objetos de ejemplo del catálogo (mesa y armario).
//
// Uso:  npm run catalogo:ejemplos
//
// Por cada objeto escribe dos archivos en catalogo/:
//   - <id>.glb   → el modelo 3D (hecho con cajas)
//   - <id>.json  → la ficha: nombre, categoría, dimensiones reales y ruta del glb
//
// Convenciones de los modelos (las mismas que espera la app):
//   - Unidades en metros.
//   - El origen está en el centro de la base del objeto (y = 0 es el suelo).
//   - El frente del objeto mira hacia +Z.

import { Document, NodeIO } from '@gltf-transform/core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CARPETA = join(dirname(fileURLToPath(import.meta.url)), '..', 'catalogo');

/**
 * Crea la geometría de una caja (24 vértices: 4 por cara, para que cada cara
 * tenga su propia normal y la iluminación se vea plana y nítida).
 */
function geometriaCaja(ancho, alto, fondo) {
  const x = ancho / 2, y = alto / 2, z = fondo / 2;
  // Cada cara: normal + 4 esquinas en sentido antihorario visto desde fuera.
  const caras = [
    { n: [1, 0, 0], v: [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]] },
    { n: [-1, 0, 0], v: [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]] },
    { n: [0, 1, 0], v: [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]] },
    { n: [0, -1, 0], v: [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]] },
    { n: [0, 0, 1], v: [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]] },
    { n: [0, 0, -1], v: [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]] },
  ];
  const posiciones = [], normales = [], indices = [];
  caras.forEach((cara, i) => {
    for (const v of cara.v) {
      posiciones.push(...v);
      normales.push(...cara.n);
    }
    const b = i * 4;
    indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  return {
    posiciones: new Float32Array(posiciones),
    normales: new Float32Array(normales),
    indices: new Uint16Array(indices),
  };
}

/** Pequeño constructor de modelos: cada pieza es una caja con su material. */
class Modelo {
  constructor(nombre) {
    this.doc = new Document();
    this.buffer = this.doc.createBuffer();
    this.escena = this.doc.createScene(nombre);
    this.materiales = new Map();
  }

  /** Material PBR sencillo: color (hex) y rugosidad (0 = brillante, 1 = mate). */
  material(nombre, colorHex, rugosidad = 0.7) {
    const c = [(colorHex >> 16) & 255, (colorHex >> 8) & 255, colorHex & 255]
      // glTF guarda los colores en espacio lineal
      .map((v) => Math.pow(v / 255, 2.2));
    const m = this.doc.createMaterial(nombre)
      .setBaseColorFactor([...c, 1])
      .setRoughnessFactor(rugosidad)
      .setMetallicFactor(0);
    this.materiales.set(nombre, m);
    return m;
  }

  /**
   * Añade una caja de tamaño (ancho, alto, fondo) cuyo CENTRO está en (x, y, z).
   */
  caja(nombre, material, [ancho, alto, fondo], [x, y, z]) {
    const g = geometriaCaja(ancho, alto, fondo);
    const doc = this.doc;
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(g.posiciones).setBuffer(this.buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(g.normales).setBuffer(this.buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(g.indices).setBuffer(this.buffer))
      .setMaterial(material);
    const malla = doc.createMesh(nombre).addPrimitive(prim);
    const nodo = doc.createNode(nombre).setMesh(malla).setTranslation([x, y, z]);
    this.escena.addChild(nodo);
  }

  async guardar(ruta) {
    const glb = await new NodeIO().writeBinary(this.doc);
    writeFileSync(ruta, glb);
  }
}

/** Escribe la ficha JSON y el GLB de un objeto. */
async function guardarObjeto(id, ficha, modelo) {
  mkdirSync(CARPETA, { recursive: true });
  await modelo.guardar(join(CARPETA, `${id}.glb`));
  writeFileSync(join(CARPETA, `${id}.json`), JSON.stringify(ficha, null, 2) + '\n');
  console.log(`✔ catalogo/${id}.json + catalogo/${id}.glb`);
}

// ---------------------------------------------------------------------------
// Mesa: tablero + 4 patas. 1,20 x 0,80 x 0,75 m
// ---------------------------------------------------------------------------
async function mesa() {
  const ancho = 1.2, fondo = 0.8, alto = 0.75;
  const grosorTablero = 0.04, pata = 0.05, margen = 0.04;

  const m = new Modelo('mesa');
  const madera = m.material('madera', 0xb07a4a, 0.6);
  const patas = m.material('patas', 0x3b3b3b, 0.5);

  m.caja('tablero', madera, [ancho, grosorTablero, fondo], [0, alto - grosorTablero / 2, 0]);
  const altoPata = alto - grosorTablero;
  const px = ancho / 2 - margen - pata / 2;
  const pz = fondo / 2 - margen - pata / 2;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    m.caja('pata', patas, [pata, altoPata, pata], [sx * px, altoPata / 2, sz * pz]);
  }

  await guardarObjeto('mesa', {
    nombre: 'Mesa de comedor',
    categoria: 'Mesas',
    dimensiones: { ancho, fondo, alto },
    glb: 'mesa.glb',
  }, m);
}

// ---------------------------------------------------------------------------
// Armario: cuerpo + dos puertas con tiradores. 1,00 x 0,60 x 2,00 m
// ---------------------------------------------------------------------------
async function armario() {
  const ancho = 1.0, fondo = 0.6, alto = 2.0;
  const grosorPuerta = 0.02, zocalo = 0.06, holgura = 0.004;

  const m = new Modelo('armario');
  const cuerpo = m.material('cuerpo', 0xe9e4da, 0.8);
  const puertas = m.material('puertas', 0xf4f1ea, 0.7);
  const metal = m.material('tiradores', 0x8a8f96, 0.3);
  const sombra = m.material('zocalo', 0x4a4a4a, 0.9);

  // Medido de atrás (-fondo/2) hacia delante: cuerpo, puertas y tiradores.
  // Los tiradores sobresalen 2 cm y llegan justo a +fondo/2.
  const salidaTirador = 0.02;
  const frentePuertas = fondo / 2 - salidaTirador;
  const traseraPuertas = frentePuertas - grosorPuerta;
  const fondoCuerpo = traseraPuertas + fondo / 2;
  const zCuerpo = (-fondo / 2 + traseraPuertas) / 2;
  m.caja('zocalo', sombra, [ancho - 0.04, zocalo, fondoCuerpo - 0.04], [0, zocalo / 2, zCuerpo]);
  m.caja('cuerpo', cuerpo, [ancho, alto - zocalo, fondoCuerpo], [0, zocalo + (alto - zocalo) / 2, zCuerpo]);

  // Dos puertas, separadas por una pequeña holgura.
  const anchoPuerta = ancho / 2 - holgura;
  const altoPuerta = alto - zocalo - holgura * 2;
  const zPuerta = frentePuertas - grosorPuerta / 2;
  const yPuerta = zocalo + holgura + altoPuerta / 2;
  for (const lado of [-1, 1]) {
    m.caja('puerta', puertas, [anchoPuerta, altoPuerta, grosorPuerta], [lado * (ancho / 4), yPuerta, zPuerta]);
    // Tirador vertical cerca del centro del armario
    m.caja('tirador', metal, [0.015, 0.25, salidaTirador], [lado * 0.05, 1.05, frentePuertas + salidaTirador / 2]);
  }

  await guardarObjeto('armario', {
    nombre: 'Armario de 2 puertas',
    categoria: 'Almacenaje',
    dimensiones: { ancho, fondo, alto },
    glb: 'armario.glb',
  }, m);
}

await mesa();
await armario();
