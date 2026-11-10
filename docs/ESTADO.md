# Estado del proyecto

Última actualización: 10 de noviembre de 2026, tras los ajustes con las
fotos de cerca de la cocina y del dormitorio (después de la fase 3c). El detalle de la fase 2 (medidas del plano, suposiciones,
comprobaciones) sigue en [RESUMEN_FASE2.md](RESUMEN_FASE2.md).

**App:** <https://exequ.github.io/Casa/> (se publica sola en cada cambio de `main`).

---

## Ajustes con fotos de cerca (cocina y dormitorio)

Tres fotos nuevas: la cocina de frente y desde el frigorífico, y el lado
izquierdo del dormitorio. Un PR por parte.

| Parte | Estado | Detalle |
|---|---|---|
| Cocina | **Hecho** | **Fregadero** de acero bajo encimera (cubeta de 0,40 × 0,34) con grifo cromado de caño alto, en el armario de 0,60 junto a la columna del frigorífico; **lavavajillas** blanco de 45 cm a su derecha y luego el rincón. Pared del fondo con las medidas de la foto frontal: armario de 0,40, horno de 0,60 y cajonera de 0,60 hasta la ventana; los altos, alineados encima (puerta de 0,40 sobre el armario, **campana** sobre la placa, puerta y estantes sobre la cajonera). Campana con frente **lacado** y tirador horizontal (no de acero). Horno con el panel de mandos arriba (reloj azul y dos mandos) y el tirador en lo alto de la puerta negra; vitrocerámica con canto claro y zonas marcadas. Tiradores de las puertas sueltas en el lado de la foto. Entre encimera y muebles altos, **pared lisa** pintada (sin azulejo), copete de granito de 10 cm y panel de granito tras la placa hasta 1,40 m. |

### Comprobaciones (cocina)

- `npm test`: 227 tests en verde; nuevos: fregadero junto a la columna y lavavajillas de 45 cm a continuación, hueco de la encimera con la cubeta debajo, grifo dentro de la caja del mueble (y por debajo de los altos), campana centrada sobre el horno y altos alineados con los bajos, panel de granito justo tras la placa y sin azulejo.
- Capturas desde los puntos de vista de las dos fotos de la cocina (escritorio y móvil), comparadas con ellas; vistas de cerca del fregadero y de la placa.
- Batería de los fijos en el navegador (ratón y dedo): los 17 fijos, no se seleccionan, una mesa arrastrada se para delante de la cocina, no se cuelga un cuadro sobre los altos; sin errores.

### Decisiones (cocina)

- **Medidas de la pared del fondo** sacadas de la foto frontal (0,40 / 0,60 / 0,60): el horno y la placa quedan en x 2,46–3,06, unos 13 cm más hacia el armario que antes y algo más que en el plano; manda la foto.
- La **pared** entre la encimera y los muebles altos se ve lisa en las fotos de cerca: se quita el azulejo (queda la pintura de la cocina).
- El **grifo** sobresale de la caja del mueble: el fijo cuenta su altura (0,31 m) para los choques y para no colgar nada encima.

---

## Fase 3c: elementos fijos

Cada parte se publica con su propio PR.

| Parte | Estado | Detalle |
|---|---|---|
| Diseño común | **Hecho** | Sección `fijos` en `data/vivienda.json` (desde `scripts/fijos.mjs`), validada al abrir la app y documentada en el README. Huellas para los choques: los fijos del suelo son obstáculo permanente en `EspacioLibre`; los colgados, solo para muebles más altos que su base; ningún cuadro puede colgarse sobre un fijo. Dibujo por código (`src/escena/fijos3d.ts`), con materiales del color y brillo de las fotos y la textura de granito; en el móvil, el modo ligero de siempre. Los colgados van en el grupo de acabados de su pared y se ocultan con ella. |
| A. Cocina | **Hecho** | En L, según el plano y las fotos: columna con el frigorífico combi (altillo con rejilla), lavavajillas blanco de 45 cm junto a ella, armario y rincón en la pared este; en la del fondo, armario, horno de acero con cristal negro y placa (la del plano) y cajonera de 4. Encimera de granito negro, zócalo blanco, tiradores de barra de acero. Altos lacados hasta el falso techo con campana extraíble sobre la placa y estantes abiertos al final, junto a la ventana. El frente de azulejo ya no queda detrás de la columna; copete de granito de 8 cm y frente de granito sobre el horno. |
| B. Baño | **Hecho** | Según el plano: plato de ducha extraplano blanco a la izquierda (0,65 × 1,36) con desagüe de rejilla, mampara fija de cristal con perfil cromado en la mitad hacia la puerta y barra de sujeción a la pared, grifería termostática cromada con barra y rociador en la pared del fondo, agarradera de acero junto a la ducha; mueble de lavabo blanco lacado de 3 cajones sobre patas con lavabo integrado y grifo en el centro del fondo, espejo sin marco encima (bajo el aplique LED que ya había); inodoro y bidé de líneas rectas en la pared de la derecha. |
| C. Armario empotrado | **Hecho** | En el hueco del plano (2,19 × 0,57 m), de suelo a techo, con el frente hacia la cama: 4 puertas blancas lisas (dos parejas), juntas horizontales finas cada 0,62 m y pomos redondos plateados pequeños; cerradas. |
| D. Aire acondicionado | **Hecho** | Unidad interior split blanca en la pared del salón junto al mirador, centrada sobre el mueble de TV, de 2,00 a 2,29 m. Unidad exterior en el tendedero, en la pared del fondo sobre la lavadora, sobre soportes de acero, de 1,80 a 2,42 m, con el ventilador hacia las lamas. Las dos se ocultan con su pared en la vista desde fuera. |

### Comprobaciones (parte A)

- `npm test`: todo en verde, con los tests nuevos de `tests/fijos.test.ts`.
- Capturas desde los puntos de vista de las dos fotos de la cocina, en escritorio y móvil, comparadas con ellas.
- Navegador (escritorio con ratón y móvil con el dedo): los fijos están en la escena y no se seleccionan; una mesa arrastrada hacia los muebles de la cocina se para delante; no se puede colgar un cuadro sobre los muebles altos. Las baterías anteriores siguen pasando.
- Carga en el móvil (primera visita, media de 3, tres tandas): casa visible a los 2.020–2.230 ms en main y 2.040–2.250 ms con la cocina (unos +20 ms: no empeora de forma apreciable; +30 KB).

### Comprobaciones (parte B)

- Tests del baño (piezas, posiciones del plano, espejo sobre el lavabo y bajo el aplique, mampara sobre el plato y barra hasta la pared).
- Capturas desde los puntos de vista de las dos fotos del baño (escritorio y móvil), comparadas con ellas. Las baterías anteriores siguen pasando.

### Comprobaciones (parte C)

