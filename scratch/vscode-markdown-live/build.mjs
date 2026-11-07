import { build } from 'esbuild'

await Promise.all([
  build({ entryPoints: ['src/extension.cjs'], bundle: true, platform: 'node', format: 'cjs', external: ['vscode'], outfile: 'dist/extension.js', sourcemap: true }),
  build({ entryPoints: ['src/editor.js'], bundle: true, platform: 'browser', format: 'iife', outfile: 'dist/editor.js', sourcemap: true }),
])
