import { defineConfig } from 'vite';

// Configuración de Vite.
// BASE_PATH es la ruta donde se publica la app. En GitHub Pages es
// "/<nombre-del-repositorio>/" (lo pone el workflow de despliegue); en local,
// Netlify o Cloudflare Pages es "/".
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  server: { port: 5173, open: false },
  // Three.js ocupa ~600 kB; es normal en una app 3D local, así que subimos el aviso.
  build: { chunkSizeWarningLimit: 1000 },
  test: { include: ['tests/**/*.test.ts'] },
});