- Tests del armario (hueco del plano, de suelo a techo, frente hacia la cama; no se puede meter un mueble dentro).
- Capturas del dormitorio desde el punto de vista de la foto (escritorio y móvil), comparadas con ella.

### Comprobaciones (parte D)

- Tests del aire acondicionado (posición sobre el mueble de TV y sobre la lavadora sin tocarla; bajo la unidad interior caben el mueble de TV y la librería de 2,00 m, pero no algo más alto).
- Capturas desde los puntos de vista de la foto del salón hacia la cocina y de la del tendedero (escritorio y móvil), comparadas con ellas.
- Escena inicial: **ningún objeto chocaba con un fijo**; no hubo que mover nada.
- **Carga en el móvil con los 17 fijos** (primera visita, media de 3, dos tandas): antes de la fase 3c, casa visible a los 2.247 / 2.193 ms; con todos los fijos, 2.250 / 2.101 ms (+25 KB). No empeora.
- Las baterías de navegador de las fases 3b, 4 y 5 (lotes 1 a 3) y la de los fijos (ratón y dedo) pasan.

### Decisiones (parte D)

- El **armario empotrado** va unido a la pared del fondo de su hueco: en la vista desde fuera se oculta con ella (si no, un bloque de 2,49 m tapaba la cama).
- **Unidad exterior** girada con el ventilador hacia las lamas (en la foto se ve de lado, con los tubos a un costado).
- La unidad interior es un colgado a 2,00 m: los muebles más altos de 2,00 m no caben debajo (la librería sí).

### Decisiones (parte B)

- **Mampara** en la mitad de la ducha hacia la puerta (como la línea gruesa del plano), entrando por el lado del lavabo; la barra de sujeción va de su extremo libre a la pared izquierda.
- **Agarradera** en la pared izquierda de la ducha, a 0,95 m (la foto no deja ver bien en qué pared está).
- El **aplique LED** sobre el espejo es la luz que ya tenía el baño (fase 3b).

### Decisiones (parte A)

- **Fregadero:** no se dibujaba (no se veía ni en las fotos ni en el plano); añadido después con las fotos de cerca (ver arriba). La **placa** sí (está en el plano) y la **campana** extraíble también (se ve en la foto bajo los muebles altos).
- **Posición del horno:** x 2,33–2,93, con la cajonera de 0,50 m a su derecha, junto a la ventana, como en las fotos. En el plano la placa está unos 10 cm más a la izquierda.
- **Lavavajillas:** de 45 cm junto a la columna, en el módulo de 0,51 del plano.
- **Muebles altos del fondo:** empiezan a 5 cm de la ventana sobre la encimera para no taparla.
- Tiradores y cromados algo menos metálicos que en la realidad, para que en el móvil (sin reflejos) no se vean negros.

---

## Fase 5, lote 3 (anterior): la casa amueblada por defecto

| # | Requisito | Estado | Detalle |
|---|---|---|---|
| 1 | `data/escena-inicial.json` con la disposición de las fotos | **Hecho** | 39 objetos, formato de escena v5, generado por `scripts/escena-inicial.mjs` (`npm run escena:inicial`) con coordenadas de `data/vivienda.json`. Comparado con capturas desde los puntos de vista de las 7 fotos (salón hacia el mirador, hacia el distribuidor y hacia la cocina, pasillo, dormitorio, terraza y tendedero). |
| 2 | Contenido y disposición | **Hecho** | Ver la tabla de abajo. Ningún objeto de ejemplo de la fase 4. |
| 3 | Primera visita amueblada; autoguardado respetado; Restaurar; Vaciar | **Hecho** | Sin autoguardado se carga la escena inicial (y queda autoguardada). Con autoguardado se respeta, también si está vacío. *Restaurar disposición original* en el menú (sección Escena): dos toques, solo muebles (no toca suelos, colores ni luces), se deshace con ↶. Guardar y cargar, igual que antes. |
| 4 | Tests y navegador | **Hecho** | Ver "Comprobaciones". |
| 5 | Documentación | **Hecho** | Este documento y README. |

### Disposición (según las fotos)

| Estancia | Objetos |
|---|---|
| Salón (20) | Sofá contra la pared norte mirando a la tele; librería en la misma pared hacia el comedor; mueble de TV contra la pared sur junto al mirador, con la tele encima; mesa de centro entre ambos; sillón en el mirador mirando al salón con la mesita de bandeja y una planta a su lado; mesita de alambre con el foco junto a la pared sur, entre la cocina y el comedor; lámpara de pie entre la librería y el comedor. |
| Comedor (dentro del salón) | Mesa de cristal contra la pared del fondo (este), a lo largo, con 4 sillas (2 por lado); espejo de marco negro en la pared norte; 3 marcos blancos en la pared del fondo, sobre la mesa. |
| Distribuidor (4) | Perchero y espejo plateado en la pared de la puerta de entrada; 2 marcos blancos en la pared del baño, uno a cada lado de su puerta. |
| Dormitorio (10) | Cama con el cabecero contra la pared norte; mesita de noche con su lámpara entre la cama y la balconera; cómoda en la pared de la balconera mirando a la cama, con otra lámpara; cuadro gris sobre la mesita; 4 marcos de madera sobre la cómoda (en la foto se ven 4; el encargo decía 3). |
| Balcón (4) | Mesa plegable con una planta encima y las 2 sillas a los lados. |
| Tendedero (1) | Lavadora contra la pared del fondo, junto a las lamas y bajo el aire acondicionado, mirando a la estancia. |

### Comprobaciones del lote 3

- **`npm test`: 202 tests, todos pasan** (6 nuevos en `tests/escena-inicial.test.ts`).
- **`npm run build`** sin errores.
- **Navegador, escritorio (22 comprobaciones):** primera visita amueblada y autoguardada; sin solapes; objetos por estancia; mover, girar (Q), duplicar (D), borrar y deshacer cuatro veces hasta el estado original; Vaciar con doble clic y recarga vacía; Restaurar con doble clic, deshacer y rehacer; Restaurar no toca los colores; recarga; Guardar y Cargar (v4 y la v5 guardada); sin errores.
- **Navegador, móvil (iPhone 13, toques reales):** primera visita amueblada; arrastrar el sillón con el dedo; Restaurar con dos toques desde el menú; sin errores.
- **Capturas desde los 7 puntos de vista de las fotos**, en escritorio y móvil, comparadas lado a lado con ellas.
- **Carga en el móvil** (primera visita, media de 3): con main, casa vacía visible a los 1.922 ms; ahora, casa visible a los 2.146 ms y amueblada a los 2.230 ms (+0,3 s y unos 600 KB más, por los 26 modelos; se descargan en paralelo).
- Las baterías de las fases 3b, 4 y 5 siguen pasando (empezando desde una casa vacía).

### Problemas y decisiones del lote 3

