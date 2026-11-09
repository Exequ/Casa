# Resumen de la fase 2: estado real

Fecha: 9 de noviembre de 2026. Estado de `main` tras los PR #2, #3 y #4.

Objetivo de la fase 2: pasar de una habitación de ejemplo a la vivienda real
(2ºA) a partir del plano de `planos/`.

---

## 1. Requisitos de la fase 2, uno por uno

| # | Requisito | Estado | Detalle |
|---|---|---|---|
| 1 | Leer los planos y extraer estancias, paredes (con grosor), puertas y ventanas (posición, ancho, alto y alféizar) | **Hecho, con suposiciones** | Las 6 estancias, el balcón, 25 paredes con grosor, 10 huecos y 11 pilares se midieron sobre la imagen. El plano **no tiene cotas de las estancias**: la escala sale de las superficies útiles. Las posiciones y anchos de puertas y ventanas están medidos. Sus **altos y alféizares son supuestos**, porque el plano en planta no los indica. Todas las suposiciones están en la sección 4. |
| 2 | Formato `data/vivienda.json` (estancias con polígono, paredes por segmentos con grosor, huecos por pared), documentado en el README | **Hecho** | Formato en la sección 3 y en el README. La app lo valida al arrancar y muestra los errores en pantalla. |
| 3 | Render: paredes con huecos reales, suelo por estancia con nombre y altura de techo, paredes que tapan la vista ocultas solas | **Parcial** | Las paredes tienen huecos reales (antepechos, dinteles y cristal en las ventanas). Cada estancia tiene suelo y una etiqueta con nombre, m² y altura de techo. Las paredes que tapan la vista se bajan a 25 cm automáticamente. **Limitación:** la altura de techo de cada estancia solo se muestra en la etiqueta. Las paredes usan la altura general de la vivienda (2,50 m) o la suya propia, no la de la estancia. Hoy da igual porque todas miden 2,50 m, pero no está conectado. No hay techos dibujados (vista de casa de muñecas). |
| 4 | Los objetos respetan paredes de cualquier forma y no atraviesan puertas ni ventanas por error | **Hecho** | Los objetos chocan con polígonos de cualquier forma, pilares incluidos. No pueden quedarse en el hueco de una puerta o ventana. Al arrastrarlos avanzan de forma continua, nunca saltan un muro y pasan por una puerta solo si caben. **No hay choques entre objetos**: dos muebles pueden solaparse. |
| 5 | Selector de estancia para centrar la cámara, y vista de toda la vivienda | **Hecho** | Desplegable en la barra superior ("Toda la vivienda" + cada estancia) y botón **Planta** para la vista cenital. |
| 6 | Modo de comprobación con el plano original superpuesto, semitransparente y a escala | **Hecho** | Botón **Plano**: la imagen se superpone sobre el suelo, la opacidad se ajusta y los muros quedan a ras de suelo en rojo (pilares en morado). Lo usé para validar; los resultados están en la sección 5. |
| 7 | La escena guardada sigue funcionando y las escenas de la fase 1 cargan | **Hecho** | Formato v2. Las escenas v1 (y las que no indican versión) se migran solas: se colocan respecto al centro del salón y, si algo no cabe, se mueve al sitio libre más cercano. Lo mismo con el autoguardado. |
| 8 | Tests automáticos de que las áreas y medidas de cada estancia en la escena coinciden con `vivienda.json` | **Hecho** | 76 tests con Vitest. El detalle está en la sección 5. |

Extras que no se pedían, todos hechos:
- Interfaz para el móvil: cajón lateral, barra del objeto seleccionado y gestos táctiles.
- CI en GitHub Actions.
- Versión de un solo archivo publicada en claude.ai.
- "Vaciar" con doble toque.
- Errores de carga mostrados en el panel.

---

## 2. Estructura del proyecto

