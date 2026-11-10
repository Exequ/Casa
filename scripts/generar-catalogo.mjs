// Genera los objetos de ejemplo del catálogo: mesa y armario (suelo) y, de
// forma provisional hasta tener los reales, un cuadro y un espejo (pared), un
// jarrón (superficie) y una planta en maceta (suelo o superficie).
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

/**
 * Geometría de un tronco de cono (cilindro si los dos radios son iguales),
 * con tapas, de altura `alto` y centrado en su eje (y de -alto/2 a alto/2).
 */
function geometriaCilindro(radioArriba, radioAbajo, alto, segmentos = 20) {
  const posiciones = [], normales = [], indices = [];
  const y = alto / 2;
  // Lateral: normal inclinada según la pendiente
  const pendiente = (radioAbajo - radioArriba) / alto;
  for (let i = 0; i <= segmentos; i++) {
    const a = (i / segmentos) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    const l = Math.hypot(1, pendiente);
    posiciones.push(c * radioAbajo, -y, s * radioAbajo, c * radioArriba, y, s * radioArriba);
    normales.push(c / l, pendiente / l, s / l, c / l, pendiente / l, s / l);
  }
  for (let i = 0; i < segmentos; i++) {
    const b = i * 2;
    indices.push(b, b + 1, b + 3, b, b + 3, b + 2);
  }
  // Tapas
  for (const [r, yy, ny] of [[radioArriba, y, 1], [radioAbajo, -y, -1]]) {
    if (r <= 0) continue;
    const centro = posiciones.length / 3;
    posiciones.push(0, yy, 0);
    normales.push(0, ny, 0);
    for (let i = 0; i <= segmentos; i++) {
      const a = (i / segmentos) * Math.PI * 2;
      posiciones.push(Math.cos(a) * r, yy, Math.sin(a) * r);
      normales.push(0, ny, 0);
    }
    for (let i = 0; i < segmentos; i++) {
      if (ny > 0) indices.push(centro, centro + i + 2, centro + i + 1);
      else indices.push(centro, centro + i + 1, centro + i + 2);
    }
  }
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
  material(nombre, colorHex, rugosidad = 0.7, metalico = 0) {
    const c = [(colorHex >> 16) & 255, (colorHex >> 8) & 255, colorHex & 255]
      // glTF guarda los colores en espacio lineal
      .map((v) => Math.pow(v / 255, 2.2));
    const m = this.doc.createMaterial(nombre)
      .setBaseColorFactor([...c, 1])
      .setRoughnessFactor(rugosidad)
      .setMetallicFactor(metalico);
    this.materiales.set(nombre, m);
    return m;
  }

  /**
   * Añade una caja de tamaño (ancho, alto, fondo) cuyo CENTRO está en (x, y, z).
   */
  caja(nombre, material, [ancho, alto, fondo], [x, y, z]) {
    this.pieza(nombre, material, geometriaCaja(ancho, alto, fondo), [x, y, z]);
  }

  /** Añade un cilindro (o tronco de cono) vertical cuyo CENTRO está en (x, y, z). */
  cilindro(nombre, material, [radioArriba, radioAbajo, alto], [x, y, z], segmentos = 20) {
    this.pieza(nombre, material, geometriaCilindro(radioArriba, radioAbajo, alto, segmentos), [x, y, z]);
  }

  pieza(nombre, material, g, [x, y, z]) {
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
    superficies: [alto],
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

// ---------------------------------------------------------------------------
// Objetos de decoración PROVISIONALES (se sustituirán por los reales).
// Los de pared tienen el frente hacia +Z y la trasera en z = -fondo/2.
// ---------------------------------------------------------------------------

/** Cuadro de 40 x 30 cm: marco negro, paspartú blanco y una "pintura" de colores. */
async function cuadro() {
  const ancho = 0.4, alto = 0.3, fondo = 0.03, marco = 0.02;
  const m = new Modelo('cuadro');
  const negro = m.material('marco', 0x1e1e1e, 0.5);
  const paspartu = m.material('paspartu', 0xf3f1ec, 0.9);
  const azul = m.material('azul', 0x3d6a8f, 0.8);
  const ocre = m.material('ocre', 0xd29a46, 0.8);
  const z = 0;
  // Marco: 4 listones
  m.caja('marco-arriba', negro, [ancho, marco, fondo], [0, alto - marco / 2, z]);
  m.caja('marco-abajo', negro, [ancho, marco, fondo], [0, marco / 2, z]);
  m.caja('marco-izq', negro, [marco, alto - 2 * marco, fondo], [-ancho / 2 + marco / 2, alto / 2, z]);
  m.caja('marco-der', negro, [marco, alto - 2 * marco, fondo], [ancho / 2 - marco / 2, alto / 2, z]);
  // Fondo y pintura, un poco hundidos
  m.caja('paspartu', paspartu, [ancho - 2 * marco, alto - 2 * marco, 0.01], [0, alto / 2, -fondo / 2 + 0.005]);
  m.caja('cielo', azul, [0.24, 0.1, 0.004], [0, alto / 2 + 0.04, -fondo / 2 + 0.012]);
  m.caja('campo', ocre, [0.24, 0.08, 0.004], [0, alto / 2 - 0.05, -fondo / 2 + 0.012]);
  await guardarObjeto('cuadro', {
    nombre: 'Cuadro 40 × 30 (provisional)',
    categoria: 'Decoración de pared',
    colocacion: 'pared',
    alturaCentro: 1.5,
    dimensiones: { ancho, fondo, alto },
    glb: 'cuadro.glb',
  }, m);
}

/** Espejo de 60 x 90 cm con marco fino plateado. */
async function espejo() {
  const ancho = 0.6, alto = 0.9, fondo = 0.025, marco = 0.025;
  const m = new Modelo('espejo');
  const plata = m.material('marco', 0xb9bcc0, 0.35, 0.8);
  // No del todo metálico: así se ve claro también en el móvil, donde no hay mapa de entorno que reflejar
  const luna = m.material('espejo', 0xd8e2e8, 0.12, 0.55);
  m.caja('marco-arriba', plata, [ancho, marco, fondo], [0, alto - marco / 2, 0]);
  m.caja('marco-abajo', plata, [ancho, marco, fondo], [0, marco / 2, 0]);
  m.caja('marco-izq', plata, [marco, alto - 2 * marco, fondo], [-ancho / 2 + marco / 2, alto / 2, 0]);
  m.caja('marco-der', plata, [marco, alto - 2 * marco, fondo], [ancho / 2 - marco / 2, alto / 2, 0]);
  m.caja('luna', luna, [ancho - 2 * marco, alto - 2 * marco, 0.008], [0, alto / 2, -fondo / 2 + 0.008]);
  await guardarObjeto('espejo', {
    nombre: 'Espejo 60 × 90 (provisional)',
    categoria: 'Decoración de pared',
    colocacion: 'pared',
    alturaCentro: 1.45,
    dimensiones: { ancho, fondo, alto },
    glb: 'espejo.glb',
  }, m);
}

/** Jarrón de cerámica de 25 cm de alto. */
async function jarron() {
  const alto = 0.25, diametro = 0.14;
  const m = new Modelo('jarron');
  const ceramica = m.material('ceramica', 0x2f6f73, 0.35);
  const r = diametro / 2;
  // Perfil: base, panza, cuello y boca
  m.cilindro('base', ceramica, [r * 0.85, r * 0.6, 0.03], [0, 0.015, 0]);
  m.cilindro('panza', ceramica, [r, r * 0.85, 0.1], [0, 0.08, 0]);
  m.cilindro('hombro', ceramica, [r * 0.45, r, 0.06], [0, 0.16, 0]);
  m.cilindro('cuello', ceramica, [r * 0.45, r * 0.45, 0.04], [0, 0.21, 0]);
  m.cilindro('boca', ceramica, [r * 0.6, r * 0.45, 0.01], [0, 0.245, 0]);
  await guardarObjeto('jarron', {
    nombre: 'Jarrón 25 cm (provisional)',
    categoria: 'Decoración',
    colocacion: 'superficie',
    dimensiones: { ancho: diametro, fondo: diametro, alto },
    glb: 'jarron.glb',
  }, m);
}

/** Planta en maceta de 45 cm de alto. */
async function planta() {
  const alto = 0.45, diametro = 0.3;
  const m = new Modelo('planta');
  const barro = m.material('maceta', 0xb5653d, 0.85);
  const tierra = m.material('tierra', 0x3b2a1e, 1);
  const hoja = m.material('hojas', 0x3f7d3a, 0.75);
  const hojaClara = m.material('hojas-claras', 0x5f9a48, 0.75);
  // Maceta de 18 cm de alto y 20 cm de diámetro
  m.cilindro('maceta', barro, [0.1, 0.08, 0.18], [0, 0.09, 0]);
  m.cilindro('tierra', tierra, [0.092, 0.092, 0.01], [0, 0.175, 0]);
  // Follaje: discos superpuestos que forman una copa redondeada de 30 cm
  const capas = [[0.09, 0.2], [0.13, 0.25], [0.15, 0.3], [0.14, 0.35], [0.1, 0.4], [0.05, 0.44]];
  capas.forEach(([radio, y], i) => {
    m.cilindro('follaje', i % 2 ? hojaClara : hoja, [radio, radio * 0.95, 0.05], [0, y - 0.015, 0], 9);
  });
  await guardarObjeto('planta', {
    nombre: 'Planta en maceta 45 cm (provisional)',
    categoria: 'Decoración',
    colocacion: 'superficie',
    dimensiones: { ancho: diametro, fondo: diametro, alto },
    glb: 'planta.glb',
  }, m);
}

await mesa();
await armario();
await cuadro();
await espejo();
await jarron();
await planta();
