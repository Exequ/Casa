// Dibujo 3D de los elementos fijos de la vivienda (cocina, baño, armario
// empotrado y aire acondicionado; ver vivienda/fijos.ts).
//
// Cada tipo se construye con cajas, cilindros y aros en sus coordenadas
// propias (origen en el centro de su base, frente hacia +z, ancho en x) y
// luego se coloca con su posición, altura y giro. Las piezas de un mismo
// material se juntan en una sola malla por fijo.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { baseDe, type Fijo, type ModuloCocina } from '../vivienda/fijos';
import { materialPared } from './texturasPared';

// --- Materiales (color y brillo de las fotos) ------------------------------------------

const mat = (nombre: string, opciones: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ name: `fijo:${nombre}`, ...opciones });
const MATERIALES = {
  /** Muebles de cocina y de lavabo: blanco lacado en brillo. */
  lacado: mat('lacado', { color: 0xf6f6f4, roughness: 0.14 }),
  /** Interior y cantos: blanco algo más mate. */
  blanco: mat('blanco', { color: 0xefefec, roughness: 0.5 }),
  /** Armario empotrado: blanco liso satinado. */
  satinado: mat('satinado', { color: 0xf4f4f1, roughness: 0.35 }),
  /** Electrodomésticos y split: plástico/chapa blanca. */
  chapa: mat('chapa', { color: 0xf1f1ef, roughness: 0.32 }),
  ceramica: mat('ceramica', { color: 0xf8f8f6, roughness: 0.12 }),
  // Metálicos a medias: sin mapa de entorno (móvil) un metal puro se vería negro
  acero: mat('acero', { color: 0xc6cacd, roughness: 0.3, metalness: 0.6 }),
  cromo: mat('cromo', { color: 0xe8eaec, roughness: 0.12, metalness: 0.65 }),
  vidrioNegro: mat('vidrio-negro', { color: 0x0d0e10, roughness: 0.06, metalness: 0.3 }),
  oscuro: mat('oscuro', { color: 0x46494d, roughness: 0.5, metalness: 0.3 }),
  junta: mat('junta', { color: 0xc9cac8, roughness: 0.8 }),
  juntaArmario: mat('junta-armario', { color: 0xa9aaa8, roughness: 0.8 }),
  cristal: mat('cristal', { color: 0xd6ebe7, roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false }),
  espejo: mat('espejo', { color: 0xd8e2e8, roughness: 0.1, metalness: 0.6 }),
  /** Dígitos del reloj del horno (azul de la foto; no ilumina). */
  pantalla: mat('pantalla', { color: 0x3d8fe8, roughness: 0.4 }),
};
type NombreMaterial = keyof typeof MATERIALES | 'granito';

/** Granito negro pulido de la encimera (textura procedural ligera, la misma que el frente de la cocina). */
let granito: THREE.Material | null = null;
function materialGranito(tamano: number) {
  granito ??= materialPared({ tipo: 'granito', color: '#141416', acabado: 'pulido' }, tamano);
  return granito;
}

// --- Taller: acumula piezas por material ----------------------------------------------------

type V3 = [number, number, number];

class Taller {
  private piezas = new Map<NombreMaterial, THREE.BufferGeometry[]>();

  private anadir(m: NombreMaterial, g: THREE.BufferGeometry, centro: V3, giro?: V3) {
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const g2 = g.index ? g.toNonIndexed() : g;
    if (giro) g2.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...giro)));
    g2.translate(...centro);
    if (!this.piezas.has(m)) this.piezas.set(m, []);
    this.piezas.get(m)!.push(g2);
  }

  /** Caja [ancho, alto, fondo] con su centro en `c`. */
  caja(m: NombreMaterial, t: V3, c: V3, giro?: V3) {
    if (t.some((x) => x <= 1e-6)) return;
    this.anadir(m, new THREE.BoxGeometry(...t), c, giro);
  }
  /** Caja con las aristas redondeadas. */
  redonda(m: NombreMaterial, t: V3, r: number, c: V3, giro?: V3) {
    const rr = Math.min(r, ...t.map((x) => x / 2 - 1e-4));
    this.anadir(m, new RoundedBoxGeometry(...t, 2, rr), c, giro);
  }
  /** Cilindro vertical (o con el giro dado). */
  cilindro(m: NombreMaterial, rArriba: number, rAbajo: number, alto: number, c: V3, giro?: V3, seg = 20) {
    this.anadir(m, new THREE.CylinderGeometry(rArriba, rAbajo, alto, seg), c, giro);
  }
  /** Barra redonda de a a b. */
  barra(m: NombreMaterial, a: V3, b: V3, r: number) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const g = new THREE.CylinderGeometry(r, r, va.distanceTo(vb), 12);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()));
    const c = va.add(vb).multiplyScalar(0.5);
    this.anadir(m, g, [c.x, c.y, c.z]);
  }
  /** Disco ovalado horizontal (semiejes rx en x y rz en z). */
  ovalo(m: NombreMaterial, rx: number, rz: number, alto: number, c: V3) {
    const g = new THREE.CylinderGeometry(1, 1, alto, 32);
    g.scale(rx, 1, rz);
    this.anadir(m, g, c);
  }
  esfera(m: NombreMaterial, r: number, c: V3) {
    this.anadir(m, new THREE.SphereGeometry(r, 14, 10), c);
  }
  aro(m: NombreMaterial, r: number, tubo: number, c: V3, giro: V3, arco = Math.PI * 2) {
    this.anadir(m, new THREE.TorusGeometry(r, tubo, 8, arco < Math.PI * 2 ? 20 : 32, arco), c, giro);
  }

  mallas(nombre: string, tamano: number): THREE.Mesh[] {
    return [...this.piezas].map(([m, gs]) => {
      const malla = new THREE.Mesh(mergeGeometries(gs), m === 'granito' ? materialGranito(tamano) : MATERIALES[m]);
      malla.name = `${nombre}:${m}`;
      malla.castShadow = m !== 'cristal';
      malla.receiveShadow = true;
      return malla;
    });
  }
}

