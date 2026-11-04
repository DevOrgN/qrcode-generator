import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let executable;
try {
  // Never require('electron'): some cached versions download on import.
  const packageRoot = path.dirname(createRequire(import.meta.url).resolve('electron/package.json'));
  const relative = readFileSync(path.join(packageRoot, 'path.txt'), 'utf8').trim();
  const candidate = path.resolve(packageRoot, 'dist', relative);
  if (relative && existsSync(candidate)) executable = candidate;
} catch { /* A system installation may be available instead. */ }
if (!executable && process.platform === 'linux') {
  executable = [ ...[42, 43, 44, 41, 40, 39].map(version => `/usr/lib/electron${version}/electron`), '/usr/bin/electron']
    .find(candidate => existsSync(candidate));
}
if (!executable) {
  console.error('No installed Electron runtime found. Use the web app or install Electron separately.');
  process.exit(1);
}
if (!existsSync(path.join(root, 'dist/index.html'))) {
  console.error('Build the application first with npm run build.');
  process.exit(1);
}
const offlineSmoke = process.argv.includes('--offline-smoke');
const smoke = process.argv.includes('--smoke') || offlineSmoke;
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
delete environment.ELECTRON_FORCE_IS_PACKAGED;
const args = [smoke ? path.join(root, offlineSmoke ? 'scripts/offline-smoke.cjs' : 'scripts/smoke.cjs') : root];
if (smoke && process.platform === 'linux') args.unshift('--ozone-platform=x11', '--disable-gpu');
if (smoke && process.argv.includes('--screenshots')) args.push('--screenshots');
const child = spawn(executable, args, {
  cwd: root, env: environment, stdio: 'inherit',
});
child.on('error', () => { console.error('Could not launch the installed Electron runtime.'); process.exit(1); });
child.on('exit', code => process.exit(code ?? 1));
