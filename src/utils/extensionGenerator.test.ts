import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createExtensionZip } from './zip.ts';

const sourceDir = resolve('extension/src');

test('extension manifest is valid MV3 and keeps origin injection centralized', () => {
  const manifest = JSON.parse(readFileSync(resolve(sourceDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage', 'activeTab', 'scripting']);
  assert.ok(manifest.host_permissions.includes('__TRADEREPLY_API_ORIGIN__/*'));
  assert.equal(manifest.background.service_worker, 'background.js');
  assert.equal(manifest.content_scripts[0].js[0], 'content.js');
});

test('origin placeholder occurs only in files that consume the API origin', () => {
  const consumers = ['manifest.json', 'background.js', 'options.html'];
  for (const name of ['manifest.json', 'background.js', 'content.js', 'content.css', 'popup.html', 'popup.js', 'options.html', 'options.js']) {
    const text = readFileSync(resolve(sourceDir, name), 'utf8');
    assert.equal(text.includes('__TRADEREPLY_API_ORIGIN__'), consumers.includes(name), name);
  }
});

test('ZIP writer emits local, central, and end records for every file', () => {
  const files = { 'manifest.json': '{}', 'content.js': 'console.log("ok");' };
  const zip = createExtensionZip(files);
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  const eocdOffset = zip.length - 22;
  assert.equal(view.getUint32(eocdOffset, true), 0x06054b50);
  assert.equal(view.getUint16(eocdOffset + 8, true), Object.keys(files).length);
  assert.equal(view.getUint16(eocdOffset + 10, true), Object.keys(files).length);
});