/** Tirador de barra: horizontal (a lo ancho) o vertical, centrado en c, delante de la cara z. */
function tirador(t: Taller, c: V3, largo: number, vertical = false, material: NombreMaterial = 'acero') {
  const sep = 0.022; // separación del frente
  const [x, y, z] = c;
  if (vertical) {
    t.caja(material, [0.012, largo, 0.012], [x, y, z + sep]);
    for (const s of [-1, 1]) t.caja(material, [0.01, 0.01, sep], [x, y + s * (largo / 2 - 0.01), z + sep / 2]);
  } else {
    t.caja(material, [largo, 0.012, 0.012], [x, y, z + sep]);
    for (const s of [-1, 1]) t.caja(material, [0.01, 0.01, sep], [x + s * (largo / 2 - 0.01), y, z + sep / 2]);
  }
}

// --- Cocina ---------------------------------------------------------------------------------

/** Lado del tirador de una puerta sola (+1 derecha, −1 izquierda, vista de frente). */
const ladoTirador = (m: ModuloCocina, porDefecto: 1 | -1) => (m.tirador === 'derecha' ? 1 : m.tirador === 'izquierda' ? -1 : porDefecto);

/** Fregadero bajo encimera (cubeta de acero) y grifo de caño alto, en el módulo centrado en cx. */
const FREGADERO = { ancho: 0.4, fondo: 0.34, hondo: 0.18, delante: 0.07 };
function fregadero(t: Taller, cx: number, D: number, yTop: number, H: number) {
  const { ancho: a, fondo: f, hondo } = FREGADERO, cz = D / 2 - FREGADERO.delante - f / 2, e = 0.006, y0 = yTop - hondo;
  t.caja('acero', [a, e, f], [cx, y0 + e / 2, cz]);
  for (const s of [-1, 1]) {
    t.caja('acero', [e, hondo, f], [cx + s * (a / 2 - e / 2), y0 + hondo / 2, cz]);
    t.caja('acero', [a, hondo, e], [cx, y0 + hondo / 2, cz + s * (f / 2 - e / 2)]);
  }
  t.cilindro('oscuro', 0.035, 0.035, 0.004, [cx, y0 + e + 0.002, cz + 0.05], undefined, 20);
  t.aro('acero', 0.035, 0.004, [cx, y0 + e + 0.003, cz + 0.05], [Math.PI / 2, 0, 0]);
  // Grifo monomando de caño alto en cuello de cisne, detrás de la cubeta, algo hacia la izquierda
  const gx = cx - 0.08, gz = -D / 2 + 0.085, r = 0.085, yArco = H + 0.21;
  t.cilindro('cromo', 0.024, 0.026, 0.05, [gx, H + 0.025, gz]);
  t.cilindro('cromo', 0.013, 0.013, yArco - H - 0.05, [gx, (H + 0.05 + yArco) / 2, gz]);
  t.aro('cromo', r, 0.013, [gx, yArco, gz + r], [0, Math.PI / 2, 0], Math.PI);
  t.cilindro('cromo', 0.014, 0.012, 0.06, [gx, yArco - 0.03, gz + 2 * r]);
  t.barra('cromo', [gx + 0.02, H + 0.11, gz], [gx + 0.075, H + 0.135, gz + 0.01], 0.006);
}

