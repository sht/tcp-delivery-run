import { clearCookie } from '../lib/session.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Set-Cookie', clearCookie);
  res.status(204).end();
}
