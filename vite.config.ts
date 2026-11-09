import { defineConfig } from 'vite';

// Configuración mínima de Vite.
export default defineConfig({
  server: { port: 5173, open: false },
  // Three.js ocupa ~600 kB; es normal en una app 3D local, así que subimos el aviso.
  build: { chunkSizeWarningLimit: 1000 },
});
