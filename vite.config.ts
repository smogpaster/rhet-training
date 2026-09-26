import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// Hinweis für das Testen auf der echten Brille: Vite muss im LAN erreichbar sein
// (host: true). Falls Hot-Reload auf der Brille nicht greift, hier zusätzlich
// `hmr: { host: '<deine-LAN-IP>' }` in `server` eintragen.
export default defineConfig({
  plugins: [preact()],
  server: { host: true, port: 5173 },
  build: { target: 'esnext' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
