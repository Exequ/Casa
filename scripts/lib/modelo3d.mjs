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

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Document, NodeIO } from '@gltf-transform/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

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
  material(nombre, { color, rugosidad = 0.7, metalico = 0, opacidad = 1, dobleCara = false }) {
    if (!this.materiales.has(nombre)) {
      this.materiales.set(nombre, { opciones: { color, rugosidad, metalico, opacidad, dobleCara }, geometrias: [] });
    }
    return nombre;
  }

  /** Añade una geometría de three.js con una posición, un giro (euler XYZ en radianes) y una escala. */
  pieza(material, geometria, posicion = [0, 0, 0], giro = [0, 0, 0], escala = [1, 1, 1]) {
    if (!this.materiales.has(material)) throw new Error(`${this.nombre}: material "${material}" sin declarar`);
    const g = geometria.index ? geometria : geometria; // todas las de three son indexadas
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...posicion),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...giro)),
      new THREE.Vector3(...escala),
    );
    const copia = g.clone();
    copia.applyMatrix4(m);
    for (const nombre of Object.keys(copia.attributes)) if (nombre !== 'position' && nombre !== 'normal') copia.deleteAttribute(nombre);
    if (!copia.index) copia.setIndex([...Array(copia.attributes.position.count).keys()]);
    this.materiales.get(material).geometrias.push(copia);
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
    const largo = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(radio, radio, largo, segmentos, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    return this.pieza(material, g);
  }

  /** Barra de sección rectangular de `desde` a `hasta`: `ancho` en el eje X del objeto y `grueso` en el otro. */
  barraCuadrada(material, desde, hasta, grueso, ancho = grueso) {
    const a = new THREE.Vector3(...desde), b = new THREE.Vector3(...hasta);
    const largo = a.distanceTo(b);
    const g = new THREE.BoxGeometry(ancho, largo, grueso);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    return this.pieza(material, g);
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
    for (const [nombre, { opciones, geometrias }] of this.materiales) {
      if (!geometrias.length) continue;
      // Una sola malla por material, sin vértices repetidos (mismo punto y misma normal)
      const g = mergeVertices(mergeGeometries(geometrias, false), 1e-5);
      const n = g.attributes.position.count;
      const indices = n > 65535 ? new Uint32Array(g.index.array) : new Uint16Array(g.index.array);
      triangulos += indices.length / 3;
      const mat = doc.createMaterial(nombre)
        .setBaseColorFactor([...lineal(opciones.color), opciones.opacidad])
        .setRoughnessFactor(opciones.rugosidad)
        .setMetallicFactor(opciones.metalico)
        .setDoubleSided(opciones.dobleCara);
      if (opciones.opacidad < 1) mat.setAlphaMode('BLEND');
      const prim = doc.createPrimitive()
        .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.attributes.position.array)).setBuffer(buffer))
        .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.attributes.normal.array)).setBuffer(buffer))
        .setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer))
        .setMaterial(mat);
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

/** Escribe un objeto del catálogo: el .glb y su ficha .json al lado. */
export async function guardarObjeto(carpetaCatalogo, ruta, ficha, modelo) {
  const base = `${carpetaCatalogo}/${ruta}`;
  const info = await modelo.guardar(`${base}.glb`);
  mkdirSync(dirname(base), { recursive: true });
  writeFileSync(`${base}.json`, JSON.stringify(ficha, null, 2) + '\n');
  console.log(`✔ catalogo/${ruta}  ${info.triangulos} triángulos, ${info.materiales} materiales, ${(info.bytes / 1024).toFixed(1)} KB`);
  return info;
}