/** Muebles bajos: zócalo, cuerpo, frentes por módulos, encimera de granito y, si los hay, placa y fregadero. */
function cocinaBajo(t: Taller, f: Fijo) {
  const { ancho: W, fondo: D, alto: H } = f.dimensiones;
  const zocalo = 0.1, encimera = 0.03, yTop = H - encimera, frente = 0.018, tirSep = 0.034;
  const zFrente = D / 2 - tirSep; // cara delantera de los frentes (los tiradores sobresalen hasta D/2)
  const modulos = f.modulos ?? [{ tipo: 'puertas', ancho: W } as ModuloCocina];
  const fondoCuerpo = D - tirSep - frente - 0.01, zCuerpo = -(tirSep + frente + 0.01) / 2;
  t.caja('lacado', [W, zocalo - 0.005, 0.016], [0, zocalo / 2, zFrente - 0.06]);
  // Cuerpo por módulos (bajo el fregadero, solo hasta el fondo de la cubeta) y encimera con su hueco
  let x = -W / 2, hueco: [number, number] | null = null;
  for (const m of modulos) {
    const cx = x + m.ancho / 2, techo = m.fregadero ? yTop - FREGADERO.hondo : yTop;
    t.caja('blanco', [m.ancho, techo - zocalo, fondoCuerpo], [cx, (zocalo + techo) / 2, zCuerpo]);
    if (m.fregadero) hueco = [cx - FREGADERO.ancho / 2, cx + FREGADERO.ancho / 2];
    x += m.ancho;
  }
  const yEnc = H - encimera / 2;
  if (!hueco) t.caja('granito', [W, encimera, D], [0, yEnc, 0]);
  else {
    const [x1, x2] = hueco, zf = D / 2 - FREGADERO.delante, zb = zf - FREGADERO.fondo;
    t.caja('granito', [x1 + W / 2, encimera, D], [(-W / 2 + x1) / 2, yEnc, 0]);
    t.caja('granito', [W / 2 - x2, encimera, D], [(x2 + W / 2) / 2, yEnc, 0]);
    t.caja('granito', [x2 - x1, encimera, D / 2 - zf], [(x1 + x2) / 2, yEnc, (zf + D / 2) / 2]);
    t.caja('granito', [x2 - x1, encimera, zb + D / 2], [(x1 + x2) / 2, yEnc, (zb - D / 2) / 2]);
  }
  x = -W / 2;
  const alto = yTop - zocalo - 0.006, yc = zocalo + 0.003 + alto / 2, zc = zFrente - frente / 2;
  for (const m of modulos) {
    const cx = x + m.ancho / 2, w = m.ancho - 0.004;
    if (m.tipo === 'cajones') {
      const n = m.n ?? 4, h = (alto - (n - 1) * 0.004) / n;
      for (let i = 0; i < n; i++) {
        const y = zocalo + 0.003 + h / 2 + i * (h + 0.004);
        t.caja('lacado', [w, h, frente], [cx, y, zc]);
        tirador(t, [cx, y + h / 2 - 0.035, zFrente], Math.min(0.32, w * 0.6));
      }
    } else if (m.tipo === 'horno') {
      // Cajón bajo el horno; horno de acero: panel de mandos arriba (reloj y dos mandos),
      // puerta de cristal negro con el tirador de barra en lo alto
      const hCajon = 0.15;
      t.caja('lacado', [w, hCajon, frente], [cx, zocalo + 0.003 + hCajon / 2, zc]);
      tirador(t, [cx, zocalo + hCajon - 0.03, zFrente], Math.min(0.32, w * 0.6));
      const y0 = zocalo + hCajon + 0.01, hHorno = yTop - y0 - 0.005, hPanel = 0.1, yPanel = yTop - 0.005 - hPanel / 2;
      t.caja('acero', [w, hHorno, frente], [cx, y0 + hHorno / 2, zc]);
      const hPuerta = hHorno - hPanel - 0.012;
      t.caja('vidrioNegro', [w - 0.03, hPuerta, 0.006], [cx, y0 + 0.006 + hPuerta / 2, zFrente + 0.003]);
      tirador(t, [cx, y0 + hPuerta - 0.035, zFrente + 0.006], w * 0.85);
      t.caja('vidrioNegro', [0.1, 0.045, 0.004], [cx, yPanel, zFrente + 0.002]);
      t.caja('pantalla', [0.045, 0.016, 0.002], [cx, yPanel + 0.004, zFrente + 0.0045]);
      for (const s of [-1, 1]) {
        t.cilindro('oscuro', 0.024, 0.024, 0.004, [cx + s * 0.17, yPanel, zFrente + 0.002], [Math.PI / 2, 0, 0], 20);
        t.cilindro('acero', 0.019, 0.02, 0.022, [cx + s * 0.17, yPanel, zFrente + 0.013], [Math.PI / 2, 0, 0], 20);
      }
      if (m.placa) {
        // Vitrocerámica: cristal negro con canto biselado y zonas de cocción apenas marcadas
        const pw = Math.min(0.58, w), pd = Math.min(0.51, D - 0.06), pz = -0.01;
        t.caja('vidrioNegro', [pw, 0.006, pd], [cx, H - 0.0015, pz]);
        // Canto biselado algo más claro (se distingue del granito, también en el móvil)
        for (const s of [-1, 1]) {
          t.caja('acero', [pw + 0.012, 0.006, 0.006], [cx, H - 0.0015, pz + s * (pd / 2 + 0.003)]);
          t.caja('acero', [0.006, 0.006, pd], [cx + s * (pw / 2 + 0.003), H - 0.0015, pz]);
        }
        for (const [dx, dz, r] of [[-0.14, 0.1, 0.09], [0.14, 0.1, 0.075], [-0.14, -0.12, 0.075], [0.13, -0.11, 0.1]] as const) {
          t.aro('oscuro', r, 0.0012, [cx + dx, H + 0.0004, pz + dz], [Math.PI / 2, 0, 0]);
        }
      }
    } else if (m.tipo === 'lavavajillas') {
      // Lavavajillas blanco de libre instalación bajo la encimera: panel de mandos arriba
      const h = yTop - 0.02;
      t.caja('chapa', [w - 0.006, h - 0.08, frente], [cx, 0.02 + (h - 0.08) / 2, zc]);
      t.caja('chapa', [w - 0.006, 0.075, frente], [cx, h - 0.02, zc]);
      t.caja('oscuro', [w * 0.5, 0.022, 0.003], [cx + w * 0.12, h - 0.02, zFrente + 0.0015]);
      t.caja('junta', [w - 0.006, 0.004, 0.004], [cx, h - 0.06, zFrente]);
      tirador(t, [cx, h - 0.1, zFrente], w * 0.5, false, 'chapa');
      t.caja('oscuro', [w - 0.03, 0.02, 0.02], [cx, 0.01, zc]);
    } else if (m.tipo === 'relleno') {
      t.caja('lacado', [w, alto, frente], [cx, yc, zc]);
    } else {
      // Puertas (1 o 2) con tirador de barra vertical arriba
      const n = m.n ?? (m.ancho > 0.65 ? 2 : 1), wp = (w - (n - 1) * 0.004) / n;
      for (let i = 0; i < n; i++) {
        const px = cx - w / 2 + wp / 2 + i * (wp + 0.004);
        t.caja('lacado', [wp, alto, frente], [px, yc, zc]);
        const lado = n === 2 ? (i === 0 ? 1 : -1) : ladoTirador(m, -1);
        tirador(t, [px + lado * (wp / 2 - 0.04), yTop - 0.12, zFrente], 0.14, true);
      }
      if (m.fregadero) fregadero(t, cx, D, yTop, H);
    }
    x += m.ancho;
  }
}

