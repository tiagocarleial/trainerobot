import { db, isAdmin, reply, sameOrigin, signedProofs, token } from '../lib/shared.js';
import { pixAmount } from '../lib/amount.js';
import { demoMode, demoPayments, saveDemoPayments } from '../lib/demo.js';
import { randomUUID } from 'node:crypto';

const fields = 'id,client_name,telegram_handle,client_token,wallet_address,usdc_amount,rate_brl,exchange_at,fee_percent,pix_amount,pix_key,crypto_tx_hash,crypto_proof,pix_proof,status,notes,created_at,received_at,paid_at,view_token';
const statuses = ['aguardando', 'recebido', 'pix_enviado'];
const validDate = value => typeof value === 'string' && !Number.isNaN(Date.parse(value));

function publicRow(row) {
  const { view_token, client_token, pix_key, notes, crypto_proof, pix_proof, ...visible } = row;
  return visible;
}

function globalRow(row) {
  const { id, client_name, telegram_handle, usdc_amount, rate_brl, exchange_at, fee_percent, pix_amount, status, created_at, received_at, paid_at, crypto_tx_hash } = row;
  return { id, client_name, telegram_handle, usdc_amount, rate_brl, exchange_at, fee_percent, pix_amount, status, created_at, received_at, paid_at, crypto_tx_hash };
}

function clean(row) {
  return {
    client_name: String(row.client_name || '').trim().slice(0, 120),
    telegram_handle: String(row.telegram_handle || '').trim().slice(0, 64),
    wallet_address: String(row.wallet_address || '').trim().slice(0, 100),
    usdc_amount: String(row.usdc_amount || ''),
    rate_brl: String(row.rate_brl || ''),
    exchange_at: row.exchange_at,
    pix_key: String(row.pix_key || '').trim().slice(0, 180),
    crypto_tx_hash: String(row.crypto_tx_hash || '').trim().slice(0, 100),
    notes: String(row.notes || '').trim().slice(0, 1000),
    status: row.status || 'aguardando'
  };
}

