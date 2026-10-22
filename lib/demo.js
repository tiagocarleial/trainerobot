import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { token } from './shared.js';

const file = join(process.cwd(), '.dev-payments.json');
export const demoMode = () => process.env.PAYMENTS_DEMO_MODE === '1' && process.env.VERCEL_ENV !== 'production';

export function demoPayments() {
  if (existsSync(file)) {
    const rows = JSON.parse(readFileSync(file, 'utf8'));
    let migrated = false;
    for (const row of rows) {
      if (!row.client_token) { row.client_token = row.view_token; migrated = true; }
      if (row.telegram_handle === undefined) { row.telegram_handle = ''; migrated = true; }
      if (row.client_name === 'Cliente exemplo' && !row.telegram_handle) { row.telegram_handle = '@cliente_exemplo'; migrated = true; }
    }
    if (migrated) saveDemoPayments(rows);
    return rows;
  }
  const sample = [{
    id: randomUUID(), view_token: token(), client_token: token(), client_name: 'Cliente exemplo', telegram_handle: '@cliente_exemplo',
    wallet_address: '', sender_address: '', usdc_amount: '5', rate_brl: '5',
    exchange_at: new Date().toISOString(), fee_percent: 20, pix_amount: 20,
    pix_key: '', crypto_tx_hash: '', crypto_proof: null, pix_proof: null,
    status: 'recebido', notes: 'Registro de demonstração',
    created_at: new Date().toISOString(), received_at: new Date().toISOString(), paid_at: null
  }];
  writeFileSync(file, JSON.stringify(sample, null, 2));
  return sample;
}

export function saveDemoPayments(payments) {
  writeFileSync(file, JSON.stringify(payments, null, 2));
}
