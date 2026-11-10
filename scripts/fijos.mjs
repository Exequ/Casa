// Elementos fijos de la vivienda (fase 3c): cocina, baño, armario empotrado y
// aire acondicionado. Los usa scripts/digitalizar-plano.mjs para escribir la
// sección "fijos" de data/vivienda.json, y escribe su tabla en docs/OBJETOS.md.
//
// Coordenadas en metros de data/vivienda.json (x hacia la derecha del plano, z
// hacia abajo). `posicion` es el centro de la base; `giro` como los muebles
// (0 = el frente mira al sur, 90 = al este, 180 = al norte, 270 = al oeste); con
// giro 90 o 270 el ancho va a lo largo de z. Medidas estimadas con las fotos
// del anuncio y el plano (planos/plano.jpg).

import { escribirSeccion } from './lib/lote.mjs';

/** Un fijo con su giro: calcula el centro a partir de los límites en planta [x1, x2] × [z1, z2]. */
function fijo(datos, [x1, x2], [z1, z2]) {
  const r = (n) => Math.round(n * 1000) / 1000;
  const giro = datos.giro ?? 0;
  const lado = giro % 180 === 0 ? [x2 - x1, z2 - z1] : [z2 - z1, x2 - x1];
  return {
    id: datos.id, tipo: datos.tipo, nombre: datos.nombre, estancia: datos.estancia,
    posicion: [r((x1 + x2) / 2), r((z1 + z2) / 2)],
    ...(datos.altura ? { altura: datos.altura } : {}),
    giro,
    dimensiones: { ancho: r(lado[0]), fondo: r(lado[1]), alto: datos.alto },
    ...(datos.pared ? { pared: datos.pared } : {}),
    material: datos.material,
    ...(datos.modulos ? { modulos: datos.modulos } : {}),
    ...(datos.puertas ? { puertas: datos.puertas } : {}),
    medidas: 'estimadas',
  };
}

// --- Cocina (fotos "Cocina" y plano) ----------------------------------------------------
// Forma en L: la pared de la derecha (este, x = 4,06, tras el patinillo) y la del
// fondo (sur, z = 6,17). En el plano: módulos de 0,60 / 0,51 / 0,61 en la pared
// este y la placa en la del fondo. Muebles bajos de 0,60 × 0,90; altos de 0,33
// de fondo desde 1,45 m hasta el falso techo (2,40 m).
const COCINA = [
  fijo({
    id: 'cocina-columna', tipo: 'columna-frigorifico', nombre: 'Columna con frigorífico combi', estancia: 'cocina',
    giro: 270, alto: 2.39, material: 'lacado blanco brillo; frigorífico blanco',
  }, [3.46, 4.06], [3.82, 4.42]),
  fijo({
    id: 'cocina-bajo-este', tipo: 'cocina-bajo', nombre: 'Muebles bajos (pared este): lavavajillas y armario', estancia: 'cocina',
    giro: 270, alto: 0.9, material: 'lacado blanco brillo; encimera de granito negro',
    modulos: [{ tipo: 'lavavajillas', ancho: 0.5 }, { tipo: 'puertas', ancho: 0.61 }, { tipo: 'relleno', ancho: 0.64 }],
  }, [3.46, 4.06], [4.42, 6.17]),
  fijo({
    id: 'cocina-bajo-sur', tipo: 'cocina-bajo', nombre: 'Muebles bajos (pared del fondo): armario, horno con placa y cajonera', estancia: 'cocina',
    giro: 180, alto: 0.9, material: 'lacado blanco brillo; horno de acero; encimera de granito negro',
    modulos: [{ tipo: 'puertas', ancho: 0.53 }, { tipo: 'horno', ancho: 0.6, placa: true }, { tipo: 'cajones', ancho: 0.5, n: 4 }],
  }, [1.83, 3.46], [5.57, 6.17]),
  fijo({
    id: 'cocina-alto-este', tipo: 'cocina-alto', nombre: 'Muebles altos (pared este)', estancia: 'cocina',
    giro: 270, altura: 1.45, alto: 0.94, pared: 'cocina-este', material: 'lacado blanco brillo',
    modulos: [{ tipo: 'puertas', ancho: 0.5 }, { tipo: 'puertas', ancho: 0.61 }, { tipo: 'puertas', ancho: 0.64 }],
  }, [3.73, 4.06], [4.42, 6.17]),
  fijo({
    id: 'cocina-alto-sur', tipo: 'cocina-alto', nombre: 'Muebles altos (pared del fondo) con campana y estantes abiertos', estancia: 'cocina',
    giro: 180, altura: 1.45, alto: 0.94, pared: 'cocina-sur', material: 'lacado blanco brillo; campana de acero',
    modulos: [{ tipo: 'puertas', ancho: 0.8 }, { tipo: 'campana', ancho: 0.6 }, { tipo: 'puertas', ancho: 0.25 }, { tipo: 'estantes', ancho: 0.2 }],
  }, [1.88, 3.73], [5.84, 6.17]),
];

export const FIJOS = [...COCINA];

/** Cómo se estimó cada medida (para docs/OBJETOS.md). */
const NOTAS = {
  'cocina-columna': 'Módulo de 0,60 del plano junto al patinillo; alto hasta el falso techo (2,40 m).',
  'cocina-bajo-este': 'Módulos del plano: 0,51 (lavavajillas de 45 cm de libre instalación) y 0,61; el rincón queda tras los muebles del fondo. Fondo 0,60, encimera a 0,90.',
  'cocina-bajo-sur': 'Fondo de la L en el plano (0,57–0,60). Horno de 0,60 bajo la placa del plano; cajonera de 0,50 junto a la ventana (fotos).',
  'cocina-alto-este': 'Fondo 0,33, de 1,45 m al falso techo; sobre el lavavajillas y el armario (foto).',
  'cocina-alto-sur': 'Igual; campana extraíble sobre la placa y estantes abiertos al final, junto a la ventana (fotos). Empieza a 5 cm de la ventana para no taparla.',
};

/** Escribe la sección "Elementos fijos" de docs/OBJETOS.md. */
export function documentarFijos() {
  const m = (n) => String(n).replace('.', ',');
  const filas = FIJOS.map((f) => {
    const d = f.dimensiones;
    return `| ${f.nombre} (\`${f.id}\`) | ${f.estancia} | ${m(d.ancho)} × ${m(d.fondo)} × ${m(d.alto)}${f.altura ? ` (desde ${m(f.altura)} m)` : ''} | ${f.material} | ${NOTAS[f.id] ?? ''} | estimada |`;
  });
  escribirSeccion('z-fijos', `## Elementos fijos

Forman parte de la vivienda (sección \`fijos\` de \`data/vivienda.json\`, generada
por \`scripts/fijos.mjs\` con \`npm run vivienda:generar\`): no se seleccionan, no se
mueven ni se borran y los muebles no pueden atravesarlos. Medidas estimadas a
partir de las fotos y del plano (\`planos/plano.jpg\`). Para corregir una,
cambia el fijo en \`scripts/fijos.mjs\` y ejecuta \`npm run vivienda:generar\` (o
edita \`data/vivienda.json\` directamente).

| Elemento | Estancia | Medidas (ancho × fondo × alto, m) | Material | De dónde salen las medidas | Estado |
|---|---|---|---|---|---|
${filas.join('\n')}

**No se dibuja** lo que no se ve en las fotos ni en el plano: el fregadero
(ni en el plano ni en las fotos). La placa sí está en el plano, y la campana
extraíble se ve en la foto de la cocina bajo los muebles altos.`);
}
