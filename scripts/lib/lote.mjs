// Lo común a los scripts de lotes del catálogo (catalogo-lote1.mjs, catalogo-lote2.mjs, catalogo-lote4.mjs, catalogo-lote5.mjs, catalogo-lote6.mjs):
// materiales habituales, piezas repetidas (marcos) y el proceso de guardar
// cada objeto y su fila de docs/OBJETOS.md.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { guardarObjeto } from './modelo3d.mjs';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CATALOGO = join(RAIZ, 'catalogo');
const DOC = join(RAIZ, 'docs', 'OBJETOS.md');

/** Materiales habituales (color de las fotos y brillo). */
export const MAT = {
  negroMate: { color: 0x1b1b1b, rugosidad: 0.6, metalico: 0.3 },
  metalNegro: { color: 0x1a1a1a, rugosidad: 0.42, metalico: 0.6 },
  laton: { color: 0xa9874f, rugosidad: 0.35, metalico: 0.85 },
  plata: { color: 0xc5c8cc, rugosidad: 0.3, metalico: 0.85 },
  cristal: { color: 0xcfe5e2, rugosidad: 0.05, opacidad: 0.28 },
  luna: { color: 0xd8e2e8, rugosidad: 0.12, metalico: 0.55 },
  blancoLacado: { color: 0xf3f3f0, rugosidad: 0.4 },
  metalBlanco: { color: 0xeeeeea, rugosidad: 0.45, metalico: 0.3 },
};

/** Marco de cuatro listones (con las aristas algo redondeadas) de ancho W, alto H, fondo D y listón `ancho`, apoyado en y = 0. */
export function marcoRectangular(m, material, W, H, D, ancho, z = 0) {
  m.cajaRedonda(material, [W, ancho, D], 0.004, [0, H - ancho / 2, z], undefined, 2);
  m.cajaRedonda(material, [W, ancho, D], 0.004, [0, ancho / 2, z], undefined, 2);
  for (const sx of [-1, 1]) m.cajaRedonda(material, [ancho, H - 2 * ancho + 0.002, D], 0.004, [sx * (W / 2 - ancho / 2), H / 2, z], undefined, 2);
}

/** Pata de sección cuadrada que se estrecha hacia abajo (de `arriba` a `abajo` de lado). */
export function pataCuadrada(m, material, x, z, alto, arriba, abajo = arriba, y0 = 0) {
  const g = new THREE.BoxGeometry(arriba, alto, arriba);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < 0) { pos.setX(i, pos.getX(i) * (abajo / arriba)); pos.setZ(i, pos.getZ(i) * (abajo / arriba)); }
  }
  g.computeVertexNormals();
  m.pieza(material, g, [x, y0 + alto / 2, z]);
}

/**
 * Genera los objetos de un lote y su sección de docs/OBJETOS.md.
 * Cada objeto: { ruta, construir(), ficha: { nombre, categoria, colocacion?, alturaCentro?, superficies? }, como, fotos? }.
 * Si el .json ya existe, se respetan sus "dimensiones", "superficies",
 * "alturaCentro" y "medidas" (lo corregido a mano), salvo con `reiniciar`.
 */
export async function procesarLote(objetos, { reiniciar = false, seccion, titulo, introduccion }) {
  const resumen = [];
  for (const o of objetos) {
    const modelo = o.construir();
    const id = o.ruta.split('/').pop();
    const ficha = {
      nombre: o.ficha.nombre,
      categoria: o.ficha.categoria,
      ...(o.ficha.colocacion ? { colocacion: o.ficha.colocacion } : {}),
      ...(o.ficha.alturaCentro !== undefined ? { alturaCentro: o.ficha.alturaCentro } : {}),
      dimensiones: modelo.dimensiones,
      ...(o.ficha.superficies ? { superficies: o.ficha.superficies } : {}),
      medidas: 'estimadas',
      glb: `${id}.glb`,
    };
    const rutaJson = join(CATALOGO, `${o.ruta}.json`);
    if (existsSync(rutaJson) && !reiniciar) {
      const antigua = JSON.parse(readFileSync(rutaJson, 'utf8'));
      for (const campo of ['dimensiones', 'superficies', 'alturaCentro', 'medidas']) {
        if (antigua[campo] !== undefined && (campo !== 'superficies' || ficha.superficies)) ficha[campo] = antigua[campo];
      }
    }
    const info = await guardarObjeto(CATALOGO, o.ruta, ficha, modelo);
    resumen.push({ ...o, ficha, info });
  }
  escribirSeccion(seccion, `## ${titulo}\n\n${introduccion}\n\n${tabla(resumen)}`);
  escribirSuperficies();
  console.log(`✔ docs/OBJETOS.md (${titulo} y superficies)`);
  return resumen;
}

const m = (n) => String(n).replace('.', ',');