- **Todo cabe con las medidas estimadas**; no hace falta confirmar ninguna
  para que encaje. Lo más justo: el comedor (mesa de 0,70 m de fondo junto a
  la pared del fondo con 2 sillas por lado: las de detrás quedan a 5 mm de la pared) y la
  lámpara de pie, encajada entre la librería y la silla. Si la mesa de
  comedor o la librería miden más de lo estimado, habría que moverlas:
  conviene **confirmar el largo de la mesa de comedor y el ancho de la librería**.
- **Lámpara de pie:** su sitio en las fotos es ambiguo; la puse entre la
  librería y el comedor, delante del espejo, como en la foto del comedor.
- **Marcos de madera:** 4 sobre la cómoda (la foto muestra 4; el encargo decía 3).
- **Marcos blancos:** 3 sobre la mesa del comedor y 2 en el pasillo (5 en total).
- **Perchero y espejo plateado:** en la pared de la entrada, pasado el
  barrido de la puerta del salón; el perchero a 1,85 m y el espejo a 1,38 m (como en la foto).
- **Aire acondicionado:** no está en el catálogo, así que no se pone (sobre el mueble de TV ni en el tendedero).
- **Restaurar** solo recoloca los muebles; los suelos, colores y luces se quedan como estén.
- La primera visita queda autoguardada en seguida (así, recargar no la vuelve a generar).

---

## Fase 5, lote 2 (anterior): fotos reales, texturas y dormitorio, balcón y tendedero

### Parte A: el lote 1 ajustado a las fotos

| Objeto | Qué cambió al compararlo con las fotos |
|---|---|
| Sofá | Brazos enrollados hacia fuera (perfil curvo) más bajos que el respaldo, con vivo; respaldo fijo; crema más amarillento; cojines como en la foto (azul pizarra y blanco). |
| Sillón | Mucho más oscuro (gris pardo), brazos rectos. |
| Mesa de centro | Teca media con veta; cristal ahumado; **celosía de rombos continua en los 4 lados** entre el faldón y un travesaño bajo; patas que se estrechan. |
| Librería | 4 baldas (no 5) a 0,37 / 0,66 / 0,98 / 1,36 m; cornisa escalonada que vuela; zócalo con moldura; cajón con panel en relieve; madera más rojiza. |
| Mueble de TV | Un solo estante de listones a 0,275 m (no dos); faldón; teca oscura. |
| Televisión | Marco gris oscuro algo metálico. |
| Mesa de comedor | Sin bastidor: patas redondas finas sujetas con pletinas, más abiertas. |
| Silla de comedor | Carcasa envolvente tapizada en blanco roto. |
| Lámpara semiesfera | Negro brillante, vástago más fino. |
| **Lámpara de trípode** | **Medida corregida:** en la foto es un foco de sobremesa sobre la mesita de alambre, no una lámpara de pie: 0,24 × 0,28 × 0,55 m y colocación "superficie". Foco cilíndrico inclinado con horquilla de latón. |
| **Mesita de alambre** | **Medida corregida:** 0,45 m de diámetro (no 0,35): en la foto es casi tan ancha como alta. Varillas cruzadas en reloj de arena. |
| Mesita de bandeja | Patas casi rectas unidas por un aspa abajo. |
| Espejo marco negro | Marco de madera muy oscura más ancho (11 cm) con rebaje. |
| Cuadro marco blanco | Lámina azul grisácea; en la foto hay tres en fila. |

**Texturas:** veta de madera en todas las maderas y tejido sutil en
tapicerías, cojines, colchón y pantalla de la lámpara; imágenes de 128 px
(madera) y 64 px (tela) en grises dentro de cada `.glb` (unos 10 KB).

### Parte B: lote 2

10 objetos nuevos (`npm run catalogo:lote2`): cama con cabecero de cerezo y
canapé, mesita de noche, lámpara de sobremesa, cómoda alta de 6 cajones,
cuadro de marco gris, marco pequeño de madera, mesa redonda y silla plegables
de balcón, planta pequeña en maceta blanca y lavadora. Medidas, colocación y
superficies en `docs/OBJETOS.md` (la cama y la silla del balcón no admiten
nada encima).

### Comprobaciones del lote 2

- **`npm test`: 196 tests, todos pasan** (catálogo: los 26 muebles reales con
  medidas exactas, origen, triángulos, tamaño y texturas; colocación y
  superficies de ambos lotes; apoyos en la app).
- **`npm run build`** sin errores.
- **Vistas de cada objeto** (frente, lado y 3/4 trasera) revisadas frente a
  las fotos; corregidos: celosía de la mesa de centro (salían X sueltas),
  color de la madera, ondulación de la veta, maceta de la planta.
- **Navegador, escritorio:** 32 miniaturas; los 10 objetos del lote 2
  añadidos desde el catálogo (lámpara y planta se apoyan en la mesita); la
  casa amueblada como en las fotos (35 objetos); cada modelo mide en la escena
  lo de su ficha; todo bien colocado; texturas presentes; recarga; sin errores.
  **Capturas desde los mismos puntos de vista que las 5 fotos** (salón hacia
  el mirador, hacia el comedor y hacia la cocina, dormitorio y balcón) y del
  tendedero, comparadas con ellas.
- **Navegador, móvil (iPhone 13, toques reales):** cama, mesita y lámpara
  desde el menú; arrastrar la mesita con el dedo y la lámpara va con ella;
  capturas del dormitorio y del salón; sin errores.
- **Carga en el móvil** (media de 3, iPhone 13 emulado): vacía, 1.823 ms en
  main y 1.798 ms ahora; con el salón amueblado (11 muebles), 2.060 ms y
  2.053 ms. Para compensar las texturas, las miniaturas del catálogo ya no se
  descargan en el móvil hasta abrir el menú.
- Las baterías de navegador de las fases 3b, 4 y 5 (lote 1) siguen pasando (en la de la 3b actualicé las dos comprobaciones que esperaban la versión 4 de la escena).

### Problemas y limitaciones del lote 2

- La lavadora y el perchero no salen en las fotos: son modelos genéricos.
- Las medidas siguen siendo estimadas (las fotos no tienen cotas).
- Las texturas son procedurales: veta y tejido sutiles, no fotos reales.
- No probado en un móvil real.

### Decisiones del lote 2

- La lámpara de trípode pasa a ser un foco de sobremesa y la mesita de
  alambre a 0,45 m de diámetro (anotado en `docs/OBJETOS.md`).
- La librería tiene 4 baldas (como en la foto) y el mueble de TV un estante.
- Las texturas multiplican el color (el tono sigue siendo el medido en la foto).
- `ajustar()` en la librería de modelado estira unos milímetros las piezas
  curvas para que el modelo mida exactamente lo de la ficha.
- Carpetas nuevas: `dormitorio/`, `exterior/`, `decoracion/`, `tendedero/`.
- Cuadro gris con el centro a 1,55 m; marcos de madera a 1,50 m.