```
data/vivienda.json          La vivienda: estancias, paredes, huecos, pilares, plano y suposiciones
planos/plano-original.png   Captura original del plano (idealista), 2622 × 1206 px
planos/plano.jpg            Recorte del plano que se superpone en la app (1880 × 1000 px)
catalogo/*.json + *.glb     Catálogo de objetos (ahora: mesa y armario)
scripts/
  digitalizar-plano.mjs     Medidas en píxeles del plano → data/vivienda.json (calcula la escala)
  generar-catalogo.mjs      Genera la mesa y el armario de ejemplo (.json + .glb)
tests/
  vivienda.test.ts          Áreas y medidas de suelos y paredes frente a vivienda.json y al plano
  espacio.test.ts           Choques de muebles con paredes, pilares, puertas y ventanas
  persistencia.test.ts      Migración de escenas de la fase 1 y lectura del catálogo
src/main.ts                 Punto de entrada: une todas las piezas
src/vivienda/               Datos y geometría en planta, sin 3D (lo que se prueba en los tests)
  modelo.ts                 Tipos de vivienda.json y validación
  geometria.ts              Áreas, puntos en polígonos, cruces de segmentos, huella de un mueble
  espacio.ts                Dónde cabe un mueble, cómo se arrastra y cómo pasa por las puertas
src/escena/                 Todo lo 3D (Three.js)
  escena.ts                 Renderizador, cámara orbital, luces, sombras y encuadres animados
  vivienda3d.ts             Suelos, paredes con huecos, cristales y pilares
  corte.ts                  Bajar las paredes que tapan la vista
  etiquetas.ts              Etiquetas HTML de cada estancia
  plano.ts                  Capa del plano superpuesto
  objetos.ts                Muebles colocados: añadir, mover, girar, borrar, seleccionar
  interaccion.ts            Ratón, dedo y teclado
  persistencia.ts           Guardar/cargar JSON, autoguardado y migración v1 → v2
src/catalogo/
  catalogo.ts               Lee las fichas .json del catálogo (import.meta.glob de Vite)
  modelos.ts                Carga los .glb y los ajusta a las medidas de su ficha
src/ui/
  panel.ts                  Panel lateral (cajón en el móvil)
  barra.ts                  Barra superior y barra del objeto seleccionado (móvil)
  util.ts, estilos.css      Utilidades y estilos
.github/workflows/
  ci.yml                    Tests y compilación en cada PR y en main
  desplegar.yml             Publicación en GitHub Pages (se salta si Pages no está activado)
netlify.toml                Configuración lista para publicar en Netlify
```

Tecnologías: Vite 8, TypeScript 7, Three.js 0.187 y Vitest 5. No usa frameworks.

---

## 3. Formatos de datos

### `data/vivienda.json`

Coordenadas en **metros**, en planta como el plano: `[x, z]`, con x hacia la
derecha del plano y z hacia abajo. En 3D, y es la altura y el suelo está en y = 0.
El origen (0, 0) es la esquina superior izquierda del plano, junto al mirador.

```json
{
  "nombre": "Vivienda 2ºA",
  "alturaTecho": 2.5,
  "plano": { "imagen": "planos/plano.jpg", "pixelesPorMetro": 134.14,
             "origenPx": [25, 19], "anchoPx": 1880, "altoPx": 1000 },
  "estancias": [
    { "id": "distribuidor", "nombre": "Distribuidor", "alturaTecho": 2.5,
      "superficiePlano": 2.81,
      "poligono": [[6.07, 1.78], [8.61, 1.78], [8.61, 2.84], [6.07, 2.84]] }
  ],
  "paredes": [
    { "id": "salon-este", "nombre": "Salón / baño y distribuidor",
      "desde": [6, 0.05], "hasta": [6, 2.84], "grosor": 0.14,
      "huecos": [
        { "tipo": "puerta", "nombre": "Puerta del salón",
          "distancia": 1.83, "ancho": 0.81, "alto": 2.05, "alfeizar": 0 }
      ] }
  ],
  "pilares": [ { "id": "pilar-salon-n", "desde": [3.97, 0.23], "hasta": [4.36, 0.42] } ],
  "suposiciones": ["..."]
}
```

- **Estancia:**
  - `poligono` sigue la cara interior de los muros.
  - Opcionales: `alturaTecho`, `superficiePlano` (solo para comprobar) y `exterior: true` (balcón).
- **Pared:**
  - `desde` y `hasta` son los extremos del **eje central**. La pared ocupa `grosor/2` a cada lado.
  - `alto` es opcional; por defecto se usa `alturaTecho`.
  - Las paredes no se alargan solas en las esquinas: se solapan como estén en los datos.
- **Hueco:**
  - `tipo` es `puerta` o `ventana`.
  - `distancia` va desde el punto `desde` hasta el borde del hueco.
  - Una puerta-ventana es una `ventana` con `alfeizar: 0`.
- **Pilar:** rectángulo alineado con los ejes, de suelo a techo, dado por dos esquinas opuestas.

### Catálogo de objetos

