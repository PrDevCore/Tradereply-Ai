import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(projectRoot, 'extension', 'src');
const outputDir = path.join(projectRoot, 'dist-extension');
const requiredFiles = [
  'manifest.json', 'background.js', 'content.js', 'content.css',
  'popup.html', 'popup.js', 'options.html', 'options.js', 'README.md',
  'icon16.png', 'icon32.png', 'icon48.png', 'icon128.png',
];

function normalizeApiOrigin(value: string): string {
  let origin: URL;
  try {
    origin = new URL(value.trim());
  } catch {
    throw new Error('API origin must be an absolute URL, for example http://localhost:3000');
  }
  if (!['http:', 'https:'].includes(origin.protocol)) {
    throw new Error('API origin must use http or https');
  }
  if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) {
    throw new Error('Non-local API origins must use HTTPS');
  }
  if (origin.search || origin.hash || (origin.pathname && origin.pathname !== '/')) {
    throw new Error('API origin must not include a path, query string, or fragment');
  }
  return origin.origin;
}

const apiOrigin = normalizeApiOrigin(process.argv[2] || process.env.TRADEREPLY_API_ORIGIN || 'http://localhost:3000');
const token = '__TRADEREPLY_API_ORIGIN__';

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const fileName of requiredFiles) {
  const sourcePath = path.join(sourceDir, fileName);
  if (fileName.endsWith('.png')) {
    writeFileSync(path.join(outputDir, fileName), readFileSync(sourcePath));
    continue;
  }
  const source = readFileSync(sourcePath, 'utf8');
  const output = source.replaceAll(token, apiOrigin);
  writeFileSync(path.join(outputDir, fileName), output, 'utf8');
}

const manifestPath = path.join(outputDir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.manifest_version !== 3) throw new Error('Extension must use Manifest V3');
for (const permission of ['storage', 'activeTab', 'scripting']) {
  if (!manifest.permissions.includes(permission)) throw new Error(`Manifest is missing ${permission}`);
}
if (!manifest.host_permissions.includes(`${apiOrigin}/*`)) throw new Error('Manifest is missing the API origin host permission');

for (const fileName of readdirSync(outputDir).filter((name) => name.endsWith('.js'))) {
  const check = spawnSync(process.execPath, ['--check', path.join(outputDir, fileName)], { encoding: 'utf8' });
  if (check.status !== 0) throw new Error(`JavaScript syntax check failed for ${fileName}:\n${check.stderr}`);
}

const outputBytes = readdirSync(outputDir).reduce((sum, name) => sum + statSync(path.join(outputDir, name)).size, 0);
console.log(`Built and validated ${requiredFiles.length} extension files in ${outputDir}`);
console.log(`API origin: ${apiOrigin}`);
console.log(`Unpacked size: ${(outputBytes / 1024).toFixed(1)} KiB`);