function tabla(resumen) {
  const filas = resumen.map(({ ruta, ficha, como, fotos, info }) => {
    const d = ficha.dimensiones;
    const extra = [
      `colocación: ${ficha.colocacion ?? 'suelo'}`,
      ficha.alturaCentro !== undefined ? `centro a ${m(ficha.alturaCentro)} m` : '',
      ficha.superficies ? (ficha.superficies.length ? `superficies: ${ficha.superficies.map((s) => m(typeof s === 'number' ? s : s.altura)).join(' / ')} m (ver «Superficies»)` : 'no admite nada encima') : '',
    ].filter(Boolean).join('; ');
    return `| ${ficha.nombre} (\`${ruta}\`) | ${m(d.ancho)} × ${m(d.fondo)} × ${m(d.alto)} | ${extra} | ${como} | ${fotos ?? ''} | ${ficha.medidas === 'confirmadas' ? '**confirmada**' : 'estimada'} | ${info.triangulos} |`;
  });
  return [
    '| Objeto | Medidas (ancho × fondo × alto, m) | Colocación | De dónde salen las medidas | Comparado con las fotos | Estado | Triángulos |',
    '|---|---|---|---|---|---|---:|',
    ...filas,
  ].join('\n');
}

const CABECERA = `# Objetos del catálogo

Muebles reales del piso, generados por scripts a partir de las fotos:
\`scripts/catalogo-lote1.mjs\` (salón y pasillo), \`scripts/catalogo-lote2.mjs\`
(dormitorio, balcón y tendedero), \`scripts/catalogo-lote4.mjs\` (zapatero y
coffee corner, de fotos de producto), \`scripts/catalogo-lote5.mjs\`
(tocadiscos, altavoces y packs de vinilos) y \`scripts/catalogo-lote6.mjs\`
(alfombra de cuadros). Los objetos de ejemplo de las fases 1 y 4
(mesa, armario, cuadro, espejo, jarrón y planta provisionales) siguen en
\`catalogo/\`.

## Cómo corregir una medida

1. Abre el \`.json\` del objeto (por ejemplo \`catalogo/sofas/sofa-3-plazas.json\`).
2. Cambia \`dimensiones\` (en metros: \`ancho\` = de lado a lado, \`fondo\` = de
   delante atrás, \`alto\`). Si es un mueble con \`superficies\`, cambia también
   sus tapas o baldas (altura, ancho, fondo, desplazamiento y altura libre; ver
   «Superficies»); si es de pared, \`alturaCentro\`.
3. Pon \`"medidas": "confirmadas"\` para marcarla como medida de verdad.

No hace falta tocar nada más: la app estira el modelo a las medidas de la
ficha. Si se vuelve a ejecutar \`npm run catalogo:lote1\` (o \`lote2\`, \`lote4\`, \`lote5\`, \`lote6\`), las
medidas de los \`.json\` existentes se respetan (salvo con \`-- --reiniciar\`)
y estas tablas se regeneran con ellas.
`;

/** Por qué se ha estimado así cada superficie (lo que se ve en las fotos y en el modelo). */
const NOTAS_SUPERFICIES = {
  'alfombras/alfombra-cuadros-rosa-rojo': 'Toda la alfombra, a 1 cm del suelo, sin límite por encima.',
  'almacenaje/libreria': 'Baldas: hueco entre los laterales (0,77) por el fondo útil delante del trasero (0,34), algo hacia atrás; altura libre hasta la cara de abajo de la balda de encima (2,5 cm de balda) y, la de arriba, hasta el techo interior (1,84 m). Tapa: toda la cornisa.',
  'almacenaje/mueble-tv': 'Estante de listones entre las patas (0,79 × 0,32); altura libre hasta el faldón de la tapa (0,47 m), por donde tiene que entrar lo que se mete. Tapa entera.',
  'almacenaje/zapatero': 'Tapa entera (las trampillas no admiten nada).',
  'cocina/coffee-corner': 'Baldas de 40 × 30 de la foto con 25 y 30 cm de hueco (la del medio, hasta el cajón bajo la encimera). Encimera entera de 48 × 33 con 53 cm libres hasta el estante. Estante de arriba de 43 × 12 al fondo, sin límite por encima.',
  'dormitorio/comoda-alta': 'Tapa entera.',
  'dormitorio/mesita-noche': 'Tapa entera.',
  'dormitorio/puf': 'Tapa de borreguito sin las esquinas blandas (4 cm por lado de 0,50 × 0,60).',
  'exterior/mesa-balcon': 'Tapa redonda de ø0,60 con el borde doblado: se toma un cuadrado de 0,50 (lo que se apoya suele ser redondo).',
  'mesas/mesa-centro': 'Tapa entera (marco de madera y cristal casi enrasados).',
  'mesas/mesa-comedor-cristal': 'Cristal entero.',
  'mesas/mesita-alambre': 'Bandeja redonda de ø0,44 con borde: cuadrado de 0,38 (cabe la lámpara foco girada 45°, como en la foto).',
  'mesas/mesita-bandeja': 'Bandeja redonda de ø0,42 por dentro del borde: cuadrado de 0,36.',
  'tendedero/lavadora': 'Tapa sin las esquinas redondeadas ni la puerta y los mandos, que sobresalen 3 cm por delante.',
  mesa: 'Objeto de ejemplo: tablero entero.',
  armario: 'Objeto de ejemplo: encima del cuerpo, sin las puertas ni los tiradores.',
};