---

## Fase 5, lote 1 (anterior): muebles reales del salón y del pasillo

| # | Requisito | Estado | Detalle |
|---|---|---|---|
| 1 | Script reutilizable que genera cada objeto (.glb + .json) en `catalogo/<categoria>/` | **Hecho** | `scripts/catalogo-lote1.mjs` (`npm run catalogo:lote1`) con la librería `scripts/lib/modelo3d.mjs`: piezas de three.js (cajas, cajas redondeadas para tapizados y cojines, cilindros, barras inclinadas, esferas, tornos y extrusiones), una malla por material, materiales compartidos dentro de cada objeto. Carpetas: `sofas/`, `mesas/`, `sillas/`, `almacenaje/`, `electronica/`, `iluminacion/`, `pared/`. |
| 2 | Formas fieles, menos de 20.000 triángulos, .glb ligeros | **Hecho** | Entre 108 y 6.948 triángulos; entre 7 y 132 KB. |
| 3 | Origen en el centro de la base, frente +Z, medidas reales, colocación y superficies | **Hecho** | El script comprueba la caja envolvente de cada modelo al guardarlo (falla si no coincide con la ficha o no está centrado). Sofá, sillón, silla y lámparas llevan `"superficies": []`: no se puede apoyar nada encima (la app ahora entiende la lista vacía). |
| 4 | Medidas estimadas y `docs/OBJETOS.md` | **Hecho** | Tabla con medidas, colocación, de dónde sale cada medida y estado. Corregir una medida = editar el `.json` (la app estira el modelo); el script respeta esas correcciones si se vuelve a ejecutar. |
| 5 | Miniaturas de 128 px en el panel | **Hecho** | `scripts/miniaturas.mjs` (`npm run catalogo:miniaturas`) dibuja cada `.glb` en un Chromium sin ventana; se muestran en el catálogo (también las de los objetos de ejemplo). |
| 6 | Verificación de cada objeto | **Hecho** | Caja envolvente (script y test), frente +Z y 3 vistas por objeto (frente, lado y 3/4 desde atrás, con una flecha roja hacia +Z) revisadas una a una; luego, en la app, el salón y el pasillo amueblados. |
| 7 | Tests del catálogo | **Hecho** | `tests/catalogo.test.ts`: todo el catálogo carga; cada `.glb` es coherente con su `.json`; triángulos y tamaño; colocación y superficies. |
| 8 | Tiempo de carga en el móvil | **Hecho, no empeora** | Los `.glb` ya se cargaban bajo demanda (al añadir el objeto); ahora además las miniaturas y los modelos nunca van dentro del JavaScript (`assetsInlineLimit`) y las imágenes son `loading="lazy"`. iPhone 13 emulado, media de 3 cargas: fase 4, 948 ms y 227 KB; fase 5, 963 ms y 235 KB. |

**Lo que cambió del encargo:** la lámpara de trípode mide 0,449 × 0,442 m en
planta (no 0,45 × 0,45): con tres patas abiertas la planta no es cuadrada.

### Comprobaciones de la fase 5

- **`npm test`: 184 tests, todos pasan** (27 nuevos en `tests/catalogo.test.ts`).
- **`npm run build`** sin errores.
- **Vistas de cada objeto** (frente, lado, 3/4 trasera) revisadas: corregí el
  color de la mesa de centro (salía naranja) y piezas que se salían de la caja.
- **Navegador automático, escritorio (12 comprobaciones):** 22 miniaturas de
  128 px; buscador; añadir los 16 objetos desde el catálogo (cada uno donde le
  toca y descargando su modelo en ese momento); amueblar el salón y el pasillo;
  en la escena cada modelo mide lo que dice su ficha (±5 mm); todo bien
  colocado; la tele sobre el mueble de TV; el sofá no es soporte; recarga; sin
  errores. Capturas del salón (fuera, planta y dentro: sofá, tele, comedor) y del pasillo.
- **Navegador automático, móvil (iPhone 13, toques reales, 4 comprobaciones):**
  miniatura en el menú, añadir el sofá tocándola, arrastrarlo con el dedo, sin
  errores; capturas del salón amueblado por fuera y por dentro.
- Las baterías de las fases 4 y 3b siguen pasando (en la de la fase 4 actualicé la búsqueda: "espe" ahora encuentra tres espejos; en la de la 3b, dos comprobaciones esperan aún la versión 4 de la escena, que ya es la 5).

### Problemas y limitaciones de la fase 5

- **No recibí fotos en este encargo**: los modelos siguen las descripciones y
  medidas del mensaje; no he podido compararlos con las fotos. Los colores son
  los descritos (crema, gris-marrón, madera miel/caoba, muy oscura...).
- Las medidas interiores (alturas de asiento, baldas...) las puse yo; están
  marcadas en `docs/OBJETOS.md`.
- Las texturas son colores lisos (sin vetas de madera ni tejido).
- Las lámparas no dan luz (no se pedía en este lote).

### Decisiones de la fase 5

- Carpetas por categoría (`catalogo/sofas/`, `mesas/`...), así que los
  identificadores son `sofas/sofa-3-plazas`, etc.
- `"superficies": []` para lo que no es soporte, y campo informativo
  `"medidas": "estimadas"`.
- La librería tiene 6 superficies: las 5 baldas (0,33 a 1,61 m) y la tapa
  (2,00 m); el mueble de TV, 3 (0,135, 0,335 y 0,55 m); la mesita de bandeja,
  0,43 m (fondo de la bandeja).
- Sofá con cojines azules en los extremos y crema en el centro; sillón con su cojín gris.
- Las miniaturas son de todo el catálogo (también los objetos de ejemplo).

---

## Fase 4 (anterior): herramientas para decorar

