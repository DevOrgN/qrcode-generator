import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const workerPath = path.join(root, 'sw.js');

async function walk(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), relative));
    else if (relative !== 'sw.js') files.push(relative);
  }
  return files;
}

const files = (await walk(root)).sort();
const precache = JSON.stringify(files.map((file) => `./${file}`));
// Content-address the cache generation so activation can retire old assets only
// after the complete new precache has installed successfully.
const hash = createHash('sha256');
for (const file of files) hash.update(file).update(await readFile(path.join(root, file)));
const versionHash = hash.digest('hex').slice(0, 16);
let worker = await readFile(path.join(root, '..', 'public', 'sw.js'), 'utf8');
worker = worker.replace('self.__PRECACHE_URLS__ || []', precache);
worker = worker.replace("`${CACHE_PREFIX}v1`", `\`${'${CACHE_PREFIX}'}${versionHash}\``);
await writeFile(workerPath, worker);
