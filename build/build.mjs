// 빌드 스크립트: main / preload / renderer를 각각 묶고, 정적 파일을 dist로 복사한다.
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'main'), { recursive: true });
mkdirSync(join(dist, 'renderer'), { recursive: true });

const common = { bundle: true, sourcemap: true, logLevel: 'info' };

await build({
  ...common,
  entryPoints: [join(root, 'src/main/main.ts')],
  outfile: join(dist, 'main/main.js'),
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
});

await build({
  ...common,
  entryPoints: [join(root, 'src/main/preload.ts')],
  outfile: join(dist, 'main/preload.js'),
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
});

await build({
  ...common,
  entryPoints: [join(root, 'src/renderer/app.ts')],
  outfile: join(dist, 'renderer/app.js'),
  platform: 'browser',
  format: 'esm',
});

// 정적 파일
cpSync(join(root, 'src/renderer/index.html'), join(dist, 'renderer/index.html'));
cpSync(join(root, 'src/renderer/styles.css'), join(dist, 'renderer/styles.css'));
const pdfjsDir = dirname(require.resolve('pdfjs-dist/package.json'));
cpSync(join(pdfjsDir, 'build/pdf.worker.min.mjs'), join(dist, 'renderer/pdf.worker.min.mjs'));
cpSync(join(pdfjsDir, 'web/pdf_viewer.css'), join(dist, 'renderer/pdf_viewer.css'));
cpSync(join(pdfjsDir, 'cmaps'), join(dist, 'renderer/cmaps'), { recursive: true });
cpSync(join(pdfjsDir, 'standard_fonts'), join(dist, 'renderer/standard_fonts'), { recursive: true });
const sqlDir = dirname(require.resolve('sql.js/package.json'));
cpSync(join(sqlDir, 'dist/sql-wasm.wasm'), join(dist, 'main/sql-wasm.wasm'));
