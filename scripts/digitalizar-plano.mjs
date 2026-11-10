// Convierte las medidas tomadas sobre el plano (en píxeles) en data/vivienda.json.
//
// Uso:  npm run vivienda:generar
//
// De dónde salen los números:
//   - La imagen es planos/plano-original.png (2622 x 1206 px, captura de idealista).
//   - Cada cara de muro se midió sobre la imagen ampliada con una rejilla y
//     afinando con un escaneo de píxeles oscuros. Todas las coordenadas de este
//     archivo son PÍXELES DE ESA IMAGEN (x hacia la derecha, y hacia abajo).
//   - El plano no trae cotas de las estancias, solo superficies útiles y un
//     círculo de giro de ø1,50 m. La ESCALA se calcula aquí por mínimos
//     cuadrados para que las superficies medidas coincidan con las del plano.
//     El círculo de ø1,50 m sirve de comprobación independiente.
//
// Si corriges una medida, cambia el número en píxeles y vuelve a ejecutar.
// También puedes editar data/vivienda.json a mano directamente (en metros),
// pero ten en cuenta que este script lo sobrescribe.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIJOS, documentarFijos } from './fijos.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// 1. Estancias: polígono de la cara interior de los muros (px), en orden.
//    `superficie` es la superficie útil que indica el plano (m²).
// ---------------------------------------------------------------------------
const estancias = [
  {
    id: 'salon', nombre: 'Salón comedor', superficie: 15.74,
    // Incluye el mirador de la izquierda y las muescas de 3 pilares.
    px: [[560, 130], [977, 130], [977, 155], [1030, 155], [1030, 130], [1240, 130], [1240, 480],
      [962, 480], [962, 521], [912, 521], [912, 532], [560, 532], [560, 510], [537, 510],
      [537, 488], [461, 488], [461, 214], [537, 214], [537, 160], [560, 160]],
  },
  {
    id: 'cocina', nombre: 'Cocina', superficie: 6.37,
    // Abierta al salón por arriba (no hay muro entre ambas). Muesca del patinillo.
    px: [[690, 532], [912, 532], [912, 612], [990, 612], [990, 926], [690, 926]],
  },
  {
    id: 'tendedero', nombre: 'Tendedero', superficie: 3.55,
    px: [[514, 566], [655, 566], [655, 1015], [557, 1015], [557, 969], [514, 969]],
  },
  {
    id: 'bano', nombre: 'Baño', superficie: 3.34,
    // Muesca arriba a la derecha: patinillo de instalaciones.
    px: [[1259, 130], [1508, 130], [1508, 172], [1600, 172], [1600, 322], [1259, 322]],
  },
  {
    id: 'distribuidor', nombre: 'Distribuidor', superficie: 2.81,
    px: [[1259, 338], [1600, 338], [1600, 480], [1259, 480]],
  },
  {
    id: 'dormitorio', nombre: 'Dormitorio', superficie: 10.91,
    // Incluye el hueco del armario empotrado (abajo) y las muescas de 4 pilares.
    px: [[1656, 130], [2080, 130], [2080, 144], [2102, 144], [2102, 468], [2080, 468], [2080, 492],
      [1950, 492], [1950, 568], [1656, 568], [1656, 466], [1619, 466], [1619, 148], [1656, 148]],
  },
  {
    id: 'balcon', nombre: 'Balcón', exterior: true,
    px: [[2121, 178], [2266, 178], [2266, 416], [2121, 416]],
  },
];

// ---------------------------------------------------------------------------
// 2. Muros: rectángulo [x1, y1, x2, y2] en px. El eje del muro va a lo largo
//    del lado mayor. Huecos: [inicio, fin] en px a lo largo del muro.
// ---------------------------------------------------------------------------
// Carpintería (de las fotos del piso). Bisagras y sentido de apertura, de los arcos del plano:
//   bisagra 'desde'/'hasta' = extremo del hueco más cercano al inicio/fin del muro;
//   abre 'izquierda'/'derecha' = lado, visto caminando del inicio al fin del muro
//   (los muros horizontales van de izquierda a derecha y los verticales de arriba abajo).
const PUERTA = { tipo: 'puerta', alto: 2.05, alfeizar: 0, estilo: 'puerta-blanca' };
const PUERTA_ENTRADA = { tipo: 'puerta', alto: 2.10, alfeizar: 0, estilo: 'puerta-entrada' };
const BALCONERA = { tipo: 'ventana', alto: 2.10, alfeizar: 0, estilo: 'ventana' };

