# Estado del proyecto

Última actualización: 9 de noviembre de 2026, tras las fases 2.5 (pendientes de
la fase 2) y 3a (suelos). El detalle de la fase 2 (medidas del plano,
suposiciones, comprobaciones) sigue en [RESUMEN_FASE2.md](RESUMEN_FASE2.md).

**App:** <https://exequ.github.io/Casa/>, cuando GitHub Pages esté activado (ver
"Despliegue" más abajo). Copia en claude.ai, siempre disponible para el
propietario: <https://claude.ai/artifact/FBiLfRAKuNSTwtNVXf9xfi>.

---

## Fase 2.5: pendientes de la fase 2

| # | Pendiente | Estado | Detalle |
|---|---|---|---|
| 1 | Despliegue automático con GitHub Pages | **Preparado; falta un ajuste manual** | El repositorio ya es público. El workflow `desplegar.yml` publica en Pages en cada merge a `main` y ahora intenta activar Pages por la API, pero el token de GitHub Actions no tiene permiso (probado: se salta). Hay que activar *Settings → Pages → Source = GitHub Actions* una vez. Después, una ejecución programada cada hora publica la web si aún no existe, sin esperar a otro merge. |
| 2 | Choques entre muebles | **Hecho** | Ningún mueble puede solaparse con otro al arrastrarlo (se queda pegado), girarlo (se aparta lo justo o no gira) ni añadirlo. Al añadir, va al sitio libre más cercano al centro de la estancia elegida en la barra superior (o del salón), buscando en toda la casa. Si no cabe en ninguna parte, se avisa arriba del panel. Al cargar escenas con muebles superpuestos, se separan; los que no caben se omiten con aviso. |
| 3 | Altura de techo de cada estancia → altura de sus paredes | **Hecho** | Cada pared mide la mayor altura de techo de las estancias que toca (las detecta por geometría: lados de estancia pegados a sus caras). Las paredes con `alto` propio (barandilla) lo conservan; los pilares toman la mayor de las estancias que rodean. La validación de huecos usa esta altura. Con test. |
| 4 | Mejor corte automático de paredes | **Hecho** | Nueva regla de la "sombra": se calcula qué franja de suelo tapa cada pared vista desde la cámara y se baja si tapa suelo de la vivienda (en la vista de una estancia, si tapa el suelo de esa estancia o queda entre la cámara y ella). Ahora se bajan los laterales del armario empotrado y, al mirar el balcón, la barandilla de delante. Con tests. |
| 5 | Rendimiento en el móvil | **Hecho** | Medido (ver abajo). En pantallas táctiles o pequeñas: sombras de 1024 px (antes 4096) y como mucho 1,5 píxeles por punto. En el ordenador: sombras de 2048 px. Se puede forzar con `?calidad=ligera|normal|alta`. |
| 6 | Documentación | **Hecho** | Este archivo, README actualizado y nota en `RESUMEN_FASE2.md`. |

### Medida de fps

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

## Fase 3a: suelos

| # | Requisito | Estado | Detalle |
|---|---|---|---|
| 1 | Campo opcional `suelo` por estancia (tipo + color + escala en metros por repetición), documentado | **Hecho** | `"suelo": { "tipo": "tarima", "color": "#5c3b26", "escala": 2.4 }`. Tipos: `tarima`, `baldosa`, `marmol`, `microcemento`, `terrazo`, `exterior`. Validado al cargar. Documentado en el README. **No admite imagen de textura** (solo color + tipo), ver decisiones. |
| 2 | Valores por defecto | **Hecho** | Tarima de nogal oscuro en salón, dormitorio y distribuidor; mármol blanco en baño, cocina y tendedero; gres de exterior en el balcón. Están escritos en `vivienda.json` y hay un respaldo en código para estancias sin `suelo`. |
| 3 | Texturas con escala real y coordenadas UV en planta | **Hecho** | Texturas procedurales dibujadas con `<canvas>` (512 × 512 px, repetibles sin costuras, 0 KB en el repositorio). Las coordenadas de textura del suelo son la posición en planta en metros, así que no se deforman en polígonos irregulares; la textura se repite 1/escala veces por metro. Con test. |
| 4 | Selector de suelo con vista previa, guardado en la escena (v3, migración desde v2) | **Hecho** | Panel → *Suelo* (en el móvil, menú ☰): desplegable de estancia (sigue a la barra superior) y 8 suelos con vista previa de 1,2 × 1,2 m reales: 3 tarimas, mármol, porcelánico, microcemento, terrazo y gres de exterior. Botón *Volver al original*. Escena v3 con `suelos` (solo los cambiados); v1 y v2 se migran; autoguardado y recarga restauran los suelos. |
| 5 | Tests y pruebas en navegador con capturas de cada estancia | **Hecho** | Ver "Comprobaciones". |

---

## Comprobaciones

- **`npm test`: 108 tests, todos pasan.** Nuevos en estas fases:
  - suelos: formato, suelos por defecto, área de cada suelo, coordenadas de textura en metros;
  - migración v1 → v3, v2 → v3 y v3;
  - altura de paredes y pilares con alturas de techo distintas, también en la geometría 3D;
  - corte de paredes: fachadas del fondo en pie, paredes que tapan bajadas, laterales del armario, barandilla, vista cenital;
  - choques entre muebles: solape, contacto, arrastre, giro, sitio libre y casa llena.