| # | Requisito | Estado | Detalle |
|---|---|---|---|
| 1 | Campo `colocacion` en el catálogo (`suelo` / `pared` / `superficie`), `alturaCentro`, `superficies`; los .json antiguos siguen valiendo | **Hecho** | Validado al leer el catálogo (`src/catalogo/catalogo.ts`) y documentado en el README. Sin `colocacion` → suelo; sin `superficies` → el borde superior del mueble; sin `alturaCentro` → 1,50 m. |
| 2 | Objetos de pared | **Hecho** | Se pegan a la pared a la que apunta el cursor o el dedo (o a la más cercana al punto del suelo señalado), con el frente hacia la estancia, y corren a lo largo de ella o pasan a otra. No pueden tapar puertas (con 7 cm de tapajuntas) ni ventanas (con 3 cm de marco), ni solaparse con otro objeto de la misma pared, ni salirse de la pared, el suelo o el techo: se quedan en el sitio libre más cercano. Altura con deslizador y número en el panel, y ▲ ▼ (5 cm) en la barra del móvil. Si su muro se baja en la vista desde fuera, se ocultan con él. |
| 3 | Objetos de superficie | **Hecho** | Al arrastrarlos sobre un mueble se apoyan en la tapa o balda señalada (la más alta por debajo del puntero; si no cabe, las demás), dentro del mueble, sin solaparse y comprobando que caben en altura bajo la balda de encima. Se mueven y giran con el mueble. Al borrar el mueble pasan a otro mueble libre a menos de 1,5 m o, si no hay, al suelo. Si no hay mueble bajo el puntero, van por el suelo. |
| 4 | Los de suelo no se solapan; los de pared y superficie no son obstáculo | **Hecho** | Solo los objetos que están en el suelo cuentan como obstáculo (un jarrón que esté en el suelo, sí). |
| 5 | Deshacer y rehacer, mínimo 50 pasos | **Hecho** | Botones ↶ ↷ y `Ctrl+Z` / `Ctrl+Mayús+Z` (o `Ctrl+Y`). Recuerda 100 pasos: añadir, mover, girar, borrar, vaciar, duplicar, colgar, apoyar, altura, cargar una escena y cambiar suelos o colores de pared. Los cambios muy seguidos (p. ej. el selector de color) cuentan como uno. No incluye luces, puertas ni cortinas. Se borra al recargar la página. |
| 6 | Duplicar | **Hecho** | Tecla `D`, botón *Duplicar* del panel y ⧉ en la barra del móvil. La copia va al lado (en la misma pared o el mismo mueble si cabe) y queda seleccionada. |
| 7 | Catálogo: categorías plegables y buscador | **Hecho** | Categorías como desplegables (abiertas al empezar) y buscador por nombre sin importar tildes ni mayúsculas, con aviso si no hay resultados. También en el menú del móvil. |
| 8 | Imagen PNG de la vista | **Hecho** | Botón 📷: descarga `casa-AAAAMMDD-HHMMSS.png` con lo que se ve, sin barras, etiquetas ni caja de selección. |
| 9 | Escena v5 con migración | **Hecho** | Cada objeto guarda `colocacion`; los de pared, el muro, la estancia y la `altura` del centro; los apoyados, `soporte` (posición del mueble en la lista) y `nivel`. Al cargar: primero los muebles, luego lo apoyado y luego lo colgado, en el orden del archivo. v1–v4 se migran (todo al suelo). |
| 10 | 4 objetos de ejemplo provisionales con su script | **Hecho** | `scripts/generar-catalogo.mjs`: cuadro 40 × 30 cm y espejo 60 × 90 cm (pared), jarrón de 25 cm y planta en maceta de 45 cm (superficie o suelo). Hechos con cajas y cilindros. |
| 11 | Tests y navegador | **Hecho** | Ver "Comprobaciones". |
| 12 | README y este documento | **Hecho** | |

---

### Comprobaciones de la fase 4

- **`npm test`: 157 tests, todos pasan.** Nuevos (`tests/decorar.test.ts`, 26):
  - catálogo: colocación de los ejemplos, valores por defecto y validación de los campos nuevos;
  - pared: caras de cada estancia (no en el balcón ni barandillas); no tapar la puerta del salón (ni su tapajuntas) ni el mirador; no salirse; pegado a la pared mirando a la estancia; rayo que encuentra la pared por delante; arrastrar contra la puerta; dos objetos sin solaparse (y sí uno encima de otro); altura con techo y con otro cuadro debajo; no estorban a los muebles; no se giran;
  - superficie: altura de la tapa; sin solapes; sin salirse al arrastrar fuera; mesa llena; moverse y girar con la mesa; borrar la mesa (a otra mesa y luego al suelo); estantería con tres baldas (altura libre entre baldas); del suelo a la mesa y vuelta;
  - duplicar en el suelo, en la pared y en la mesa;
  - escena v5: guardar y cargar deja todo exactamente igual (posiciones, pared, altura, soporte y orden); v4 → v5; cuadro de una escena antigua; apoyado sin mueble;
  - deshacer/rehacer: 60 pasos y deshacer 50 en orden; rehacer; un cambio nuevo borra lo rehacible; cambios seguidos juntos; añadir, mover, girar, apoyar, colgar y borrar con la escena real.
- **`npm run build`** sin errores.
- **Navegador automático, escritorio (1400 × 860, ratón), 46 comprobaciones, todas bien:**
  - buscador (con y sin tildes), aviso sin resultados, plegar una categoría;
  - añadir mesa, jarrón (queda sobre la mesa) y cuadro (en una pared del salón);
  - arrastrar el cuadro a lo largo de la pared, y hasta la puerta del salón (se queda al lado);
  - altura con el deslizador; sin controles de giro en objetos de pared;
  - `D` duplica el cuadro; espejo colgado sin solapes;
  - jarrón de la mesa al suelo y de vuelta; planta en la mesa; planta arrastrada contra el jarrón sin solaparse;
  - mover y girar la mesa con lo de encima;
  - `Ctrl+Z` / `Ctrl+Mayús+Z`; borrar la mesa (lo de encima al suelo) y deshacerlo con ↶; deshacer 15 veces hasta la casa vacía y rehacerlo todo; deshacer un cambio de suelo y uno de color;
  - botón *Duplicar*; 📷 descarga un PNG (y la selección sigue);
  - autoguardado v5 y recarga con todo en su sitio; Guardar v5; cargar v4; deshacer una carga; cargar la v5 guardada;
  - un cuadro en el muro del rellano se oculta cuando el muro se baja y se ve desde dentro;
  - sin errores en la consola.
- **Navegador automático, móvil (iPhone 13 emulado, eventos táctiles reales), 15 comprobaciones, todas bien:** buscador en el menú; añadir cuadro, mesa y jarrón; tocar para seleccionar; arrastrar el cuadro con el dedo por la pared; ▲ ▲ ▼; ⧉ duplicar; jarrón al suelo y a la mesa con el dedo; ↶ ↷; las herramientas no quedan tapadas por la barra del objeto; 📷; recarga; sin errores.
- **Batería de la fase 3b** (63 + 10 comprobaciones): todo bien salvo dos que esperaban la versión 4 de la escena (ahora es la 5).
- **Capturas** de cada función revisadas; corregido: el espejo se veía negro (sin entorno que reflejar en el móvil) y los cuadros de un muro bajado flotaban en el aire.

---

### Problemas conocidos de la fase 4

- Los 4 objetos de decoración son **provisionales** (cajas y cilindros).
- Al apoyar varias cosas en un mueble, cada una va al sitio libre más cercano
  a donde se suelta: no se busca el mejor reparto (en la mesa de 1,20 × 0,80
  caben con seguridad 3 macetas de 30 cm, aunque en teoría cabrían 8).
- Se supone que cada tapa o balda ocupa **toda la planta del mueble**.
- Las **baldas de abajo** solo se pueden elegir si el puntero apunta a esa
  altura del mueble (de frente); desde arriba se apoya en la tapa.