const muros = [
  { id: 'fachada-norte', nombre: 'Fachada norte', rect: [505, 106, 2121, 130] },
  { id: 'oeste-alto', nombre: 'Fachada oeste (sobre el mirador)', rect: [505, 106, 537, 214] },
  { id: 'mirador-norte', nombre: 'Mirador, lado norte', rect: [445, 198, 537, 214] },
  {
    id: 'mirador-frente', nombre: 'Mirador, frente acristalado', rect: [445, 198, 461, 504],
    // De suelo a techo: paños fijos abajo y hojas abatibles arriba (foto del salón).
    huecos: [{ ...BALCONERA, alto: 2.45, hojas: 3, travesano: 1.05, cortina: true, px: [214, 488], nombre: 'Mirador del salón (3 paños)' }],
  },
  { id: 'mirador-sur', nombre: 'Mirador, lado sur', rect: [445, 488, 537, 504] },
  { id: 'oeste-bajo', nombre: 'Fachada oeste (bajo el mirador)', rect: [505, 488, 537, 566] },
  { id: 'salon-tendedero', nombre: 'Salón / tendedero', rect: [505, 532, 655, 566] },
  {
    id: 'tendedero-oeste', nombre: 'Cerramiento del tendedero', rect: [506, 532, 514, 1046],
    // Lamas de aluminio negro de suelo a techo en todo el largo (foto del tendedero).
    huecos: [{ tipo: 'ventana', estilo: 'lamas', alto: 2.45, alfeizar: 0, px: [569, 966], nombre: 'Celosía de lamas del tendedero' }],
  },
  { id: 'tendedero-sur', nombre: 'Tendedero, muro sur', rect: [506, 1015, 689, 1046] },
  {
    id: 'cocina-tendedero', nombre: 'Cocina / tendedero', rect: [655, 532, 689, 1046],
    huecos: [
      // Foto de la cocina: fijo de suelo a dintel partido en horizontal, puerta de madera con vidrio
      // y, al otro lado, ventana fija sobre la encimera.
      { tipo: 'ventana', estilo: 'fijo', alto: 2.10, alfeizar: 0, travesano: 1.05, px: [637, 728], nombre: 'Fijo acristalado (junto al salón)' },
      { tipo: 'puerta', estilo: 'puerta-vidriera', alto: 2.10, alfeizar: 0, bisagra: 'hasta', abre: 'derecha', px: [735, 833], nombre: 'Puerta cocina-tendedero' },
      { tipo: 'ventana', estilo: 'fijo', alto: 1.10, alfeizar: 1.00, px: [840, 925], nombre: 'Fijo acristalado (sobre la encimera)' },
    ],
  },
  { id: 'cocina-sur', nombre: 'Cocina, muro sur', rect: [655, 926, 1019, 946] },
  { id: 'cocina-este', nombre: 'Cocina / escalera', rect: [990, 521, 1019, 946] },
  {
    id: 'rellano', nombre: 'Muro al rellano', rect: [962, 480, 1619, 504],
    huecos: [{ ...PUERTA_ENTRADA, bisagra: 'hasta', abre: 'izquierda', px: [1450, 1557], nombre: 'Puerta de entrada' }],
  },
  {
    id: 'salon-este', nombre: 'Salón / baño y distribuidor', rect: [1240, 106, 1259, 480],
    huecos: [{ ...PUERTA, bisagra: 'hasta', abre: 'izquierda', px: [352, 460], nombre: 'Puerta del salón' }],
  },
  {
    id: 'bano-distribuidor', nombre: 'Baño / distribuidor', rect: [1259, 322, 1600, 338],
    huecos: [{ ...PUERTA, bisagra: 'desde', abre: 'izquierda', px: [1383, 1478], nombre: 'Puerta del baño' }],
  },
  {
    id: 'dormitorio-oeste', nombre: 'Baño y distribuidor / dormitorio', rect: [1600, 106, 1619, 492],
    huecos: [{ ...PUERTA, bisagra: 'hasta', abre: 'izquierda', px: [350, 450], nombre: 'Puerta del dormitorio' }],
  },
  {
    id: 'fachada-este', nombre: 'Fachada este (dormitorio)', rect: [2102, 106, 2121, 521],
    huecos: [{ ...BALCONERA, hojas: 2, cortina: true, px: [202, 400], nombre: 'Balconera del dormitorio (2 hojas)' }],
  },
  { id: 'dormitorio-sur', nombre: 'Dormitorio, muro sur', rect: [1950, 492, 2121, 521] },
  { id: 'armario-fondo', nombre: 'Armario empotrado, fondo', rect: [1640, 568, 1960, 598] },
  { id: 'armario-izq', nombre: 'Armario empotrado, lateral izquierdo', rect: [1640, 480, 1656, 598] },
  { id: 'armario-der', nombre: 'Armario empotrado, lateral derecho', rect: [1950, 492, 1960, 598] },
  // Barandilla del balcón: barrotes verticales negros de 1 m
  { id: 'barandilla-norte', nombre: 'Barandilla del balcón', rect: [2121, 173, 2271, 178], alto: 1.0, tipo: 'barandilla' },
  { id: 'barandilla-este', nombre: 'Barandilla del balcón', rect: [2266, 173, 2271, 421], alto: 1.0, tipo: 'barandilla' },
  { id: 'barandilla-sur', nombre: 'Barandilla del balcón', rect: [2121, 416, 2271, 421], alto: 1.0, tipo: 'barandilla' },
];

