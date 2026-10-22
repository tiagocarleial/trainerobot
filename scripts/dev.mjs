import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const env = { ...process.env };
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && ['ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET', 'PAYMENTS_DEMO_MODE'].includes(match[1])) env[match[1]] = match[2];
  }
}

const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(command, ['exec', '--yes', '--package=vercel', '--', 'vercel', 'dev', '--yes'], {
  stdio: 'inherit', env, shell: process.platform === 'win32'
});
child.on('exit', code => { process.exitCode = code ?? 1; });
