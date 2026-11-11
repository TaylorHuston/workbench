import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadPersona } from './personas.mjs';

// A small stand-in isolates discovery and precedence; the SDK smoke test uses Pi's YAML parser.
function parse(content) {
  if (!content.startsWith('---\n')) return { frontmatter: {}, body: content };
  const end = content.indexOf('\n---\n', 4);
  return { frontmatter: { name: content.slice(4, end).replace(/^name: /, '') }, body: content.slice(end + 5) };
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'pi-personas-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const agentDir = join(root, 'agent');
  const cwd = join(root, 'project');
  await mkdir(join(agentDir, 'personas'), { recursive: true });
  await mkdir(join(cwd, '.pi', 'personas'), { recursive: true });
  return { root, agentDir, cwd, configDir: '.pi', projectTrusted: true, parse };
}

test('loads global persona and falls back to filename for its name', async (t) => {
  const opts = await fixture(t);
  await writeFile(join(opts.agentDir, 'personas', 'writing.md'), 'Global instructions.');
  assert.deepEqual(await loadPersona('writing', opts), { id: 'writing', name: 'writing', instructions: 'Global instructions.' });
});

test('trusted project persona replaces the global profile, without merging', async (t) => {
  const opts = await fixture(t);
  await writeFile(join(opts.agentDir, 'personas', 'writing.md'), 'Global instructions.');
  await writeFile(join(opts.cwd, '.pi', 'personas', 'writing.md'), '---\nname: Project Writer\n---\nProject instructions.');
  assert.deepEqual(await loadPersona('writing', opts), { id: 'writing', name: 'Project Writer', instructions: 'Project instructions.' });
  assert.equal((await loadPersona('writing', { ...opts, projectTrusted: false })).instructions, 'Global instructions.');
});

test('reports missing, invalid and malformed profiles without falling back', async (t) => {
  const opts = await fixture(t);
  await assert.rejects(loadPersona('../escape', opts), /Persona ID/);
  await assert.rejects(loadPersona('missing', opts), /not found/);
  await writeFile(join(opts.agentDir, 'personas', 'writing.md'), 'Global instructions.');
  await writeFile(join(opts.cwd, '.pi', 'personas', 'writing.md'), '   ');
  await assert.rejects(loadPersona('writing', opts), /no instructions/);
  await assert.rejects(loadPersona('writing', { ...opts, parse: () => { throw new Error('bad YAML'); } }), /bad YAML/);
  await assert.rejects(loadPersona('writing', { ...opts, parse: () => ({ frontmatter: { name: 12 }, body: 'body' }) }), /string name/);
});