// ---------------------------------------------------------------------------
// 3. Pilares y patinillos (bloques macizos de suelo a techo), [x1, y1, x2, y2] px
// ---------------------------------------------------------------------------
const pilares = [
  { id: 'pilar-salon-no', rect: [537, 130, 560, 160] },
  { id: 'pilar-salon-so', rect: [537, 510, 560, 532] },
  { id: 'pilar-salon-n', rect: [977, 130, 1030, 155] },
  { id: 'pilar-salon-se', rect: [962, 480, 1019, 521] },
  { id: 'patinillo-cocina', rect: [912, 521, 990, 612] },
  { id: 'patinillo-bano', rect: [1508, 130, 1600, 172] },
  { id: 'pilar-dormitorio-no', rect: [1619, 130, 1656, 148] },
  { id: 'pilar-dormitorio-so', rect: [1619, 466, 1656, 492] },
  { id: 'pilar-dormitorio-ne', rect: [2080, 130, 2102, 144] },
  { id: 'pilar-dormitorio-se', rect: [2080, 468, 2102, 492] },
  { id: 'pilar-tendedero-so', rect: [514, 969, 557, 1015] },
];

// ---------------------------------------------------------------------------
// 3b. Acabados reales, de las fotos del anuncio (en METROS, no en píxeles)
// ---------------------------------------------------------------------------
// Suelos: tipo, color, escala (metros por repetición de la textura), pieza y brillo.
const TARIMA_IPE = { tipo: 'tarima', color: '#56301e', escala: 2.4, pieza: 0.08, acabado: 'satinado' };
const GRANITO_NEGRO = { tipo: 'granito', color: '#121214', escala: 1.2, pieza: 0.6, acabado: 'pulido' };
const PIEDRA_OSCURA = { tipo: 'marmol', color: '#5d5750', escala: 1.2, pieza: 0.6, acabado: 'mate' };
const MARMOL_CLARO = { tipo: 'marmol', color: '#dcdddb', escala: 0.9, pieza: 0.45, acabado: 'mate' };
const PIZARRA = { tipo: 'pizarra', color: '#5a5d5f', escala: 1.2, pieza: 0.4, acabado: 'mate' };

// Revestimientos de pared
const ALICATADO_BANO = { tipo: 'alicatado', color: '#d5d6d4', pieza: [0.6, 0.3], acabado: 'satinado' };
const FRENTE_GRANITO = { tipo: 'granito', color: '#121214', acabado: 'pulido' };

/** Falso techo de la cocina y del distribuidor: SUPOSICIÓN (no hay cotas). Cámbialo aquí. */
const FALSO_TECHO = 2.4;

