# Casa 3D

Herramienta web para diseñar y decorar una casa en 3D. Uso personal: sin
backend ni cuentas, todo funciona en el navegador (también en el móvil).
Todas las medidas están en **metros**, a escala real.

- **Fase 1:** una habitación de ejemplo donde colocar, mover, girar y borrar
  objetos del catálogo, con guardado y carga de la escena.
- **Fase 2:** la vivienda real (2ºA), sacada de los planos de
  `planos/`: estancias, paredes con sus puertas y ventanas, pilares, selector
  de estancia y modo de comprobación con el plano superpuesto.
- **Fase 2.5 y 3a:** choques entre muebles, altura de paredes según
  las estancias, mejor corte de paredes, calidad gráfica adaptada al móvil y
  **suelos con textura** por estancia, con selector en la interfaz.
- **Fase 3b:** **acabados reales** sacados de las fotos del piso:
  suelos (tarima de ipé, granito negro pulido, mármol…), pintura de paredes por
  estancia y por cara, alicatado del baño y frente de la cocina, rodapiés,
  tapajuntas, **carpintería** (ventanas de nogal con cristal, puertas lacadas,
  lamas del tendedero, barandilla, cortinas), **techos** con falso techo y
  focos, **luces** con interruptores y **vista interior** a la altura de los ojos.
- **Fase 4:** herramientas para **decorar**: cuadros y espejos
  colgados en las paredes, objetos apoyados sobre los muebles (jarrones,
  plantas, la tele), **deshacer y rehacer**, duplicar, buscador y categorías
  plegables en el catálogo e **imagen PNG** de la vista.
- **Fase 5, lote 1:** los **muebles reales del salón y del pasillo**
  (sofá, sillón, mesas, librería, mueble y televisión, sillas, lámparas,
  mesitas, espejos, cuadro y perchero), modelados por código, con
  **miniaturas** en el catálogo.
- **Fase 5, lote 2 (actual):** el lote 1 **ajustado a las fotos** reales
  (colores, formas, la celosía de la mesa de centro, la librería...) con
  **veta de madera y tejido** en las tapicerías, y los muebles del
  **dormitorio, el balcón y el tendedero** (cama, mesita, lámpara, cómoda,
  cuadros, mesa y sillas de balcón, planta y lavadora). Medidas estimadas en
  [`docs/OBJETOS.md`](docs/OBJETOS.md).

**App publicada:** <https://exequ.github.io/Casa/> (ver [Publicación](#publicación)).
Estado detallado: [`docs/ESTADO.md`](docs/ESTADO.md).

## Cómo ejecutarlo

