import { isAuthenticated } from '../lib/session.js';

// TODAY=YYYY-MM-DD overrides the current date, for testing only.
function berlinDate(offsetDays) {
  const base = process.env.TODAY ? new Date(`${process.env.TODAY}T12:00:00Z`) : new Date();
  return new Date(base.getTime() + offsetDays * 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
}

async function fetchOrders(date) {
  const upstream = await fetch(`${process.env.API_BASE_URL}/functions/getCourierOrders?date=${date}&limit=100`, {
    headers: {
      'x-api-key': process.env.API_KEY,
      'x-courier-token': process.env.COURIER_TOKEN,
    },
  });
  if (!upstream.ok) throw new Error(`Upstream ${upstream.status} for ${date}`);
  return upstream.json();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Not logged in' });

  const today = berlinDate(0);
  const tomorrow = berlinDate(1);

  let results;
  try {
    results = await Promise.all([fetchOrders(today), fetchOrders(tomorrow)]);
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: 'Could not load orders' });
  }

  const orders = results
    .flatMap((r) => r.orders || [])
    .filter((o) => o.fulfillment_date === today || o.fulfillment_date === tomorrow)
    .sort((a, b) =>
      a.fulfillment_date.localeCompare(b.fulfillment_date) || (a.meal_time || '').localeCompare(b.meal_time || ''));

  res.status(200).json({ courier: results[0].courier, today, tomorrow, orders });
}
