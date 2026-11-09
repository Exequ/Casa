# Casa 3D

Herramienta web local para diseñar y decorar una casa en 3D. Uso personal: sin
backend ni cuentas, todo funciona en el navegador. Todas las medidas están en
**metros**, a escala real.

**Fase 1 (actual):** una habitación en 3D donde colocar, mover, girar y borrar
objetos del catálogo, con guardado y carga de la escena.

## Cómo ejecutarlo

Necesitas [Node.js](https://nodejs.org) 20 o superior.

```bash
npm install      # solo la primera vez
npm run dev      # arranca la app
```

Abre <http://localhost:5173> en el navegador.

Otros comandos:

| Comando | Qué hace |
| --- | --- |
| `npm run build` | Comprueba los tipos y genera la versión final en `dist/` |
| `npm run preview` | Sirve la versión de `dist/` para probarla |
| `npm run comprobar` | Solo comprueba los tipos de TypeScript |
| `npm run catalogo:ejemplos` | Regenera la mesa y el armario de ejemplo del catálogo |

## Cómo se usa

- **Cámara:** arrastrar con el botón izquierdo = girar · rueda = zoom · botón
  derecho = desplazar. Las paredes que quedan entre la cámara y la habitación
  se ocultan solas para ver siempre el interior.
- **Añadir:** clic en un objeto del catálogo (panel izquierdo). Aparece en el
  centro de la habitación, ya seleccionado.
- **Seleccionar:** clic sobre el objeto. Clic en vacío o `Esc` deselecciona.
- **Mover:** arrastrar el objeto; se desliza por el suelo y no atraviesa las paredes.
- **Girar:** `Q` / `E` o los botones ⟲ ⟳ giran en pasos de 15°. Giro libre
  con el deslizador, escribiendo los grados, o `Mayús + Q/E` (1°).
- **Borrar:** tecla `Supr` (o el botón *Borrar*).
- **Guardar / Cargar:** descarga la escena como `escena.json` o abre una
  guardada. Además, cada cambio se **autoguarda** en el navegador
  (`localStorage`) y se recupera al volver a abrir la app.

## Estructura del proyecto

```
data/habitacion.json      Medidas de la habitación (ancho, largo, alto)
catalogo/                 Objetos del catálogo: un .json + un .glb por objeto
scripts/                  generar-catalogo.mjs: crea los objetos de ejemplo
src/main.ts               Punto de entrada: une todas las piezas
src/escena/
  escena.ts               Renderizador, cámara orbital, luces y sombras
  habitacion.ts           Suelo, paredes y límites de la habitación
  objetos.ts              Objetos colocados: añadir, mover, girar, borrar, seleccionar
  interaccion.ts          Ratón y teclado sobre la escena 3D
  persistencia.ts         Guardar/cargar JSON y autoguardado
src/catalogo/
  catalogo.ts             Lee las fichas .json del catálogo
  modelos.ts              Carga los .glb y los ajusta a sus medidas reales
src/ui/
  panel.ts                Panel lateral
  estilos.css             Estilos
```

### Coordenadas

El origen es el centro del suelo. **X** va a lo ancho, **Z** a lo largo e
**Y** hacia arriba. La habitación ocupa de `-ancho/2` a `+ancho/2` en X y de
`-largo/2` a `+largo/2` en Z.

## La habitación

Edita `data/habitacion.json`:

```json
{
  "nombre": "Habitación de ejemplo",
  "ancho": 4,
  "largo": 3.5,
  "alto": 2.5
}
```

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
   aparece en el catálogo. Si no, arráncalo.

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
  "version": 1,
  "objetos": [
    { "catalogo": "mesa", "posicion": { "x": 0.5, "y": 0, "z": -1 }, "rotacion": 90 }
  ]
}
```

`posicion` es el centro de la base del objeto en metros y `rotacion` el giro
alrededor del eje vertical en grados (positivo = antihorario visto desde arriba).
