import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExtensionDialogs } from '../extension-ui.mjs';

function fixture() {
  let viewers = true; const events = [];
  const dialogs = createExtensionDialogs({ publish: (event) => events.push(event), hasViewers: () => viewers });
  return { dialogs, ui: dialogs.context({}), events, disconnect: () => { viewers = false; dialogs.cancelAll(); } };
}
test('accepts only valid explicit dialog responses and rejects stale answers', async () => {
  const { dialogs, ui, events } = fixture();
  const confirm = ui.confirm('Allow?', 'This changes data'); const id = events.at(-1).dialog.id;
  assert.throws(() => dialogs.respond(id, 'yes'), /Invalid/);
  assert.equal(dialogs.respond(id, true), true); assert.equal(await confirm, true);
  assert.throws(() => dialogs.respond(id, true), /no longer pending/);
  const select = ui.select('Choose', ['a', 'b']); const selectId = events.at(-1).dialog.id;
  assert.throws(() => dialogs.respond(selectId, 'other'), /Invalid/);
  dialogs.respond(selectId, 'b'); assert.equal(await select, 'b');
  const input = ui.input('Name', 'Type here'); dialogs.respond(events.at(-1).dialog.id, ''); assert.equal(await input, '');
  const editor = ui.editor('Edit', 'draft'); dialogs.respond(events.at(-1).dialog.id, null); assert.equal(await editor, undefined);
  await assert.rejects(ui.custom(() => {}), /not supported/);
});
test('cancels pending requests on disconnect, abort, timeout, and absent viewers', async () => {
  const { dialogs, ui, events, disconnect } = fixture();
  const confirm = ui.confirm('Confirm', 'message'), input = ui.input('Input');
  const ids = events.filter((event) => event.type === 'extension_dialog').map((event) => event.dialog.id);
  disconnect(); assert.equal(await confirm, false); assert.equal(await input, undefined);
  for (const id of ids) assert.throws(() => dialogs.respond(id, true), /no longer pending/);
  assert.equal(await ui.confirm('No viewer', 'message'), false);
  const second = fixture(), signal = new AbortController();
  const aborted = second.ui.select('Choose', ['a'], { signal: signal.signal }); signal.abort(); assert.equal(await aborted, undefined);
  assert.equal(await second.ui.confirm('Timeout', 'message', { timeout: 5 }), false);
  const alreadyAborted = new AbortController(); alreadyAborted.abort();
  assert.equal(await second.ui.input('Input', '', { signal: alreadyAborted.signal }), undefined);
});
test('replays pending dialogs to a newly connected viewer', async () => {
  const { dialogs, ui } = fixture(); const answer = ui.input('Input'); const replay = [];
  dialogs.replay((event) => replay.push(event)); assert.equal(replay.length, 1);
  dialogs.respond(replay[0].dialog.id, 'value'); assert.equal(await answer, 'value');
});
