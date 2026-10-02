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

