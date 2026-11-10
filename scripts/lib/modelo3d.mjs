// Pequeña librería para construir modelos 3D del catálogo por código.
//
// Las piezas se hacen con las geometrías de three.js (cajas, cajas con
// esquinas redondeadas, cilindros, esferas, tornos, extrusiones...), se
// colocan con posición y giro, y al guardar se juntan todas las piezas de un
// mismo material en una sola malla (pocas mallas = .glb ligero y rápido).
//
// Convenciones (las mismas que espera la app):
//   - Unidades en metros.
//   - El origen está en el centro de la base del objeto (y = 0 es el suelo).
//   - El frente del objeto mira hacia +Z (en los objetos de pared, la trasera
//     es la cara -Z).
// Al guardar se comprueba que la caja envolvente mide lo que dice la ficha
// (ancho × alto × fondo) y está centrada en el origen; si no, da error.
//
// Texturas: un material puede llevar `textura: 'madera'` o `'tela'`. Cada
// pieza recibe coordenadas de textura en metros, proyectadas según la cara y
// con la veta a lo largo del lado más largo de la pieza (una pata, a lo alto;
// un tablero, a lo largo). La imagen (pequeña, en grises) va dentro del .glb.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Document, NodeIO } from '@gltf-transform/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { TEXTURAS } from './texturas.mjs';

/** Tolerancia al comprobar la caja envolvente (m). */
const TOLERANCIA = 0.002;

/** Color hexadecimal (sRGB) → factor lineal de glTF. */
const lineal = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => Math.pow(v / 255, 2.2));

export class Modelo {
  /** `nombre` solo sirve para el archivo; `dimensiones` = { ancho, fondo, alto } esperadas. */
  constructor(nombre, dimensiones) {
    this.nombre = nombre;
    this.dimensiones = dimensiones;
    /** Materiales por nombre: { opciones, geometrias[] } */
    this.materiales = new Map();
  }

  /**
   * Declara un material (se comparte entre todas las piezas que lo usen).
   * opciones: color (hex), rugosidad (0 brillante – 1 mate), metalico (0–1),
   * opacidad (1 = opaco), dobleCara (para láminas sin grosor, como pantallas).
   */
  material(nombre, { color, rugosidad = 0.7, metalico = 0, opacidad = 1, dobleCara = false, textura = null }) {
    if (textura && !TEXTURAS[textura]) throw new Error(`${this.nombre}: textura "${textura}" desconocida`);
    if (!this.materiales.has(nombre)) {
      this.materiales.set(nombre, { opciones: { color, rugosidad, metalico, opacidad, dobleCara, textura }, geometrias: [] });
    }
    return nombre;
  }