/** Muebles altos: puertas con tirador vertical abajo, estantes abiertos y campana extraíble. */
function cocinaAlto(t: Taller, f: Fijo) {
  const { ancho: W, fondo: D, alto: H } = f.dimensiones;
  const frente = 0.018, tirSep = 0.034, zFrente = D / 2 - tirSep, zc = zFrente - frente / 2;
  const fondoCuerpo = D - tirSep - frente;
  let x = -W / 2;
  for (const m of f.modulos ?? [{ tipo: 'puertas', ancho: W } as ModuloCocina]) {
    const cx = x + m.ancho / 2, w = m.ancho - 0.004;
    if (m.tipo === 'estantes') {
      // Estantes abiertos: costado, fondo y 4 baldas, con el canto redondeado
      t.caja('lacado', [w, H, 0.012], [cx, H / 2, -D / 2 + 0.006]);
      t.caja('lacado', [0.018, H, fondoCuerpo + frente], [cx + w / 2 - 0.009, H / 2, -D / 2 + (fondoCuerpo + frente) / 2]);
      for (let i = 0; i < 4; i++) {
        const y = 0.01 + (i * (H - 0.02)) / 3;
        t.redonda('lacado', [w, 0.02, fondoCuerpo + frente], 0.008, [cx, Math.min(H - 0.01, Math.max(0.01, y)), -D / 2 + (fondoCuerpo + frente) / 2]);
      }
    } else {
      t.caja('blanco', [w, H, fondoCuerpo], [cx, H / 2, -D / 2 + fondoCuerpo / 2]);
      let y0 = 0;
      if (m.tipo === 'campana') {
        // Campana extraíble: frente lacado abajo con tirador horizontal (foto), filtro gris debajo
        const hc = 0.28;
        t.caja('oscuro', [w - 0.04, 0.004, fondoCuerpo - 0.02], [cx, 0.002, -D / 2 + fondoCuerpo / 2]);
        t.caja('acero', [w - 0.03, 0.01, fondoCuerpo - 0.01], [cx, 0.006, -D / 2 + fondoCuerpo / 2 + 0.005]);
        t.caja('lacado', [w - 0.02, hc, frente], [cx, hc / 2, zc]);
        tirador(t, [cx, 0.06, zFrente], Math.min(0.32, w * 0.55));
        y0 = hc + 0.004;
      }
      const n = m.n ?? (m.ancho > 0.65 ? 2 : 1), wp = (w - (n - 1) * 0.004) / n, h = H - y0 - 0.004;
      for (let i = 0; i < n; i++) {
        const px = cx - w / 2 + wp / 2 + i * (wp + 0.004);
        t.caja('lacado', [wp, h, frente], [px, y0 + h / 2, zc]);
        const lado = n === 2 ? (i === 0 ? 1 : -1) : ladoTirador(m, 1);
        tirador(t, [px + lado * (wp / 2 - 0.04), y0 + 0.12, zFrente], 0.14, true);
      }
    }
    x += m.ancho;
  }
}

