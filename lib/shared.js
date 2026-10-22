import { createClient } from '@supabase/supabase-js';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Configure SUPABASE_URL e SUPABASE_SECRET_KEY.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function reply(res, status, data) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(data);
}

export function sameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    const localHttp = process.env.VERCEL_ENV !== 'production' && parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
    return parsed.host === host && (parsed.protocol === 'https:' || localHttp);
  }
  catch { return false; }
}

function signature(value) {
  return createHmac('sha256', process.env.ADMIN_SESSION_SECRET || '').update(value).digest('hex');
}

export function adminCookie() {
  const value = `${Date.now()}.${randomBytes(16).toString('hex')}`;
  return `tr_admin=${value}.${signature(value)}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=43200`;
}

export function isAdmin(req) {
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET) return false;
  const match = (req.headers.cookie || '').match(/(?:^|;\s*)tr_admin=([^;]+)/);
  if (!match) return false;
  const parts = match[1].split('.');
  if (parts.length !== 3) return false;
  const [time, nonce, mac] = parts;
  if (!/^\d{13}$/.test(time) || !/^[a-f0-9]{32}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(mac)) return false;
  if (Date.now() - Number(time) > 43200000 || Number(time) > Date.now()) return false;
  return timingSafeEqual(Buffer.from(mac), Buffer.from(signature(`${time}.${nonce}`)));
}

export function safeEqual(a, b) {
  const aa = Buffer.from(a || '');
  const bb = Buffer.from(b || '');
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

export function token() { return randomBytes(32).toString('base64url'); }

export async function signedProofs(client, row) {
  const proofs = {};
  for (const field of ['crypto_proof', 'pix_proof']) {
    if (!row[field]) continue;
    const { data, error } = await client.storage.from('payment-proofs').createSignedUrl(row[field], 300);
    if (error) throw error;
    proofs[field] = data.signedUrl;
  }
  return proofs;
}
