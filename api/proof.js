import { randomUUID } from 'node:crypto';
import { db, isAdmin, reply, sameOrigin } from '../lib/shared.js';
import { demoMode, demoPayments, saveDemoPayments } from '../lib/demo.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { error: 'Método não permitido.' });
  if (!isAdmin(req)) return reply(res, 401, { error: 'Acesso restrito.' });
  if (!sameOrigin(req)) return reply(res, 403, { error: 'Origem inválida.' });
  const { id, kind, data, mime } = req.body || {};
  if (!/^[0-9a-f-]{36}$/i.test(String(id)) || !['crypto', 'pix'].includes(kind) || !['image/jpeg', 'image/png', 'image/webp'].includes(mime) || typeof data !== 'string' || data.length > 2800000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    return reply(res, 400, { error: 'Envie uma imagem JPG, PNG ou WebP de até 2 MB.' });
  }
  try {
    const bytes = Buffer.from(data, 'base64');
    if (bytes.length > 2000000 || bytes.length === 0) return reply(res, 400, { error: 'Imagem acima de 2 MB.' });
    const matches = mime === 'image/jpeg' ? bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
      : mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!matches) return reply(res, 400, { error: 'Formato de imagem inválido.' });
    if (demoMode()) {
      const rows = demoPayments();
      const row = rows.find(p => p.id === id);
      if (!row) return reply(res, 404, { error: 'Transação não encontrada.' });
      row[`${kind}_proof`] = `data:${mime};base64,${data}`;
      saveDemoPayments(rows);
      return reply(res, 200, { ok: true });
    }
    const client = db();
    const { data: row, error: readError } = await client.from('payments').select('id,crypto_proof,pix_proof').eq('id', id).maybeSingle();
    if (readError) throw readError;
    if (!row) return reply(res, 404, { error: 'Transação não encontrada.' });
    const extension = mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp';
    const path = `${id}/${kind}-${randomUUID()}.${extension}`;
    const uploaded = await client.storage.from('payment-proofs').upload(path, bytes, { contentType: mime, upsert: false });
    if (uploaded.error) throw uploaded.error;
    const field = `${kind}_proof`;
    const saved = await client.from('payments').update({ [field]: path }).eq('id', id);
    if (saved.error) throw saved.error;
    if (row[field]) {
      const removed = await client.storage.from('payment-proofs').remove([row[field]]);
      if (removed.error) console.error('Falha ao remover comprovante antigo:', removed.error);
    }
    return reply(res, 200, { ok: true });
  } catch (error) {
    console.error(error);
    return reply(res, 500, { error: 'Não foi possível anexar o comprovante.' });
  }
}
