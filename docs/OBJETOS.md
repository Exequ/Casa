# Objetos del catálogo

Muebles reales del piso, generados por `scripts/catalogo-lote1.mjs` (lote 1:
salón y pasillo). Los objetos de ejemplo de las fases 1 y 4 (mesa, armario,
cuadro, espejo, jarrón y planta provisionales) siguen en `catalogo/` hasta el lote 2.

## Cómo corregir una medida

1. Abre el `.json` del objeto (por ejemplo `catalogo/sofas/sofa-3-plazas.json`).
2. Cambia `dimensiones` (en metros: `ancho` = de lado a lado, `fondo` = de
   delante atrás, `alto`). Si es un mueble con `superficies`, cambia también
   las alturas de sus tapas o baldas; si es de pared, `alturaCentro`.
3. Pon `"medidas": "confirmadas"` para marcarla como medida de verdad.

No hace falta tocar nada más: la app estira el modelo a las medidas de la
ficha. Si se vuelve a ejecutar `npm run catalogo:lote1`, las medidas de los
`.json` existentes se respetan (salvo con `-- --reiniciar`) y esta tabla se
regenera con ellas.

## Lote 1: salón y pasillo

Todas las medidas son **estimadas**. Las exteriores (ancho × fondo × alto)
son las del encargo, sacadas de las fotos con estas referencias: puerta
interior de 2,05 m de alto y listones de tarima de 7–9 cm. Las alturas
interiores (asientos, baldas, tapas) y los detalles de forma los puse yo a
partir de la descripción de cada mueble; están anotados en la tabla.

| Objeto | Medidas (ancho × fondo × alto, m) | Colocación | De dónde salen | Estado | Triángulos |
|---|---|---|---|---|---:|
| Sofá 3 plazas crema (`sofas/sofa-3-plazas`) | 2,05 × 0,92 × 0,85 | colocación: suelo; sin superficies (no se apoya nada encima) | Exteriores: las del encargo. Mías: patas de 10 cm, asiento a 0,49 m, rollo del brazo hasta 0,70 m, cojines sueltos de 40 cm. | estimada | 6948 |
| Sillón gris (`sofas/sillon`) | 0,8 × 0,85 × 0,8 | colocación: suelo; sin superficies (no se apoya nada encima) | Exteriores: las del encargo. Mías: patas de 8 cm, asiento a 0,46 m, brazos hasta 0,63 m. | estimada | 3752 |
| Mesa de centro de madera y cristal (`mesas/mesa-centro`) | 1 × 0,7 × 0,45 | colocación: suelo; superficies: 0,45 m | Exteriores: las del encargo. Mías: marco de la tapa de 7 cm, patas de 5 cm, celosía en X en los dos lados cortos. | estimada | 204 |
| Librería alta de madera oscura (`almacenaje/libreria`) | 0,9 × 0,4 × 2 | colocación: suelo; superficies: 0,33 / 0,65 / 0,97 / 1,29 / 1,61 / 2 m | Exteriores: las del encargo. Mías: cajón de 20 cm sobre un zócalo de 8 cm y baldas cada 32 cm (0,33 / 0,65 / 0,97 / 1,29 / 1,61 m) más la tapa a 2,00 m. | estimada | 304 |
| Mueble de TV de listones (`almacenaje/mueble-tv`) | 0,9 × 0,38 × 0,55 | colocación: suelo; superficies: 0,135 / 0,335 / 0,55 m | Exteriores: las del encargo. Mías: dos estantes de 5 listones con su superficie a 0,135 y 0,335 m, más la tapa a 0,55 m. | estimada | 276 |
| Televisión 32" (`electronica/television`) | 0,73 × 0,2 × 0,48 | colocación: superficie | Las del encargo (pantalla de 32" 16:9 con peana). | estimada | 924 |
| Mesa de comedor de cristal (`mesas/mesa-comedor-cristal`) | 1,2 × 0,7 × 0,75 | colocación: suelo; superficies: 0,75 m | Exteriores: las del encargo. Mías: cristal de 12 mm y patas que se abren unos 5 cm hacia fuera. | estimada | 108 |
| Silla de comedor blanca (`sillas/silla-comedor`) | 0,48 × 0,55 × 0,82 | colocación: suelo; sin superficies (no se apoya nada encima) | Exteriores: las del encargo. Mías: asiento a 0,48 m y respaldo curvo de 30 cm de alto. | estimada | 1024 |
| Lámpara de pie semiesfera negra (`iluminacion/lampara-pie-semiesfera`) | 0,3 × 0,3 × 1,45 | colocación: suelo; sin superficies (no se apoya nada encima) | Las del encargo. Mías: base de 30 cm de diámetro (como la pantalla). | estimada | 2000 |
| Lámpara de trípode negra (`iluminacion/lampara-tripode`) | 0,449 × 0,442 × 1,3 | colocación: suelo; sin superficies (no se apoya nada encima) | Ancho y alto: los del encargo. El fondo (0,442) sale de la forma: con tres patas abiertas a 0,45 m, la planta no es cuadrada. | estimada | 1864 |
| Mesita auxiliar de alambre (`mesas/mesita-alambre`) | 0,35 × 0,35 × 0,55 | colocación: suelo; superficies: 0,55 m | Las del encargo. Mías: forma de reloj de arena con 12 varillas. | estimada | 3040 |
| Mesita auxiliar de bandeja negra (`mesas/mesita-bandeja`) | 0,45 × 0,45 × 0,45 | colocación: suelo; superficies: 0,43 m | Exteriores: las del encargo. Mía: superficie útil de la bandeja a 0,43 m (el borde llega a 0,45). | estimada | 728 |
| Espejo con marco negro (`pared/espejo-marco-negro`) | 0,95 × 0,04 × 0,65 | colocación: pared; centro a 1,3 m | Las del encargo (marco de 9 cm, centro a 1,30 m). | estimada | 1224 |
| Cuadro pequeño de marco blanco (`pared/cuadro-marco-blanco`) | 0,25 × 0,02 × 0,25 | colocación: pared; centro a 1,5 m | Las del encargo. Mía: altura del centro a 1,50 m (la que usa la app por defecto). | estimada | 1316 |
| Perchero de pared de 3 ganchos (`pared/perchero-pared`) | 0,45 × 0,1 × 0,12 | colocación: pared; centro a 1,65 m | Las del encargo (centro a 1,65 m). | estimada | 1020 |
| Espejo pequeño plateado (`pared/espejo-marco-plateado`) | 0,35 × 0,02 × 0,75 | colocación: pared; centro a 1,45 m | Las del encargo. Mía: centro a 1,45 m. | estimada | 1224 |
