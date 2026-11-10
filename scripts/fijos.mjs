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

// --- Baño (fotos "Baño" y plano) ---------------------------------------------------------
// Según el plano: ducha a la izquierda (x 6,07–6,72, toda la profundidad) con la
// grifería en la pared del fondo y la mampara fija en su lado derecho (la
// mitad hacia la puerta); lavabo en el centro de la pared del fondo; inodoro y
// bidé en la pared de la derecha, pasado el patinillo.
const BANO = [
  fijo({
    id: 'bano-plato', tipo: 'plato-ducha', nombre: 'Plato de ducha extraplano', estancia: 'bano',
    alto: 0.035, material: 'resina blanca; desagüe de rejilla de acero',
  }, [6.07, 6.72], [0.23, 1.59]),
  fijo({
    id: 'bano-mampara', tipo: 'mampara', nombre: 'Mampara fija de cristal', estancia: 'bano',
    giro: 90, altura: 0.035, alto: 1.965, material: 'cristal transparente; perfil cromado',
  }, [6.705, 6.735], [0.93, 1.59]),
  fijo({
    id: 'bano-barra-mampara', tipo: 'barra', nombre: 'Barra de sujeción de la mampara', estancia: 'bano',
    altura: 1.95, alto: 0.03, pared: 'salon-este', material: 'acero cromado',
  }, [6.07, 6.705], [0.915, 0.945]),
  fijo({
    id: 'bano-griferia', tipo: 'griferia-ducha', nombre: 'Grifería termostática con barra de ducha', estancia: 'bano',
    altura: 0.95, alto: 1.05, pared: 'fachada-norte', material: 'cromo',
  }, [6.29, 6.59], [0.23, 0.35]),
  fijo({
    id: 'bano-agarradera', tipo: 'barra', nombre: 'Agarradera de acero', estancia: 'bano',
    giro: 90, altura: 0.92, alto: 0.06, pared: 'salon-este', material: 'acero cromado',
  }, [6.07, 6.15], [1.05, 1.45]),
  fijo({
    id: 'bano-lavabo', tipo: 'mueble-lavabo', nombre: 'Mueble de lavabo de 3 cajones con lavabo integrado', estancia: 'bano',
    alto: 0.98, material: 'lacado blanco; lavabo cerámico; grifo cromado',
  }, [7.09, 7.89], [0.23, 0.69]),
  fijo({
    id: 'bano-espejo', tipo: 'espejo', nombre: 'Espejo sin marco', estancia: 'bano',
    altura: 1.05, alto: 0.8, pared: 'fachada-norte', material: 'espejo',
  }, [7.14, 7.84], [0.23, 0.24]),
  fijo({
    id: 'bano-inodoro', tipo: 'inodoro', nombre: 'Inodoro', estancia: 'bano',
    giro: 270, alto: 0.8, material: 'porcelana blanca',
  }, [7.99, 8.61], [0.735, 1.095]),
  fijo({
    id: 'bano-bide', tipo: 'bide', nombre: 'Bidé', estancia: 'bano',
    giro: 270, alto: 0.52, material: 'porcelana blanca; grifo cromado',
  }, [8.07, 8.61], [1.22, 1.58]),
];

export const FIJOS = [...COCINA, ...BANO];

/** Cómo se estimó cada medida (para docs/OBJETOS.md). */
const NOTAS = {
  'cocina-columna': 'Módulo de 0,60 del plano junto al patinillo; alto hasta el falso techo (2,40 m).',
  'cocina-bajo-este': 'Módulos del plano: 0,51 (lavavajillas de 45 cm de libre instalación) y 0,61; el rincón queda tras los muebles del fondo. Fondo 0,60, encimera a 0,90.',
  'cocina-bajo-sur': 'Fondo de la L en el plano (0,57–0,60). Horno de 0,60 bajo la placa del plano; cajonera de 0,50 junto a la ventana (fotos).',
  'cocina-alto-este': 'Fondo 0,33, de 1,45 m al falso techo; sobre el lavavajillas y el armario (foto).',
  'cocina-alto-sur': 'Igual; campana extraíble sobre la placa y estantes abiertos al final, junto a la ventana (fotos). Empieza a 5 cm de la ventana para no taparla.',
  'bano-plato': 'Ancho de la ducha en el plano (0,65) por toda la profundidad del baño (1,36).',
  'bano-mampara': 'Línea gruesa del plano: la mitad de la ducha hacia la puerta (0,66), sobre el plato; hasta 2,00 m.',
  'bano-barra-mampara': 'Del extremo libre del cristal a la pared, arriba (foto).',
  'bano-griferia': 'Posición de la grifería en el plano; termostático a 1,00 m y barra hasta 2,00 m (foto).',
  'bano-agarradera': 'Foto: barra horizontal en la pared junto a la ducha, a 0,95 m; 40 cm.',
  'bano-lavabo': 'Plano: 0,80 × 0,47 en el centro de la pared del fondo; encimera a 0,85, sobre patas.',
  'bano-espejo': 'Foto: algo más estrecho que el mueble, de 1,05 a 1,85 m, bajo el aplique LED (1,95).',
  'bano-inodoro': 'Plano: 0,37 de ancho y 0,62 de fondo, el primero pasado el patinillo.',
  'bano-bide': 'Plano: 0,36 × 0,54, junto a la puerta.',
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
extraíble se ve en la foto de la cocina bajo los muebles altos. En el baño, el
aplique LED sobre el espejo es el que ya había (luz de la estancia).`);
}
