import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep this static site self-contained: no runtime CDN or framework dependency.
const version = '1.7.1';
const entry = fileURLToPath(import.meta.resolve('morphicons/dom'));
const source = path.dirname(entry);
const destination = fileURLToPath(new URL(`../assets/vendor/morphicons-${version}/`, import.meta.url));
const manifest = JSON.parse(await readFile(path.join(source, '..', 'package.json'), 'utf8'));
if (manifest.version !== version) throw new Error(`Expected morphicons ${version}`);
await mkdir(destination, { recursive: true });

const copied = new Set();
async function copyModule(name) {
  if (copied.has(name)) return;
  if (path.basename(name) !== name || !name.endsWith('.js')) throw new Error(`Unexpected module: ${name}`);
  copied.add(name);
  const code = await readFile(path.join(source, name), 'utf8');
  for (const match of code.matchAll(/(?:from\s+|import\s+)["']\.\/([^"']+)["']/g)) {
    await copyModule(match[1]);
  }
  await copyFile(path.join(source, name), path.join(destination, name));
}

await copyModule(path.basename(entry));
await copyFile(path.join(source, '..', 'LICENSE'), path.join(destination, 'LICENSE'));
console.log(`Vendored morphicons ${version}: ${[...copied].join(', ')}`);
