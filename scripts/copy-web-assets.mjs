import { copyFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const webDir = resolve('www');
const webFiles = [
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest',
  'icon.svg'
];

await rm(webDir, { recursive: true, force: true });
await mkdir(webDir, { recursive: true });

for (const file of webFiles) {
  await copyFile(resolve(file), resolve(webDir, file));
}

console.log(`Android-webbestanden klaargezet in ${webDir}`);