/** Columna con el frigorífico combi integrado y un altillo con rejilla de ventilación. */
function columnaFrigorifico(t: Taller, f: Fijo) {
  const { ancho: W, fondo: D, alto: H } = f.dimensiones;
  const frente = 0.018, tirSep = 0.034, zFrente = D / 2 - tirSep, zc = zFrente - frente / 2;
  t.caja('lacado', [W, H, D - tirSep - frente], [0, H / 2, -(tirSep + frente) / 2]);
  // Altillo con puerta y rejilla de ventilación en su parte baja
  const yAltillo = 1.92;
  t.caja('lacado', [W - 0.004, H - yAltillo - 0.003, frente], [0, (yAltillo + H) / 2, zc]);
  tirador(t, [0, H - 0.08, zFrente], 0.22);
  for (let i = 0; i < 6; i++) t.caja('oscuro', [W - 0.08, 0.006, 0.004], [0, yAltillo + 0.03 + i * 0.016, zFrente + 0.002]);
  // Frigorífico combi: puerta grande arriba y congelador abajo
  const yCorte = 0.82;
  t.caja('chapa', [W - 0.03, yAltillo - yCorte - 0.02, frente], [0, (yCorte + yAltillo) / 2, zc]);
  t.caja('chapa', [W - 0.03, yCorte - 0.06, frente], [0, 0.04 + (yCorte - 0.06) / 2, zc]);
  t.caja('junta', [W - 0.03, 0.006, 0.004], [0, yCorte - 0.01, zFrente]);
  tirador(t, [0, yCorte + 0.03, zFrente], W * 0.65, false, 'chapa');
  tirador(t, [0, yCorte - 0.05, zFrente], W * 0.65, false, 'chapa');
  t.caja('lacado', [W - 0.004, 0.04, frente], [0, 0.02, zc]);
}

// --- Baño -------------------------------------------------------------------------------------

function platoDucha(t: Taller, f: Fijo) {
  const { ancho: W, fondo: D, alto: H } = f.dimensiones;
  t.redonda('ceramica', [W, H - 0.002, D], 0.006, [0, (H - 0.002) / 2, 0]);
  // Desagüe de rejilla metálica, centrado y hacia la entrada
  t.caja('acero', [0.12, 0.003, 0.12], [0, H - 0.0015, D / 2 - 0.3]);
  for (let i = -2; i <= 2; i++) t.caja('oscuro', [0.09, 0.001, 0.008], [0, H - 0.0005, D / 2 - 0.3 + i * 0.02]);
}

function mampara(t: Taller, f: Fijo) {
  const { ancho: W, fondo: D, alto: H } = f.dimensiones;
  // Perfil cromado contra la pared (a la izquierda, visto de frente) y vidrio fijo
  t.caja('cromo', [0.02, H, D], [-W / 2 + 0.01, H / 2, 0]);
  t.caja('cristal', [W - 0.02, H - 0.005, 0.008], [0.01, (H - 0.005) / 2 + 0.005, 0]);
  t.caja('cromo', [0.012, H - 0.005, 0.012], [W / 2 - 0.006, (H - 0.005) / 2 + 0.005, 0]);
}