Necesitas [Node.js](https://nodejs.org) 20 o superior.

```bash
npm install      # solo la primera vez
npm run dev      # arranca la app
```

Abre <http://localhost:5173> en el navegador.

| Comando | Qué hace |
| --- | --- |
| `npm test` | Ejecuta los tests automáticos |
| `npm run build` | Comprueba los tipos y genera la versión final en `dist/` |
| `npm run preview` | Sirve la versión de `dist/` para probarla |
| `npm run comprobar` | Solo comprueba los tipos de TypeScript |
| `npm run vivienda:generar` | Regenera `data/vivienda.json` a partir de las medidas del plano |
| `npm run catalogo:ejemplos` | Regenera los objetos de ejemplo del catálogo (mesa, armario y los provisionales de decoración) |
| `npm run catalogo:lote1` | Regenera los muebles reales del lote 1 (salón y pasillo) y su tabla de `docs/OBJETOS.md`; respeta las medidas corregidas en los `.json` (con `-- --reiniciar`, no) |
| `npm run catalogo:lote2` | Igual, para el lote 2 (dormitorio, balcón y tendedero) |
| `npm run catalogo:miniaturas` | Dibuja las miniaturas PNG del catálogo (necesita Playwright con Chromium); con `-- sofas/sillon` solo esa, con `-- --vistas carpeta` además 3 vistas grandes de cada objeto para revisarlo |

## Cómo se usa

**Barra superior** (sobre la vista 3D):

- **Selector de estancia:** centra la cámara en una estancia o en toda la vivienda.
- **Planta:** vista desde arriba.
- **Interior:** entra en la estancia elegida: cámara a la altura de los ojos
  (1,55 m), mirando a lo largo de la estancia desde el lado de la puerta, con
  techo y focos. Se gira con el dedo o el ratón; vuelve a pulsarlo para salir.
- **Luces:** enciende o apaga todos los focos (cada estancia tiene además su
  interruptor en el panel, sección *Acabados*).
- **Puertas:** abre o cierra todas las puertas a la vez.
- **Cortinas:** muestra u oculta las cortinas del mirador y del dormitorio.
- **Plano:** superpone el plano original (ver [Comprobar con el plano](#comprobar-con-el-plano)).
- **☰** (solo en el móvil): abre el menú con el catálogo, los acabados, guardar y cargar.

Los interruptores (luces, puertas, cortinas) se guardan con la escena.

**Herramientas** (abajo a la derecha): **↶ deshacer**, **↷ rehacer** y
**📷 imagen**, que descarga un PNG de lo que se ve, sin barras, etiquetas ni
caja de selección.

**Catálogo** (panel; en el móvil, menú ☰): las categorías se pliegan tocando
su título y el **buscador** filtra por nombre (sin importar tildes ni mayúsculas).

**Ordenador:**

- **Cámara:** arrastrar con el botón izquierdo = girar · rueda = zoom · botón derecho = desplazar.
- **Añadir:** clic en un objeto del catálogo. Aparece en la estancia elegida
  en la barra superior (o en el salón), ya seleccionado: los muebles en el
  sitio libre del suelo más cercano al centro; los cuadros y espejos en una
  pared libre que se vea desde la cámara; los jarrones y plantas sobre un
  mueble con sitio (o en el suelo si no hay). Si no cabe, se avisa en el panel.
- **Seleccionar:** clic sobre el objeto. Clic en vacío o `Esc` deselecciona.
- **Mover:** arrastrar el objeto (ver abajo cómo se mueve cada tipo).
- **Girar:** `Q` / `E` o los botones ⟲ ⟳ (pasos de 15°). Giro libre con el
  deslizador, escribiendo los grados, o `Mayús + Q/E` (1°).
- **Altura** (cuadros y espejos): deslizador *Altura en la pared* del panel.
- **Duplicar:** tecla `D` o botón *Duplicar*.
- **Borrar:** tecla `Supr` (o el botón *Borrar*).
- **Deshacer / rehacer:** `Ctrl+Z` / `Ctrl+Mayús+Z` (o `Ctrl+Y`), o los botones ↶ ↷.

**Móvil:**

- **Cámara:** un dedo = girar · dos dedos = zoom y desplazar.
- **Objetos:** tócalo para seleccionarlo y arrástralo con el dedo. Al
  seleccionarlo aparece abajo una barra con girar (⟲ ⟳; en cuadros y
  espejos, subir ▲ y bajar ▼ de 5 en 5 cm), duplicar (⧉) y borrar.

**Cuadros y espejos (objetos de pared):**

- Se cuelgan de la pared a la que se apunta con el ratón o el dedo, con el
  frente hacia la estancia. Si se apunta al suelo, van a la pared más
  cercana a ese punto. Al arrastrarlos corren a lo largo de la pared o pasan
  a otra.
- No pueden tapar puertas (ni su tapajuntas) ni ventanas (ni su marco), ni
  solaparse con otro objeto de la misma pared, ni salirse de la pared, del
  suelo o del techo: si se intenta, se quedan en el sitio libre más cercano.
- La altura se cambia aparte (deslizador o ▲ ▼); empieza en la `alturaCentro` de su ficha.
- No se giran. Si su muro se baja (vista desde fuera), se ocultan con él.

**Jarrones, plantas, lámparas... (objetos de superficie):**

- Al arrastrarlos sobre un mueble se apoyan en la tapa o balda más cercana
  al puntero, dentro del mueble y sin solaparse con lo que ya haya. Si no hay
  mueble debajo (o no caben), van por el suelo como un mueble más.
- **Se mueven y giran con el mueble.** Si se borra el mueble, pasan a otro
  mueble libre cercano o, si no hay, al suelo.
- Los objetos de pared y los apoyados no estorban a los muebles del suelo
  (un objeto de superficie que esté en el suelo, sí).

**Cómo se comportan los muebles:**

- Nunca atraviesan paredes, pilares, puertas ni ventanas: al empujarlos
  contra una pared se quedan pegados a ella y se deslizan a lo largo.
- Pasan de una estancia a otra **por las puertas, solo si caben** (como en la
  realidad). Si se sueltan en mitad de una puerta, se colocan solos en el
  sitio libre más cercano.
- **No se solapan entre sí:** al arrastrar uno contra otro se queda pegado;
  al girarlo, si chocaría, se aparta lo justo; al añadirlo o al cargar una
  escena, va al sitio libre más cercano.
- El salón y la cocina abierta son un mismo espacio: se puede poner algo a caballo.
- Si al girar un mueble chocaría con una pared u otro mueble, se aparta lo
  justo; si no cabe girado, no se gira.

**Paredes:** las que tapan la vista se bajan solas a 25 cm (como en un plano).
La regla: se mira qué trozo de suelo tapa cada pared vista desde la cámara (su
"sombra"); si tapa suelo de la vivienda, se baja. Así se bajan también las
paredes cortas, como los laterales del armario empotrado, y se quedan en pie
las fachadas del fondo. Al elegir una estancia, se bajan las que quedan entre
la cámara y ella y las que tapan su suelo; las del fondo de la estancia se
quedan en pie. Cada pared mide la mayor altura de techo de las estancias que toca.

**Acabados:** en el panel (en el móvil, menú ☰), sección *Acabados*: elige la
estancia (o elígela en la barra superior) y:

- **Suelo:** toca uno de los 10 suelos. *Suelo original* deja el de `vivienda.json`.
- **Color de las paredes:** 8 colores (blanco roto, gris perla, arena, greige,
  verde salvia, azul niebla, terracota suave, antracita) u *Otro color* (libre).
  Pinta todas las paredes de esa estancia por su lado, sin tocar la otra cara
  de los tabiques ni el alicatado. *Color original* vuelve al de `vivienda.json`.
- **Luz de esta estancia:** su interruptor (solo en las que tienen focos).

Los cambios se guardan con la escena.

**Techos:** solo se ven desde dentro (vista *Interior*, o al acercar la
cámara por debajo del techo); en la vista general y en planta se ocultan.

**Luces:** el sol entra por las ventanas reales (dentro, un sol bajo de
poniente que proyecta la forma de la carpintería en el suelo), un entorno
neutro da los reflejos (el granito pulido brilla) y los focos son luces de
3000 K. Para que vaya fluido, solo dan sombra el sol y, con calidad normal,
hasta 2 luces de la estancia en la que está la cámara (máximo 3 con sombra).
En el móvil, una luz por estancia y solo el sol da sombra.

**Calidad gráfica:** en pantallas táctiles o pequeñas la app usa sombras de
1024 px y menos píxeles por punto (más fluido); en el ordenador, sombras de
2048 px. Se puede forzar con `?calidad=ligera`, `?calidad=normal` o
`?calidad=alta` (4096 px) al final de la dirección.

**Guardar / Cargar / Vaciar:** descarga la escena como `escena.json` o abre una
guardada (si el archivo no vale, se explica en el panel y la escena no cambia).
*Vaciar* pide un segundo toque para confirmar. Además, cada cambio se **autoguarda** en el navegador
(`localStorage`) y se recupera al volver a abrir la app.

## Estructura del proyecto

```
data/vivienda.json        La vivienda: estancias, paredes con huecos, pilares
planos/                   Planos originales (plano-original.png) y el recorte que se superpone (plano.jpg)
catalogo/                 Objetos del catálogo: un .json + un .glb + una miniatura .png por objeto (muebles reales en carpetas por categoría)
scripts/
  digitalizar-plano.mjs   Medidas tomadas del plano (en píxeles) → data/vivienda.json
  generar-catalogo.mjs    Crea los objetos de ejemplo del catálogo
  catalogo-lote1.mjs      Crea los muebles reales del lote 1 (salón y pasillo) y su tabla en docs/OBJETOS.md
  catalogo-lote2.mjs      Crea los del lote 2 (dormitorio, balcón y tendedero)
  miniaturas.mjs          Dibuja las miniaturas PNG del catálogo (y vistas de comprobación)
  lib/modelo3d.mjs        Librería para modelar objetos con piezas de three.js y guardarlos en .glb
  lib/texturas.mjs        Texturas procedurales (veta de madera y tejido) que van dentro de los .glb
  lib/lote.mjs            Lo común a los lotes: materiales, marcos, guardar y la tabla de docs/OBJETOS.md
tests/                    Tests automáticos (Vitest)
docs/                     Estado del proyecto (ESTADO.md), medidas de los objetos (OBJETOS.md) y resumen de la fase 2
src/main.ts               Punto de entrada: une todas las piezas
src/vivienda/             Datos y geometría en planta (sin 3D)
  modelo.ts               Formato de vivienda.json y su validación
  geometria.ts            Áreas, puntos en polígonos, cruces de segmentos...
  espacio.ts              Dónde caben los muebles (paredes, puertas, pilares, otros muebles)
  suelos.ts               Formato del campo "suelo", suelos disponibles y por defecto
  acabados.ts             Formato de los acabados (pintura, revestimientos, rodapié) y colores de pared
  caras.ts                Caras de pared de cada estancia (qué trozo de qué muro ve cada estancia)
  vista.ts                Desde dónde mirar una estancia en la vista interior
  colgar.ts               Caras de pared donde colgar cuadros y espejos, y sus reglas
src/escena/               Todo lo 3D
  escena.ts               Renderizador, cámara orbital, luces y encuadres
  vivienda3d.ts           Suelos, paredes con huecos y pilares a partir del JSON
  corte.ts                Bajar las paredes que tapan la vista (regla de la "sombra")
  etiquetas.ts            Nombre, superficie y altura de techo de cada estancia
  plano.ts                Plano original superpuesto (modo comprobación)
  texturasSuelo.ts        Texturas de suelo dibujadas por código (canvas) y sus materiales
  suelos3d.ts             Pone el suelo de cada estancia y recuerda los cambios
  texturasPared.ts        Texturas de alicatado, azulejo y granito de pared
  paredes3d.ts            Pintura y revestimientos por cara, rodapiés, umbrales; colores de pared
  carpinteria.ts          Marcos, hojas, cristales, manillas, lamas, cortinas y barandilla
  techos.ts               Techos, tabicas del falso techo y focos
  luces.ts                Focos como luces, interruptores, sol y sombras según la vista
  objetos.ts              Objetos colocados (suelo, pared, sobre muebles): añadir, mover, girar, duplicar, borrar
  historial.ts            Deshacer y rehacer
  interaccion.ts          Ratón, dedo y teclado: arrastrar por el suelo, por la pared o sobre muebles; atajos
  persistencia.ts         Guardar/cargar JSON, autoguardado y migración de escenas
src/catalogo/
  catalogo.ts             Lee las fichas .json del catálogo
  modelos.ts              Carga los .glb y los ajusta a sus medidas reales
src/ui/
  panel.ts                Panel lateral (cajón en el móvil): catálogo con buscador, objeto seleccionado, escena
  barra.ts                Barra superior, herramientas (↶ ↷ 📷) y barra del objeto seleccionado (móvil)
  selectorAcabados.ts     Suelo, color de paredes y luz de cada estancia
  estilos.css             Estilos
```

## Formato de vivienda.json

Coordenadas en **metros**, vistas en planta igual que el plano: **x** hacia la
derecha del plano y **z** hacia abajo del plano. En 3D, **y** es la altura y el
suelo está en `y = 0`. Un punto se escribe `[x, z]`.

```jsonc
{
  "nombre": "Vivienda 2ºA",
  "alturaTecho": 2.5,                  // altura por defecto (m)
  "plano": {                           // opcional: imagen para comprobar
    "imagen": "planos/plano.jpg",
    "pixelesPorMetro": 134.14,         // escala de la imagen
    "origenPx": [25, 19],              // píxel de la imagen que es el punto [0, 0]
    "anchoPx": 1880, "altoPx": 1000
  },
  "estancias": [
    {
      "id": "salon",
      "nombre": "Salón comedor",
      "alturaTecho": 2.5,              // opcional
      "superficiePlano": 15.74,        // opcional: la del plano, para comprobar
      "exterior": false,               // opcional: true en balcones y terrazas
      "suelo": { "tipo": "tarima", "color": "#56301e", "escala": 2.4, "pieza": 0.08 },  // opcional (ver abajo)
      "acabado": { "pared": { "color": "#eeede9" } },                    // opcional (ver "Acabados")
      "focos": [[1.5, 1.0], [1.5, 2.4]],                                 // opcional: focos empotrados [x, z]
      "poligono": [[0.86, 0.23], [5.93, 0.23], [5.93, 2.84], ...]
    }
  ],
  "paredes": [
    {
      "id": "salon-este",
      "desde": [6.0, 0.05],            // extremos del EJE CENTRAL de la pared
      "hasta": [6.0, 2.84],
      "grosor": 0.14,                  // la pared ocupa grosor/2 a cada lado del eje
      "alto": 2.5,                     // opcional (por defecto, la mayor alturaTecho de las estancias que toca)
      "tipo": "muro",                  // opcional: "muro" (por defecto) o "barandilla" (barrotes, no maciza)
      "huecos": [
        {
          "tipo": "puerta",            // "puerta" o "ventana"
          "nombre": "Puerta del salón",
          "distancia": 1.83,           // desde el punto "desde" hasta el borde del hueco
          "ancho": 0.81,
          "alto": 2.05,
          "alfeizar": 0,               // altura del antepecho (0 en puertas)
          "estilo": "puerta-blanca",   // opcional: carpintería (ver "Carpintería")
          "bisagra": "hasta",          // opcional, puertas: extremo con las bisagras ("desde" | "hasta")
          "abre": "izquierda"          // opcional, puertas: hacia dónde abre, mirando de "desde" a "hasta"
        }
      ]
    }
  ],
  "pilares": [
    { "id": "pilar-salon-n", "desde": [3.97, 0.23], "hasta": [4.36, 0.42] }  // dos esquinas opuestas
  ],
  "suposiciones": ["..."]              // notas de lo que se supuso al leer el plano
}
```

Reglas:

- El **polígono** de cada estancia sigue la **cara interior** de sus muros
  (incluidas las muescas de los pilares). Es el suelo, y también el espacio
  donde pueden estar los muebles.
- Dos estancias que **comparten un lado** sin muro (salón y cocina abierta)
  forman un mismo espacio.
- Los **huecos** son puertas y ventanas; las ventanas llevan cristal. Una
  puerta-ventana (balconera) es una `ventana` con `alfeizar: 0`.
- Al abrir la app se valida el archivo; si hay errores, se muestran en pantalla.

### El campo `suelo`

Cada estancia puede llevar un `suelo`:

```json
"suelo": { "tipo": "tarima", "color": "#56301e", "escala": 2.4, "pieza": 0.08, "acabado": "satinado" }
```

- `tipo`: el dibujo. Uno de `tarima`, `baldosa`, `marmol`, `granito`,
  `microcemento`, `terrazo`, `exterior` o `pizarra`.
- `color`: color base, en hexadecimal (`#rrggbb`).
- `escala`: **metros reales que ocupa una repetición de la textura**. Por
  ejemplo, `baldosa` con escala 1,2 y pieza 0,6 son 2 × 2 baldosas de 60 cm.
- `pieza` (opcional): ancho del listón de tarima o lado de la baldosa, en
  metros (tarima de ipé: 0,08; baldosas: 0,6 o 0,45).
- `acabado` (opcional): `mate`, `satinado` o `pulido` (el pulido refleja).
- `giro` (opcional): `0` o `90`. Sin él, la tarima va a lo largo del lado
  mayor de la estancia.

Si una estancia no tiene `suelo`, se usa uno por defecto: tarima de ipé
oscura en las zonas de estar, mármol gris claro en baño, cocina y tendedero, y
pizarra en balcones y terrazas. Lo que lleva ahora `vivienda.json`, según las
fotos: tarima de ipé (listón de 8 cm, satinada) en salón, distribuidor y
dormitorio; granito negro pulido 60 × 60 en la cocina; piedra gris oscura
mate con vetas claras en el tendedero; mármol gris claro mate 45 × 45 en el
baño, y pizarra gris oscura en el balcón.

### Acabados (`acabado`, `focos`, `apliques`)

```jsonc
"acabado": {
  "pared": { "color": "#eeede9" },          // pintura de las paredes de la estancia
  "rodapie": { "alto": 0.07, "color": "#5d5750" },  // null = sin rodapié; si falta, blanco de 10 cm
  "revestimientos": [                       // alicatados y frentes; si se solapan, gana el último
    {
      "nombre": "Alicatado hasta 1,10 m",
      "material": { "tipo": "alicatado", "color": "#d5d6d4", "pieza": [0.6, 0.3], "acabado": "satinado" },
      "desde": 0,                           // altura de inicio (m), por defecto 0
      "hasta": 1.1                          // altura final (m) o "techo" (por defecto)
    },
    {
      "nombre": "Ducha hasta el techo",
      "material": { "tipo": "alicatado", "color": "#d5d6d4" },
      "hasta": "techo",
      "zona": [6.0, 0.2, 7.01, 1.7]          // solo las paredes dentro de este rectángulo [x1, z1, x2, z2]
    }
  ]
},
"focos": [[6.55, 0.95], [7.6, 1.0]],        // focos empotrados en el techo
"apliques": [{ "desde": [7.2, 0.25], "hasta": [7.8, 0.25], "altura": 1.95 }]  // LED lineal de pared
```

- **Pintura:** cada estancia pinta *su* cara de cada pared. Un tabique entre
  dos estancias tiene un color por cada lado; las fachadas por fuera se quedan
  con el color del muro. Por defecto, blanco roto con un matiz gris (`#eeede9`).
- **Revestimientos:** `tipo` `alicatado` (piezas rectangulares en varios
  grises y blanco veteado, con despiece irregular), `azulejo` (liso, de un
  color) o `granito` (piedra moteada sin juntas). La altura del alicatado se
  cambia con `hasta`. Encima de un revestimiento sigue la pintura.
- **Rodapié:** blanco de 10 cm salvo que se diga otra cosa; el tendedero
  lleva 7 cm del mismo material que el suelo y el baño ninguno.
- **Techo:** `alturaTecho` de la estancia. El **falso techo** de la cocina y
  el distribuidor (2,40 m) es una suposición: se cambia ahí. Donde dos techos
  de distinta altura se tocan sin muro (salón | cocina) se dibuja la tabica.
- **Focos:** discos luminosos de 8 cm en el techo; la luz es cálida (3000 K).

Las texturas de pared también se dibujan por código, con coordenadas en
metros (la pieza mide lo que dice el JSON en cualquier pared).

### Carpintería (`estilo` de los huecos)

| `estilo` | Qué dibuja |
| --- | --- |
| `puerta-blanca` | Puerta interior lisa lacada en blanco, tapajuntas de 7 cm y manilla plateada (por defecto en puertas) |
| `puerta-entrada` | Puerta de entrada blanca lisa con mirilla |
| `puerta-vidriera` | Puerta de madera oscura con vidrio |
| `ventana` | Marco y hojas de nogal con cristal y manillas plateadas (por defecto en ventanas) |
| `fijo` | Paño fijo acristalado con marco de nogal |
| `lamas` | Celosía de lamas horizontales de aluminio negro |

Otros campos opcionales de un hueco: `hojas` (número de hojas o paños),
`travesano` (altura de un travesaño horizontal que parte el hueco),
`cortina: true` (cortina blanca hasta el suelo por dentro). Las paredes con
`"tipo": "barandilla"` se dibujan como barandilla de barrotes negros.

**Texturas:** se dibujan por código en el navegador (`src/escena/texturasSuelo.ts`,
con `<canvas>`), así que no hay imágenes descargadas ni licencias de terceros:
son obra de este proyecto. Pesan 0 KB en el repositorio y cada una ocupa 512 ×
512 px en memoria. Las coordenadas de textura del suelo van en metros en
planta, de modo que la escala es real y no se deforman en polígonos irregulares.

## Cómo se pasó el plano a datos

El plano (`planos/plano-original.png`, captura de idealista) **no tiene cotas
de las estancias**: solo sus superficies útiles y un círculo de giro de
ø1,50 m en el rellano. El proceso, en `scripts/digitalizar-plano.mjs`:

1. Se midió cada cara de muro, puerta, ventana y pilar sobre la imagen
   ampliada (rejilla de píxeles + escaneo de píxeles oscuros).
2. La **escala** (134,1 px/m) se calculó por mínimos cuadrados para que las
   superficies medidas coincidan con las del plano. Comprobación independiente:
   el círculo de ø1,50 m mide 1,53 m.
3. Resultado frente al plano:

| Estancia | Plano | Medido | Diferencia |
| --- | ---: | ---: | ---: |
| Salón comedor | 15,74 m² | 15,90 m² | +1,0 % |
| Cocina | 6,37 m² | 6,21 m² | −2,4 % |
| Tendedero | 3,55 m² | 3,44 m² | −3,0 % |
| Baño | 3,34 m² | 3,42 m² | +2,3 % |
| Distribuidor | 2,81 m² | 2,69 m² | −4,2 % |
| Dormitorio | 10,91 m² | 10,83 m² | −0,7 % |
| **Total** | **42,72 m²** | **42,50 m²** | **−0,5 %** |

Todo lo que se ha **supuesto** (alturas, alféizares, cerramientos...) está en
la lista `suposiciones` de `data/vivienda.json` y se puede leer en la app
(panel → *Suposiciones al leer el plano*).

## Comprobar con el plano

Botón **Plano** (o panel → *Superponer el plano original*): pone la imagen del
plano, semitransparente y a escala, sobre el suelo. Las paredes se quedan a ras
de suelo y en rojo (pilares en morado), sin dinteles: así se ve si su huella
coincide con el dibujo y las puertas aparecen como huecos. Combínalo con
**Planta** y con el selector de estancia para acercarte. La opacidad se ajusta
en el panel.

Si algo no coincide, corrige la medida en píxeles en
`scripts/digitalizar-plano.mjs` y ejecuta `npm run vivienda:generar`, o edita
`data/vivienda.json` directamente (en metros).

## Cómo añadir un objeto nuevo al catálogo

1. Consigue o crea el modelo en formato **.glb** (por ejemplo, exportándolo
   desde Blender con *File → Export → glTF 2.0*, formato *glTF Binary*).
2. Copia el `.glb` a la carpeta `catalogo/` (puedes usar subcarpetas, p. ej.
   `catalogo/salon/`).
3. Crea a su lado un `.json` con la ficha. Ejemplo `catalogo/sofa.json`:

   ```json
   {
     "nombre": "Sofá de 3 plazas",
     "categoria": "Sofás",
     "dimensiones": { "ancho": 2.1, "fondo": 0.9, "alto": 0.85 },
     "glb": "sofa.glb"
   }
   ```

   - `nombre`: lo que se ve en el panel.
   - `categoria`: agrupa los objetos en el panel.
   - `dimensiones`: medidas **reales** en metros. `ancho` = eje X,
     `fondo` = eje Z, `alto` = eje Y.
   - `glb`: ruta del modelo, relativa a la carpeta del `.json`.
   - `colocacion` (opcional): dónde se pone. `"suelo"` (por defecto: muebles),
     `"pared"` (cuadros, espejos) o `"superficie"` (jarrones, lámparas de mesa,
     la tele...: sobre un mueble, o en el suelo si no hay sitio).
   - `alturaCentro` (opcional, solo `"pared"`): altura del centro del objeto
     sobre el suelo, en metros. Por defecto 1,50.
   - `superficies` (opcional, solo muebles de suelo: mesas, cómodas,
     estanterías, mueble de TV): lista de alturas en metros de sus tapas o
     baldas donde se pueden apoyar objetos. Por defecto, el borde superior del
     mueble. Se supone que cada tapa o balda ocupa toda la planta del mueble.
     **`[]`** = no se puede apoyar nada encima (sofás, sillas, lámparas...).
   - `medidas` (opcional, informativo): `"estimadas"` o `"confirmadas"`.

   La **miniatura** del panel es un `.png` con el mismo nombre que el `.json`
   (`sofa.json` → `sofa.png`), de 128 × 128 px. `npm run catalogo:miniaturas`
   la genera a partir del `.glb`. Si no hay, el objeto sale sin imagen.

   Ejemplos:

   ```jsonc
   // Cuadro
   { "nombre": "Cuadro 40 × 30", "categoria": "Decoración de pared", "colocacion": "pared",
     "alturaCentro": 1.5, "dimensiones": { "ancho": 0.4, "fondo": 0.03, "alto": 0.3 }, "glb": "cuadro.glb" }
   // Estantería con tres baldas
   { "nombre": "Estantería", "categoria": "Almacenaje", "superficies": [0.35, 0.75, 1.2],
     "dimensiones": { "ancho": 0.8, "fondo": 0.35, "alto": 1.2 }, "glb": "estanteria.glb" }
   ```

   Los `.json` antiguos (sin estos campos) siguen funcionando: son muebles de
   suelo y se puede apoyar cosas encima de ellos.
4. Si `npm run dev` está en marcha, la página se recarga sola y el objeto
   aparece en el catálogo. Si no, arráncalo. Al subirlo a `main` se publica solo.

El identificador del objeto es la ruta del `.json` sin extensión (`sofa`, o
`sofas/sofa-3-plazas` si está en una subcarpeta; los muebles reales van en
una carpeta por categoría: `sofas/`, `mesas/`, `sillas/`, `almacenaje/`,
`electronica/`, `iluminacion/` y `pared/`). Es lo que se guarda en las escenas,
así que **no renombres** un `.json` si ya lo usas en escenas guardadas.

### Qué hace la app con el modelo

- Lo **escala** para que mida exactamente lo que dice `dimensiones` (da igual
  en qué unidades se exportara).
- Lo **recoloca** para que su origen quede en el centro de la base, apoyado
  en el suelo.
- El **frente** del objeto debe mirar hacia **+Z** en el modelo (en Blender,
  hacia *-Y*, porque el exportador convierte los ejes). En los objetos de
  pared, la trasera es la cara -Z, que queda pegada a la pared.
- Si el `.json` tiene un error o falta el `.glb`, el objeto no aparece y se
  explica el motivo en la consola del navegador (F12).

### Muebles reales (lotes 1 y 2) y cómo corregir sus medidas

`scripts/catalogo-lote1.mjs` (salón y pasillo, 16 objetos) y
`scripts/catalogo-lote2.mjs` (dormitorio, balcón y tendedero, 10 objetos)
construyen los muebles reales con la librería `scripts/lib/modelo3d.mjs`:
piezas de three.js (tableros, patas, cojines redondeados, brazos enrollados,
celosías, baldas, varillas, pantallas...) colocadas con su posición y giro; al
guardar, todas las piezas de un mismo material se juntan en una sola malla y
se comprueba que la caja envolvente mide lo que dice la ficha, con el origen
en el centro de la base y el frente hacia +Z. Todos tienen menos de 8.000
triángulos y pesan menos de 210 KB.

**Texturas:** un material puede llevar `textura: 'madera'` (veta) o `'tela'`
(tejido). Son imágenes pequeñas en grises (128 y 64 px, generadas por
`scripts/lib/texturas.mjs`) que van dentro del `.glb` y multiplican el color
del material, así que el tono sigue siendo el de la foto. Cada pieza recibe
coordenadas de textura en metros, con la veta a lo largo de su lado más largo.

Todas las medidas son **estimadas** (ver la tabla de
[`docs/OBJETOS.md`](docs/OBJETOS.md)). Para corregir una basta con **editar
el `.json`** (`dimensiones`, y si hace falta `superficies` o `alturaCentro`):
la app estira el modelo a lo que diga la ficha. Volver a ejecutar el script
respeta esas correcciones.

Los modelos se descargan **cuando se añaden** a la escena (no al abrir la
app), y las miniaturas cuando se ve el catálogo.

### Generar objetos por script

`scripts/generar-catalogo.mjs` construye los objetos de ejemplo a base de
cajas y cilindros: la mesa y el armario, y cuatro objetos **provisionales**
de decoración (se sustituirán por los reales): un cuadro de 40 × 30 cm y un
espejo de 60 × 90 cm (pared), un jarrón de 25 cm y una planta en maceta de
45 cm (superficie o suelo). Puedes copiar una de sus funciones para crear
otros objetos sencillos y ejecutar `npm run catalogo:ejemplos`.

## Formato de una escena guardada

```json
{
  "version": 5,
  "vivienda": "Vivienda 2ºA",
  "objetos": [
    { "catalogo": "mesa", "posicion": { "x": 3.1, "y": 0, "z": 1.8 }, "rotacion": 90, "colocacion": "suelo" },
    { "catalogo": "jarron", "posicion": { "x": 3.2, "y": 0.75, "z": 1.7 }, "rotacion": 90,
      "colocacion": "superficie", "soporte": 0, "nivel": 0.75 },
    { "catalogo": "cuadro", "posicion": { "x": 2.0, "y": 1.35, "z": 0.255 }, "rotacion": 0,
      "colocacion": "pared", "pared": "pared:fachada-norte", "estancia": "salon", "altura": 1.5 }
  ],
  "suelos": {
    "salon": { "tipo": "microcemento", "color": "#bcb5aa", "escala": 2 }
  },
  "paredes": { "dormitorio": { "color": "#bfccd6" } },
  "ajustes": {
    "luces": { "encendidas": true, "apagadas": ["bano"] },
    "puertasAbiertas": false,
    "cortinas": true
  }
}
```

`posicion` es el centro de la base del objeto en metros, en las coordenadas de
`vivienda.json`, y `rotacion` el giro alrededor del eje vertical en grados
(positivo = antihorario visto desde arriba). `colocacion` dice cómo está
puesto: en el `"suelo"`, en la `"pared"` (con el muro o pilar donde cuelga,
la estancia a la que mira y la `altura` de su centro) o sobre un mueble
(`"superficie"`, con `soporte` = posición del mueble en la lista, empezando
en 0, y `nivel` = altura de la tapa o balda). `suelos` y `paredes` llevan solo
las estancias cambiadas respecto a `vivienda.json`. `ajustes` guarda los
interruptores: luces (general y estancias apagadas), puertas y cortinas.

**Escenas antiguas** (se migran solas al cargarlas, también el autoguardado):

- **v4** (fase 3b): objetos sin `colocacion`; se cargan en el suelo (y un
  objeto de pared, si lo hubiera, se cuelga en la pared más cercana).
- **v3** (fase 3a): sin `paredes` ni `ajustes`; se cargan con los colores
  originales, luces encendidas, puertas cerradas y cortinas visibles.
- **v2** (fase 2): además, sin `suelos`; se cargan con los suelos originales.
- **v1** (fase 1, o sin versión): las posiciones eran relativas al centro de
  la habitación de ejemplo; se colocan relativas al centro del salón.

Si algún objeto no cabe donde estaba (paredes u otros muebles), se mueve al
sitio libre más cercano; si no cabe en ninguna parte, se omite y se avisa en
el panel. Los suelos y colores de estancias que no existen o mal escritos se
ignoran (también con aviso).

## Tests

`npm test` comprueba, entre otras cosas:

- que el área, el ancho y el fondo del suelo de cada estancia en la escena 3D
  coinciden con su polígono en `vivienda.json`, y que sus coordenadas de
  textura van en metros (escala real);
- que las superficies coinciden con las del plano (±5 % por estancia, ±2 % en total);
- que cada pared 3D mide lo que dice el JSON y tiene sus huecos (volumen exacto),
  y que su altura es la mayor de las estancias que toca;
- que ninguna pared invade el suelo de una estancia y que cada puerta comunica
  dos estancias;
- que los muebles no atraviesan paredes, pilares, puertas, ventanas ni otros
  muebles, que pasan por las puertas solo si caben, y que se avisa si no hay sitio;
- el corte automático de paredes (incluidas las cortas y la barandilla);
- el formato del suelo, los suelos por defecto y la migración de escenas v1, v2 y v3 → v4;
- el formato de los acabados, que **cada pared tiene material en sus dos caras**
  (y que la cara que da a una estancia lleva su pintura o su alicatado), que el
  alicatado del baño llega a 1,10 m y al techo en la ducha, y el cambio de color;
- que **la altura de cada techo coincide con `vivienda.json`** (falso techo de
  2,40 m en cocina y distribuidor) y que ninguna pared queda más baja que su techo;
- el número de focos, puertas abatibles y cortinas, los interruptores de luz y
  que nunca hay más de 3 luces con sombra (1 en el móvil);
- el punto de vista de la vista interior de cada estancia;
- **el catálogo completo** (`tests/catalogo.test.ts`): que todas las fichas
  se leen y tienen modelo y miniatura; que cada `.glb` mide lo que dice su
  `.json` (exacto en los de los lotes 1 y 2), con el origen en el centro de la
  base; menos de 20.000 triángulos, 300 KB y 2 texturas por objeto; la
  colocación de cada mueble; que sofá, sillón, silla, lámpara de pie, cama y
  silla de balcón no admiten nada encima; y que en la app la tele va sobre su
  mueble, la lámpara foco sobre la mesita de alambre, la lámpara de noche sobre
  la mesita y la planta sobre la mesa del balcón;
- **decorar** (`tests/decorar.test.ts`): los campos nuevos del catálogo; colgar
  en paredes sin tapar puertas (con su tapajuntas) ni ventanas, sin solapes y
  sin salirse; la altura; apoyar en tapas y baldas sin salirse ni solaparse;
  que lo apoyado se mueve y gira con el mueble y qué pasa al borrarlo;
  duplicar; guardar y cargar en v5 (y migrar desde v4); deshacer y rehacer
  (más de 50 pasos, cambios seguidos juntos y añadir, mover, girar, borrar,
  colgar y apoyar).

## Publicación

Cada cambio en `main` pasa los tests y se publica solo con GitHub Actions
(`.github/workflows/desplegar.yml`) en **GitHub Pages**:
<https://exequ.github.io/Casa/>. La ruta base de Vite se toma de la variable
`BASE_PATH` (en Pages, `/<nombre-del-repositorio>/`).

Pages tiene que estar activado una vez en el repositorio (el workflow lo
intenta, pero el token de GitHub Actions no tiene permiso para hacerlo):
*Settings → Pages → Build and deployment → Source = **GitHub Actions***.
Mientras no esté activado, el workflow compila y prueba igualmente y se salta
la publicación con un aviso (no falla). Además se ejecuta solo cada hora: en
cuanto Pages esté activado y la web no exista aún, la publica sin esperar al
siguiente cambio.

Alternativa gratuita, **Netlify** (ya está preparado en `netlify.toml`):

1. Entra en <https://app.netlify.com> con tu cuenta de GitHub.
2. *Add new site → Import an existing project → GitHub* y elige este repositorio.
3. Pulsa *Deploy*. No hay que tocar nada más: cada cambio en `main` se publica solo.

(En Cloudflare Pages sería igual: comando `npm run build`, carpeta `dist`.)
