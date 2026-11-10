# Estado del proyecto

Última actualización: 10 de noviembre de 2026, tras la fase 5, lote 1
(muebles reales del salón y del pasillo). El detalle de la fase 2 (medidas del plano, suposiciones,
comprobaciones) sigue en [RESUMEN_FASE2.md](RESUMEN_FASE2.md).

**App:** <https://exequ.github.io/Casa/> (se publica sola en cada cambio de `main`).

---

## Fase 5, lote 1: muebles reales del salón y del pasillo

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

1. **Fase 5, lote 2:** dormitorio, balcón, tendedero, plantas y decoración
   (entonces se quitarán los 4 objetos provisionales de la fase 4).
2. **Fase 3c:** cocina completa, sanitarios, plato de ducha y mampara y
   armario empotrado (fijos).
3. Confirmar las medidas de `docs/OBJETOS.md` y, si hace falta, ajustar los `.json`.
4. Posibles mejoras: texturas de madera y tejido, que las lámparas den luz,
   reparto automático de lo apoyado, historial que sobreviva a recargar,
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

