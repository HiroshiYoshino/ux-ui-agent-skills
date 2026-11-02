import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

/** Expand the file globs in the plan without depending on a shell. */
export function expandArgs(args, cwd) {
  return args.flatMap(arg => {
    if (arg.startsWith('-') || !/[*?]/.test(arg)) return [arg];
    const dir = dirname(arg);
    if (/[*?]/.test(dir)) throw new Error(`Glob directories are not supported: ${arg}`);
    const pattern = basename(arg).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    const re = new RegExp(`^${pattern}$`);
    const matches = readdirSync(resolve(cwd, dir), { withFileTypes: true })
      .filter(e => e.isFile() && re.test(e.name)).map(e => join(dir, e.name)).sort();
    if (!matches.length) throw new Error(`No files match: ${arg}`);
    return matches;
  });
}

async function terminate(child) {
  if (!child.pid) return null;
  if (process.platform === 'win32') {
    return new Promise(resolveKill => {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      const fallback = message => {
        try { child.kill(); } catch (e) { message += `; ${e.message}`; }
        resolveKill(message);
      };
      killer.once('error', e => fallback(e.message));
      killer.once('exit', code => {
        if (code === 0) resolveKill(null);
        else fallback(`process-tree termination exited ${code}; direct termination requested`);
      });
    });
  }
  try { process.kill(-child.pid, 'SIGKILL'); return null; }
  catch (e) { if (e.code !== 'ESRCH') { child.kill('SIGKILL'); return e.message; } return null; }
}

/** A timeout, failed launch or skipped measurement never satisfies an expected exit. */
export async function runStep(step, { cwd = process.cwd(), env = {}, timeoutMs, onOutput } = {}) {
  const at = performance.now();
  const result = { command: step.command, args: step.args, expectedExit: step.expectedExit ?? 0,
    code: null, signal: null, output: '', status: 'error', elapsedMs: 0, timedOut: false };
  const budget = timeoutMs ?? step.timeoutMs ?? 180000;
  if (!Number.isFinite(budget) || budget <= 0) return { ...result, error: 'timeoutMs must be positive' };
  let args;
  try { args = step.expandGlobs ? expandArgs(step.args, cwd) : [...step.args]; }
  catch (e) { return { ...result, error: e.message, elapsedMs: performance.now() - at }; }
  if (step.command === 'node' && args.includes('--test') && !args.some(a => a.startsWith('--test-reporter'))) {
    args.splice(args.indexOf('--test') + 1, 0, '--test-reporter=tap');
  }
  result.args = args;
  const command = step.command === 'node' ? process.execPath : step.command;
  const childEnv = { ...process.env, ...env, DS_REQUIRE_BROWSER: '1', UX_UI_PROJECT_ROOT: cwd };
  delete childEnv.NODE_TEST_CONTEXT;
  return new Promise(done => {
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true,
      detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
      env: childEnv });
    let finished = false, timer, forceTimer;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer); clearTimeout(forceTimer);
      result.elapsedMs = performance.now() - at;
      const skipped = /^(?!#|ok |not ok ).*\bSKIPPED\b/m.test(result.output) || /^# skipped [1-9]\d*/m.test(result.output);
      result.status = result.timedOut ? 'timeout' : result.error ? 'error' : skipped ? 'skipped'
        : result.code === result.expectedExit && (!step.expectedOutput || result.output.includes(step.expectedOutput)) ? 'pass' : 'fail';
      done(result);
    };
    const stop = () => {
      if (forceTimer) return;
      clearTimeout(timer);
      void terminate(child).then(error => { result.cleanupError = error; });
      // A descendant holding a pipe must not keep the report waiting indefinitely.
      forceTimer = setTimeout(() => {
        child.stdout.destroy(); child.stderr.destroy(); child.unref(); finish();
      }, 2000);
    };
    const collect = chunk => {
      const text = chunk.toString('utf8');
      if (result.output.length > 8 * 1024 * 1024) return;
      result.output += text;
      onOutput?.(text);
      if (result.output.length > 8 * 1024 * 1024 && !result.error) {
        result.error = 'output exceeded 8 MiB';
        stop();
      }
    };
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    child.once('error', e => { result.error = e.message; finish(); });
    child.once('close', (code, signal) => { result.code = code; result.signal = signal; finish(); });
    timer = setTimeout(() => {
      result.timedOut = true;
      stop();
    }, budget);
  });
}

export async function runCheck(steps, options = {}) {
  const started = performance.now(), results = [];
  for (const [index, step] of steps.entries()) {
    options.onStart?.(step, index, steps.length);
    const result = await runStep(step, options);
    results.push(result);
    options.onEnd?.(result, index, steps.length);
    if (result.status !== 'pass') break;
  }
  return { status: results.length === steps.length && results.every(r => r.status === 'pass') ? 'pass' : 'fail',
    plannedSteps: steps.length, steps: results, elapsedMs: performance.now() - started };
}
