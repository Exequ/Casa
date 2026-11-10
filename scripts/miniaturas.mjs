// Miniaturas PNG (128 px) de los objetos del catálogo, para el panel.
//
// Uso:  npm run catalogo:miniaturas                 (todas)
//       npm run catalogo:miniaturas -- sofas/sillon (solo esas)
//       npm run catalogo:miniaturas -- --vistas carpeta   (además, 3 vistas grandes
//                 de cada objeto: frente, lado y 3/4 desde atrás, para revisarlos)
//
// Dibuja cada .glb con three.js en un Chromium sin ventana (Playwright) y
// guarda <objeto>.png junto a su .json. Necesita Playwright instalado
// (npx playwright install chromium, si no lo está).

import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOGO = join(RAIZ, 'catalogo');
const THREE_DIR = join(RAIZ, 'node_modules', 'three');
const args = process.argv.slice(2);
const iVistas = args.indexOf('--vistas');
const carpetaVistas = iVistas >= 0 ? args[iVistas + 1] : null;
const filtro = args.filter((a, i) => !a.startsWith('--') && (iVistas < 0 || i !== iVistas + 1));

const { chromium } = createRequire(import.meta.url)('playwright');

/** Todas las fichas .json del catálogo (ruta sin extensión, relativa a catalogo/). */
function fichas(dir = CATALOGO) {
  const r = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) r.push(...fichas(p));
    else if (f.endsWith('.json')) r.push(relative(CATALOGO, p).replace(/\.json$/, ''));
  }
  return r.sort();
}

const PAGINA = `<!doctype html><html><body style="margin:0">
<script type="importmap">{ "imports": { "three": "/three/build/three.module.js", "three/addons/": "/three/examples/jsm/" } }</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.append(renderer.domElement);
const escena = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
escena.environmentIntensity = 0.6;
escena.add(new THREE.HemisphereLight(0xffffff, 0xb9a48f, 1.1));
const sol = new THREE.DirectionalLight(0xffffff, 2.2);
sol.position.set(2, 4, 3);
escena.add(sol);
const VISTAS = {
  miniatura: [0.9, 0.75, 1.6],
  frente: [0, 0.18, 1],
  lado: [1, 0.18, 0],
  atras: [-0.9, 0.6, -1.3],
};
window.dibujar = async (url, vista, lado, fondo) => {
  const gltf = await new GLTFLoader().loadAsync(url);
  const modelo = gltf.scene;
  escena.add(modelo);
  const caja = new THREE.Box3().setFromObject(modelo);
  const centro = caja.getCenter(new THREE.Vector3());
  const radio = caja.getSize(new THREE.Vector3()).length() / 2;
  const camara = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  const dir = new THREE.Vector3(...VISTAS[vista]).normalize();
  camara.position.copy(centro).addScaledVector(dir, (radio / Math.sin(THREE.MathUtils.degToRad(15))) * 1.02);
  camara.lookAt(centro);
  renderer.setPixelRatio(2);
  renderer.setSize(lado, lado);
  renderer.setClearColor(fondo ?? 0x000000, fondo === null ? 0 : 1);
  // Vistas de comprobación: cuadrícula de 10 cm en el suelo y una flecha roja hacia el frente (+Z)
  let suelo = null;
  if (fondo !== null) {
    suelo = new THREE.Group();
    suelo.add(new THREE.GridHelper(4, 40, 0xbbbbbb, 0xd6d6d6));
    suelo.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.003, 0), Math.max(0.3, radio * 1.3), 0xd03030, 0.08, 0.05));
    escena.add(suelo);
  }
  renderer.render(escena, camara);
  // Reducción a "lado" px con buena calidad
  const c = document.createElement('canvas');
  c.width = c.height = lado;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(renderer.domElement, 0, 0, lado, lado);
  escena.remove(modelo);
  if (suelo) escena.remove(suelo);
  return c.toDataURL('image/png');
};
window.listo = true;
</script></body></html>`;

const navegador = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pagina = await navegador.newPage();
const TIPOS = { '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.html': 'text/html' };
await pagina.route('http://miniaturas.local/**', (ruta) => {
  const camino = decodeURIComponent(new URL(ruta.request().url()).pathname);
  let archivo = null;
  if (camino === '/') return ruta.fulfill({ body: PAGINA, contentType: 'text/html' });
  if (camino.startsWith('/three/')) archivo = join(THREE_DIR, camino.slice('/three/'.length));
  else if (camino.startsWith('/catalogo/')) archivo = join(CATALOGO, camino.slice('/catalogo/'.length));
  if (!archivo || !existsSync(archivo)) return ruta.fulfill({ status: 404, body: 'no' });
  return ruta.fulfill({ body: readFileSync(archivo), contentType: TIPOS[extname(archivo)] ?? 'application/octet-stream' });
});
pagina.on('pageerror', (e) => console.error('Error en la página:', e.message));
await pagina.goto('http://miniaturas.local/');
await pagina.waitForFunction(() => window.listo === true);

const guardarPng = (ruta, dataUrl) => {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, Buffer.from(dataUrl.split(',')[1], 'base64'));
};

for (const ruta of fichas()) {
  if (filtro.length && !filtro.includes(ruta)) continue;
  const ficha = JSON.parse(readFileSync(join(CATALOGO, `${ruta}.json`), 'utf8'));
  const glb = join(dirname(ruta), ficha.glb).replaceAll('\\', '/');
  const url = `http://miniaturas.local/catalogo/${glb}`;
  guardarPng(join(CATALOGO, `${ruta}.png`), await pagina.evaluate(([u]) => window.dibujar(u, 'miniatura', 128, null), [url]));
  console.log(`✔ catalogo/${ruta}.png`);
  if (carpetaVistas) {
    for (const vista of ['frente', 'lado', 'atras']) {
      const png = await pagina.evaluate(([u, v]) => window.dibujar(u, v, 360, 0xf2f2f2), [url, vista]);
      guardarPng(join(carpetaVistas, `${ruta.replaceAll('/', '_')}-${vista}.png`), png);
    }
  }
}
await navegador.close();