const ACABADOS = {
  salon: {
    suelo: TARIMA_IPE,
    acabado: { pared: { color: '#eeede9' } },
    focos: [[1.5, 1.0], [1.5, 2.4], [3.4, 1.7], [5.0, 1.0], [5.0, 2.3]],
  },
  cocina: {
    alturaTecho: FALSO_TECHO,
    suelo: GRANITO_NEGRO,
    acabado: {
      pared: { color: '#eeede9' },
      // Frente entre muebles bajos y altos (fotos de cerca): pared lisa pintada, copete de
      // granito negro sobre la encimera y un panel de granito tras la placa.
      revestimientos: [
        { nombre: 'Copete de granito negro sobre la encimera (fondo)', material: FRENTE_GRANITO, desde: 0.9, hasta: 1.0, zona: [1.8, 6.1, 4.1, 6.2] },
        { nombre: 'Copete de granito negro sobre la encimera (derecha)', material: FRENTE_GRANITO, desde: 0.9, hasta: 1.0, zona: [4.0, 4.42, 4.1, 6.2] },
        { nombre: 'Panel de granito negro tras la placa', material: FRENTE_GRANITO, desde: 0.9, hasta: 1.4, zona: [2.46, 6.1, 3.06, 6.2] },
      ],
    },
    focos: [[2.9, 4.1], [2.9, 5.3]],
  },
  tendedero: {
    suelo: PIEDRA_OSCURA,
    acabado: { pared: { color: '#eeede9' }, rodapie: { alto: 0.07, color: '#5d5750' } },
  },
  bano: {
    suelo: MARMOL_CLARO,
    acabado: {
      pared: { color: '#f2f2f0' },
      rodapie: null,
      revestimientos: [
        { nombre: 'Alicatado hasta 1,10 m', material: ALICATADO_BANO, hasta: 1.1 },
        { nombre: 'Alicatado de la ducha, hasta el techo', material: ALICATADO_BANO, hasta: 'techo', zona: [6.0, 0.2, 7.01, 1.7] },
      ],
    },
    focos: [[6.55, 0.95], [7.6, 1.0]],
    apliques: [{ desde: [7.2, 0.25], hasta: [7.8, 0.25], altura: 1.95 }],
  },
  distribuidor: {
    alturaTecho: FALSO_TECHO,
    suelo: TARIMA_IPE,
    acabado: { pared: { color: '#eeede9' } },
    focos: [[6.8, 2.31], [7.9, 2.31]],
  },
  dormitorio: {
    suelo: TARIMA_IPE,
    acabado: { pared: { color: '#e4e5e4' } },
    focos: [[9.7, 1.0], [9.7, 2.2], [11.4, 1.0], [11.4, 2.2]],
  },
  balcon: { suelo: PIZARRA },
};

// ---------------------------------------------------------------------------
// 4. Escala y origen
// ---------------------------------------------------------------------------
/** Píxel de la imagen original que será el punto (0, 0) en metros. */
const ORIGEN = [445, 99];
/** Recorte usado para planos/plano.jpg (la imagen que se superpone en la app). */
const RECORTE = { x: 420, y: 80, ancho: 1880, alto: 1000 };

const areaPx = (pts) => Math.abs(pts.reduce((s, [x1, y1], i) => {
  const [x2, y2] = pts[(i + 1) % pts.length];
  return s + x1 * y2 - x2 * y1;
}, 0)) / 2;

// Mínimos cuadrados: m²/px² = Σ(área_plano · área_px) / Σ(área_px²)
const conArea = estancias.filter((e) => e.superficie);
const k = conArea.reduce((s, e) => s + e.superficie * areaPx(e.px), 0)
  / conArea.reduce((s, e) => s + areaPx(e.px) ** 2, 0);
const PX_POR_METRO = 1 / Math.sqrt(k);

// Comprobación con el círculo de giro de ø1,50 m del rellano (diámetro dibujado)
const diametroPx = Math.hypot(1587 - 1452, 845 - 690);

// ---------------------------------------------------------------------------
// 5. Conversión a metros
// ---------------------------------------------------------------------------
const cm = (v) => Math.round(v * 100) / 100;
const aM = ([x, y]) => [cm((x - ORIGEN[0]) / PX_POR_METRO), cm((y - ORIGEN[1]) / PX_POR_METRO)];
const largoM = (px) => cm(px / PX_POR_METRO);

