// Escribe data/escena-inicial.json: la casa amueblada como en las fotos del
// anuncio (fase 5, lote 3). Es la escena que carga la app la primera vez (si no
// hay nada autoguardado) y la de "Restaurar disposición original".
//
// Uso:  npm run escena:inicial
//
// Coordenadas en metros de data/vivienda.json (x hacia la derecha del plano,
// z hacia abajo). Giros en grados, antihorario visto desde arriba; con giro 0
// el frente del mueble mira hacia +z (hacia abajo del plano):
//   0 = mira al sur · 90 = al este · 180 = al norte · 270 = al oeste.
// Los objetos de pared se dan por el muro, la estancia a la que miran, un punto
// de la pared y la altura de su centro; los apoyados, por su mueble y la altura
// de la tapa o balda.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const objetos = [];
const indice = new Map();
const r3 = (n) => Math.round(n * 1000) / 1000;

/** Mueble en el suelo: centro de su base (x, z) y giro. `nombre` sirve para apoyar cosas encima. */
function suelo(catalogo, x, z, rotacion = 0, nombre) {
  if (nombre) indice.set(nombre, objetos.length);
  objetos.push({ catalogo, posicion: { x: r3(x), y: 0, z: r3(z) }, rotacion, colocacion: 'suelo' });
}
/** Objeto apoyado en la tapa o balda `nivel` del mueble `soporte`, en (x, z) o en su centro. */
function sobre(catalogo, soporte, nivel, rotacion, x, z) {
  const s = objetos[indice.get(soporte)];
  objetos.push({
    catalogo, posicion: { x: r3(x ?? s.posicion.x), y: nivel, z: r3(z ?? s.posicion.z) },
    rotacion: rotacion ?? s.rotacion, colocacion: 'superficie', soporte: indice.get(soporte), nivel,
  });
}
/** Objeto colgado: muro, estancia a la que mira, punto de la pared (x, z) y altura de su centro. */
function pared(catalogo, muro, estancia, x, z, altura) {
  objetos.push({ catalogo, posicion: { x: r3(x), y: altura, z: r3(z) }, rotacion: 0, colocacion: 'pared', pared: `pared:${muro}`, estancia, altura });
}

// --- Salón (fotos "Salón" 1, 2 y 3) -------------------------------------------------
// Sofá contra la pared larga (norte), de cara a la tele; librería en la misma pared, hacia el comedor.
suelo('sofas/sofa-3-plazas', 1.905, 0.695, 0);
suelo('almacenaje/libreria', 3.505, 0.435, 0);
// Mueble de TV contra la pared de enfrente (sur), entre el mirador y la cocina, mirando al sofá.
suelo('almacenaje/mueble-tv', 1.335, 3.035, 180, 'mueble-tv');
sobre('electronica/television', 'mueble-tv', 0.55);
// Mesa de centro entre el sofá y la tele, a lo largo del salón.
suelo('mesas/mesa-centro', 1.95, 2.0, 0);
// Sillón en el mirador, mirando al salón; a su lado la mesita de bandeja con una planta.
suelo('sofas/sillon', 0.56, 1.6, 90);
suelo('mesas/mesita-bandeja', 0.5, 2.35, 0, 'mesita-bandeja');
sobre('decoracion/planta-pequena', 'mesita-bandeja', 0.43, 0);
// Mesita de alambre con el foco, junto a la pared sur entre la cocina y el comedor.
suelo('mesas/mesita-alambre', 3.62, 2.9, 0, 'mesita-alambre');
sobre('iluminacion/lampara-tripode', 'mesita-alambre', 0.55, 315);
// Lámpara de pie: junto a la librería, delante del espejo (foto del comedor).
suelo('iluminacion/lampara-pie-semiesfera', 4.515, 0.385, 0);

