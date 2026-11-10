// Lo común a los scripts de lotes del catálogo (catalogo-lote1.mjs, catalogo-lote2.mjs):
// materiales habituales, piezas repetidas (marcos) y el proceso de guardar
// cada objeto y su fila de docs/OBJETOS.md.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
  console.log(`✔ docs/OBJETOS.md (${titulo})`);
  return resumen;
}

const m = (n) => String(n).replace('.', ',');

function tabla(resumen) {
  const filas = resumen.map(({ ruta, ficha, como, fotos, info }) => {
    const d = ficha.dimensiones;
    const extra = [
      `colocación: ${ficha.colocacion ?? 'suelo'}`,
      ficha.alturaCentro !== undefined ? `centro a ${m(ficha.alturaCentro)} m` : '',
      ficha.superficies ? (ficha.superficies.length ? `superficies: ${ficha.superficies.map(m).join(' / ')} m` : 'no admite nada encima') : '',
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
\`scripts/catalogo-lote1.mjs\` (salón y pasillo) y \`scripts/catalogo-lote2.mjs\`
(dormitorio, balcón y tendedero). Los objetos de ejemplo de las fases 1 y 4
(mesa, armario, cuadro, espejo, jarrón y planta provisionales) siguen en
\`catalogo/\`.

## Cómo corregir una medida

1. Abre el \`.json\` del objeto (por ejemplo \`catalogo/sofas/sofa-3-plazas.json\`).
2. Cambia \`dimensiones\` (en metros: \`ancho\` = de lado a lado, \`fondo\` = de
   delante atrás, \`alto\`). Si es un mueble con \`superficies\`, cambia también
   las alturas de sus tapas o baldas; si es de pared, \`alturaCentro\`.
3. Pon \`"medidas": "confirmadas"\` para marcarla como medida de verdad.

No hace falta tocar nada más: la app estira el modelo a las medidas de la
ficha. Si se vuelve a ejecutar \`npm run catalogo:lote1\` (o \`lote2\`), las
medidas de los \`.json\` existentes se respetan (salvo con \`-- --reiniciar\`)
y estas tablas se regeneran con ellas.
`;

/** Sustituye (o añade) la sección `id` de docs/OBJETOS.md. */
function escribirSeccion(id, texto) {
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
