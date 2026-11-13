import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileUrl, parseFileUrl, sessionUrl, parseSessionUrl } from '../src/file-routes.js';

const id = 'a'.repeat(64);
test('round-trips only a valid session key in a session URL', () => {
  assert.equal(sessionUrl(id), `/?session=${id}`);
  assert.deepEqual(parseSessionUrl(sessionUrl(id)), { sessionKey: id });
  assert.equal(parseSessionUrl('/?session=bad'), null);
  assert.equal(parseSessionUrl(`/?session=${id}&file=note.md`), null);
  assert.equal(parseSessionUrl(`/?session=${id}&session=${id}`), null);
  assert.throws(() => sessionUrl('bad'), /Invalid/);
});
test('round-trips file and workspace URLs without an absolute workspace path', () => {
  for (const path of ['notes/name with spaces.md', 'notes/#heading & emoji 🌲.md', 'SOME.MD', 'src/app.ts', '.gitignore', 'LICENSE']) {
    const url = fileUrl(id, path);
    assert.deepEqual(parseFileUrl(url), { workspaceId: id, path });
    assert.ok(!url.includes('/Users/'));
  }
  assert.deepEqual(parseFileUrl(fileUrl(id)), { workspaceId: id, path: null });
});
test('rejects malformed IDs, traversal and duplicate query fields', () => {
  for (const path of ['../escape.md', '/absolute.md', 'a/./b.md', 'a//b.md', 'a\\b.md']) {
    assert.throws(() => fileUrl(id, path), /Invalid/);
  }
  assert.equal(parseFileUrl('/?workspace=bad&file=note.md'), null);
  assert.equal(parseFileUrl(`/?workspace=${id}&workspace=${id}`), null);
  assert.equal(parseFileUrl(`/?workspace=${id}&file=a.md&file=b.md`), null);
  assert.equal(parseFileUrl(`/?workspace=${id}&file=..%2Foutside.md`), null);
});
