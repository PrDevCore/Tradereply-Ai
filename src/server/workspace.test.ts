import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WorkspaceStore, normaliseLead, nowIso } from './workspaceStore.ts';
import { isLiveChannel, DemoChannelDriver } from './channelAdapters.ts';

async function tempStore() {
  const dir = await mkdtemp(path.join(tmpdir(), 'tradereply-ws-'));
  return new WorkspaceStore(path.join(dir, 'workspace.json'));
}

test('a new lead opens a thread with the customer message as the first row', async () => {
  const store = await tempStore();
  const lead = await store.addLead({ customerName: 'Sam', messageText: 'Boiler is broken' });
  assert.equal(lead.stage, 'new');
  assert.equal(lead.messages.length, 1);
  assert.equal(lead.messages[0].author, 'customer');
  assert.equal(lead.messages[0].body, 'Boiler is broken');
});

test('a lead survives a reload from disk', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tradereply-ws-'));
  const file = path.join(dir, 'workspace.json');
  const first = new WorkspaceStore(file);
  await first.addLead({ customerName: 'Persisted', messageText: 'Need a quote' });

  const second = new WorkspaceStore(file);
  await second.load();
  assert.equal(second.listLeads().length, 1);
  assert.equal(second.listLeads()[0].customerName, 'Persisted');
  // The file on disk must be valid JSON, never a half-written temp file.
  JSON.parse(await readFile(file, 'utf8'));
});

test('saving a draft does not mark the lead replied, but sending does', async () => {
  const store = await tempStore();
  const lead = await store.addLead({ customerName: 'Dana', messageText: 'Hello' });

  const afterDraft = await store.addMessage(lead.id, { author: 'draft', body: 'suggested text' });
  assert.equal(afterDraft?.author, 'draft');
  assert.equal(store.getLead(lead.id)?.stage, 'new', 'a draft must not claim the lead was answered');

  await store.addMessage(lead.id, { author: 'tradesperson', body: 'sent text' });
  assert.equal(store.getLead(lead.id)?.stage, 'replied');
});

test('hostile field values are clamped and unknown enums fall back', () => {
  const lead = normaliseLead(
    {
      customerName: 'x'.repeat(5000),
      messageText: 'y'.repeat(9000),
      urgency: 'not-a-real-urgency',
      stage: 'not-a-real-stage',
    },
    nowIso(),
  );
  assert.equal(lead.customerName.length, 120);
  assert.equal(lead.messageText.length, 4000);
  assert.equal(lead.urgency, 'flexible');
  assert.equal(lead.stage, 'new');
  // Nothing in the store may be flagged as a real channel by accident.
  assert.equal(lead.isDemo, true);
});

test('an invalid stage is ignored rather than written through', async () => {
  const store = await tempStore();
  const lead = await store.addLead({ customerName: 'Ellis', messageText: 'Hi' });
  await store.updateLead(lead.id, { stage: 'not-a-stage' });
  assert.equal(store.getLead(lead.id)?.stage, 'new');
  await store.updateLead(lead.id, { stage: 'won' });
  assert.equal(store.getLead(lead.id)?.stage, 'won');
});

test('no channel is reported live until a credentialed driver is registered', () => {
  // Guards the UI against ever implying a live Checkatrade API connection.
  assert.equal(isLiveChannel('Checkatrade'), false);
  assert.equal(isLiveChannel('MyBuilder'), false);
  assert.equal(new DemoChannelDriver().live, false);
});


test('platform URL parser accepts any social URL and derives match patterns', async () => {
  const { parsePlatformUrl } = await import('./platformUrls.ts');
  const fb = parsePlatformUrl('https://www.facebook.com/somepage/messages');
  assert.equal(fb.label, 'Facebook');
  assert.ok(fb.matchPatterns.some((p) => p.includes('facebook.com')));
  const insta = parsePlatformUrl('instagram.com/someone');
  assert.equal(insta.label, 'Instagram');
  assert.throws(() => parsePlatformUrl('not a url'), /URL/);
});

test('accounts: signup then login, duplicate rejected, bad password rejected', async () => {
  const { AuthStore } = await import('./authStore.ts');
  const dir = await mkdtemp(path.join(tmpdir(), 'tradereply-auth-'));
  const store = new AuthStore(path.join(dir, 'auth.json'));
  await store.load();
  const { user, token } = await store.signup('Test@Example.com', 'password123', 'Tester');
  assert.equal(user.email, 'test@example.com');
  assert.ok(token.startsWith('tr_'));
  await assert.rejects(() => store.signup('test@example.com', 'password123', 'Dup'), /already exists/);
  await assert.rejects(() => store.login('test@example.com', 'wrongpass1'), /Incorrect/);
  const again = await store.login('test@example.com', 'password123');
  assert.equal(again.user.id, user.id);
  assert.ok(store.userForToken(again.token));
});

test('connections: one host per user, patterns aggregate', async () => {
  const { ConnectionStore } = await import('./connectionStore.ts');
  const { parsePlatformUrl } = await import('./platformUrls.ts');
  const dir = await mkdtemp(path.join(tmpdir(), 'tradereply-conn-'));
  const store = new ConnectionStore(path.join(dir, 'c.json'));
  await store.load();
  const c = await store.add('u1', parsePlatformUrl('https://www.facebook.com/page'));
  assert.equal(c.label, 'Facebook');
  await assert.rejects(() => store.add('u1', parsePlatformUrl('https://facebook.com/other')), /already connected/);
  assert.ok(store.patternsForUser('u1').some((p) => p.includes('facebook.com')));
});