- Los objetos de pared no comprueban si chocan con un **mueble alto** pegado a
  esa pared (p. ej. un cuadro detrás de un armario), ni con otro cuadro en la
  pared de al lado justo en la esquina.
- El **historial** se pierde al recargar la página, y deshacer vuelve a
  colocar todos los objetos (con muchos objetos puede tardar un momento).
- La **imagen PNG** en el visor de claude.ai puede no descargarse (allí las
  descargas normales están bloqueadas); en GitHub Pages funciona.
- No probado en un móvil real ni en Safari o Firefox.

---

### Decisiones de la fase 4

- **"superficie" también puede ir al suelo**: es la forma de dar a la planta
  la opción "suelo o superficie" con los valores pedidos. Al añadirla se busca
  primero un mueble libre de la estancia; si no hay, va al suelo.
- **Cualquier mueble de suelo es un soporte** (por defecto, su tapa de
  arriba), también el armario. Los objetos de pared o superficie no son soportes.
- **Márgenes**: 7 cm alrededor de las puertas (el tapajuntas) y 3 cm
  alrededor de las ventanas.
- **Altura** con pasos de 5 cm en el móvil y de 1 cm en el panel; el
  espejo empieza a 1,45 m y el cuadro a 1,50 m.
- Al **añadir** un cuadro se prefiere una pared de la estancia elegida que se
  vea de frente desde la cámara.
- **Duplicar** coloca la copia al lado (+10 cm en la pared, +30 cm en diagonal en el suelo).
- **Deshacer** guarda 100 pasos y no incluye luces, puertas ni cortinas.
- **Botones ↶ ↷ 📷 flotando abajo a la derecha** (encima de la barra del
  objeto en el móvil), para no añadir una tercera fila a la barra superior.
- En la escena, el **soporte** se guarda como la posición del mueble en la lista de objetos.
- Al cargar una escena antigua, un cuadro guardado "en el suelo" se cuelga en la pared más cercana.

---

## Qué falta

1. Más decoración y alfombras; decidir cuándo quitar los 4 objetos
   provisionales de la fase 4.
2. Confirmar las medidas de `docs/OBJETOS.md` (muebles y elementos fijos) y, si hace falta, ajustarlas.
3. Posibles mejoras: que las lámparas den luz, reparto automático de lo apoyado, historial que sobreviva a recargar,
   vista de paseo en primera persona.

---

## Fase 3b (anterior): acabados reales, carpintería, techos y luces

Todo sacado de las fotos del anuncio (colores a ojo) y escrito en
`data/vivienda.json` (generado por `scripts/digitalizar-plano.mjs`).

| # | Requisito | Estado | Detalle |
|---|---|---|---|
| 1 | Paredes por cara, material según estancia, texturas a escala real, alicatado de altura configurable | **Hecho** | Cada estancia reviste *su* cara de cada muro (`src/vivienda/caras.ts`): un tabique tiene un acabado por lado y las fachadas por fuera se quedan con el muro. Pintura mate blanco roto (`#eeede9`; dormitorio más gris, `#e4e5e4`; baño `#f2f2f0`). Baño: alicatado 60 × 30 en varios grises y blanco veteado, con despiece irregular, hasta 1,10 m (`hasta`) y hasta el techo en la ducha (`zona`). Cocina: azulejo blanco brillante entre 0,90 y 1,45 m y granito negro tras la placa. Texturas por código (canvas), coordenadas en metros. |
| 2 | Selector de acabado de pared por estancia, presets + color libre, guardado (escena v4 con migración) | **Hecho** | Panel → *Acabados* → *Color de las paredes*: 8 colores (blanco roto, gris perla, arena, greige, verde salvia, azul niebla, terracota suave, antracita) y *Otro color*. *Color original*. Escena **v4** con `paredes` y `ajustes`; v1, v2 y v3 se migran. |
| 3 | Rodapiés y tapajuntas | **Hecho** | Rodapié blanco de 10 cm en todas las estancias salvo baño (sin rodapié) y tendedero (7 cm del color de su suelo). Se corta en las puertas. Tapajuntas de 7 cm en las puertas interiores, por las dos caras. Umbral bajo cada puerta con el suelo de una de las estancias (transición recta, sin escalón). |
| 4 | Carpintería | **Hecho** | Ventanas y balconeras de nogal con cristal transparente y manillas plateadas; mirador del salón de suelo a techo (2,45 m) con 3 paños y travesaño; balconera del dormitorio de 2 hojas; cortinas blancas hasta el suelo en ambos (botón **Cortinas**); lamas horizontales de aluminio negro en el tendedero; puerta cocina–tendedero de madera oscura con vidrio y fijos acristalados (uno partido en horizontal); puertas interiores lisas lacadas en blanco; entrada blanca lisa con mirilla; barandilla del balcón de barrotes negros de 1 m. Botón **Puertas** (todas abiertas/cerradas). Sin toldo. |
| 5 | Techos solo desde dentro, focos, falso techo | **Hecho** | Techos blancos visibles solo en la vista interior (ocultos en la general y en planta). Focos de 8 cm como discos luminosos: salón 5, cocina 2, distribuidor 2, dormitorio 4, baño 2 + aplique LED lineal sobre el espejo. Falso techo de 2,40 m en cocina y distribuidor (en `alturaTecho` de cada una, marcado como suposición); las paredes toman esa altura y se dibuja la tabica entre salón (2,50) y cocina (2,40). |
| 6 | Luces | **Hecho** | Entorno neutro (`RoomEnvironment`) para reflejos (el granito pulido brilla); sol que entra por las ventanas reales en la vista interior; focos de 3000 K como luces (una o dos por estancia, no una por foco). Botón **Luces** (general) e interruptor por estancia. Como mucho 3 luces con sombra (sol + 2 de la estancia de la cámara). Calidad ligera automática en pantallas táctiles: sin sombras de focos, una luz por estancia, sin mapa de entorno y materiales mates más baratos. |
| 7 | README y este documento | **Hecho** | README: formato de `acabado`, `revestimientos`, `rodapie`, `focos`, `apliques`, `estilo` de huecos, barandillas, campos nuevos del suelo y escena v4. |
| 8 | Tests y navegador con capturas | **Hecho** | Ver "Comprobaciones". |

Además: **botón Interior** (cámara a 1,55 m dentro de la estancia elegida,
mirando a lo largo de su diagonal más larga desde el lado de la puerta, con un
ángulo de visión más abierto que también sirve con el móvil en vertical).

### Suelos (actualizados con las fotos)

| Estancia | Suelo |
|---|---|
| Salón, distribuidor, dormitorio | Tarima de ipé oscura, marrón rojizo, listones de 8 cm de largos variados, satinada, a lo largo del lado mayor |
| Cocina | Granito negro pulido 60 × 60, juntas finas, muy brillante |
| Tendedero | Piedra gris oscura-marrón con vetas claras, mate, 60 × 60 |
| Baño | Mármol gris claro mate, 45 × 45 |
| Balcón | Pizarra gris oscura |

