import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Type } from 'typebox';
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import { fauxProvider, fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai';
import { createAgentHost } from '../agent.mjs';

async function setup(t, { tokensPerSecond = 10000 } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'pi-workbench-agent-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cwd = join(root, 'project'), agentDir = join(root, 'agent'), stateDir = join(root, 'state');
  const nativeDir = join(agentDir, 'sessions', 'project-group');
  await mkdir(cwd); await mkdir(agentDir);
  const modelRuntime = await ModelRuntime.create({ authPath: join(root, 'auth.json'), modelsPath: null, modelsStorePath: join(root, 'models.json'), allowModelNetwork: false, refreshOnCreate: false });
  const faux = fauxProvider({ provider: 'workbench-fixture', models: [{ id: 'fixture' }], tokensPerSecond });
  modelRuntime.registerNativeProvider(faux.provider);
  let calls = 0;
  const customTools = [{ name: 'fixture_echo', label: 'Fixture echo', description: 'A synthetic test tool', parameters: Type.Object({ text: Type.String() }), async execute(_id, args) { calls++; return { content: [{ type: 'text', text: args.text }], details: undefined }; } }];
  const makeSession = async ({ cwd: path, loader, settings, manager }) => createAgentSession({ cwd: path, agentDir, resourceLoader: loader, settingsManager: settings, sessionManager: manager, modelRuntime, model: faux.getModel(), tools: ['fixture_echo'], customTools });
  const options = { agentDir, stateDir, makeSession, settingsFactory: () => SettingsManager.inMemory() };
  async function seed(dir = nativeDir) {
    await mkdir(dir, { recursive: true });
    const settings = SettingsManager.inMemory();
    const loader = new DefaultResourceLoader({ cwd, agentDir, settingsManager: settings, noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true });
    await loader.reload();
    const { session } = await makeSession({ cwd, loader, settings, manager: SessionManager.create(cwd, dir) });
    try { await session.bindExtensions({ mode: 'json' }); faux.setResponses([fauxAssistantMessage('Seed response.')]); await session.prompt('Saved fixture prompt'); }
    finally { session.dispose(); }
  }
  return { cwd, stateDir, agentDir, modelRuntime, faux, options, seed, getCalls: () => calls };
}
function run(host, message) {
  return new Promise((resolve, reject) => {
    let started = false; const events = [];
    const timeout = setTimeout(() => { unsubscribe(); reject(new Error('Fixture run timed out')); }, 5000);
    const unsubscribe = host.subscribe((event) => {
      events.push(event);
      if (event.type === 'busy' && event.value) started = true;
      if (event.type === 'error') { clearTimeout(timeout); unsubscribe(); reject(new Error(event.message)); }
      if (event.type === 'snapshot' && started && !event.value?.busy) { clearTimeout(timeout); unsubscribe(); resolve(events); }
    });
    try { host.send(message); } catch (error) { clearTimeout(timeout); unsubscribe(); reject(error); }
  });
}

test('discovers a native Pi session, streams and continues it with earlier context', async (t) => {
  const { cwd, faux, options, seed, getCalls } = await setup(t); await seed();
  const host = createAgentHost(options); const sessions = await host.list();
  assert.equal(sessions.length, 1); assert.equal(sessions[0].cwd, cwd);
  faux.setResponses([fauxAssistantMessage([fauxToolCall('fixture_echo', { text: 'example' })]), fauxAssistantMessage('Synthetic response.')]);
  const opened = await host.open(sessions[0].key); assert.equal(opened.id, sessions[0].id); assert.match(opened.model, /fixture/);
  const events = await run(host, 'Fixture prompt');
  assert.equal(events.filter((event) => event.type === 'delta').map((event) => event.text).join(''), 'Synthetic response.');
  assert.ok(events.some((event) => event.type === 'tool' && event.name === 'fixture_echo' && event.phase === 'start'));
  assert.equal(getCalls(), 1);
  const other = createAgentHost(options); await assert.rejects(other.open(sessions[0].key), /already in use/);
  await host.close();
  const resumed = await other.open(sessions[0].key); assert.equal(resumed.id, opened.id);
  assert.ok(resumed.messages.some((message) => message.text === 'Synthetic response.'));
  let sawContext = false;
  faux.setResponses([(context) => { sawContext = JSON.stringify(context.messages).includes('Saved fixture prompt'); return fauxAssistantMessage('Continued.'); }]);
  await run(other, 'Follow up'); assert.ok(sawContext); assert.ok(other.snapshot().messages.some((message) => message.text === 'Continued.'));
  await other.close();
});

test('lists sessions directly in the native root and distinguishes their file keys', async (t) => {
  const { agentDir, options, seed } = await setup(t);
  await seed(); await seed(join(agentDir, 'sessions'));
  const host = createAgentHost(options); const sessions = await host.list();
  assert.equal(sessions.length, 2); assert.notEqual(sessions[0].key, sessions[1].key);
});

test('archives and restores without changing the Pi session or closing its runtime', async (t) => {
  const { agentDir, options, seed } = await setup(t); await seed();
  const host = createAgentHost(options); const [saved] = await host.list();
  const [info] = await SessionManager.listAll(join(agentDir, 'sessions', 'project-group'));
  const opened = await host.open(saved.key); const original = await readFile(info.path);
  await host.setArchived(saved.key, true);
  assert.equal((await host.list())[0].archived, true);
  assert.equal(host.snapshot().id, opened.id);
  assert.deepEqual(await readFile(info.path), original);
  const other = createAgentHost(options); assert.equal((await other.list())[0].archived, true);
  await other.setArchived(saved.key, false);
  assert.equal((await host.list())[0].archived, false);
  assert.deepEqual(await readFile(info.path), original);
  await host.close();
});

test('archiving a listed session does not rescan the entire session catalog', async (t) => {
  const { options, seed } = await setup(t); await seed();
  const host = createAgentHost(options); const original = SessionManager.listAll; let scans = 0;
  SessionManager.listAll = async (...args) => { scans++; return original.apply(SessionManager, args); };
  try {
    const [saved] = await host.list(); const before = scans; assert.ok(before > 0);
    await host.setArchived(saved.key, true);
    assert.equal(scans, before, 'archive should not trigger another catalog scan');
  } finally { SessionManager.listAll = original; }
});

test('refuses to archive a session removed since the list was loaded', async (t) => {
  const { agentDir, stateDir, options, seed } = await setup(t); await seed();
  const host = createAgentHost(options); const [saved] = await host.list();
  const [info] = await SessionManager.listAll(join(agentDir, 'sessions', 'project-group'));
  await rm(info.path);
  await assert.rejects(host.setArchived(saved.key, true), /not found/);
  await assert.rejects(stat(stateDir), { code: 'ENOENT' });
});

test('concurrent archive requests never silently lose a successful change', async (t) => {
  const { options, seed } = await setup(t); await seed(); await seed();
  const first = createAgentHost(options), second = createAgentHost(options); const sessions = await first.list(); await second.list();
  assert.equal(sessions.length, 2);
  const results = await Promise.allSettled([first.setArchived(sessions[0].key, true), second.setArchived(sessions[1].key, true)]);
  const after = await first.list();
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'fulfilled') assert.equal(after.find((item) => item.key === sessions[i].key).archived, true);
    else assert.match(results[i].reason.message, /lock|in use/);
  }
  assert.ok(results.some((result) => result.status === 'fulfilled'));
});

