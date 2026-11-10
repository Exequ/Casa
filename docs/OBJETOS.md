# Objetos del catálogo

Muebles reales del piso, generados por scripts a partir de las fotos:
`scripts/catalogo-lote1.mjs` (salón y pasillo) y `scripts/catalogo-lote2.mjs`
(dormitorio, balcón y tendedero). Los objetos de ejemplo de las fases 1 y 4
(mesa, armario, cuadro, espejo, jarrón y planta provisionales) siguen en
`catalogo/`.

## Cómo corregir una medida

1. Abre el `.json` del objeto (por ejemplo `catalogo/sofas/sofa-3-plazas.json`).
2. Cambia `dimensiones` (en metros: `ancho` = de lado a lado, `fondo` = de
   delante atrás, `alto`). Si es un mueble con `superficies`, cambia también
   las alturas de sus tapas o baldas; si es de pared, `alturaCentro`.
3. Pon `"medidas": "confirmadas"` para marcarla como medida de verdad.

No hace falta tocar nada más: la app estira el modelo a las medidas de la
ficha. Si se vuelve a ejecutar `npm run catalogo:lote1` (o `lote2`), las
medidas de los `.json` existentes se respetan (salvo con `-- --reiniciar`)
y estas tablas se regeneran con ellas.

<!-- secciones -->

<!-- inicio:lote1 -->
## Lote 1: salón y pasillo

Hecho primero sin fotos (con las medidas y descripciones del encargo) y
ajustado después a las fotos del salón. Todas las medidas son **estimadas**:
las exteriores son las del encargo salvo las marcadas como **corregidas**;
las interiores (asientos, baldas, tapas) y los detalles de forma salen de las
fotos, con la puerta interior (2,05 m) y la tarima (listones de 7–9 cm) como
referencia. Maderas con veta y tapicerías con tejido (texturas procedurales).