El selector tiene ahora 10 suelos (se añadieron granito, pizarra, mármol gris
claro, piedra oscura y tarima de ipé; se quitaron nogal, mármol blanco y gres).

### Rendimiento

Misma medida que en la fase 2.5 (Chromium sin GPU, girando la cámara 5 s,
vista general, calidad automática). Las cifras absolutas no valen para un
dispositivo real con GPU; sí la comparación:

| Dispositivo emulado | Fase 3a | Fase 3b, primera versión | Fase 3b final |
|---|---:|---:|---:|
| iPhone 13 (ligera) | 46,7 fps | 12,0 fps | **35,6 fps** |
| Escritorio 1400 × 860 (normal) | 22,5 fps | 5,1 fps | **10,4 fps** |

Para recuperar fps: los focos solo dan luz en la vista interior y solo los de
la estancia de la cámara (y las abiertas a ella); en el móvil, sin mapa de
entorno y con materiales Lambert en lo mate. En el ordenador se mantiene la
calidad completa porque una GPU de verdad lo mueve sin problema, pero en este
emulador sin GPU baja a la mitad.

---

<details><summary>Comprobaciones, problemas y decisiones de la fase 3b</summary>

### Comprobaciones

- **`npm test`: 131 tests, todos pasan.** Nuevos en la fase 3b (`tests/acabados.test.ts` y ajustes en los demás):
  - formato de los acabados y su validación; migración de escenas v1, v2 y v3 → v4 y escena v4 con ajustes parciales;
  - **cada pared tiene material en sus dos caras**, y la cara que da a una estancia lleva su pintura o su revestimiento (no el muro desnudo); un tabique entre baño y distribuidor tiene un acabado distinto por cada lado;
  - el alicatado del baño llega exactamente a 1,10 m y al techo en la ducha;
  - **la altura del techo de cada estancia coincide con `vivienda.json`** (2,40 m en cocina y distribuidor) y ninguna pared queda más baja que el techo de las estancias que toca;
  - número de focos por estancia, puertas abatibles (cerradas al empezar), cortinas, lamas, puerta vidriera y mirador;
  - rodapiés (ninguno en el baño, 7 cm en el tendedero);
  - luces: como mucho 3 con sombra (1 en el móvil), interruptores general y por estancia, guardar y restaurar, focos solo en la estancia de la cámara;
  - calidad ligera (materiales Lambert, el color de pared sigue funcionando);
  - punto de vista de la vista interior en cada estancia;
  - los tests de las fases anteriores, adaptados (paredes medidas por su núcleo macizo, suelos por defecto nuevos).
- **`npm run build`** sin errores.
- **Navegador automático, escritorio (1400 × 860), 63 comprobaciones, todas bien:**
  - suelos y pinturas por defecto; techos ocultos en la vista general; puertas cerradas y cortinas visibles al empezar;
  - botones **Puertas** (todas abren), **Cortinas** (se ocultan), **Luces** (todas se apagan y el interruptor de la estancia se desactiva);
  - el panel de acabados sigue a la estancia elegida; el color de pared se oculta en el balcón y el interruptor de luz en las estancias sin focos;
  - color preset en el dormitorio, color libre en el salón (sin tocar la cocina), *Color original*;
  - **Interior**: techos visibles dentro y ocultos al salir; interior de las 7 estancias sin errores y con ≤ 3 sombras;
  - apagar la luz del baño sin apagar el salón; cambiar un suelo; añadir una mesa;
  - recarga: colores, suelo, luces, puertas, cortinas y mesa se restauran (autoguardado v4);
  - Guardar descarga un JSON v4;
  - cargar escenas v3 (suelos aplicados, paredes y ajustes por defecto), v2, v1 y v4 (con un color no válido que se ignora con aviso);
  - plano superpuesto; sin errores en la consola.
- **Navegador automático, móvil (iPhone 13 emulado, toques reales), 10 comprobaciones, todas bien:** calidad ligera, la barra cabe en la pantalla, Puertas, pintar el dormitorio desde el menú, vista interior de salón, dormitorio y baño (solo el sol da sombra), recarga, sin errores.
- **Capturas** de las 7 estancias por fuera y por dentro, en escritorio y móvil, comparadas con las fotos. Corregí:
  - la tarima salía naranja: ahora es marrón rojizo oscuro (ipé) con menos contraste entre listones;
  - la vista interior de las estancias pequeñas (baño, tendedero) miraba a una pared a 30 cm: ahora mira a lo largo de la diagonal más larga desde la puerta;
  - en el móvil en vertical la vista interior era un pasillo estrecho: ahora el ángulo de visión se calcula para ver unos 80° en horizontal;
  - el interruptor de luz aparecía en estancias sin focos (balcón);
  - en el móvil, sin mapa de entorno, los techos se veían marrones: corregido el color de la luz ambiental.

---

### Problemas conocidos y limitaciones

- **Colores aproximados a ojo** de las fotos; las texturas son procedurales
  (no fotorrealistas: sin relieve ni reflejos reales del entorno, solo uno neutro).
- **En el móvil** el granito pulido no refleja el entorno (sin mapa de entorno
  para que vaya fluido); solo brilla con el sol y los focos.
- **Rendimiento:** medido sin GPU. En el ordenador baja a la mitad respecto a
  la fase 3a en este emulador; no he podido medirlo en un móvil ni en un
  ordenador reales, ni probar en Safari o Firefox.
- **Focos:** solo iluminan dentro (vista Interior) y la estancia en la que está
  la cámara; las de al lado no reciben luz de ellos aunque la puerta esté abierta.
- La **vista interior** no tiene modo "caminar": se gira alrededor de un punto
  de la estancia; para cambiar de estancia hay que elegirla arriba.
- El **frente de la cocina** está pintado en la pared sin muebles (la cocina es de la fase 3c).
- **Alturas supuestas:** falso techo de 2,40 m, puertas de 2,05–2,10 m, mirador
  de 2,45 m, alicatado de 1,10 m (todo editable en `vivienda.json`).
- La **posición de los focos** es a ojo (el número sí sale de las fotos).
- Lo de antes: el corte de paredes es una heurística; "Guardar" dentro de
  claude.ai solo probado con un visor simulado.

---

### Decisiones que tomé por mi cuenta

- **Formato de acabados** (`acabado` con `pared`, `rodapie` y
  `revestimientos` por zonas y alturas; `focos`; `apliques`; `estilo`,
  `hojas`, `travesano`, `bisagra`, `abre` y `cortina` en los huecos; `tipo:
  "barandilla"` en paredes). Ver README.
