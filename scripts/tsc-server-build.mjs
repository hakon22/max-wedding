import { execFileSync } from 'child_process';
import {
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const require = createRequire(import.meta.url);

const base = JSON.parse(readFileSync(join(root, 'tsconfig.json'), 'utf8'));
const merged = {
  ...base,
  include: ['server/**/*.ts', 'shared/**/*.ts'],
  exclude: ['node_modules', 'server/**/*.test.ts'],
  compilerOptions: {
    ...base.compilerOptions,
    noEmit: false,
    incremental: false,
    outDir: 'dist',
    rootDir: '.',
    module: 'ESNext',
    moduleResolution: 'Node',
    jsx: 'preserve',
    plugins: [],
  },
};

const tmp = join(root, '.tsconfig.server-emit.json');
writeFileSync(tmp, `${JSON.stringify(merged, null, 2)}\n`);

const tscJs = join(
  dirname(require.resolve('typescript/package.json')),
  'lib/tsc.js',
);
const tscAliasJs = join(
  dirname(require.resolve('tsc-alias/package.json')),
  'dist/bin/index.js',
);

try {
  execFileSync(process.execPath, [tscJs, '-p', tmp], {
    cwd: root,
    stdio: 'inherit',
  });
  execFileSync(process.execPath, [tscAliasJs, '-p', tmp], {
    cwd: root,
    stdio: 'inherit',
  });
} finally {
  for (const f of [tmp, `${tmp.slice(0, -5)}.tsbuildinfo`]) {
    if (existsSync(f)) unlinkSync(f);
  }
}