Cada objeto son dos archivos en `catalogo/`. Se admiten subcarpetas, y el id
del objeto es la ruta del `.json` sin extensión. Ejemplo real, `catalogo/armario.json`:

```json
{
  "nombre": "Armario de 2 puertas",
  "categoria": "Almacenaje",
  "dimensiones": { "ancho": 1, "fondo": 0.6, "alto": 2 },
  "glb": "armario.glb"
}
```

- `dimensiones` son las medidas reales en metros: ancho = X, fondo = Z, alto = Y.
- `glb` es una ruta relativa a la carpeta del `.json`.
- La app escala el `.glb` para que mida exactamente lo que dice `dimensiones` y lo apoya en el suelo.
- El frente del modelo debe mirar a +Z.
- La app lee el catálogo al arrancar. Si a un `.json` le faltan campos o su `.glb` no existe, se ignora con un aviso en la consola.

### Escena guardada (v2)

```json
{ "version": 2, "vivienda": "Vivienda 2ºA",
  "objetos": [ { "catalogo": "mesa", "posicion": { "x": 3.1, "y": 0, "z": 1.8 }, "rotacion": 90 } ] }
```

`rotacion` está en grados (positivo = antihorario visto desde arriba).

---

## 4. Lo que se sacó del plano

### Escala

- El plano no tiene cotas de estancias. Tiene superficies útiles y un círculo de giro de ø1,50 m en el rellano.
- La escala se calculó por mínimos cuadrados con las 6 superficies: **134,14 px/m**.
- Comprobación independiente: el diámetro del círculo de ø1,50 m mide **1,53 m** con esa escala (+2 %).
- Comprobé con los arcos de las puertas que la imagen no está deformada (escala igual en horizontal y en vertical).
- Las coordenadas se redondearon a 1 cm.
- Precisión estimada de cada medida: **±3 cm**, más el error de la escala (alrededor del 1–2 %).

### Estancias

| Estancia | Superficie del plano | Medida en la app | Diferencia | Caja (ancho × fondo) | Notas |
|---|---:|---:|---:|---|---|
| Salón comedor | 15,74 m² | 15,90 m² | +1,0 % | 5,81 × 3,00 m | Incluye el mirador (0,57 m de fondo) y las muescas de 3 pilares |
| Cocina | 6,37 m² | 6,21 m² | −2,4 % | 2,23 × 2,94 m | Abierta al salón; muesca del patinillo arriba a la derecha |
| Tendedero | 3,55 m² | 3,44 m² | −3,0 % | 1,06 × 3,35 m | Muesca de un pilar abajo a la izquierda |
| Baño | 3,34 m² | 3,42 m² | +2,3 % | 2,54 × 1,43 m | Muesca del patinillo arriba a la derecha; plato de ducha no modelado |
| Distribuidor | 2,81 m² | 2,69 m² | −4,2 % | 2,54 × 1,06 m | Rectángulo |
| Dormitorio | 10,91 m² | 10,83 m² | −0,7 % | 3,60 × 3,27 m | Incluye el hueco del armario empotrado (2,19 × 0,57 m) y 4 pilares |
| Balcón | sin dato | 1,93 m² | — | 1,09 × 1,77 m | Exterior, con barandilla |
| **Total (6 estancias)** | **42,72 m²** | **42,50 m²** | **−0,5 %** | | |

### Puertas y ventanas (10 huecos)

| Hueco | Pared | Ancho | Alto | Alféizar | ¿Medido o supuesto? |
|---|---|---:|---:|---:|---|
| Puerta de entrada | rellano | 0,80 | 2,10 | 0 | ancho medido; alto supuesto |
| Puerta del salón (al distribuidor) | salon-este | 0,81 | 2,05 | 0 | ancho medido; alto supuesto |
| Puerta del baño | bano-distribuidor | 0,71 | 2,05 | 0 | ancho medido; alto supuesto |
| Puerta del dormitorio | dormitorio-oeste | 0,75 | 2,05 | 0 | ancho medido; alto supuesto |
| Puerta cocina–tendedero | cocina-tendedero | 0,73 | 2,05 | 0 | ancho medido; alto supuesto |
| Balconera del salón (mirador, 3 hojas) | mirador-frente | 2,04 | 2,10 | 0 | ancho medido; alto supuesto |
| Balconera del dormitorio (2 hojas, al balcón) | fachada-este | 1,48 | 2,10 | 0 | ancho medido; alto supuesto |
| Fijo acristalado cocina–tendedero (arriba) | cocina-tendedero | 0,68 | 1,10 | 1,00 | ancho medido; alto y alféizar supuestos |
| Fijo acristalado cocina–tendedero (abajo) | cocina-tendedero | 0,63 | 1,10 | 1,00 | ancho medido; alto y alféizar supuestos |
| Celosía / ventana del tendedero | tendedero-oeste | 2,68 | 1,10 | 1,00 | ancho aproximado; tipo, alto y alféizar supuestos |

