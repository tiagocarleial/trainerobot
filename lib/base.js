export const BASE_RECEIVE_ADDRESS = '0x8f362ECd2DF3FBa1F3Ffd74CE73F4325965767cB';
export const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export const address = value => typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);
export const normalized = value => String(value || '').toLowerCase();

export function usdcFromRaw(raw) {
  if (!/^0x[a-fA-F0-9]{1,64}$/.test(raw || '')) throw new Error('Valor USDC inválido.');
  const value = BigInt(raw);
  if (value <= 0n || value > 999999999999999999n) throw new Error('Valor USDC fora do limite.');
  return `${value / 1000000n}.${String(value % 1000000n).padStart(6, '0')}`;
}

export function parseTransferLog(log) {
  if (normalized(log?.address) !== normalized(BASE_USDC_ADDRESS) ||
      normalized(log?.topics?.[0]) !== TRANSFER_TOPIC || log.topics?.length !== 3 ||
      !/^0x[a-fA-F0-9]{64}$/.test(log.topics[1]) || !/^0x[a-fA-F0-9]{64}$/.test(log.topics[2]) ||
      normalized(`0x${log.topics[2].slice(-40)}`) !== normalized(BASE_RECEIVE_ADDRESS) ||
      !/^0x[a-fA-F0-9]{64}$/.test(log.data || '')) return null;
  return {
    tx_hash: normalized(log.transactionHash),
    log_index: Number(BigInt(log.logIndex)),
    from_address: normalized(`0x${log.topics[1].slice(-40)}`),
    to_address: normalized(BASE_RECEIVE_ADDRESS),
    usdc_amount: usdcFromRaw(log.data),
    block_number: Number(BigInt(log.blockNumber))
  };
}