| Objeto | Medidas (ancho × fondo × alto, m) | Colocación | De dónde salen las medidas | Comparado con las fotos | Estado | Triángulos |
|---|---|---|---|---|---|---:|
| Sofá 3 plazas crema (`sofas/sofa-3-plazas`) | 2,05 × 0,92 × 0,85 | colocación: suelo; no admite nada encima | Exteriores: las del encargo. Mías: patas de 7 cm, asiento a 0,49 m, brazos a 0,68 m y respaldo a 0,80 m. | Brazos enrollados hacia fuera más bajos que el respaldo, con vivo; respaldo fijo; 3 cojines de asiento gruesos; crema más amarillento; cojines azul pizarra (detrás) y blanco a la izquierda, azul y crema pequeño a la derecha. | estimada | 7548 |
| Sillón gris (`sofas/sillon`) | 0,8 × 0,85 × 0,8 | colocación: suelo; no admite nada encima | Exteriores: las del encargo. Mías: patas de 7 cm, asiento a 0,46 m, brazos a 0,60 m. | Mucho más oscuro (gris pardo); brazos rectos; cojín gris pardo. | estimada | 3576 |
| Mesa de centro de madera y cristal (`mesas/mesa-centro`) | 1 × 0,7 × 0,45 | colocación: suelo; superficies: 0,45 m | Exteriores: las del encargo. Mías: marco de la tapa de 8,5 cm, patas de 5,5 cm. | Teca/caoba media con veta; cristal ahumado; celosía de rombos continua en los 4 lados entre el faldón y un travesaño a 0,13 m (abierta por debajo); patas algo más finas abajo. | estimada | 588 |
| Librería alta de madera oscura (`almacenaje/libreria`) | 0,9 × 0,4 × 2 | colocación: suelo; superficies: 0,37 / 0,66 / 0,98 / 1,36 / 2 m | Exteriores: las del encargo. Baldas medidas en la foto respecto al alto total: 0,37 / 0,66 / 0,98 / 1,36 m y la tapa a 2,00 m. | Cuatro baldas (no cinco), cornisa escalonada que vuela por delante y los lados, zócalo con moldura, cajón con panel en relieve y pomo de madera; madera más rojiza. | estimada | 1584 |
| Mueble de TV de listones (`almacenaje/mueble-tv`) | 0,9 × 0,38 × 0,55 | colocación: suelo; superficies: 0,275 / 0,55 m | Exteriores: las del encargo. Estante de listones a 0,275 m medido en la foto. | Un solo estante de listones a media altura (no dos) y patas libres por debajo; faldón bajo la tapa; madera teca más oscura. | estimada | 264 |
| Televisión 32" (`electronica/television`) | 0,73 × 0,2 × 0,48 | colocación: superficie | Las del encargo (pantalla de 32" 16:9 con peana). | Marco gris oscuro algo metálico y más grueso (LCD antiguo), peana negra brillante. | estimada | 936 |
| Mesa de comedor de cristal (`mesas/mesa-comedor-cristal`) | 1,2 × 0,7 × 0,75 | colocación: suelo; superficies: 0,75 m | Exteriores: las del encargo. Mías: cristal de 12 mm. | Sin bastidor bajo el cristal: patas redondas finas sujetas con pletinas en las esquinas, más abiertas. | estimada | 252 |
| Silla de comedor blanca (`sillas/silla-comedor`) | 0,48 × 0,55 × 0,82 | colocación: suelo; no admite nada encima | Exteriores: las del encargo. Mías: asiento a 0,48 m. | Carcasa envolvente tapizada en blanco roto (el respaldo rodea los costados) con el borde redondeado; patas finas abiertas. | estimada | 1756 |
| Lámpara de pie semiesfera negra (`iluminacion/lampara-pie-semiesfera`) | 0,3 × 0,3 × 1,45 | colocación: suelo; no admite nada encima | Las del encargo. | Negro brillante (pantalla y base), vástago más fino. | estimada | 1992 |
| Lámpara foco de trípode (`iluminacion/lampara-tripode`) | 0,24 × 0,28 × 0,55 | colocación: superficie | **Corregida con las fotos**: no es de pie (1,30 m) sino una lámpara tipo foco que está encima de la mesita de alambre y mide casi lo mismo que ella de alto (0,55 m); 0,24 × 0,28 m en planta. Ahora es de superficie. | Foco cilíndrico negro inclinado hacia arriba, sobre una horquilla de latón con pomos, y trípode de patas finas. | estimada | 1688 |
| Mesita auxiliar de alambre (`mesas/mesita-alambre`) | 0,45 × 0,45 × 0,55 | colocación: suelo; superficies: 0,55 m | **Corregida con las fotos**: la bandeja es más ancha que la estimada (0,45 m en vez de 0,35; en la foto es casi tan ancha como alta). | Varillas rectas cruzadas que forman un reloj de arena, con aros arriba, en la cintura y abajo; bandeja de arriba con borde. | estimada | 3552 |
| Mesita auxiliar de bandeja negra (`mesas/mesita-bandeja`) | 0,45 × 0,45 × 0,45 | colocación: suelo; superficies: 0,43 m | Exteriores: las del encargo. Mía: superficie útil de la bandeja a 0,43 m. | Patas casi rectas unidas abajo por un aspa (no patas cruzadas en X). | estimada | 696 |
| Espejo con marco negro (`pared/espejo-marco-negro`) | 0,95 × 0,04 × 0,65 | colocación: pared; centro a 1,3 m | Las del encargo. | Marco de madera muy oscura (wengué) más ancho (11 cm), con un pequeño rebaje junto a la luna. | estimada | 2424 |
| Cuadro pequeño de marco blanco (`pared/cuadro-marco-blanco`) | 0,25 × 0,02 × 0,25 | colocación: pared; centro a 1,5 m | Las del encargo. Mía: centro a 1,50 m. | En la foto hay tres iguales en fila sobre la mesa de comedor; lámina pequeña azul grisácea con paspartú blanco. | estimada | 1248 |
| Perchero de pared de 3 ganchos (`pared/perchero-pared`) | 0,45 × 0,1 × 0,12 | colocación: pared; centro a 1,65 m | Las del encargo (centro a 1,65 m). | No sale en las fotos: sin cambios. | estimada | 1020 |
| Espejo pequeño plateado (`pared/espejo-marco-plateado`) | 0,35 × 0,02 × 0,75 | colocación: pared; centro a 1,45 m | Las del encargo. Mía: centro a 1,45 m. | No sale en las fotos: sin cambios. | estimada | 1224 |
<!-- fin:lote1 -->

<!-- inicio:lote2 -->
## Lote 2: dormitorio, balcón y tendedero

