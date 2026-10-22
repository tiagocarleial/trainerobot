export function parseSix(value, max) {
  const text = String(value);
  if (!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,6})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const units = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0') || '0');
  if (units <= 0n || units > BigInt(max) * 1000000n) return null;
  return units;
}

export function pixAmount(usdc, rate) {
  const a = parseSix(usdc, 1000000);
  const b = parseSix(rate, 1000);
  if (a === null || b === null) return null;
  const cents = (a * b * 80n + 500000000000n) / 1000000000000n;
  return Number(cents) / 100;
}