/** Barra redonda cromada sujeta a la pared por sus extremos (barra de la mampara, agarradera). */
function barra(t: Taller, f: Fijo) {
  const { ancho: W, fondo: D, alto: H } = f.dimensiones;
  const r = Math.min(H, D) / 2 * 0.45;
  if (f.tipo === 'barra' && D > 0.04) {
    // Agarradera: dos patas hasta la pared (atrás) y la barra delante
    const zBarra = D / 2 - r - 0.002;
    t.barra('cromo', [-W / 2 + r + 0.01, H / 2, zBarra], [W / 2 - r - 0.01, H / 2, zBarra], r);
    for (const s of [-1, 1]) {
      t.barra('cromo', [s * (W / 2 - r - 0.01), H / 2, -D / 2 + 0.008], [s * (W / 2 - r - 0.01), H / 2, zBarra], r);
      t.cilindro('cromo', 0.025, 0.025, 0.008, [s * (W / 2 - r - 0.01), H / 2, -D / 2 + 0.004], [Math.PI / 2, 0, 0], 16);
    }
  } else {
    // Barra estabilizadora: de pared (izquierda) a la mampara (derecha)
    t.barra('cromo', [-W / 2 + 0.006, H / 2, 0], [W / 2, H / 2, 0], r);
    t.cilindro('cromo', Math.min(0.02, H / 2), Math.min(0.02, H / 2), 0.012, [-W / 2 + 0.006, H / 2, 0], [0, 0, Math.PI / 2], 16);
  }
}

/** Grifería termostática con barra de ducha, rociador y flexo. */
function griferiaDucha(t: Taller, f: Fijo) {
  const { ancho: W, fondo: D, alto: H } = f.dimensiones;
  const zPared = -D / 2;
  // Termostático (abajo)
  t.redonda('cromo', [W * 0.8, 0.06, 0.06], 0.02, [0, 0.05, zPared + 0.03]);
  for (const s of [-1, 1]) t.cilindro('cromo', 0.025, 0.025, 0.05, [s * (W * 0.4 - 0.01), 0.05, zPared + 0.035], [0, 0, Math.PI / 2], 16);
  t.caja('cromo', [0.02, 0.05, 0.03], [W * 0.15, 0.0 + 0.025, zPared + 0.07]);
  // Barra vertical con su soporte y el rociador
  const yBarra = 0.3;
  t.cilindro('cromo', 0.011, 0.011, H - yBarra - 0.01, [0, yBarra + (H - yBarra) / 2, zPared + 0.04], undefined, 12);
  for (const y of [yBarra + 0.02, H - 0.02]) t.caja('cromo', [0.03, 0.03, 0.04], [0, y, zPared + 0.02]);
  t.caja('cromo', [0.03, 0.05, 0.03], [0, H - 0.25, zPared + 0.055]);
  // Rociador inclinado hacia abajo, delante de la barra
  t.cilindro('cromo', 0.05, 0.045, 0.02, [0, H - 0.2, D / 2 - 0.042], [Math.PI / 2 - 0.55, 0, 0], 24);
  // Flexo: del termostático al mango del rociador
  t.barra('acero', [0, 0.03, zPared + 0.05], [W * 0.35, 0.3, zPared + 0.06], 0.006);
  t.barra('acero', [W * 0.35, 0.3, zPared + 0.06], [0.01, H - 0.27, zPared + 0.06], 0.006);
}

/** Mueble de lavabo blanco lacado de 3 cajones sobre patas, lavabo cerámico integrado y grifo. */
function muebleLavabo(t: Taller, f: Fijo) {
  const { ancho: W, fondo: D, alto: H } = f.dimensiones;
  const patas = 0.14, ySobre = 0.8, tirSep = 0.03, zFrente = D / 2 - tirSep;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.caja('cromo', [0.025, patas, 0.025], [sx * (W / 2 - 0.04), patas / 2, sz * (D / 2 - 0.07)]);
  t.caja('lacado', [W - 0.004, ySobre - 0.05 - patas, D - tirSep - 0.02], [0, (patas + ySobre - 0.05) / 2, -(tirSep + 0.02) / 2]);
  const n = 3, alto = ySobre - 0.05 - patas, h = (alto - (n - 1) * 0.004) / n;
  for (let i = 0; i < n; i++) {
    const y = patas + h / 2 + i * (h + 0.004);
    t.caja('lacado', [W - 0.008, h, 0.018], [0, y, zFrente - 0.009]);
    tirador(t, [0, y + h / 2 - 0.03, zFrente], W * 0.65, false, 'cromo');
  }
  // Lavabo cerámico integrado con la cubeta, el rebosadero y el grifo
  t.redonda('ceramica', [W, 0.05, D - tirSep + 0.012], 0.012, [0, ySobre + 0.025, -(tirSep - 0.012) / 2]);
  t.ovalo('junta', W * 0.32, (D - tirSep) * 0.3, 0.002, [0, ySobre + 0.0505, 0.01]); // la cubeta
  t.cilindro('cromo', 0.018, 0.022, 0.1, [0, ySobre + 0.1, -D / 2 + 0.08], undefined, 16);
  t.caja('cromo', [0.025, 0.02, 0.1], [0, ySobre + 0.13, -D / 2 + 0.12], [-0.2, 0, 0]);
  t.caja('cromo', [0.012, 0.02, 0.08], [0, H - 0.01, -D / 2 + 0.07]);
}

