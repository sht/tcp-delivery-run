import { checkPassword, sessionCookie } from '../lib/session.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();

  if (!checkPassword(req.body?.password)) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return res.status(401).json({ error: 'Wrong password' });
  }

  res.setHeader('Set-Cookie', sessionCookie());
  res.status(204).end();
}