test('preserves corrupt archive metadata and refuses a stale archive lock', async (t) => {
  const { stateDir, options, seed } = await setup(t); await seed();
  const host = createAgentHost(options); const [saved] = await host.list();
  await mkdir(stateDir, { recursive: true }); const file = join(stateDir, 'archived-sessions.json');
  await writeFile(file, '{invalid json');
  await assert.rejects(host.list(), /invalid/);
  await assert.rejects(host.setArchived(saved.key, true), /invalid/);
  assert.equal(await readFile(file, 'utf8'), '{invalid json');
  await rm(file); await mkdir(join(stateDir, 'archive-lock'));
  await assert.rejects(host.setArchived(saved.key, true), /stale lock/);
  assert.ok((await stat(join(stateDir, 'archive-lock'))).isDirectory());
});

test('includes sessions made by the previous Workbench spike', async (t) => {
  const { stateDir, options, seed } = await setup(t); await seed(join(stateDir, 'sessions'));
  const host = createAgentHost(options); const sessions = await host.list(); assert.equal(sessions.length, 1);
  const opened = await host.open(sessions[0].key); assert.equal(opened.id, sessions[0].id); await host.close();
});

test('does not activate unavailable recorded extension tools when restoring', async (t) => {
  const { agentDir, modelRuntime, faux, options, seed } = await setup(t); await seed(); let runtimeSession, extensionCount = -1;
  const host = createAgentHost({ ...options, makeSession: async ({ cwd, loader, settings, manager }) => {
    extensionCount = loader.getExtensions().extensions.length;
    const result = await createAgentSession({ cwd, agentDir, resourceLoader: loader, settingsManager: settings, sessionManager: manager, modelRuntime, model: faux.getModel() });
    runtimeSession = result.session; return result;
  } });
  const [saved] = await host.list(); await host.open(saved.key);
  assert.equal(extensionCount, 0); assert.ok(runtimeSession);
  assert.deepEqual(runtimeSession.getActiveToolNames(), [], 'Unavailable recorded extension tools must not become active');
  await host.close();
});