**Paredes:** hay 25: 22 de altura completa y 3 tramos de barandilla de 1 m.
Grosores medidos en el plano:
- Fachada norte: 0,18 m.
- Fachada este y tabiques: 0,12–0,14 m.
- Muros a zonas comunes: 0,15–0,25 m.
- Cerramiento del tendedero: 0,06 m.

**Pilares y patinillos:** hay 11, medidos en el plano.

### Suposiciones (donde el plano no era claro)

1. **Escala** deducida de las superficies (ver arriba), no de cotas.
2. **Altura de techo** de 2,50 m en todas las estancias. El plano no la indica; el baño y el distribuidor podrían tener falso techo más bajo.
3. **Puertas interiores** de 2,05 m de alto y **puerta de entrada** de 2,10 m.
4. **Mirador del salón y salida al balcón:** puertas-ventana de suelo a 2,10 m. El mirador parece un balcón francés: no hay balcón dibujado fuera.
5. **Cerramiento cocina–tendedero:** una puerta y dos fijos acristalados con alféizar a 1,00 m y 1,10 m de alto. La puerta está dibujada con trazo discontinuo y podría ser corredera.
6. **Cerramiento exterior del tendedero:** se supone celosía o ventana con alféizar a 1,00 m. El plano solo muestra dos líneas finas.
7. **La cocina está abierta al salón.** Entre ambas solo hay un cambio de pavimento, no un muro. Esto cuadra con la superficie del salón.
8. **Armario empotrado del dormitorio:** su hueco cuenta como dormitorio, porque sin él el dormitorio saldría en 9,5 m² en vez de 10,91. Su frente (puertas correderas) no se dibuja.
9. **Rectángulo bajo la cocina** (con puertas dibujadas hacia abajo): se interpretó como armario de la vivienda vecina y no se incluye.
10. **Barandilla del balcón** de 1,00 m.
11. **Escalera, ascensor y rellano** no forman parte de la vivienda y no se dibujan.
12. **Detalles simplificados del baño:** el plato de ducha, la mampara y el escalón del fondo de la ducha no se modelan. El borde inferior del baño se tomó recto.
13. **Ligera inclinación de la fachada norte** en la imagen (unos 10 px a lo largo del plano): se ignoró y se tomó la cara interior recta.

---

## 5. Qué se comprobó y cómo

### Tests automáticos (`npm test`): 76 tests, todos pasan

- **Formato:** `vivienda.json` es válido y tiene las 7 estancias esperadas.
- **Suelos 3D frente a `vivienda.json`:** para cada estancia, el área de la geometría 3D (suma de triángulos) coincide con el área del polígono hasta 0,0001 m², por la precisión float32. Ancho, fondo y altura (y = 0) coinciden hasta 1e-6 m.
- **Superficies frente al plano:** ±5 % por estancia y ±2 % en total. Todas pasan; la peor es el distribuidor, con −4,2 %.
- **Paredes 3D:** cada pared mide lo que dice el JSON en largo, alto y grosor. Su volumen macizo es exactamente (largo × alto − huecos) × grosor, lo que demuestra que los huecos existen y tienen su tamaño.
- **Coherencia:** ninguna pared invade el suelo de una estancia más de 1,5 cm. Cada puerta interior comunica dos estancias distintas y la de entrada da al distribuidor.
- **Choques:**
  - una mesa cabe en el salón y no cabe atravesando un muro;
  - nada puede quedarse en el hueco de una puerta, ni salir por la balconera, ni meterse en la muesca de un pilar;
  - salón y cocina forman un solo espacio;
  - al empujar un mueble contra una pared se queda a menos de 1 mm y se desliza a lo largo de ella;
  - un mueble pasa por una puerta si cabe y no pasa si es más ancho;
  - si se suelta en un hueco, se recoloca fuera.
- **Migración** de escenas v1, sin versión y v2. **Catálogo** leído correctamente.
- `npm run build` (tipos + compilación) sin errores, también con la ruta base de GitHub Pages.

