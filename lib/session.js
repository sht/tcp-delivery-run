import crypto from 'node:crypto';

const MAX_AGE = 7 * 24 * 60 * 60;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest();

function sign(expiry) {
  const passwordHash = sha256(process.env.COURIER_PASSWORD).toString('hex');
  return crypto
    .createHmac('sha256', process.env.SESSION_SECRET)
    .update(`${expiry}.${passwordHash}`)
    .digest('hex');
}

export function checkPassword(password) {
  if (typeof password !== 'string' || !process.env.COURIER_PASSWORD) return false;
  return crypto.timingSafeEqual(sha256(password), sha256(process.env.COURIER_PASSWORD));
}

export function sessionCookie() {
  const expiry = Math.floor(Date.now() / 1000) + MAX_AGE;
  return `session=${expiry}.${sign(expiry)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`;
}

export const clearCookie = 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';

export function isAuthenticated(req) {
  const match = /(?:^|;\s*)session=(\d+)\.([a-f0-9]{64})/.exec(req.headers.cookie || '');
  if (!match) return false;
  const [, expiry, mac] = match;
  if (Number(expiry) < Date.now() / 1000) return false;
  return crypto.timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(sign(expiry), 'hex'));
}