  /** Añade una geometría de three.js con una posición, un giro (euler XYZ en radianes) y una escala. */
  pieza(material, geometria, posicion = [0, 0, 0], giro = [0, 0, 0], escala = [1, 1, 1]) {
    return this.piezaConMatriz(material, geometria, new THREE.Matrix4().compose(
      new THREE.Vector3(...posicion),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...giro)),
      new THREE.Vector3(...escala),
    ));
  }

  /** Añade una geometría (en sus coordenadas propias) colocada con una matriz. */
  piezaConMatriz(material, geometria, matriz) {
    const mat = this.materiales.get(material);
    if (!mat) throw new Error(`${this.nombre}: material "${material}" sin declarar`);
    const copia = geometria.clone();
    for (const nombre of Object.keys(copia.attributes)) if (nombre !== 'position' && nombre !== 'normal') copia.deleteAttribute(nombre);
    if (mat.opciones.textura) copia.setAttribute('uv', uvEnMetros(copia, TEXTURAS[mat.opciones.textura].tamano));
    copia.applyMatrix4(matriz);
    if (!copia.index) copia.setIndex([...Array(copia.attributes.position.count).keys()]);
    mat.geometrias.push(copia);
    return this;
  }

  // --- Piezas habituales -------------------------------------------------------

  /** Caja de tamaño [ancho, alto, fondo] con su CENTRO en `posicion`. */
  caja(material, [ancho, alto, fondo], posicion, giro) {
    return this.pieza(material, new THREE.BoxGeometry(ancho, alto, fondo), posicion, giro);
  }

  /** Caja con las esquinas y aristas redondeadas (cojines, tapizados). */
  cajaRedonda(material, [ancho, alto, fondo], radio, posicion, giro, segmentos = 3) {
    const r = Math.min(radio, ancho / 2 - 1e-4, alto / 2 - 1e-4, fondo / 2 - 1e-4);
    return this.pieza(material, new RoundedBoxGeometry(ancho, alto, fondo, segmentos, r), posicion, giro);
  }

  /** Cilindro vertical (o tronco de cono) con su CENTRO en `posicion`. */
  cilindro(material, [radioArriba, radioAbajo, alto], posicion, giro, segmentos = 24, abierto = false) {
    return this.pieza(material, new THREE.CylinderGeometry(radioArriba, radioAbajo, alto, segmentos, 1, abierto), posicion, giro);
  }

  /** Barra redonda de `desde` a `hasta` (puntos [x, y, z]) con un radio. */
  barra(material, desde, hasta, radio, segmentos = 10) {
    const a = new THREE.Vector3(...desde), b = new THREE.Vector3(...hasta);
    const g = new THREE.CylinderGeometry(radio, radio, a.distanceTo(b), segmentos, 1);
    return this.piezaConMatriz(material, g, matrizEntre(a, b));
  }

  /** Barra de sección rectangular de `desde` a `hasta`: `ancho` en el eje X del objeto y `grueso` en el otro. */
  barraCuadrada(material, desde, hasta, grueso, ancho = grueso) {
    const a = new THREE.Vector3(...desde), b = new THREE.Vector3(...hasta);
    const g = new THREE.BoxGeometry(ancho, a.distanceTo(b), grueso);
    return this.piezaConMatriz(material, g, matrizEntre(a, b));
  }

  /** Esfera o parte de ella (theta = ángulo desde el polo de arriba). */
  esfera(material, radio, posicion, { thetaInicio = 0, thetaLargo = Math.PI, segmentos = 32 } = {}, giro) {
    return this.pieza(material, new THREE.SphereGeometry(radio, segmentos, Math.max(4, segmentos / 2), 0, Math.PI * 2, thetaInicio, thetaLargo), posicion, giro);
  }

  /** Superficie de revolución alrededor del eje Y a partir de un perfil [[radio, y], ...]. */
  torno(material, perfil, posicion = [0, 0, 0], segmentos = 32) {
    return this.pieza(material, new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r, y)), segmentos), posicion);
  }

  /** Aro (toro) horizontal de radio `radio` y grosor `tubo`, centrado en `posicion`. */
  aro(material, radio, tubo, posicion, giro = [Math.PI / 2, 0, 0], arco = Math.PI * 2) {
    return this.pieza(material, new THREE.TorusGeometry(radio, tubo, 8, 48, arco), posicion, giro);
  }

  /** Extrusión de una forma 2D (THREE.Shape) con una profundidad. */
  extrusion(material, forma, profundidad, posicion, giro, { bisel = 0, segmentosCurva = 24 } = {}) {
    const g = new THREE.ExtrudeGeometry(forma, {
      depth: profundidad, curveSegments: segmentosCurva,
      bevelEnabled: bisel > 0, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 2,
    });
    return this.pieza(material, g, posicion, giro);
  }

  /**
   * Mueve todas las piezas para que la caja envolvente quede centrada en X y
   * Z y apoyada en y = 0 (para objetos cuya forma no es simétrica, como un trípode).
   */
  centrar() {
    const caja = this.caja3d();
    const c = caja.getCenter(new THREE.Vector3());
    for (const { geometrias } of this.materiales.values()) for (const g of geometrias) g.translate(-c.x, -caja.min.y, -c.z);
    return this;
  }

  /** Medidas reales de lo construido (al milímetro): { ancho, fondo, alto }. */
  medir() {
    const t = this.caja3d().getSize(new THREE.Vector3());
    const r = (n) => Math.round(n * 1000) / 1000;
    return { ancho: r(t.x), fondo: r(t.z), alto: r(t.y) };
  }

  /**
   * Para formas curvas o con biseles, que no salen al milímetro: centra el
   * modelo, comprueba que mide casi lo pedido (±`tolerancia` m por eje) y lo
   * estira esa diferencia para que mida exactamente lo pedido.
   */
  ajustar(objetivo, tolerancia = 0.012) {
    this.centrar();
    const t = this.caja3d().getSize(new THREE.Vector3());
    const real = { ancho: t.x, alto: t.y, fondo: t.z };
    for (const eje of ['ancho', 'fondo', 'alto']) {
      if (Math.abs(real[eje] - objetivo[eje]) > tolerancia) {
        throw new Error(`${this.nombre}: ${eje} construido ${real[eje].toFixed(3)} m, pedido ${objetivo[eje]} m`);
      }
    }
    const e = new THREE.Matrix4().makeScale(objetivo.ancho / t.x, objetivo.alto / t.y, objetivo.fondo / t.z);
    for (const { geometrias } of this.materiales.values()) for (const g of geometrias) g.applyMatrix4(e);
    this.dimensiones = { ...objetivo };
    return this;
  }

  // --- Guardar -------------------------------------------------------------------

  /** Caja envolvente de todas las piezas. */
  caja3d() {
    const caja = new THREE.Box3();
    for (const { geometrias } of this.materiales.values()) {
      for (const g of geometrias) { g.computeBoundingBox(); caja.union(g.boundingBox); }
    }
    return caja;
  }

  /**
   * Escribe el .glb. Comprueba antes la caja envolvente. Devuelve
   * { triangulos, materiales, bytes }.
   */
  async guardar(ruta) {
    const caja = this.caja3d();
    const t = caja.getSize(new THREE.Vector3());
    const c = caja.getCenter(new THREE.Vector3());
    const { ancho, fondo, alto } = this.dimensiones;
    const fallos = [];
    if (Math.abs(t.x - ancho) > TOLERANCIA) fallos.push(`ancho ${t.x.toFixed(4)} ≠ ${ancho}`);
    if (Math.abs(t.y - alto) > TOLERANCIA) fallos.push(`alto ${t.y.toFixed(4)} ≠ ${alto}`);
    if (Math.abs(t.z - fondo) > TOLERANCIA) fallos.push(`fondo ${t.z.toFixed(4)} ≠ ${fondo}`);
    if (Math.abs(c.x) > TOLERANCIA || Math.abs(c.z) > TOLERANCIA || Math.abs(caja.min.y) > TOLERANCIA) {
      fallos.push(`no está centrado en la base: centro (${c.x.toFixed(4)}, ${c.z.toFixed(4)}), y mínima ${caja.min.y.toFixed(4)}`);
    }
    if (fallos.length) throw new Error(`${this.nombre}: la caja envolvente no coincide con la ficha: ${fallos.join('; ')}`);

    const doc = new Document();
    const buffer = doc.createBuffer();
    const malla = doc.createMesh(this.nombre);
    let triangulos = 0;
    // Una imagen por tipo de textura, compartida por todos los materiales que la usan
    const imagenes = new Map();
    const imagen = (tipo) => {
      if (!imagenes.has(tipo)) {
        const t = TEXTURAS[tipo].crear();
        imagenes.set(tipo, { textura: doc.createTexture(tipo).setImage(new Uint8Array(t.png)).setMimeType('image/png'), media: t.media });
      }
      return imagenes.get(tipo);
    };
    for (const [nombre, { opciones, geometrias }] of this.materiales) {
      if (!geometrias.length) continue;
      // Una sola malla por material, sin vértices repetidos (mismo punto y misma normal)
      const g = mergeVertices(mergeGeometries(geometrias, false), 1e-5);
      const n = g.attributes.position.count;
      const indices = n > 65535 ? new Uint32Array(g.index.array) : new Uint16Array(g.index.array);
      triangulos += indices.length / 3;
      // Con textura, el color se aclara lo que la oscurece la imagen (de media), para conservar el tono
      const tex = opciones.textura ? imagen(opciones.textura) : null;
      const color = lineal(opciones.color).map((c) => Math.min(1, tex ? c / Math.pow(tex.media, 2.2) : c));
      const mat = doc.createMaterial(nombre)
        .setBaseColorFactor([...color, opciones.opacidad])
        .setRoughnessFactor(opciones.rugosidad)
        .setMetallicFactor(opciones.metalico)
        .setDoubleSided(opciones.dobleCara);
      if (opciones.opacidad < 1) mat.setAlphaMode('BLEND');
      if (tex) mat.setBaseColorTexture(tex.textura);
      const prim = doc.createPrimitive()
        .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.attributes.position.array)).setBuffer(buffer))
        .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.attributes.normal.array)).setBuffer(buffer))
        .setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer))
        .setMaterial(mat);
      if (tex) prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(g.attributes.uv.array)).setBuffer(buffer));
      malla.addPrimitive(prim);
    }
    const nodo = doc.createNode(this.nombre).setMesh(malla);
    doc.createScene(this.nombre).addChild(nodo);
    const glb = await new NodeIO().writeBinary(doc);
    mkdirSync(dirname(ruta), { recursive: true });
    writeFileSync(ruta, glb);
    return { triangulos, materiales: this.materiales.size, bytes: glb.length };
  }
}