/** Inodoro de líneas rectas con cisterna vista (la cisterna contra la pared, atrás). */
function inodoro(t: Taller, f: Fijo) {
  const { ancho: W, fondo: D, alto: H } = f.dimensiones;
  const zAtras = -D / 2, fondoCisterna = 0.17;
  t.redonda('ceramica', [W - 0.06, 0.2, D - 0.16], 0.03, [0, 0.1, zAtras + 0.06 + (D - 0.16) / 2]);
  t.redonda('ceramica', [W, 0.2, D - 0.05], 0.04, [0, 0.29, zAtras + 0.05 + (D - 0.05) / 2]);
  t.redonda('ceramica', [W, 0.03, D - fondoCisterna - 0.01], 0.03, [0, 0.405, zAtras + fondoCisterna + (D - fondoCisterna - 0.01) / 2 + 0.005]);
  t.redonda('ceramica', [W, H - 0.4, fondoCisterna], 0.025, [0, 0.4 + (H - 0.4) / 2, zAtras + fondoCisterna / 2]);
  t.cilindro('cromo', 0.025, 0.025, 0.006, [0, H - 0.002, zAtras + fondoCisterna / 2], undefined, 20);
}

function bide(t: Taller, f: Fijo) {
  const { ancho: W, fondo: D, alto: H } = f.dimensiones;
  const hCuerpo = 0.4, zAtras = -D / 2;
  t.redonda('ceramica', [W - 0.06, 0.22, D - 0.1], 0.03, [0, 0.11, zAtras + 0.02 + (D - 0.1) / 2]);
  t.redonda('ceramica', [W, hCuerpo - 0.2, D], 0.04, [0, 0.2 + (hCuerpo - 0.2) / 2, 0]);
  t.ovalo('junta', (W - 0.1) / 2, (D - 0.22) / 2, 0.002, [0, hCuerpo + 0.0005, 0.05]); // la cubeta
  // Grifo monomando cromado atrás
  t.cilindro('cromo', 0.018, 0.022, H - hCuerpo - 0.02, [0, hCuerpo + (H - hCuerpo - 0.02) / 2, zAtras + 0.07], undefined, 16);
  t.caja('cromo', [0.012, 0.012, 0.08], [0, H - 0.01, zAtras + 0.08]);
}

function espejo(t: Taller, f: Fijo) {
  const { ancho: W, fondo: D, alto: H } = f.dimensiones;
  t.caja('espejo', [W, H, D], [0, H / 2, 0]);
}

// --- Dormitorio y aire acondicionado -----------------------------------------------------------

/** Armario empotrado: puertas lisas de suelo a techo con juntas horizontales y pomos. */
function armarioEmpotrado(t: Taller, f: Fijo) {
  const { ancho: W, fondo: D, alto: H } = f.dimensiones;
  const pomo = 0.022, zFrente = D / 2 - pomo, grosor = 0.02;
  t.caja('blanco', [W, H, D - pomo - grosor], [0, H / 2, -(pomo + grosor) / 2]);
  const n = f.puertas ?? 4, wp = (W - (n - 1) * 0.004) / n;
  const juntas = [0.62, 1.24, 1.86];
  for (let i = 0; i < n; i++) {
    const px = -W / 2 + wp / 2 + i * (wp + 0.004);
    t.caja('satinado', [wp, H - 0.004, grosor], [px, (H - 0.004) / 2, zFrente - grosor / 2]);
    for (const y of juntas) t.caja('juntaArmario', [wp, 0.004, 0.002], [px, y, zFrente + 0.0005]);
    if (i > 0) t.caja('juntaArmario', [0.004, H - 0.004, 0.002], [px - wp / 2 - 0.002, (H - 0.004) / 2, zFrente + 0.0005]);
    // Pomos en el lado que abre (las puertas van por parejas)
    const lado = i % 2 === 0 ? 1 : -1;
    t.esfera('cromo', 0.011, [px + lado * (wp / 2 - 0.045), 1.05, zFrente + pomo - 0.011]);
    t.cilindro('cromo', 0.005, 0.005, pomo - 0.011, [px + lado * (wp / 2 - 0.045), 1.05, zFrente + (pomo - 0.011) / 2], [Math.PI / 2, 0, 0], 8);
  }
}