test('can stop an active synthetic run', async (t) => {
  const { faux, options, seed } = await setup(t, { tokensPerSecond: 30 }); await seed(); const host = createAgentHost(options);
  faux.setResponses([fauxAssistantMessage('A long fixture response. '.repeat(200))]);
  const [saved] = await host.list(); await host.open(saved.key); let stopRequested = false;
  await new Promise((resolve, reject) => {
    let started = false;
    const timeout = setTimeout(() => { unsubscribe(); reject(new Error('Fixture stop timed out')); }, 5000);
    const unsubscribe = host.subscribe((event) => {
      if (event.type === 'busy') started = true;
      if (event.type === 'delta' && !stopRequested) { stopRequested = true; void host.stop().catch(reject); }
      if (event.type === 'snapshot' && started && !event.value?.busy) { clearTimeout(timeout); unsubscribe(); resolve(); }
    });
    host.send('Stop fixture');
  });
  assert.equal(stopRequested, true); assert.equal(host.snapshot().busy, false); await host.close();
});

test('listing is read-only; opening without a saved session cannot create one', async (t) => {
  const { stateDir, options } = await setup(t); const host = createAgentHost(options);
  assert.deepEqual(await host.list(), []); await assert.rejects(stat(stateDir), { code: 'ENOENT' });
  await assert.rejects(host.open(), /Select an existing session/);
  await assert.rejects(host.open('not-a-key'), /Select an existing session/);
  await assert.rejects(host.setArchived('0'.repeat(64), true), /not found/);
  await assert.rejects(host.setArchived('../invalid', true), /Invalid archive/);
  await assert.rejects(stat(stateDir), { code: 'ENOENT' });
  assert.throws(() => host.send('hello'), /Open a session/);
});

test('reports model errors instead of presenting them as successful runs', async (t) => {
  const { faux, options, seed } = await setup(t); await seed(); const host = createAgentHost(options);
  const [saved] = await host.list(); await host.open(saved.key);
  faux.setResponses([fauxAssistantMessage('', { stopReason: 'error', errorMessage: 'Synthetic failure' })]);
  const events = [];
  await new Promise((resolve, reject) => {
    let started = false;
    const timeout = setTimeout(() => { unsubscribe(); reject(new Error('Fixture run timed out')); }, 5000);
    const unsubscribe = host.subscribe((event) => {
      events.push(event); if (event.type === 'busy') started = true;
      if (event.type === 'snapshot' && started && !event.value?.busy) { clearTimeout(timeout); unsubscribe(); resolve(); }
    });
    host.send('Trigger fixture error');
  });
  assert.ok(events.some((event) => event.type === 'error' && event.message.includes('Synthetic failure'))); await host.close();
});