Hecho a partir de las fotos del dormitorio y de la terraza. Todas las
medidas son **estimadas**: las exteriores son las del encargo; las interiores
y los detalles salen de las fotos con la balconera (2,10 m), la puerta (2,05 m)
y la tarima como referencia.

| Objeto | Medidas (ancho × fondo × alto, m) | Colocación | De dónde salen las medidas | Comparado con las fotos | Estado | Triángulos |
|---|---|---|---|---|---|---:|
| Cama con cabecero de cerezo y canapé (`dormitorio/cama`) | 1,58 × 2,08 × 0,95 | colocación: suelo; no admite nada encima | Las del encargo; colchón de 1,50 × 2,00 × 0,24 sobre canapé de 0,36 m. Cabecero: postes de 6 cm con bola, a 0,95 m (más alto que la mesita de 0,50 m, como en la foto). | Postes torneados con remate redondo, panel liso de cerezo, canapé y colchón blancos con ribete gris. | estimada | 2320 |
| Mesita de noche de cerezo (`dormitorio/mesita-noche`) | 0,45 × 0,38 × 0,5 | colocación: suelo; superficies: 0,11 / 0,5 m | Las del encargo; balda baja a 0,11 m. | Tapa de cerezo claro al sol, cajón de frente liso; en la foto la lámpara ocupa casi media tapa. | estimada | 588 |
| Lámpara de sobremesa blanca (`iluminacion/lampara-sobremesa`) | 0,28 × 0,28 × 0,45 | colocación: superficie | Las del encargo (pantalla de 28 cm abajo y 20 arriba). | Pantalla cónica blanca de tela, pie fino plateado y base redonda plana (hay otra igual sobre la cómoda). | estimada | 1296 |
| Cómoda alta de 6 cajones (`dormitorio/comoda-alta`) | 0,6 × 0,42 × 1,15 | colocación: suelo; superficies: 1,15 m | Las del encargo. En la foto llega casi al alféizar de los cuadros (1,15 m) y es más estrecha que la balconera. | Seis cajones de frente liso sin tiradores visibles separados por juntas finas, zócalo bajo; cerezo algo más rojizo en los frentes. | estimada | 144 |
| Cuadro de marco gris (`pared/cuadro-marco-gris`) | 0,3 × 0,02 × 0,4 | colocación: pared; centro a 1,55 m | Las del encargo. Mía: centro a 1,55 m (en la foto, junto a la cama, algo por encima del cabecero). | Marco gris fino con paspartú y lámina clara. | estimada | 1248 |
| Marco pequeño de madera (`pared/marco-madera`) | 0,18 × 0,02 × 0,24 | colocación: pared; centro a 1,5 m | Las del encargo. En la foto hay cuatro sobre la cómoda en dos filas; mía: centro a 1,50 m. | Marco fino de madera media, paspartú blanco y lámina verde. | estimada | 1236 |
| Mesa redonda plegable de balcón (`exterior/mesa-balcon`) | 0,6 × 0,6 × 0,72 | colocación: suelo; superficies: 0,72 m | Las del encargo (diámetro 0,60, alto 0,72). | Metal blanco, tapa con el borde doblado y patas en tijera que se cruzan. | estimada | 1408 |
| Silla plegable de balcón (`exterior/silla-balcon`) | 0,4 × 0,45 × 0,85 | colocación: suelo; no admite nada encima | Exteriores: las del encargo. Mías: asiento a 0,44 m con 6 listones, respaldo de 2 listones anchos. | Metal blanco; patas traseras que siguen hasta el respaldo y delanteras cruzadas por debajo del asiento. | estimada | 1088 |
| Planta pequeña en maceta blanca (`decoracion/planta-pequena`) | 0,2 × 0,2 × 0,3 | colocación: superficie | Las del encargo (maceta de 13 cm de alto). | Mata redonda de hojas pequeñas verde claro en maceta cilíndrica blanca (en la mesa del balcón y en las mesitas del salón). | estimada | 3032 |
| Lavadora de carga frontal (`tendedero/lavadora`) | 0,6 × 0,55 × 0,85 | colocación: suelo; superficies: 0,85 m | Las del encargo (medidas estándar). No sale en las fotos. | No sale en las fotos: modelo genérico blanco con puerta redonda y panel de mandos. | estimada | 1240 |
<!-- fin:lote2 -->