export default async function handler(req, res) {
  try {
    const demo = demoMode();
    const client = demo ? null : db();
    if (req.method === 'GET' && req.query?.all === '1') {
      if (demo) return reply(res, 200, { payments: demoPayments().map(globalRow) });
      const rows = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await client.from('payments').select('id,client_name,telegram_handle,usdc_amount,rate_brl,exchange_at,fee_percent,pix_amount,status,created_at,received_at,paid_at,crypto_tx_hash').order('created_at', { ascending: false }).range(from, from + 999);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 1000) break;
      }
      return reply(res, 200, { payments: rows });
    }
    if (req.method === 'GET' && (req.query?.client || req.query?.token)) {
      const requestedToken = String(req.query.client || req.query.token);
      if (!/^[A-Za-z0-9_-]{43}$/.test(requestedToken)) return reply(res, 404, { error: 'Usuário não encontrado.' });
      let clientToken = requestedToken;
      if (demo) {
        const rows = demoPayments();
        if (req.query.token) clientToken = rows.find(p => p.view_token === requestedToken)?.client_token;
        const matching = rows.filter(p => p.client_token === clientToken);
        if (!matching.length) return reply(res, 404, { error: 'Usuário não encontrado.' });
        return reply(res, 200, { payments: matching.map(publicRow), proofs: Object.fromEntries(matching.map(p => [p.id, { crypto_proof: p.crypto_proof, pix_proof: p.pix_proof }])) });
      }
      if (req.query.token) {
        const { data: first, error: findError } = await client.from('payments').select('client_token').eq('view_token', requestedToken).maybeSingle();
        if (findError) throw findError;
        clientToken = first?.client_token;
      }
      if (!clientToken) return reply(res, 404, { error: 'Usuário não encontrado.' });
      const rows = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await client.from('payments').select(fields).eq('client_token', clientToken).order('created_at', { ascending: false }).range(from, from + 999);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 1000) break;
      }
      if (!rows.length) return reply(res, 404, { error: 'Usuário não encontrado.' });
      return reply(res, 200, { payments: rows.map(publicRow), proofs: Object.fromEntries(await Promise.all(rows.map(async row => [row.id, await signedProofs(client, row)]))) });
    }
    if (!isAdmin(req)) return reply(res, 401, { error: 'Acesso restrito.' });
    if (req.method === 'GET') {
      if (demo) return reply(res, 200, { payments: demoPayments(), demo: true });
      const rows = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await client.from('payments').select(fields).order('created_at', { ascending: false }).range(from, from + 999);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 1000) break;
      }
      return reply(res, 200, { payments: rows });
    }
    if (req.method !== 'POST') return reply(res, 405, { error: 'Método não permitido.' });
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Origem inválida.' });
    const item = clean(req.body || {});
    const amount = pixAmount(item.usdc_amount, item.rate_brl);
    if (!item.client_name || amount === null || !validDate(item.exchange_at) || !statuses.includes(item.status) ||
        (item.telegram_handle && !/^@[A-Za-z0-9_]{1,32}$/.test(item.telegram_handle)) ||
        (item.wallet_address && !/^0x[a-fA-F0-9]{40}$/.test(item.wallet_address)) ||
        (item.crypto_tx_hash && !/^0x[a-fA-F0-9]{64}$/.test(item.crypto_tx_hash))) {
      return reply(res, 400, { error: 'Preencha nome, USDC, cotação, data e status válidos.' });
    }
    const payload = { ...item, fee_percent: 20, pix_amount: amount };
    const requestedClient = String(req.body?.client_token || '');
    if (requestedClient && !/^[A-Za-z0-9_-]{43}$/.test(requestedClient)) return reply(res, 400, { error: 'Usuário inválido.' });
    if (demo) {
      const rows = demoPayments();
      let row;
      if (req.body?.id) {
        row = rows.find(p => p.id === req.body.id);
        if (!row) return reply(res, 404, { error: 'Transação não encontrada.' });
        if (row.client_name !== item.client_name) return reply(res, 400, { error: 'O nome do usuário não pode ser alterado nesta transação.' });
        Object.assign(row, payload);
        row.received_at = item.status === 'aguardando' ? null : row.received_at || new Date().toISOString();
        row.paid_at = item.status === 'pix_enviado' ? row.paid_at || new Date().toISOString() : null;
      } else {
        const existing = requestedClient ? rows.find(p => p.client_token === requestedClient) : null;
        if (requestedClient && !existing) return reply(res, 400, { error: 'Usuário não encontrado.' });
        if (existing) payload.client_name = existing.client_name;
        row = { id: randomUUID(), view_token: token(), client_token: existing?.client_token || token(), ...payload,
          crypto_proof: null, pix_proof: null, created_at: new Date().toISOString(),
          received_at: item.status === 'aguardando' ? null : new Date().toISOString(),
          paid_at: item.status === 'pix_enviado' ? new Date().toISOString() : null };
        rows.unshift(row);
      }
      saveDemoPayments(rows);
      return reply(res, 200, { payment: row });
    }
    let result;
    if (req.body?.id) {
      const id = String(req.body.id);
      if (!/^[0-9a-f-]{36}$/i.test(id)) return reply(res, 400, { error: 'ID inválido.' });
      const { data: old, error: readError } = await client.from('payments').select('received_at,paid_at,client_name').eq('id', id).single();
      if (readError) throw readError;
      if (old.client_name !== item.client_name) return reply(res, 400, { error: 'O nome do usuário não pode ser alterado nesta transação.' });
      payload.received_at = item.status === 'aguardando' ? null : old.received_at || new Date().toISOString();
      payload.paid_at = item.status === 'pix_enviado' ? old.paid_at || new Date().toISOString() : null;
      result = await client.from('payments').update(payload).eq('id', id).select(fields).single();
    } else {
      if (requestedClient) {
        const { data: existing, error: findError } = await client.from('payments').select('client_name,client_token').eq('client_token', requestedClient).limit(1).maybeSingle();
        if (findError) throw findError;
        if (!existing) return reply(res, 400, { error: 'Usuário não encontrado.' });
        payload.client_name = existing.client_name;
        payload.client_token = existing.client_token;
      } else payload.client_token = token();
      payload.view_token = token();
      payload.received_at = item.status === 'aguardando' ? null : new Date().toISOString();
      payload.paid_at = item.status === 'pix_enviado' ? new Date().toISOString() : null;
      result = await client.from('payments').insert(payload).select(fields).single();
    }
    if (result.error) throw result.error;
    return reply(res, 200, { payment: result.data });
  } catch (error) {
    console.error(error);
    return reply(res, 500, { error: 'Não foi possível salvar ou carregar a transação.' });
  }
}
