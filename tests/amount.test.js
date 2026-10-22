import test from 'node:test';
import assert from 'node:assert/strict';
import { pixAmount } from '../lib/amount.js';

test('5 USDC, cotação R$ 5,00, desconto de 20%', () => {
  assert.equal(pixAmount('5', '5'), 20);
});

test('arredonda o PIX para centavos', () => {
  assert.equal(pixAmount('1', '5.555555'), 4.44);
  assert.equal(pixAmount('0.01', '5'), 0.04);
});

test('recusa entradas fora da precisão ou limites', () => {
  assert.equal(pixAmount('1.0000001', '5'), null);
  assert.equal(pixAmount('-1', '5'), null);
  assert.equal(pixAmount('5', '1001'), null);
});
