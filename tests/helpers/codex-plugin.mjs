/**
 * Helpers for the Codex plugin tests: an isolated copy of the repository (what a
 * git checkout hands Codex), and a driver for `codex app-server`.
 */
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import readline from 'node:readline';
import { ROOT } from './run.mjs';

/** A directory name with a space and Japanese, which is where paths go wrong. */
export const AWKWARD = '取得先 cache';

export function tempDir(label = 'codex-plugin') {
  return mkdtempSync(join(tmpdir(), `${label}-`));
}

/**
 * Copy what a clone would contain: every tracked file plus new files that are
 * not ignored. Nothing a developer's checkout happens to carry (node_modules,
 * receipts) comes along, so a file the plugin needs but git does not hold is
 * missing here exactly as it would be on a user's machine.
 */
export function isolatedCheckout(into = tempDir()) {
  const dest = join(into, AWKWARD, 'ux ui agent skills');
  const list = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (list.status !== 0) throw new Error(`git ls-files failed: ${list.stderr}`);
  for (const rel of list.stdout.split('\0').filter(Boolean)) {
    mkdirSync(dirname(join(dest, rel)), { recursive: true });
    cpSync(join(ROOT, rel), join(dest, rel));
  }
  return dest;
}

/** The codex binary to test against, or null. CODEX_BIN wins over PATH. */
export function findCodex() {
  const bin = process.env.CODEX_BIN || 'codex';
  const r = spawnSync(bin, ['--version'], { encoding: 'utf8', env: { ...process.env, CODEX_HOME: tempDir('codex-probe') } });
  if (r.status !== 0) return null;
  return { bin, version: (r.stdout || '').trim() };
}

/** Run the codex CLI with an isolated CODEX_HOME. Never touches the real one. */
export function codex(bin, home, args, opts = {}) {
  const r = spawnSync(bin, args, {
    cwd: opts.cwd,
    encoding: 'utf8',
    timeout: opts.timeout ?? 180000,
    env: { ...process.env, CODEX_HOME: home, ...(opts.env || {}) },
  });
  const stdout = r.stdout || '';
  const stderr = (r.stderr || '').split('\n').filter((l) => !l.startsWith('WARNING: proceeding, even though we could not create PATH aliases')).join('\n');
  return { status: r.status, stdout, stderr, out: stdout + stderr };
}

/** Call app-server methods over stdio JSON-RPC. Resolves to { method: result|error }. */
export async function appServer(bin, home, cwd, calls, timeoutMs = 90000) {
  const p = spawn(bin, ['app-server'], { cwd, env: { ...process.env, CODEX_HOME: home }, stdio: ['pipe', 'pipe', 'ignore'] });
  const rl = readline.createInterface({ input: p.stdout });
  const pending = new Map();
  let id = 0;
  rl.on('line', (line) => {
    let m; try { m = JSON.parse(line); } catch { return; }
    if (m.id !== undefined && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params) => new Promise((resolve) => {
    const i = ++id;
    const timer = setTimeout(() => { pending.delete(i); resolve({ error: { message: `timeout: ${method}` } }); }, timeoutMs);
    pending.set(i, (m) => { clearTimeout(timer); resolve(m); });
    p.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: i, method, params })}\n`);
  });
  try {
    await send('initialize', { clientInfo: { name: 'ux-ui-agent-skills-test', version: '0' }, capabilities: {} });
    p.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'initialized' })}\n`);
    const out = {};
    for (const [method, params] of calls) {
      const m = await send(method, params);
      out[method] = m.error ? { error: m.error } : m.result;
    }
    return out;
  } finally {
    p.kill();
  }
}