### Pruebas en navegador automático (Chromium headless)

Escritorio, 1400 × 860, 18 comprobaciones, todas bien:
- añadir objetos en el salón y en el dormitorio;
- arrastrar contra una pared sin puerta: se detiene;
- pasar la mesa por la puerta del salón al distribuidor y volver;
- girar con teclado y con el panel junto a una pared;
- vistas general, planta y plano;
- recargar: el autoguardado restaura la escena;
- Guardar: descarga un JSON v2;
- seleccionar con clic y borrar con Supr;
- cargar una escena de la fase 1;
- cargar un archivo no válido: mensaje de error y la escena no cambia;
- Vaciar con doble toque;
- sin errores en la consola.

Móvil emulado (iPhone 13, eventos táctiles reales), 7 comprobaciones, todas bien:
- menú;
- añadir;
- girar y borrar desde la barra inferior;
- arrastrar con el dedo;
- selector de estancia;
- plano superpuesto;
- sin errores.

Versión de un solo archivo: la misma batería completa pasa. En el visor real de claude.ai (emulado), la página arranca, los modelos 3D cargan y no hay errores. "Guardar" con la capacidad de descargas del visor se probó solo con un **visor simulado**.

### Superposición del plano

Revisé por zonas, en vista en planta con el plano al 50 %, el salón, la cocina con el tendedero, el baño con el distribuidor y el dormitorio con el balcón.

Resultado: las huellas de muros y pilares coinciden con el dibujo en casi todo el contorno, con desviaciones de pocos píxeles (≈1–3 cm).

**Diferencias que quedan sin corregir:**
- **Superficies:**
  - Distribuidor −4,2 %: el polígono coincide con el dibujo, así que la diferencia parece del cálculo de superficie del plano, quizá porque cuenta medio grosor de los umbrales.
  - Tendedero −3,0 %: depende de dónde se tome la cara del cerramiento de celosía.
  - Baño +2,3 %: el plano podría descontar el plato de ducha o el patinillo.
- **Esquina superior derecha de la cocina:** el patinillo y el pilar se simplificaron en dos bloques; sus contornos internos difieren unos centímetros.
- **Pilares de la fachada este del dormitorio:** en el plano sobresalen algo más hacia el exterior que la pared modelada. No afecta al interior.
- **Fachada norte:** su cara exterior está ligeramente inclinada en la imagen y se modeló recta.

---

## 6. Problemas conocidos y limitaciones

- **No hay choques entre muebles:** dos objetos pueden ocupar el mismo sitio. Al añadir varios seguidos aparecen en el mismo punto, uno encima de otro.
- **La altura de techo de cada estancia no cambia la altura de sus paredes.** Solo se muestra; todas las paredes miden 2,50 m.
- **No hay techos, rodapiés, marcos de puertas ni hojas de puertas o ventanas.** Los huecos son aberturas limpias; las ventanas llevan un cristal azulado provisional.
- **El corte automático de paredes es heurístico.** En algunos ángulos quedan en pie paredes cortas que tapan un poco, como los laterales del armario empotrado, o se cortan algunas que no molestan. Al desplazar la cámara con el botón derecho no se cambia el modo.
- **La puerta de entrada da al vacío:** el rellano no está dibujado.
- **Etiquetas:** en pantallas pequeñas pueden solaparse en la vista general. En el móvil solo muestran el nombre.
- **Mover muebles entre estancias** obliga a llevarlos por la puerta. Uno que no quepa (por ejemplo, el armario de frente por una puerta de 0,75 m) hay que girarlo antes. No hay opción de "llevar a otra estancia".
- **Rendimiento:** no se ha medido en un móvil real. Las sombras usan un mapa de 4096 px, que puede ser pesado en móviles modestos.
- **Despliegue:** GitHub Pages **no funciona** porque el repositorio es privado y la cuenta no tiene plan de pago (la API devuelve "Resource not accessible"). El workflow compila y prueba, pero se salta la publicación. La app está publicada como página privada de claude.ai, que **no se actualiza sola** con cada cambio en main: hay que volver a publicarla. Netlify está preparado (`netlify.toml`), pero **no se ha probado**: hace falta crear la cuenta.
- **Sin probar:**
  - un móvil o tablet real (solo la emulación de Chromium), Safari y Firefox;
  - el guardado real dentro de claude.ai (solo con un visor simulado);
  - cargar `.glb` reales de terceros, porque el catálogo solo tiene los dos ejemplos generados por script;
  - planos de otras viviendas.