const vivienda = {
  nombre: 'Vivienda 2ºA',
  alturaTecho: 2.5,
  plano: {
    imagen: 'planos/plano.jpg',
    pixelesPorMetro: Math.round(PX_POR_METRO * 100) / 100,
    // Píxel de planos/plano.jpg que corresponde al punto (0, 0)
    origenPx: [ORIGEN[0] - RECORTE.x, ORIGEN[1] - RECORTE.y],
    anchoPx: RECORTE.ancho,
    altoPx: RECORTE.alto,
  },
  estancias: estancias.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    ...(e.exterior ? { exterior: true } : { alturaTecho: ACABADOS[e.id].alturaTecho ?? 2.5 }),
    ...(e.superficie ? { superficiePlano: e.superficie } : {}),
    suelo: ACABADOS[e.id].suelo,
    ...(ACABADOS[e.id].acabado ? { acabado: ACABADOS[e.id].acabado } : {}),
    ...(ACABADOS[e.id].focos ? { focos: ACABADOS[e.id].focos } : {}),
    ...(ACABADOS[e.id].apliques ? { apliques: ACABADOS[e.id].apliques } : {}),
    poligono: e.px.map(aM),
  })),
  paredes: muros.map((m) => {
    const [x1, y1, x2, y2] = m.rect;
    const horizontal = x2 - x1 >= y2 - y1;
    // Eje central del rectángulo, de izquierda a derecha o de arriba abajo.
    const desde = horizontal ? [x1, (y1 + y2) / 2] : [(x1 + x2) / 2, y1];
    const hasta = horizontal ? [x2, (y1 + y2) / 2] : [(x1 + x2) / 2, y2];
    const inicioEje = horizontal ? x1 : y1;
    return {
      id: m.id,
      nombre: m.nombre,
      desde: aM(desde),
      hasta: aM(hasta),
      grosor: largoM(horizontal ? y2 - y1 : x2 - x1),
      ...(m.alto ? { alto: m.alto } : {}),
      ...(m.tipo ? { tipo: m.tipo } : {}),
      huecos: (m.huecos ?? []).map(({ px, ...h }) => ({
        ...h,
        distancia: largoM(px[0] - inicioEje),
        ancho: largoM(px[1] - px[0]),
      })),
    };
  }),
  pilares: pilares.map((p) => {
    const [x1, y1, x2, y2] = p.rect;
    return { id: p.id, desde: aM([x1, y1]), hasta: aM([x2, y2]) };
  }),
  fijos: FIJOS,
  suposiciones: [
    `Escala deducida de las superficies útiles del plano (mínimos cuadrados): ${PX_POR_METRO.toFixed(1)} px/m. ` +
      `Comprobación: el círculo de giro de ø1,50 m mide ${(diametroPx / PX_POR_METRO).toFixed(2)} m con esta escala.`,
    'El plano no tiene cotas de estancias: todas las medidas salen de la imagen (precisión estimada ±3 cm).',
    'Altura libre de techo: 2,50 m (el plano no la indica). Falso techo de la cocina y del distribuidor: 2,40 m, SUPUESTO (las fotos muestran que es más bajo, pero no hay cotas).',
    'Puertas interiores: 2,05 m de alto. Puerta de entrada: 2,10 m. Anchos medidos en el plano.',
    'Mirador del salón: carpintería de madera de suelo a techo (2,45 m), con paños fijos abajo, hojas arriba y travesaño a 1,05 m. Sus dos laterales se suponen macizos.',
    'Balconera del dormitorio: 2 hojas de madera y vidrio de suelo a 2,10 m.',
    'Cerramiento entre cocina y tendedero (de la foto): fijo de suelo a 2,10 m partido a 1,05 m, puerta de madera con vidrio de 2,10 m y ventana fija sobre la encimera (alféizar 1,00 m).',
    'Cerramiento exterior del tendedero: lamas horizontales de aluminio negro de suelo a 2,45 m en todo el largo.',
    'Acabados (suelos, pintura, alicatados, rodapiés, carpintería) tomados de las fotos del anuncio. Colores aproximados a ojo.',
    'Alicatado del baño: 1,10 m de alto y hasta el techo en la zona de la ducha (x < 7,0 m). Frente de la cocina (fotos de cerca): pared lisa pintada, copete de granito negro de 10 cm sobre la encimera y panel de granito negro tras la placa hasta 1,40 m (sobre el horno, x 2,46–3,06).',
    'Focos empotrados: número de las fotos; posiciones repartidas a ojo. Aplique LED del baño sobre el lavabo, a 1,95 m.',
    'Sentido de apertura de las puertas: de los arcos del plano.',
    'La cocina está abierta al salón (en el plano no hay muro entre ambas, solo cambio de pavimento).',
    'El hueco del armario empotrado del dormitorio se cuenta dentro del dormitorio (así cuadra su superficie); su frente no se dibuja.',
    'Barandilla del balcón: 1,00 m de alto. El balcón no tiene superficie en el plano.',
    'Escalera, ascensor y rellano no forman parte de la vivienda y no se dibujan.',
    'Grosores de muro medidos en el plano: fachadas 0,18 m, tabiques 0,11–0,14 m, muros a zonas comunes 0,15–0,30 m.',
  ],
};

writeFileSync(join(RAIZ, 'data', 'vivienda.json'), JSON.stringify(vivienda, null, 2) + '\n');
documentarFijos();

// Informe
console.log(`Escala: ${PX_POR_METRO.toFixed(2)} px/m  ·  ø1,50 → ${(diametroPx / PX_POR_METRO).toFixed(3)} m`);
for (const e of conArea) {
  const m2 = areaPx(e.px) / PX_POR_METRO ** 2;
  console.log(`${e.nombre.padEnd(14)} plano ${e.superficie.toFixed(2)} m²  medido ${m2.toFixed(2)} m²  (${((m2 / e.superficie - 1) * 100).toFixed(1)} %)`);
}
console.log('✔ data/vivienda.json');
