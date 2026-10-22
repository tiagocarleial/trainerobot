import { adminCookie, isAdmin, reply, safeEqual, sameOrigin } from '../lib/shared.js';

export default function handler(req, res) {
  if (req.method === 'GET') return reply(res, 200, { authenticated: isAdmin(req) });
  if (req.method !== 'POST') return reply(res, 405, { error: 'Método não permitido.' });
  if (!sameOrigin(req)) return reply(res, 403, { error: 'Origem inválida.' });
  if (req.body?.action === 'logout') {
    res.setHeader('Set-Cookie', 'tr_admin=; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=0');
    return reply(res, 200, { authenticated: false });
  }
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET) return reply(res, 503, { error: 'Acesso administrativo ainda não configurado.' });
  if (!safeEqual(String(req.body?.password || ''), process.env.ADMIN_PASSWORD)) return reply(res, 401, { error: 'Senha incorreta.' });
  res.setHeader('Set-Cookie', adminCookie());
  return reply(res, 200, { authenticated: true });
}