- **Rama sin borrar:** la rama `claude/determined-thompson-ciad4f` sigue en GitHub. El entorno de trabajo no me permitió borrarla y hay que hacerlo desde GitHub. Todo su contenido ya está en main.

---

## 7. Decisiones que tomé por mi cuenta

- **Escala por superficies**, con el círculo de ø1,50 m como comprobación, porque el plano no trae cotas.
- **Origen de coordenadas** en la esquina superior izquierda del plano y ejes como en el plano (z hacia abajo), para que comparar con la imagen sea directo.
- **Los polígonos de las estancias son la fuente de verdad para los choques.** Las paredes son solo visuales, más una comprobación en los tests.
- **Arrastre continuo y puertas como paso:** el objeto nunca salta un muro y solo cruza una puerta si cabe. En una primera versión saltaba a la estancia de al lado si el destino estaba libre; lo cambié porque era "atravesar por error".
- **Salón y cocina como un solo espacio** para los muebles.
- **Corte de paredes con dos reglas:** casa de muñecas en la vista general (solo quedan en pie las paredes del fondo) y regla cámara-objetivo al mirar una estancia. Los pilares siguen a las paredes que tocan.
- **Migración de la fase 1** centrada en el salón.
- **Interfaz para el móvil:** cajón lateral, barra inferior del objeto, etiquetas compactas, y en pantallas verticales la casa se encuadra "de canto".
- **Sin `confirm()` ni `alert()`:** Vaciar con doble toque y errores en el panel.
- **Publicación en claude.ai** de una versión de un solo archivo, como alternativa inmediata a GitHub Pages para poder abrirla en el móvil. Incluye la capacidad de descargas del visor para "Guardar".
- **Squash merge de cada PR.** Para poder seguir usando la misma rama tras cada merge sin forzar el push, integré la rama ya fusionada con la estrategia "ours" (sin cambiar contenido).

---

## 8. Qué falta para la fase 3 (materiales, suelos, luces) y recomendaciones

Falta todo lo visual: hoy los colores son provisionales y planos.

1. **Primero, suelos por estancia:**
   - un campo `suelo` en cada estancia de `vivienda.json` (tipo y color o textura);
   - texturas con escala real (metros por repetición) y coordenadas UV calculadas en planta para que no se deformen en polígonos irregulares.
   - Baño, cocina y tendedero con baldosa; el resto con tarima.
   - Es lo que más cambia la sensación del espacio y lo más fácil.
2. **Paredes:**
   - material por cara de pared, porque un tabique tiene dos caras que dan a estancias distintas;
   - para eso conviene separar cada pared en sus dos caras o asignar el material según la estancia a la que mira;
   - azulejo en baño y cocina.
3. **Carpintería:** marcos y hojas de puertas, perfiles de ventanas y rodapiés. Hoy son huecos limpios.
4. **Luces:**
   - un mapa de entorno (`RoomEnvironment` o un HDR pequeño) para reflejos realistas;
   - luz natural entrando por las ventanas reales (las posiciones ya están en el JSON);
   - opcionalmente, puntos de luz por estancia;
   - vigilar el rendimiento en el móvil: bajar el mapa de sombras o añadir un modo "calidad baja".
5. **Techos** opcionales, visibles solo al mirar una estancia desde dentro.
6. **Antes o en paralelo**, cosas pendientes de la fase 2 que conviene resolver pronto:
   - choques entre muebles;
   - conectar la altura de techo de cada estancia con la altura de sus paredes;
   - activar un despliegue automático real (Netlify o Pages) para no depender de volver a publicar la página de claude.ai.

---

## 9. Cómo abrir la app

**En el móvil (ahora):** https://claude.ai/artifact/FBiLfRAKuNSTwtNVXf9xfi
- Es una página privada en la cuenta de claude.ai del propietario, con el mismo código que `main` a fecha de este documento.
- No se actualiza sola con nuevos cambios en `main`.

**Despliegue automático:**
- **GitHub Pages:** se activa en *Settings → Pages → Source = GitHub Actions*. Necesita plan de pago al ser un repositorio privado. Quedaría en `https://exequ.github.io/Casa/`.
- **Netlify (gratis):** *Add new site → Import from Git → Casa → Deploy*. No hay que tocar nada más.

**En local:**

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests
npm run build      # tipos + versión final en dist/
```
