import { createHmac, timingSafeEqual } from 'node:crypto';
import { db, reply } from '../lib/shared.js';
import { parseTransferLog } from '../lib/base.js';

export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1000000) throw new Error('Payload muito grande.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function authentic(raw, signature, key) {
  if (!key || !/^[a-f0-9]{64}$/i.test(signature || '')) return false;
  const actual = Buffer.from(signature, 'hex');
  const expected = createHmac('sha256', key).update(raw).digest();
  return timingSafeEqual(actual, expected);
}

async function rpc(method, params) {
  const endpoint = process.env.BASE_RPC_URL;
  if (!endpoint) throw new Error('Configure BASE_RPC_URL.');
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`RPC Base: HTTP ${response.status}`);
  const result = await response.json();
  if (result.error) throw new Error(`RPC Base: ${result.error.message}`);
  return result.result;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { error: 'Método não permitido.' });
  try {
    const raw = await rawBody(req);
    if (!authentic(raw, req.headers['x-alchemy-signature'], process.env.ALCHEMY_WEBHOOK_SIGNING_KEY))
      return reply(res, 401, { error: 'Assinatura inválida.' });
    const payload = JSON.parse(raw.toString('utf8'));
    if (payload.type !== 'ADDRESS_ACTIVITY' || !Array.isArray(payload.event?.activity))
      return reply(res, 200, { processed: 0 });
    const hashes = [...new Set(payload.event.activity.map(item => item.hash).filter(hash => /^0x[a-fA-F0-9]{64}$/.test(hash || '')))];
    if (!hashes.length) return reply(res, 200, { processed: 0 });
    if (await rpc('eth_chainId', []) !== '0x2105') throw new Error('BASE_RPC_URL não aponta para a Base mainnet.');
    const client = db();
    let processed = 0;
    for (const hash of hashes) {
      const tx = await rpc('eth_getTransactionReceipt', [hash]);
      if (!tx) throw new Error('Recibo ainda indisponível.');
      if (tx.status !== '0x1') continue;
      const block = await rpc('eth_getBlockByNumber', [tx.blockNumber, false]);
      if (!block || block.hash?.toLowerCase() !== tx.blockHash?.toLowerCase()) throw new Error('Bloco do recibo mudou.');
      const blockTime = new Date(Number(BigInt(block.timestamp)) * 1000).toISOString();
      for (const log of tx.logs || []) {
        const transfer = parseTransferLog(log);
        if (!transfer) continue;
        const { error } = await client.rpc('record_base_usdc_deposit', { deposit: { ...transfer, block_time: blockTime } });
        if (error) throw error;
        processed++;
      }
    }
    return reply(res, 200, { processed });
  } catch (error) {
    console.error('Falha ao processar webhook Base:', error);
    return reply(res, 503, { error: 'Falha temporária ao processar depósito.' });
  }
}