/** Matriz que lleva el eje Y de una pieza (centrada) del punto a al punto b. */
function matrizEntre(a, b) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
}

/**
 * Coordenadas de textura en metros de una pieza (en sus coordenadas propias):
 * cada cara se proyecta sobre el plano al que más mira, y U va a lo largo del
 * lado más largo de la pieza dentro de ese plano (la veta sigue la pieza).
 */
function uvEnMetros(g, [tamU, tamV]) {
  g.computeBoundingBox();
  const t = g.boundingBox.getSize(new THREE.Vector3()).toArray();
  const pos = g.attributes.position, nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const n = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))];
    const eje = n.indexOf(Math.max(...n));
    const [a, b] = [0, 1, 2].filter((k) => k !== eje);
    const [ejeU, ejeV] = t[a] >= t[b] ? [a, b] : [b, a];
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    uv[i * 2] = p[ejeU] / tamU;
    uv[i * 2 + 1] = p[ejeV] / tamV;
  }
  return new THREE.BufferAttribute(uv, 2);
}

/** Escribe un objeto del catálogo: el .glb y su ficha .json al lado. */
export async function guardarObjeto(carpetaCatalogo, ruta, ficha, modelo) {
  const base = `${carpetaCatalogo}/${ruta}`;
  const info = await modelo.guardar(`${base}.glb`);
  mkdirSync(dirname(base), { recursive: true });
  writeFileSync(`${base}.json`, JSON.stringify(ficha, null, 2) + '\n');
  console.log(`✔ catalogo/${ruta}  ${info.triangulos} triángulos, ${info.materiales} materiales, ${(info.bytes / 1024).toFixed(1)} KB`);
  return info;
}