/** Todas las fichas del catálogo (id → ficha), leídas de catalogo/. */
function fichasCatalogo(carpeta = CATALOGO, prefijo = '') {
  const res = [];
  for (const e of readdirSync(carpeta, { withFileTypes: true })) {
    if (e.isDirectory()) res.push(...fichasCatalogo(join(carpeta, e.name), `${prefijo}${e.name}/`));
    else if (e.name.endsWith('.json')) res.push([`${prefijo}${e.name.slice(0, -5)}`, JSON.parse(readFileSync(join(carpeta, e.name), 'utf8'))]);
  }
  return res.sort((a, b) => a[0].localeCompare(b[0]));
}

/** Sección «Superficies» de docs/OBJETOS.md: cada tapa y balda de los muebles soporte del catálogo. */
export function escribirSuperficies() {
  const filas = [];
  for (const [id, f] of fichasCatalogo()) {
    if ((f.colocacion ?? 'suelo') !== 'suelo') continue;
    const lista = Array.isArray(f.superficies) ? f.superficies : [f.dimensiones.alto];
    if (!lista.length) continue;
    const ordenadas = lista.map((s) => (typeof s === 'number' ? { altura: s } : s)).sort((a, b) => a.altura - b.altura);
    ordenadas.forEach((s, i) => {
      const siguiente = ordenadas[i + 1];
      const libre = s.alturaLibre ?? (siguiente ? Number((siguiente.altura - s.altura).toFixed(3)) : null);
      const desp = [s.desplazamientoX ? `x ${m(s.desplazamientoX)}` : '', s.desplazamientoZ ? `z ${m(s.desplazamientoZ)}` : ''].filter(Boolean).join(', ') || '—';
      filas.push(`| ${i === 0 ? `${f.nombre} (\`${id}\`)` : ''} | ${m(s.altura)} | ${m(s.ancho ?? f.dimensiones.ancho)} × ${m(s.fondo ?? f.dimensiones.fondo)} | ${desp} | ${libre === null ? 'sin límite' : `${m(libre)}${s.alturaLibre === undefined ? ' (hasta la siguiente)' : ''}`} | ${i === 0 ? NOTAS_SUPERFICIES[id] ?? '' : ''} |`);
    });
  }
  escribirSeccion('superficies', `## Superficies de los muebles soporte

Tapas y baldas donde se pueden apoyar objetos (\`superficies\` de cada ficha;
formato en el README). Un objeto solo se apoya en una si su huella, con su giro,
cabe en su ancho × fondo y su alto no pasa de su altura libre. Todas las medidas
son **estimadas** a partir de las fotos y del modelo de cada mueble (las
exteriores del coffee corner y del zapatero son las de sus fotos de producto).
El desplazamiento es el del centro de la superficie respecto al del mueble
(z positivo = hacia el frente). Esta tabla se regenera con los scripts de los lotes.

| Mueble | Altura (m) | Ancho × fondo (m) | Desplazamiento (m) | Altura libre (m) | De dónde sale |
|---|---:|---|---|---|---|
${filas.join('\n')}`);
}

/** Sustituye (o añade) la sección `id` de docs/OBJETOS.md. */
export function escribirSeccion(id, texto) {
  let doc = existsSync(DOC) ? readFileSync(DOC, 'utf8') : '';
  if (!doc.includes('<!-- secciones -->')) doc = `${CABECERA}\n<!-- secciones -->\n`;
  doc = doc.replace(/^[\s\S]*?<!-- secciones -->/, `${CABECERA}\n<!-- secciones -->`);
  const inicio = `<!-- inicio:${id} -->`, fin = `<!-- fin:${id} -->`;
  const bloque = `${inicio}\n${texto}\n${fin}`;
  if (doc.includes(inicio)) doc = doc.replace(new RegExp(`${inicio}[\\s\\S]*?${fin}`), bloque);
  else doc = `${doc.trimEnd()}\n\n${bloque}\n`;
  // Las secciones, por orden de lote
  const secciones = [...doc.matchAll(/<!-- inicio:(\S+) -->[\s\S]*?<!-- fin:\1 -->/g)].map((x) => [x[1], x[0]]).sort();
  doc = `${CABECERA}\n<!-- secciones -->\n\n${secciones.map(([, b]) => b).join('\n\n')}\n`;
  writeFileSync(DOC, doc);
}
