import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/auth.js';

function response() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; }
  };
}

test('painel exige senha e origem válida', () => {
  process.env.ADMIN_PASSWORD = 'test-password-long';
  process.env.ADMIN_SESSION_SECRET = 'test-secret-long-unique';
  const blocked = response();
  handler({ method: 'POST', headers: { origin: 'https://evil.example', host: 'site.example' }, body: { password: 'test-password-long' } }, blocked);
  assert.equal(blocked.statusCode, 403);

  const wrong = response();
  handler({ method: 'POST', headers: { origin: 'https://site.example', host: 'site.example' }, body: { password: 'wrong' } }, wrong);
  assert.equal(wrong.statusCode, 401);

  const logged = response();
  handler({ method: 'POST', headers: { origin: 'https://site.example', host: 'site.example' }, body: { password: 'test-password-long' } }, logged);
  assert.equal(logged.statusCode, 200);
  assert.match(logged.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Strict/);

  const check = response();
  handler({ method: 'GET', headers: { cookie: logged.headers['Set-Cookie'].split(';')[0] } }, check);
  assert.equal(check.data.authenticated, true);
});
