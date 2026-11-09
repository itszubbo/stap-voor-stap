import { copyFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const webDir = resolve('www');
const webFiles = [
  'index.html',
  'styles.css',
  'app.js',
  'client-suite.js',
  'client-suite.css',
  'firebase-config.js',
  'service-worker.js',
  'manifest.webmanifest',
  'icon.svg'
];

await rm(webDir, { recursive: true, force: true });
await mkdir(webDir, { recursive: true });

for (const file of webFiles) {
  await copyFile(resolve(file), resolve(webDir, file));
}

await build({
  entryPoints: ['native-notifications-entry.mjs'],
  outfile: resolve(webDir, 'native-notifications.js'),
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: ['es2020'],
  legalComments: 'none'
});

console.log(`Webbestanden en Android-meldingen klaargezet in ${webDir}`);
