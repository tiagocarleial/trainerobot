import { db, isAdmin, reply, sameOrigin } from '../lib/shared.js';

const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');

export default async function handler(req, res) {
  if (!isAdmin(req)) return reply(res, 401, { error: 'Acesso restrito.' });
  try {
    const client = db();
    if (req.method === 'GET') {
      const deposits = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await client.from('base_deposits')
          .select('id,tx_hash,log_index,from_address,usdc_amount,block_number,detected_at,payment_id')
          .order('detected_at', { ascending: false }).range(from, from + 999);
        if (error) throw error;
        deposits.push(...data);
        if (data.length < 1000) break;
      }
      return reply(res, 200, { deposits, configured: !!(process.env.BASE_RPC_URL && process.env.ALCHEMY_WEBHOOK_SIGNING_KEY) });
    }
    if (req.method !== 'POST') return reply(res, 405, { error: 'Método não permitido.' });
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Origem inválida.' });
    const { deposit_id, payment_id } = req.body || {};
    if (!uuid(deposit_id) || !uuid(payment_id)) return reply(res, 400, { error: 'Depósito ou transação inválidos.' });
    const { error } = await client.rpc('assign_base_usdc_deposit', { deposit_id, target_payment_id: payment_id });
    if (error) return reply(res, 409, { error: error.message });
    return reply(res, 200, { assigned: true });
  } catch (error) {
    console.error(error);
    return reply(res, 500, { error: 'Não foi possível carregar ou associar depósitos.' });
  }
}
