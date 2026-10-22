import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

function response() {
  return {
    statusCode: 200,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; }
  };
}

test('depósito provisório fica privado até ser identificado e aceita ajuste do PIX', async () => {
  const originalCwd = process.cwd();
  const dir = mkdtempSync(join(tmpdir(), 'trainerobot-provisional-'));
  const oldEnv = Object.fromEntries(['PAYMENTS_DEMO_MODE', 'VERCEL_ENV', 'ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET'].map(key => [key, process.env[key]]));
  try {
    process.chdir(dir);
    process.env.PAYMENTS_DEMO_MODE = '1';
    delete process.env.VERCEL_ENV;
    process.env.ADMIN_PASSWORD = 'test-password';
    process.env.ADMIN_SESSION_SECRET = 'test-session-secret';
    const { default: handler } = await import('../api/transactions.js');
    const { adminCookie } = await import('../lib/shared.js');
    const id = randomUUID();
    const hash = `0x${'a'.repeat(64)}`;
    const wallet = '0x8f362ECd2DF3FBa1F3Ffd74CE73F4325965767cB';
    const sender = '0x1111111111111111111111111111111111111111';
    writeFileSync('.dev-payments.json', JSON.stringify([{
      id, view_token: 'v'.repeat(43), client_token: 'c'.repeat(43), client_name: 'A identificar',
      telegram_handle: '', wallet_address: wallet, sender_address: sender, usdc_amount: '5.000000',
      rate_brl: null, exchange_at: null, fee_percent: 20, pix_amount: null, pix_manual: false,
      provisional: true, pix_key: '', crypto_tx_hash: hash, crypto_proof: null, pix_proof: null,
      status: 'recebido', notes: '', created_at: new Date().toISOString(), received_at: new Date().toISOString(), paid_at: null
    }]));
    const before = response();
    await handler({ method: 'GET', query: { all: '1' } }, before);
    assert.equal(before.data.payments.length, 0);

    const saved = response();
    await handler({
      method: 'POST', headers: { origin: 'https://site.example', host: 'site.example', cookie: adminCookie().split(';')[0] },
      body: { id, client_name: 'Maria', telegram_handle: '@maria', wallet_address: wallet,
        sender_address: sender, usdc_amount: '5', rate_brl: '5', exchange_at: new Date().toISOString(),
        pix_amount_override: '19.50', status: 'recebido', crypto_tx_hash: hash }
    }, saved);
    assert.equal(saved.statusCode, 200);
    assert.equal(saved.data.payment.client_name, 'Maria');
    assert.equal(saved.data.payment.pix_amount, 19.5);
    assert.equal(saved.data.payment.pix_manual, true);
    assert.equal(saved.data.payment.provisional, false);
    const after = response();
    await handler({ method: 'GET', query: { all: '1' } }, after);
    assert.equal(after.data.payments.length, 1);
  } finally {
    process.chdir(originalCwd);
    rmSync(dir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(oldEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