// --- Comedor -------------------------------------------------------------------------
// Mesa de cristal contra el fondo (pared este), a lo largo de ella, con 2 sillas a cada lado.
suelo('mesas/mesa-comedor-cristal', 5.025, 1.105, 90);
suelo('sillas/silla-comedor', 4.395, 0.85, 90);
suelo('sillas/silla-comedor', 4.395, 1.36, 90);
suelo('sillas/silla-comedor', 5.65, 0.85, 270);
suelo('sillas/silla-comedor', 5.65, 1.36, 270);
// Espejo de marco negro en la pared norte, sobre la mesa; 3 marcos blancos en la del fondo.
pared('pared/espejo-marco-negro', 'fachada-norte', 'salon', 5.02, 0.23, 1.45);
for (const z of [0.8, 1.1, 1.4]) pared('pared/cuadro-marco-blanco', 'salon-este', 'salon', 5.93, z, 1.6);

// --- Pasillo / distribuidor (foto "Pasillo") -------------------------------------------
// Pared de la puerta de entrada (sur): perchero y espejo plateado junto a la puerta,
// pasada la hoja de la puerta del salón cuando está abierta (como en la foto); el espejo, debajo y más cerca de la entrada.
pared('pared/perchero-pared', 'rellano', 'distribuidor', 6.92, 2.84, 1.85);
pared('pared/espejo-marco-plateado', 'rellano', 'distribuidor', 7.2, 2.84, 1.38);
// Pared del baño (norte): un marco antes de la puerta del baño y otro después.
pared('pared/cuadro-marco-blanco', 'bano-distribuidor', 'distribuidor', 6.45, 1.78, 1.6);
pared('pared/cuadro-marco-blanco', 'bano-distribuidor', 'distribuidor', 8.2, 1.78, 1.6);

// --- Dormitorio (fotos "Habitación", "Terraza" y la del lado izquierdo de la cama) ----------
// Cama con el cabecero contra la pared norte, casi centrada; una mesita de noche a cada
// lado (la izquierda, a 22 cm del pilar de la esquina, como en la foto), cada una con su
// lámpara y un cuadro encima. Puf baúl contra la pared de la puerta, delante del pilar.
suelo('dormitorio/cama', 10.5, 1.27, 0);
suelo('dormitorio/mesita-noche', 11.52, 0.425, 0, 'mesita-noche');
sobre('iluminacion/lampara-sobremesa', 'mesita-noche', 0.5);
suelo('dormitorio/mesita-noche', 9.48, 0.425, 0, 'mesita-izquierda');
sobre('iluminacion/lampara-sobremesa', 'mesita-izquierda', 0.5);
suelo('dormitorio/puf', 9.0, 1.05, 0);
// Cómoda contra la pared del armario (sur), junto a él, mirando a las mesitas; lámpara en su
// esquina hacia la balconera y 4 marcos encima (2 columnas, la del armario más alta).
suelo('dormitorio/comoda-alta', 11.53, 2.72, 180, 'comoda');
sobre('iluminacion/lampara-sobremesa', 'comoda', 1.15, 180, 11.69, 2.65);
pared('pared/cuadro-marco-gris', 'fachada-norte', 'dormitorio', 11.4, 0.23, 1.5);
pared('pared/cuadro-marco-plateado', 'fachada-norte', 'dormitorio', 9.48, 0.23, 1.5);
for (const [x, y] of [[11.43, 1.42], [11.43, 1.74], [11.63, 1.42], [11.63, 1.68]]) pared('pared/marco-madera', 'dormitorio-sur', 'dormitorio', x, 2.93, y);

// --- Balcón (foto "Terraza") ------------------------------------------------------------
suelo('exterior/mesa-balcon', 13.035, 1.475, 0, 'mesa-balcon');
sobre('decoracion/planta-pequena', 'mesa-balcon', 0.72, 0);
suelo('exterior/silla-balcon', 13.035, 0.9, 0);
suelo('exterior/silla-balcon', 13.035, 2.05, 180);

// --- Tendedero (foto "Cocina") ---------------------------------------------------------
// Lavadora contra la pared del fondo (norte), junto a las lamas y bajo el aire acondicionado, mirando a la estancia.
suelo('tendedero/lavadora', 0.9, 3.76, 0);

const escena = { version: 5, vivienda: 'Vivienda 2ºA', objetos };
writeFileSync(join(RAIZ, 'data', 'escena-inicial.json'), JSON.stringify(escena, null, 2) + '\n');
console.log(`✔ data/escena-inicial.json (${objetos.length} objetos)`);