- **`npm run build`** sin errores.
- **Navegador automático, escritorio (1400 × 860), 43 comprobaciones, todas bien:**
  - suelos con textura en las 7 estancias;
  - dos mesas sin solaparse al añadirlas, al arrastrar una contra otra y al girarla;
  - aviso cuando no hay sitio;
  - cambio de suelo en cada estancia desde el panel, con captura de cada una, y *Volver al original*;
  - recarga (muebles y suelos);
  - Guardar (v3);
  - cargar escenas v2 (mesas superpuestas que se separan; suelos originales), v3 (suelos aplicados y aviso de un suelo de una estancia inexistente) y v1;
  - plano superpuesto;
  - clic + Supr;
  - sin errores en consola.
  - La batería de la fase 2 (18 comprobaciones) también pasa.
- **Navegador automático, móvil (iPhone 13 emulado, toques reales), 13 comprobaciones, todas bien:**
  - calidad ligera;
  - dos mesas sin solaparse;
  - girar y arrastrar con el dedo;
  - cambiar el suelo de las 7 estancias desde el menú, con captura de cada una;
  - recarga;
  - sin errores.
- **Revisión de capturas:** corregí lo que se veía mal:
  - la tarima parecía ladrillo: ahora tiene tablas de 0,8–1,6 m;
  - las vetas del mármol eran demasiado marcadas;
  - las etiquetas de estancia se pintaban encima de la barra superior en el móvil;
  - la barandilla tapaba el suelo del balcón;
  - las estancias pequeñas se encuadraban demasiado cerca.

---

## Problemas conocidos y limitaciones

- **GitHub Pages:** no está activado y no puedo activarlo desde aquí. Hasta
  que se active, la única URL que funciona es la de claude.ai, que **no se
  actualiza sola** con cada cambio.
- Los **fps** se midieron sin GPU: no sé los fps reales en un móvil de verdad.
  Tampoco he probado en un móvil o tableta reales, ni en Safari o Firefox.
- Los **suelos no admiten una imagen de textura propia**, solo los 6 dibujos
  procedurales con cualquier color y escala. Las texturas procedurales se ven
  bien de lejos, pero no son fotorrealistas: no hay relieve ni brillo variable.
- La **orientación de la tarima** es siempre a lo largo del eje x del plano (no
  se puede girar por estancia).
- Al **añadir** un mueble se busca sitio en toda la casa: si la estancia elegida
  está llena, puede aparecer en otra estancia (lo más cerca posible).
- El **corte de paredes** sigue siendo una heurística: en algunos ángulos puede
  quedar una pared que tapa un poco o bajarse una que no molesta.
- Las **escenas antiguas** con muebles superpuestos se cargan separándolos, así
  que algún mueble puede cambiar de sitio respecto a como se guardó.
- **Sigue igual que en la fase 2:**
  - alturas de puertas y ventanas supuestas;
  - sin techos ni carpintería;
  - "Guardar" dentro de claude.ai solo probado con un visor simulado.

---

## Decisiones que tomé por mi cuenta

- **Texturas procedurales** en lugar de imágenes CC0: pesan 0 KB, no dependen
  de la red (que aquí no permite descargar de ambientCG/Poly Haven de forma
  fiable) y no hay licencias que anotar. Por eso el campo `suelo` es tipo +
  color + escala, sin imagen.
- **Tarima con escala 2,4 m** (tablas de 20 cm × 0,8–1,6 m) y baldosas de 60 cm
  (mármol y porcelánico) o de 33 cm (exterior).
- **8 suelos** en el selector: 3 tarimas (nogal, roble, ceniza), mármol blanco,
  porcelánico gris, microcemento, terrazo y gres de exterior.
- La escena v3 guarda **solo los suelos cambiados**; los demás salen de `vivienda.json`.
- **Calidad automática** según la pantalla (táctil o pequeña → ligera), con
  posibilidad de forzarla por la dirección.
- **Altura de pared = máxima** de las estancias que toca, para toda la pared
  (no se parte en tramos).
- Al **añadir**, el centro de referencia es la estancia elegida en la barra
  superior; si es "Toda la vivienda", el salón.
- **Workflow de despliegue con ejecución programada cada hora**, para publicar
  en cuanto se active Pages sin depender de otro merge.

---

## Qué falta: fase 3b y siguientes

1. **Paredes:** material por cara, porque un tabique tiene dos caras que dan a
   estancias distintas. Por ejemplo, azulejo en baño y cocina.
2. **Carpintería:**
   - marcos y hojas de puertas;
   - perfiles de ventanas;
   - rodapiés.
3. **Luces:**
   - entorno (`RoomEnvironment`);
   - luz natural por las ventanas reales;
   - puntos de luz por estancia;
   - vigilar los fps con la calidad ligera.
4. **Techos** opcionales al mirar una estancia.
5. Mejoras pendientes:
   - suelos con imagen propia y giro de la tarima por estancia;
   - más objetos en el catálogo.
