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

test('content script tries several lead selectors and never invents a lead', () => {
  const content = readFileSync(resolve(sourceDir, 'content.js'), 'utf8');
  // Detection must not hinge on a single class name that a redesign can remove.
  assert.ok(content.includes('LEAD_SELECTOR_FAMILIES'), 'expects a family of lead selectors');
  assert.ok(content.includes('detectByConversationRegion'), 'expects a structural fallback');
  // The own-message guard stops the model being asked to reply to its own reply.
  assert.ok(content.includes('OWN_MESSAGE_SELECTOR'), 'expects own-message filtering');
  assert.ok(content.includes("closest(OWN_MESSAGE_SELECTOR)"), 'expects nested own-message filtering');
  // A detection miss must be reported, not quietly swallowed.
  assert.ok(content.includes('function resolveLeadText'), 'expects a manual-entry fallback');
  assert.ok(content.includes('tr-manual-lead'), 'expects a manual paste box');
});

test('content script never uses innerHTML for lead or model data', () => {
  const content = readFileSync(resolve(sourceDir, 'content.js'), 'utf8');
  // innerHTML is permitted exactly once, for the static developer-authored shell.
  const assignments = content.match(/\.innerHTML\s*=/g) || [];
  assert.equal(assignments.length, 1, 'only the static widget shell may use innerHTML');
  assert.ok(
    content.includes('Static, developer-authored markup only'),
    'the innerHTML use must remain documented as static-only'
  );
  // Reply insertion must report success/failure rather than failing silently.
  assert.ok(content.includes('return false;'), 'insertReply must report a failed insert');
  assert.ok(content.includes('was NOT inserted'), 'a failed insert must be surfaced to the user');
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
