import { cp, mkdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';

const outDir = 'out';

await rm(outDir, { recursive: true, force: true });
await mkdir(`${outDir}/renderer`, { recursive: true });

const common = {
  bundle: true,
  sourcemap: true,
  logLevel: 'info',
  legalComments: 'none',
};

// Electron main process — CommonJS, electron is provided by the runtime.
await build({
  ...common,
  entryPoints: ['src/main/index.ts'],
  outfile: `${outDir}/main.cjs`,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron'],
});

// Preload — CommonJS, contextBridge + ipcRenderer.
await build({
  ...common,
  entryPoints: ['src/preload/index.ts'],
  outfile: `${outDir}/preload.cjs`,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron'],
});

// Renderer — обычный браузерный IIFE, парсер бандлится внутрь.
await build({
  ...common,
  entryPoints: ['src/renderer/src/main.ts'],
  outfile: `${outDir}/renderer/renderer.js`,
  platform: 'browser',
  format: 'iife',
  target: 'chrome120',
});

await cp('src/renderer/index.html', `${outDir}/renderer/index.html`);
await cp('src/renderer/src/style.css', `${outDir}/renderer/style.css`);

console.log('Build complete: out/');
