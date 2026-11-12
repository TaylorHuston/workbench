import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Type } from 'typebox';
import { createAgentSession, DefaultPackageManager, DefaultResourceLoader, ModelRuntime, ProjectTrustStore, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
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
function run(host, message, document = null) {
  return new Promise((resolve, reject) => {
    let started = false; const events = [];
    const timeout = setTimeout(() => { unsubscribe(); reject(new Error('Fixture run timed out')); }, 5000);
    const unsubscribe = host.subscribe((event) => {
      events.push(event);
      if (event.type === 'busy' && event.value) started = true;
      if (event.type === 'error') { clearTimeout(timeout); unsubscribe(); reject(new Error(event.message)); }
      if (event.type === 'snapshot' && started && !event.value?.busy) { clearTimeout(timeout); unsubscribe(); resolve(events); }
    });
    try { host.send(message, document); } catch (error) { clearTimeout(timeout); unsubscribe(); reject(error); }
  });
}

test('discovers a native Pi session, streams and continues it with earlier context', async (t) => {
  const { cwd, faux, options, seed, getCalls } = await setup(t); await seed();
  const host = createAgentHost(options); const sessions = await host.list();
  assert.equal(sessions.length, 1); assert.equal(sessions[0].cwd, await realpath(cwd));
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

test('opens a listed session without rescanning and rejects replaced or missing session files', async (t) => {
  const { agentDir, options, seed } = await setup(t); await seed(); await seed();
  const host = createAgentHost(options), sessions = await host.list();
  const files = await SessionManager.listAll(join(agentDir, 'sessions', 'project-group'));
  const target = sessions[0], targetPath = files.find(info => info.id === target.id).path, replacementPath = files.find(info => info.id !== target.id).path;
  const originalListAll = SessionManager.listAll; let scans = 0;
  SessionManager.listAll = async (...args) => { scans++; return originalListAll.apply(SessionManager, args); };
  try {
    const opened = await host.open(target.key); assert.equal(opened.id, target.id); assert.equal(scans, 0); await host.close();
    const replacement = await readFile(replacementPath); await writeFile(targetPath, replacement);
    await assert.rejects(host.open(target.key), /identity changed/); assert.deepEqual(await readFile(targetPath), replacement);
    await rm(targetPath); await assert.rejects(host.open(target.key), /not found/); assert.equal(scans, 0);
  } finally { SessionManager.listAll = originalListAll; }
});

test('includes the active document path in model context without embedding its content', async (t) => {
  const { cwd, faux, options } = await setup(t); const host = createAgentHost(options); await host.createSession(cwd);
  let context; faux.setResponses([(value) => { context = JSON.stringify(value.messages); return fauxAssistantMessage('Done.'); }]);
  await run(host, 'What is this?', 'folder/note.md');
  assert.match(context, /folder\/note\.md/); assert.match(context, /path relative to the session working directory/);
  assert.ok(host.snapshot().messages.some(item => item.text.includes('folder/note.md')));
  await host.close();
});

test('creates a native session in a workspace without a model call and persists it on first message', async (t) => {
  const { cwd, agentDir, options, seed, faux } = await setup(t); await seed(); let called = false;
  const host = createAgentHost(options); const events = []; const canonical = await realpath(cwd);
  const unsubscribe = host.subscribe((event) => events.push(event));
  faux.setResponses([() => { called = true; return fauxAssistantMessage('New session response.'); }]);
  const opened = await host.createSession(cwd);
  assert.equal(called, false); assert.equal(opened.cwd, canonical); assert.deepEqual(opened.messages, []);
  let listed = await host.list(); const draft = listed.find((item) => item.id === opened.id);
  assert.ok(draft?.transient); assert.equal(draft.name, 'New session');
  await run(host, 'First message'); assert.equal(called, true);
  listed = await host.list(); const saved = listed.find((item) => item.id === opened.id);
  assert.ok(saved && !saved.transient); assert.equal(saved.cwd, canonical); assert.match(saved.name, /First message/);
  const group = `--${canonical.replace(/^[/\\\\]/, '').replace(/[/\\\\:]/g, '-')}--`;
  const native = await SessionManager.listAll(join(agentDir, 'sessions', group)); assert.ok(native.some((item) => item.id === opened.id));
  assert.ok(events.some((event) => event.type === 'sessions_changed')); unsubscribe(); await host.close();
  const other = createAgentHost(options); const resumed = await other.open(saved.key);
  assert.ok(resumed.messages.some((item) => item.text === 'First message')); await other.close();
});

test('renames the active session through Pi and preserves a transient name on first message', async (t) => {
  const { cwd, options, faux } = await setup(t); const host = createAgentHost(options);
  const opened = await host.createSession(cwd);
  assert.throws(() => host.rename('wrong', 'Other'), /Session changed/);
  assert.throws(() => host.rename(opened.key, '  '), /Enter a session name/);
  assert.throws(() => host.rename(opened.key, 'bad\nname'), /Enter a session name/);
  assert.deepEqual(host.rename(opened.key, '  Research  '), { name: 'Research' });
  let listed = await host.list(); assert.equal(listed[0].name, 'Research'); assert.equal(listed[0].transient, true);
  faux.setResponses([fauxAssistantMessage('Done.')]); await run(host, 'First message');
  listed = await host.list(); assert.equal(listed[0].name, 'Research'); assert.ok(!listed[0].transient);
  await host.close(); await host.open(opened.key); assert.equal((await host.list())[0].name, 'Research'); await host.close();
});

test('retains empty registered workspaces and leaves an empty session unpersisted on close', async (t) => {
  const { cwd, options } = await setup(t); const host = createAgentHost(options); const canonical = await realpath(cwd);
  assert.deepEqual(await host.listWorkspaces(), []);
  const registration = await host.addWorkspace(cwd); assert.equal(registration.cwd, canonical);
  assert.equal(registration.workspace.path, canonical); assert.equal(registration.workspace.archived, false);
  assert.deepEqual(await host.addWorkspace(cwd), registration);
  const other = createAgentHost(options); assert.deepEqual(await other.listWorkspaces(), [registration.workspace]);
  const opened = await host.createSession(cwd); assert.ok((await host.list()).some((item) => item.id === opened.id && item.transient));
  await host.close(); assert.deepEqual(await host.list(), []); assert.deepEqual(await host.listWorkspaces(), [registration.workspace]);
  await assert.rejects(host.addWorkspace('relative'), /absolute/);
  await assert.rejects(host.createSession('relative'), /absolute/);
});

test('renames and archives a workspace without altering its Pi session or runtime', async (t) => {
  const { cwd, agentDir, options, seed } = await setup(t); await seed(); const host = createAgentHost(options);
  const registration = await host.addWorkspace(cwd, 'Friendly'); const [saved] = await host.list(); const opened = await host.open(saved.key);
  const [info] = await SessionManager.listAll(join(agentDir, 'sessions', 'project-group')); const original = await readFile(info.path);
  const renamed = await host.updateWorkspace(registration.cwd, { name: 'New name' }, registration.workspace.revision);
  const archived = await host.updateWorkspace(registration.cwd, { archived: true }, renamed.workspace.revision);
  assert.equal(archived.workspace.name, 'New name'); assert.equal(archived.workspace.archived, true);
  assert.equal(host.snapshot().id, opened.id); assert.deepEqual(await readFile(info.path), original);
  assert.equal((await host.list())[0].archived, false);
  const restored = await host.updateWorkspace(registration.cwd, { archived: false }, archived.workspace.revision);
  assert.equal(restored.workspace.archived, false); assert.deepEqual(await readFile(info.path), original); await host.close();
});

test('preserves the open session if a new session cannot be created', async (t) => {
  const { cwd, options, seed } = await setup(t); await seed(); let fail = false;
  const host = createAgentHost({ ...options, makeSession: async (args) => { if (fail) throw new Error('Synthetic initialization failure'); return options.makeSession(args); } });
  const [saved] = await host.list(); const opened = await host.open(saved.key); fail = true;
  await assert.rejects(host.createSession(cwd), /Synthetic initialization failure/);
  assert.equal(host.snapshot().id, opened.id); assert.equal(host.snapshot().key, saved.key);
  const other = createAgentHost(options); await assert.rejects(other.open(saved.key), /already in use/); await host.close();
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

test('loads global extensions, skips project extensions, and emits shutdown', async (t) => {
  const { cwd, agentDir, options, faux, modelRuntime } = await setup(t);
  options.makeSession = ({ cwd: path, loader, settings, manager }) => createAgentSession({ cwd: path, agentDir, resourceLoader: loader, settingsManager: settings, sessionManager: manager, modelRuntime, model: faux.getModel() });
  const globalDir = join(agentDir, 'extensions'), projectDir = join(cwd, '.pi', 'extensions');
  await mkdir(globalDir, { recursive: true }); await mkdir(projectDir, { recursive: true });
  const lifecycle = join(agentDir, 'lifecycle.txt'), projectMarker = join(agentDir, 'project-ran');
  await writeFile(join(globalDir, 'global.js'), `import { appendFile } from 'node:fs/promises';\nexport default function(pi) {\n pi.on('session_start', async () => appendFile(${JSON.stringify(lifecycle)}, 'start\\n'));\n pi.on('session_shutdown', async () => appendFile(${JSON.stringify(lifecycle)}, 'stop\\n'));\n pi.registerTool({ name: 'global_fixture', label: 'Global fixture', description: 'Fixture tool', parameters: { type: 'object', properties: {} }, execute: async () => ({ content: [{ type: 'text', text: 'global result' }], details: {} }) });\n}`);
  await writeFile(join(projectDir, 'project.js'), `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(projectMarker)}, 'executed'); export default function() {}`);
  new ProjectTrustStore(agentDir).set(cwd, true);
  const host = createAgentHost(options); const opened = await host.createSession(cwd);
  assert.match(opened.warning, /Global extensions are active/); assert.ok(opened.tools.includes('global_fixture'));
  await assert.rejects(stat(projectMarker), { code: 'ENOENT' });
  faux.setResponses([fauxAssistantMessage([fauxToolCall('global_fixture', {})]), fauxAssistantMessage('Fixture complete.')]);
  const events = await run(host, 'Use the fixture'); assert.ok(events.some((event) => event.type === 'tool' && event.name === 'global_fixture'));
  await host.reload(opened.key);
  await host.close(); assert.equal(await readFile(lifecycle, 'utf8'), 'start\nstop\nstart\nstop\n');
});

test('shuts down the previous extension runtime before starting another', async (t) => {
  const { cwd, agentDir, options } = await setup(t); const dir = join(agentDir, 'extensions'); await mkdir(dir, { recursive: true });
  const lifecycle = join(agentDir, 'lifecycle.txt');
  await writeFile(join(dir, 'fixture.js'), `import { appendFile } from 'node:fs/promises'; export default function(pi) { pi.on('session_start', async () => appendFile(${JSON.stringify(lifecycle)}, 'start\\n')); pi.on('session_shutdown', async () => appendFile(${JSON.stringify(lifecycle)}, 'stop\\n')); }`);
  const host = createAgentHost(options); await host.createSession(cwd); await host.createSession(cwd); await host.close();
  assert.equal(await readFile(lifecycle, 'utf8'), 'start\nstop\nstart\nstop\n');
});

test('skips disabled global extensions and refuses a stale extension selection on reload', async (t) => {
  const { cwd, agentDir, options } = await setup(t); const globalDir = join(agentDir, 'extensions'); await mkdir(globalDir, { recursive: true });
  const file = join(globalDir, 'disabled.js'), marker = join(agentDir, 'disabled-ran');
  await writeFile(file, `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'executed'); export default function() {}`);
  let disabled = true; options.settingsFactory = () => SettingsManager.inMemory({ extensions: disabled ? [`-${file}`] : [] });
  const host = createAgentHost(options); const opened = await host.createSession(cwd);
  await assert.rejects(stat(marker), { code: 'ENOENT' });
  disabled = false; await assert.rejects(host.reload(opened.key), /selection changed/);
  await assert.rejects(stat(marker), { code: 'ENOENT' }); await host.close();
});

test('declines extension confirmations when no browser is connected', async (t) => {
  const { cwd, agentDir, options } = await setup(t); const dir = join(agentDir, 'extensions'); await mkdir(dir, { recursive: true });
  const marker = join(agentDir, 'ui.txt');
  await writeFile(join(dir, 'fixture.js'), `import { writeFile } from 'node:fs/promises'; export default function(pi) { pi.on('session_start', async (_event, ctx) => writeFile(${JSON.stringify(marker)}, String(ctx.hasUI) + ':' + String(await ctx.ui.confirm('Fixture', 'Approve?')))); }`);
  const host = createAgentHost(options); await host.createSession(cwd);
  assert.equal(await readFile(marker, 'utf8'), 'true:false'); await host.close();
});

test('delivers and resolves a dialog while an extension is starting', async (t) => {
  const { cwd, agentDir, options } = await setup(t); const dir = join(agentDir, 'extensions'); await mkdir(dir, { recursive: true });
  const marker = join(agentDir, 'answer.txt');
  await writeFile(join(dir, 'fixture.js'), `import { writeFile } from 'node:fs/promises'; export default function(pi) { pi.on('session_start', async (_event, ctx) => writeFile(${JSON.stringify(marker)}, String(await ctx.ui.confirm('Allow?', 'Fixture action')))); }`);
  const host = createAgentHost(options); let resolveDialog; const dialog = new Promise((resolve) => { resolveDialog = resolve; });
  const unsubscribe = host.subscribe((event) => { if (event.type === 'extension_dialog') resolveDialog(event.dialog); });
  const opening = host.createSession(cwd); const request = await dialog;
  assert.equal(request.kind, 'confirm'); assert.equal(request.message, 'Fixture action');
  host.respondDialog(request.id, true); await opening; assert.equal(await readFile(marker, 'utf8'), 'true');
  unsubscribe(); await host.close();
});

test('cancels a startup confirmation when its last viewer disconnects', async (t) => {
  const { cwd, agentDir, options } = await setup(t); const dir = join(agentDir, 'extensions'); await mkdir(dir, { recursive: true });
  const marker = join(agentDir, 'answer.txt');
  await writeFile(join(dir, 'fixture.js'), `import { writeFile } from 'node:fs/promises'; export default function(pi) { pi.on('session_start', async (_event, ctx) => writeFile(${JSON.stringify(marker)}, String(await ctx.ui.confirm('Allow?', 'Fixture action')))); }`);
  const host = createAgentHost(options); let resolveDialog; const dialog = new Promise((resolve) => { resolveDialog = resolve; });
  const unsubscribe = host.subscribe((event) => { if (event.type === 'extension_dialog') resolveDialog(event.dialog); });
  const opening = host.createSession(cwd); const request = await dialog; unsubscribe(); await opening;
  assert.equal(await readFile(marker, 'utf8'), 'false'); assert.throws(() => host.respondDialog(request.id, true), /no longer pending/); await host.close();
});

test('stopping a run cancels its pending confirmation without running the tool', async (t) => {
  const { cwd, agentDir, options, faux, getCalls } = await setup(t); const dir = join(agentDir, 'extensions'); await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'fixture.js'), `export default function(pi) { pi.on('tool_call', async (_event,ctx) => { if (!(await ctx.ui.confirm('Run tool?', 'Fixture'))) return { block: true }; }); }`);
  const host = createAgentHost(options); let resolveDialog; const dialog = new Promise((resolve) => { resolveDialog = resolve; });
  const unsubscribe = host.subscribe((event) => { if (event.type === 'extension_dialog') resolveDialog(event.dialog); });
  await host.createSession(cwd); faux.setResponses([fauxAssistantMessage([fauxToolCall('fixture_echo', { text: 'fixture' })])]);
  host.send('Run the fixture'); const request = await dialog; await host.stop();
  assert.equal(getCalls(), 0); assert.throws(() => host.respondDialog(request.id, true), /no longer pending/);
  unsubscribe(); await host.close();
});

test('blocks further prompts after a global extension fails during reload', async (t) => {
  const { cwd, agentDir, options } = await setup(t); const dir = join(agentDir, 'extensions'); await mkdir(dir, { recursive: true });
  const file = join(dir, 'fixture.js'); await writeFile(file, 'export default function() {}');
  const host = createAgentHost(options); const opened = await host.createSession(cwd);
  await writeFile(file, 'export default function( {');
  await assert.rejects(host.reload(opened.key), /partially reloaded/);
  assert.throws(() => host.send('must not run'), /close and reopen/); await host.close();
});

test('does not install missing global extension packages', async (t) => {
  const { cwd, options } = await setup(t); options.settingsFactory = () => SettingsManager.inMemory({ packages: ['npm:@fixture/never-install-global@1.0.0'] });
  const original = DefaultPackageManager.prototype.installParsedSource, offline = process.env.PI_OFFLINE; let attempts = 0;
  DefaultPackageManager.prototype.installParsedSource = async () => { attempts++; throw new Error('Unexpected installation'); }; delete process.env.PI_OFFLINE;
  try { const host = createAgentHost(options); const opened = await host.createSession(cwd); assert.equal(attempts, 0); assert.match(opened.warning, /uninstalled global Pi package/); await host.close(); }
  finally { DefaultPackageManager.prototype.installParsedSource = original; if (offline === undefined) delete process.env.PI_OFFLINE; else process.env.PI_OFFLINE = offline; }
});

test('discovers user and trusted project skills without enabling extensions or project runtime settings', async (t) => {
  const { cwd, agentDir, modelRuntime, faux, options, seed } = await setup(t); await seed();
  async function skill(base, name, body, extra = '') {
    const dir = join(base, name); await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: Fixture ${name}\n${extra}---\n\n${body}\n`);
  }
  await skill(join(agentDir, 'skills'), 'fixture-user', 'USER INSTRUCTIONS');
  await skill(join(cwd, '.agents', 'skills'), 'fixture-project', 'PROJECT INSTRUCTIONS');
  await skill(join(cwd, '.pi', 'skills'), 'fixture-command-only', 'COMMAND ONLY INSTRUCTIONS', 'disable-model-invocation: true\n');
  await skill(join(cwd, '.pi', 'custom-skills'), 'fixture-configured', 'CONFIGURED INSTRUCTIONS');
  await writeFile(join(cwd, '.pi', 'settings.json'), JSON.stringify({ skills: ['./custom-skills'] }));
  await writeFile(join(cwd, '.pi', 'SYSTEM.md'), 'PROJECT SYSTEM OVERRIDE MUST NOT LOAD');
  let loaded, session;
  const host = createAgentHost({ ...options, makeSession: async ({ cwd: path, loader, settings, manager }) => {
    loaded = loader.getSkills(); assert.equal(loader.getExtensions().extensions.length, 0);
    const result = await createAgentSession({ cwd: path, agentDir, resourceLoader: loader, settingsManager: settings, sessionManager: manager, modelRuntime, model: faux.getModel(), tools: ['read'] });
    session = result.session; return result;
  } });
  const [saved] = await host.list();
  await host.open(saved.key);
  assert.ok(loaded.skills.some((item) => item.name === 'fixture-user'));
  assert.ok(!loaded.skills.some((item) => item.name === 'fixture-project'));
  assert.match(host.snapshot().warning, /Project skills skipped/);
  assert.match(session.systemPrompt, /fixture-user/);
  assert.doesNotMatch(session.systemPrompt, /USER INSTRUCTIONS|PROJECT SYSTEM OVERRIDE MUST NOT LOAD/);
  await host.close();
  new ProjectTrustStore(agentDir).set(cwd, true);
  await host.open(saved.key);
  for (const name of ['fixture-user', 'fixture-project', 'fixture-configured', 'fixture-command-only']) assert.ok(loaded.skills.some((item) => item.name === name), name);
  assert.equal(loaded.skills.find((item) => item.name === 'fixture-user').sourceInfo.scope, 'user');
  assert.equal(loaded.skills.find((item) => item.name === 'fixture-project').sourceInfo.scope, 'project');
  assert.match(session.systemPrompt, /fixture-project/); assert.match(session.systemPrompt, /fixture-configured/);
  assert.doesNotMatch(session.systemPrompt, /fixture-command-only|PROJECT INSTRUCTIONS|PROJECT SYSTEM OVERRIDE MUST NOT LOAD/);
  let expanded = false;
  faux.setResponses([(context) => { expanded = JSON.stringify(context.messages).includes('COMMAND ONLY INSTRUCTIONS'); return fauxAssistantMessage('Skill command handled.'); }]);
  await run(host, '/skill:fixture-command-only'); assert.equal(expanded, true);
  await host.close();
  new ProjectTrustStore(agentDir).set(cwd, false);
  await host.open(saved.key); assert.ok(!loaded.skills.some((item) => item.name === 'fixture-project')); await host.close();
});

test('uses the global trust default when no project decision is saved', async (t) => {
  const { cwd, agentDir, options, seed } = await setup(t); await seed();
  const dir = join(cwd, '.pi', 'skills', 'fixture-default'); await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'SKILL.md'), '---\nname: fixture-default\ndescription: Trust default fixture\n---\nInstructions\n');
  for (const [preference, expected] of [['always', true], ['never', false], ['ask', false]]) {
    let names;
    const host = createAgentHost({ ...options, settingsFactory: () => SettingsManager.inMemory({ defaultProjectTrust: preference }), makeSession: async (args) => {
      names = args.loader.getSkills().skills.map((item) => item.name); return options.makeSession(args);
    } });
    const [saved] = await host.list(); await host.open(saved.key);
    assert.equal(names.includes('fixture-default'), expected, preference); await host.close();
  }
  await assert.rejects(stat(join(agentDir, 'trust.json')), { code: 'ENOENT' });
});

test('does not install missing packages while discovering skills', async (t) => {
  const { cwd, agentDir, options, seed } = await setup(t); await seed();
  await mkdir(join(cwd, '.pi'), { recursive: true });
  await writeFile(join(cwd, '.pi', 'settings.json'), JSON.stringify({ packages: ['npm:@fixture/never-install-this@1.0.0'] }));
  new ProjectTrustStore(agentDir).set(cwd, true);
  const original = DefaultPackageManager.prototype.installParsedSource, offline = process.env.PI_OFFLINE;
  let attempts = 0;
  DefaultPackageManager.prototype.installParsedSource = async () => { attempts++; throw new Error('Unexpected installation'); };
  delete process.env.PI_OFFLINE;
  try {
    const host = createAgentHost(options); const [saved] = await host.list(); await host.open(saved.key);
    assert.equal(attempts, 0); assert.match(host.snapshot().warning, /uninstalled Pi package/); await host.close();
  } finally {
    DefaultPackageManager.prototype.installParsedSource = original;
    if (offline === undefined) delete process.env.PI_OFFLINE; else process.env.PI_OFFLINE = offline;
  }
});

test('reloads the open session and picks up skills and context without losing history or its lock', async (t) => {
  const { cwd, agentDir, modelRuntime, faux, options, seed } = await setup(t); await seed();
  let runtimeSession;
  const host = createAgentHost({ ...options, makeSession: async ({ cwd: path, loader, settings, manager }) => {
    const result = await createAgentSession({ cwd: path, agentDir, resourceLoader: loader, settingsManager: settings, sessionManager: manager, modelRuntime, model: faux.getModel(), tools: ['read'] });
    runtimeSession = result.session; return result;
  } });
  const [saved] = await host.list(); const opened = await host.open(saved.key); const before = host.snapshot().messages;
  const [info] = await SessionManager.listAll(join(agentDir, 'sessions', 'project-group')); const original = await readFile(info.path);
  const dir = join(agentDir, 'skills', 'fixture-reload'); await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'SKILL.md'), '---\nname: fixture-reload\ndescription: Newly available skill\n---\nFull instructions\n');
  await writeFile(join(cwd, 'AGENTS.md'), 'New fixture context for reload.');
  assert.doesNotMatch(runtimeSession.systemPrompt, /fixture-reload|New fixture context/);
  const states = []; const unsubscribe = host.subscribe((event) => { if (event.type === 'snapshot') states.push(event.value); });
  const result = await host.reload(saved.key); unsubscribe();
  assert.equal(result.id, opened.id); assert.deepEqual(result.messages, before);
  assert.ok(states.some((state) => state?.reloading)); assert.equal(states.at(-1).reloading, false);
  assert.match(runtimeSession.systemPrompt, /fixture-reload/); assert.match(runtimeSession.systemPrompt, /New fixture context/);
  assert.doesNotMatch(runtimeSession.systemPrompt, /Full instructions/);
  assert.deepEqual(await readFile(info.path), original);
  const other = createAgentHost(options); await assert.rejects(other.open(saved.key), /already in use/);
  faux.setResponses([fauxAssistantMessage('Continued after reload.')]); await run(host, 'Continue');
  assert.ok(host.snapshot().messages.some((item) => item.text === 'Continued after reload.')); await host.close();
});

test('guards session activity during reload and reports partial reload failure', async (t) => {
  const { options, seed } = await setup(t); await seed(); let runtimeSession;
  const host = createAgentHost({ ...options, makeSession: async (args) => { const result = await options.makeSession(args); runtimeSession = result.session; return result; } });
  const [saved] = await host.list(); await host.open(saved.key);
  const original = DefaultPackageManager.prototype.resolve; let unblock, started;
  const gate = new Promise((resolve) => { unblock = resolve; });
  const began = new Promise((resolve) => { started = resolve; });
  DefaultPackageManager.prototype.resolve = async function (...args) { started(); await gate; return original.apply(this, args); };
  try {
    const pending = host.reload(saved.key); await began;
    assert.equal(host.snapshot().reloading, true);
    assert.throws(() => host.send('Do not send'), /running/);
    await assert.rejects(host.close(), /finish opening/);
    await assert.rejects(host.reload(saved.key), /finish opening or reloading/);
    unblock(); await pending;
  } finally { unblock(); DefaultPackageManager.prototype.resolve = original; }
  const events = []; const unsubscribe = host.subscribe((event) => events.push(event));
  const priorReload = runtimeSession.reload; runtimeSession.reload = async () => { throw new Error('Synthetic reload failure'); };
  try {
    await assert.rejects(host.reload(saved.key), /partially reloaded/);
    assert.equal(host.snapshot().reloading, false); assert.equal(host.snapshot().key, saved.key);
    assert.ok(events.some((event) => event.type === 'error' && /partially reloaded/.test(event.message)));
    const other = createAgentHost(options); await assert.rejects(other.open(saved.key), /already in use/);
  } finally { runtimeSession.reload = priorReload; unsubscribe(); await host.close(); }
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

test('refuses reload while a run is active or the session key is stale', async (t) => {
  const { cwd, faux, options, seed } = await setup(t, { tokensPerSecond: 30 }); await seed(); const host = createAgentHost(options);
  faux.setResponses([fauxAssistantMessage('Slow synthetic response. '.repeat(100))]);
  const [saved] = await host.list(); await host.open(saved.key);
  await assert.rejects(host.reload('0'.repeat(64)), /Session changed/);
  host.send('Running'); await assert.rejects(host.reload(saved.key), /Stop the current run/);
  await assert.rejects(host.createSession(cwd), /Stop the current run/);
  await host.stop(); await host.close();
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