- **Revestimientos por zona rectangular en planta** (y no por id de pared):
  así un alicatado puede ocupar solo la ducha aunque la pared siga.
- **Color de pared por estancia**, no por pared suelta: es lo que pediste y
  mantiene la interfaz simple.
- **Escena v4** con `paredes` y `ajustes` (luces, puertas, cortinas); solo lo cambiado.
- **Focos agrupados** en 1–2 luces por estancia y solo activos dentro, para no
  hundir los fps; los discos se ven encendidos siempre que el interruptor lo esté.
- **Calidad ligera** sin mapa de entorno y con materiales Lambert en lo mate.
- **Tarima de ipé** `#56301e`, listón de 8 cm; granito `#121214` pulido; los
  demás colores, en el README.
- **Mirador** como un único hueco de 3 paños con travesaño a 1,05 m; sus laterales, macizos.
- **Vista interior** desde el extremo de la diagonal más larga más cercano a la puerta, a 1,55 m.
- **Colores de pared predefinidos**: blanco roto, gris perla, arena, greige,
  verde salvia, azul niebla, terracota suave y antracita.

---

### Qué falta: fase 3c y siguientes

1. **Cocina completa** (muebles, encimera, electrodomésticos), **sanitarios**,
   plato de ducha y mampara, **armario empotrado** (fase 3c).
2. Muebles sueltos y un catálogo más amplio.
3. Mejoras posibles de la fase 3b:
   - modo "caminar" en la vista interior;
   - focos que iluminen también las estancias vecinas con la puerta abierta;
   - texturas a partir de fotos reales si se quiere más realismo;
   - medir en un móvil real y ajustar la calidad ligera.

</details>

---

## Fases anteriores (2.5 y 3a)

<details><summary>Detalle</summary>

### Fase 2.5: pendientes de la fase 2

| # | Pendiente | Estado | Detalle |
|---|---|---|---|
| 1 | Despliegue automático con GitHub Pages | **Hecho (Pages ya está activado)** | El repositorio ya es público. El workflow `desplegar.yml` publica en Pages en cada merge a `main` y ahora intenta activar Pages por la API, pero el token de GitHub Actions no tiene permiso (probado: se salta). Hay que activar *Settings → Pages → Source = GitHub Actions* una vez. Después, una ejecución programada cada hora publica la web si aún no existe, sin esperar a otro merge. |
| 2 | Choques entre muebles | **Hecho** | Ningún mueble puede solaparse con otro al arrastrarlo (se queda pegado), girarlo (se aparta lo justo o no gira) ni añadirlo. Al añadir, va al sitio libre más cercano al centro de la estancia elegida en la barra superior (o del salón), buscando en toda la casa. Si no cabe en ninguna parte, se avisa arriba del panel. Al cargar escenas con muebles superpuestos, se separan; los que no caben se omiten con aviso. |
| 3 | Altura de techo de cada estancia → altura de sus paredes | **Hecho** | Cada pared mide la mayor altura de techo de las estancias que toca (las detecta por geometría: lados de estancia pegados a sus caras). Las paredes con `alto` propio (barandilla) lo conservan; los pilares toman la mayor de las estancias que rodean. La validación de huecos usa esta altura. Con test. |
| 4 | Mejor corte automático de paredes | **Hecho** | Nueva regla de la "sombra": se calcula qué franja de suelo tapa cada pared vista desde la cámara y se baja si tapa suelo de la vivienda (en la vista de una estancia, si tapa el suelo de esa estancia o queda entre la cámara y ella). Ahora se bajan los laterales del armario empotrado y, al mirar el balcón, la barandilla de delante. Con tests. |
| 5 | Rendimiento en el móvil | **Hecho** | Medido (ver abajo). En pantallas táctiles o pequeñas: sombras de 1024 px (antes 4096) y como mucho 1,5 píxeles por punto. En el ordenador: sombras de 2048 px. Se puede forzar con `?calidad=ligera|normal|alta`. |
| 6 | Documentación | **Hecho** | Este archivo, README actualizado y nota en `RESUMEN_FASE2.md`. |

#### Medida de fps

Chromium sin tarjeta gráfica (render por CPU con SwiftShader), girando la
cámara sin parar durante 5 s con la vivienda completa. Las cifras absolutas no
valen para un móvil real, que tiene GPU, pero sí la comparación entre calidades:

| Dispositivo emulado | Calidad | Sombras | Píxeles/punto | fps |
|---|---|---:|---:|---:|
| iPhone 13 (390 × 664) | alta (como en la fase 2) | 4096 | 2 | 15,0 |
| iPhone 13 | normal | 2048 | 2 | 22,8 |
| iPhone 13 | **ligera (automática)** | 1024 | 1,5 | **37,5** |
| Escritorio 1400 × 860 | alta | 4096 | 1 | 13,5 |
| Escritorio 1400 × 860 | **normal (automática)** | 2048 | 1 | **19,1** |

El mapa de sombras de 4096 px era el principal coste: en el móvil emulado, la
calidad automática da 2,5 veces más fps que la de la fase 2.

---

### Fase 3a: suelos

| # | Requisito | Estado | Detalle |
|---|---|---|---|
| 1 | Campo opcional `suelo` por estancia (tipo + color + escala en metros por repetición), documentado | **Hecho** | `"suelo": { "tipo": "tarima", "color": "#5c3b26", "escala": 2.4 }`. Tipos: `tarima`, `baldosa`, `marmol`, `microcemento`, `terrazo`, `exterior`. Validado al cargar. Documentado en el README. **No admite imagen de textura** (solo color + tipo), ver decisiones. |
| 2 | Valores por defecto | **Hecho** | Tarima de nogal oscuro en salón, dormitorio y distribuidor; mármol blanco en baño, cocina y tendedero; gres de exterior en el balcón. Están escritos en `vivienda.json` y hay un respaldo en código para estancias sin `suelo`. |
| 3 | Texturas con escala real y coordenadas UV en planta | **Hecho** | Texturas procedurales dibujadas con `<canvas>` (512 × 512 px, repetibles sin costuras, 0 KB en el repositorio). Las coordenadas de textura del suelo son la posición en planta en metros, así que no se deforman en polígonos irregulares; la textura se repite 1/escala veces por metro. Con test. |
| 4 | Selector de suelo con vista previa, guardado en la escena (v3, migración desde v2) | **Hecho** | Panel → *Suelo* (en el móvil, menú ☰): desplegable de estancia (sigue a la barra superior) y 8 suelos con vista previa de 1,2 × 1,2 m reales: 3 tarimas, mármol, porcelánico, microcemento, terrazo y gres de exterior. Botón *Volver al original*. Escena v3 con `suelos` (solo los cambiados); v1 y v2 se migran; autoguardado y recarga restauran los suelos. |
| 5 | Tests y pruebas en navegador con capturas de cada estancia | **Hecho** | Ver "Comprobaciones". |

---

</details>

---

