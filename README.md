# Casa 3D

Herramienta web para diseñar y decorar una casa en 3D. Uso personal: sin
backend ni cuentas, todo funciona en el navegador (también en el móvil).
Todas las medidas están en **metros**, a escala real.

- **Fase 1:** una habitación de ejemplo donde colocar, mover, girar y borrar
  objetos del catálogo, con guardado y carga de la escena.
- **Fase 2 (actual):** la vivienda real (2ºA), sacada de los planos de
  `planos/`: estancias, paredes con sus puertas y ventanas, pilares, selector
  de estancia y modo de comprobación con el plano superpuesto.

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
| `npm run catalogo:ejemplos` | Regenera la mesa y el armario de ejemplo del catálogo |

## Cómo se usa

**Barra superior** (sobre la vista 3D):

- **Selector de estancia:** centra la cámara en una estancia o en toda la vivienda.
- **Planta:** vista desde arriba.
- **Plano:** superpone el plano original (ver [Comprobar con el plano](#comprobar-con-el-plano)).
- **☰** (solo en el móvil): abre el menú con el catálogo, guardar y cargar.

**Ordenador:**

- **Cámara:** arrastrar con el botón izquierdo = girar · rueda = zoom · botón derecho = desplazar.
- **Añadir:** clic en un objeto del catálogo. Aparece en la estancia que se
  está viendo, ya seleccionado.
- **Seleccionar:** clic sobre el objeto. Clic en vacío o `Esc` deselecciona.
- **Mover:** arrastrar el objeto por el suelo.
- **Girar:** `Q` / `E` o los botones ⟲ ⟳ (pasos de 15°). Giro libre con el
  deslizador, escribiendo los grados, o `Mayús + Q/E` (1°).
- **Borrar:** tecla `Supr` (o el botón *Borrar*).

**Móvil:**

- **Cámara:** un dedo = girar · dos dedos = zoom y desplazar.
- **Objetos:** tócalo para seleccionarlo y arrástralo con el dedo. Girar y
  borrar desde la barra inferior que aparece al seleccionarlo.

**Cómo se comportan los muebles:**

- Nunca atraviesan paredes, pilares, puertas ni ventanas: al empujarlos
  contra una pared se quedan pegados a ella y se deslizan a lo largo.
- Pasan de una estancia a otra **por las puertas, solo si caben** (como en la
  realidad). Si se sueltan en mitad de una puerta, se colocan solos en el
  sitio libre más cercano.
- El salón y la cocina abierta son un mismo espacio: se puede poner algo a caballo.
- Si al girar un mueble chocaría con una pared, se aparta lo justo; si no
  cabe girado, no se gira.

**Paredes:** las que tapan la vista se bajan solas a 25 cm (como en un plano).
En la vista de toda la vivienda se quedan en pie solo las del fondo; al elegir
una estancia, las que hay entre la cámara y esa estancia.

**Guardar / Cargar:** descarga la escena como `escena.json` o abre una
guardada. Además, cada cambio se **autoguarda** en el navegador
(`localStorage`) y se recupera al volver a abrir la app.

## Estructura del proyecto

```
data/vivienda.json        La vivienda: estancias, paredes con huecos, pilares
planos/                   Planos originales (plano-original.png) y el recorte que se superpone (plano.jpg)
catalogo/                 Objetos del catálogo: un .json + un .glb por objeto
scripts/
  digitalizar-plano.mjs   Medidas tomadas del plano (en píxeles) → data/vivienda.json
  generar-catalogo.mjs    Crea los objetos de ejemplo del catálogo
tests/                    Tests automáticos (Vitest)
src/main.ts               Punto de entrada: une todas las piezas
src/vivienda/             Datos y geometría en planta (sin 3D)
  modelo.ts               Formato de vivienda.json y su validación
  geometria.ts            Áreas, puntos en polígonos, cruces de segmentos...
  espacio.ts              Dónde caben los muebles (paredes, puertas, pilares)
src/escena/               Todo lo 3D
  escena.ts               Renderizador, cámara orbital, luces y encuadres
  vivienda3d.ts           Suelos, paredes con huecos y pilares a partir del JSON
  corte.ts                Bajar las paredes que tapan la vista
  etiquetas.ts            Nombre, superficie y altura de techo de cada estancia
  plano.ts                Plano original superpuesto (modo comprobación)
  objetos.ts              Objetos colocados: añadir, mover, girar, borrar, seleccionar
  interaccion.ts          Ratón, dedo y teclado sobre la escena 3D
  persistencia.ts         Guardar/cargar JSON, autoguardado y migración de escenas
src/catalogo/
  catalogo.ts             Lee las fichas .json del catálogo
  modelos.ts              Carga los .glb y los ajusta a sus medidas reales
src/ui/
  panel.ts                Panel lateral (cajón en el móvil)
  barra.ts                Barra superior y barra del objeto seleccionado (móvil)
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
      "poligono": [[0.86, 0.23], [5.93, 0.23], [5.93, 2.84], ...]
    }
  ],
  "paredes": [
    {
      "id": "salon-este",
      "desde": [6.0, 0.05],            // extremos del EJE CENTRAL de la pared
      "hasta": [6.0, 2.84],
      "grosor": 0.14,                  // la pared ocupa grosor/2 a cada lado del eje
      "alto": 2.5,                     // opcional (por defecto, alturaTecho)
      "huecos": [
        {
          "tipo": "puerta",            // "puerta" o "ventana"
          "nombre": "Puerta del salón",
          "distancia": 1.83,           // desde el punto "desde" hasta el borde del hueco
          "ancho": 0.81,
          "alto": 2.05,
          "alfeizar": 0                // altura del antepecho (0 en puertas)
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
4. Si `npm run dev` está en marcha, la página se recarga sola y el objeto
   aparece en el catálogo. Si no, arráncalo. Al subirlo a `main` se publica solo.

El identificador del objeto es la ruta del `.json` sin extensión (`sofa`, o
`salon/sofa` si está en una subcarpeta). Es lo que se guarda en las escenas,
así que **no renombres** un `.json` si ya lo usas en escenas guardadas.

### Qué hace la app con el modelo

- Lo **escala** para que mida exactamente lo que dice `dimensiones` (da igual
  en qué unidades se exportara).
- Lo **recoloca** para que su origen quede en el centro de la base, apoyado
  en el suelo.
- El **frente** del objeto debe mirar hacia **+Z** en el modelo (en Blender,
  hacia *-Y*, porque el exportador convierte los ejes).
- Si el `.json` tiene un error o falta el `.glb`, el objeto no aparece y se
  explica el motivo en la consola del navegador (F12).

### Generar objetos por script

`scripts/generar-catalogo.mjs` construye la mesa y el armario de ejemplo a
base de cajas. Puedes copiar una de sus funciones (`mesa()` o `armario()`)
para crear otros objetos sencillos y ejecutar `npm run catalogo:ejemplos`.

## Formato de una escena guardada

```json
{
  "version": 2,
  "vivienda": "Vivienda 2ºA",
  "objetos": [
    { "catalogo": "mesa", "posicion": { "x": 3.1, "y": 0, "z": 1.8 }, "rotacion": 90 }
  ]
}
```

`posicion` es el centro de la base del objeto en metros, en las coordenadas de
`vivienda.json`, y `rotacion` el giro alrededor del eje vertical en grados
(positivo = antihorario visto desde arriba).

**Escenas de la fase 1** (`"version": 1` o sin versión): sus posiciones eran
relativas al centro de la habitación de ejemplo. Al cargarlas se colocan
relativas al centro del salón y, si algún objeto no cabe donde cae, se mueve
al sitio libre más cercano. Igual con el autoguardado antiguo.

## Tests

`npm test` comprueba, entre otras cosas:

- que el área, el ancho y el fondo del suelo de cada estancia en la escena 3D
  coinciden con su polígono en `vivienda.json`;
- que las superficies coinciden con las del plano (±5 % por estancia, ±2 % en total);
- que cada pared 3D mide lo que dice el JSON y tiene sus huecos (volumen exacto);
- que ninguna pared invade el suelo de una estancia y que cada puerta comunica
  dos estancias;
- que los muebles no atraviesan paredes, pilares, puertas ni ventanas, que
  pasan por las puertas solo si caben, y la migración de escenas de la fase 1.

## Publicación

Cada cambio en `main` pasa los tests y se publica solo con GitHub Actions
(`.github/workflows/desplegar.yml`) en GitHub Pages. La ruta base de Vite se
toma de la variable `BASE_PATH` (en Pages, `/<nombre-del-repositorio>/`).

GitHub Pages en un **repositorio privado** necesita un plan de pago de GitHub.
Alternativa gratuita más sencilla, **Netlify** (ya está preparado en
`netlify.toml`):

1. Entra en <https://app.netlify.com> con tu cuenta de GitHub.
2. *Add new site → Import an existing project → GitHub* y elige este repositorio.
3. Pulsa *Deploy*. No hay que tocar nada más: cada cambio en `main` se publica solo.

(En Cloudflare Pages sería igual: comando `npm run build`, carpeta `dist`.)