function splitInterior(t: Taller, f: Fijo) {
  const { ancho: W, fondo: D, alto: H } = f.dimensiones;
  t.redonda('chapa', [W, H, D], 0.035, [0, H / 2, 0]);
  // Salida de aire con la lama abajo, junta del frontal y piloto
  t.caja('oscuro', [W - 0.12, 0.025, 0.06], [0, 0.03, D / 2 - 0.035]);
  t.caja('chapa', [W - 0.13, 0.008, 0.07], [0, 0.04, D / 2 - 0.035], [0.35, 0, 0]);
  t.caja('junta', [W - 0.04, 0.003, 0.003], [0, H * 0.62, D / 2 - 0.001]);
  t.caja('oscuro', [0.05, 0.012, 0.002], [W / 2 - 0.12, H * 0.3, D / 2 - 0.0005]);
}

/** Unidad exterior sobre dos soportes atornillados a la pared (a la izquierda, visto de frente). */
function splitExterior(t: Taller, f: Fijo) {
  const { ancho: W, fondo: D, alto: H } = f.dimensiones;
  const rail = 0.035, placa = 0.02, wUnidad = W - placa - 0.01, dUnidad = D - 0.04;
  const x0 = -W / 2;
  // Soportes: placa en la pared y dos raíles bajo la unidad
  t.caja('acero', [placa, H * 0.6, D], [x0 + placa / 2, H * 0.3, 0]);
  for (const s of [-1, 1]) t.caja('acero', [W - placa, rail, 0.03], [x0 + placa + (W - placa) / 2, rail / 2, s * (D / 2 - 0.05)]);
  // Unidad con la rejilla del ventilador en el frente
  const cx = x0 + placa + 0.01 + wUnidad / 2, yU = rail + (H - rail) / 2;
  t.redonda('chapa', [wUnidad, H - rail, dUnidad], 0.015, [cx, yU, -0.02]);
  const zf = -0.02 + dUnidad / 2;
  const rx = cx + wUnidad * 0.12, r = Math.min(0.19, (H - rail) * 0.36);
  t.cilindro('oscuro', r, r, 0.006, [rx, yU, zf + 0.003], [Math.PI / 2, 0, 0], 32);
  for (const k of [0.35, 0.65, 0.95]) t.aro('chapa', r * k, 0.004, [rx, yU, zf + 0.008], [0, 0, 0]);
  t.caja('chapa', [0.02, 0.4 * r, 0.006], [rx, yU, zf + 0.012]);
  t.caja('chapa', [0.4 * r, 0.02, 0.006], [rx, yU, zf + 0.012]);
  // Tapa de las llaves y tubos (lado derecho)
  t.caja('junta', [0.12, 0.14, 0.01], [cx + wUnidad / 2 - 0.08, yU - 0.08, zf + 0.005]);
}

const CONSTRUCTORES: Record<Fijo['tipo'], (t: Taller, f: Fijo) => void> = {
  'cocina-bajo': cocinaBajo,
  'cocina-alto': cocinaAlto,
  'columna-frigorifico': columnaFrigorifico,
  'plato-ducha': platoDucha,
  mampara,
  barra,
  'griferia-ducha': griferiaDucha,
  'mueble-lavabo': muebleLavabo,
  inodoro,
  bide,
  espejo,
  'armario-empotrado': armarioEmpotrado,
  'split-interior': splitInterior,
  'split-exterior': splitExterior,
};

/** El objeto 3D de un fijo, ya colocado en la vivienda. */
export function crearFijo(f: Fijo, tamanoTextura = 512): THREE.Group {
  const t = new Taller();
  CONSTRUCTORES[f.tipo](t, f);
  const g = new THREE.Group();
  g.name = `fijo:${f.id}`;
  g.userData.fijo = f.id;
  for (const m of t.mallas(`fijo:${f.id}`, tamanoTextura)) g.add(m);
  g.position.set(f.posicion[0], baseDe(f), f.posicion[1]);
  g.rotation.y = THREE.MathUtils.degToRad(f.giro ?? 0);
  return g;
}

export interface Fijos3D {
  /** Todos los fijos, por id. */
  porId: Map<string, THREE.Group>;
  /** Los del suelo (se añaden a la vivienda). */
  suelo: THREE.Group[];
  /** Los que van con una pared ("pared:<id>"): se ocultan con ella cuando se baja. */
  colgados: Map<string, THREE.Group[]>;
}

export function construirFijos(fijos: Fijo[], tamanoTextura = 512): Fijos3D {
  const porId = new Map<string, THREE.Group>();
  const suelo: THREE.Group[] = [];
  const colgados = new Map<string, THREE.Group[]>();
  for (const f of fijos) {
    const g = crearFijo(f, tamanoTextura);
    porId.set(f.id, g);
    // Los que tienen `pared` (los colgados y el armario empotrado) se ocultan con ella
    if (f.pared) {
      const clave = `pared:${f.pared}`;
      if (!colgados.has(clave)) colgados.set(clave, []);
      colgados.get(clave)!.push(g);
    } else suelo.push(g);
  }
  return { porId, suelo, colgados };
}
