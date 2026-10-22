import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_RECEIVE_ADDRESS, BASE_USDC_ADDRESS, TRANSFER_TOPIC, parseTransferLog } from '../lib/base.js';

const padded = address => `0x${'0'.repeat(24)}${address.slice(2).toLowerCase()}`;
const sender = '0x1111111111111111111111111111111111111111';
const log = {
  address: BASE_USDC_ADDRESS,
  topics: [TRANSFER_TOPIC, padded(sender), padded(BASE_RECEIVE_ADDRESS)],
  data: `0x${(5000000n).toString(16).padStart(64, '0')}`,
  transactionHash: `0x${'a'.repeat(64)}`,
  logIndex: '0x2', blockNumber: '0x2105'
};

test('identifica 5 USDC nativos enviados à carteira Base', () => {
  assert.deepEqual(parseTransferLog(log), {
    tx_hash: log.transactionHash, log_index: 2, from_address: sender,
    to_address: BASE_RECEIVE_ADDRESS.toLowerCase(), usdc_amount: '5.000000', block_number: 8453
  });
});

test('recusa outro token ou outra carteira de destino', () => {
  assert.equal(parseTransferLog({ ...log, address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA' }), null);
  assert.equal(parseTransferLog({ ...log, topics: [TRANSFER_TOPIC, padded(sender), padded(sender)] }), null);
});
