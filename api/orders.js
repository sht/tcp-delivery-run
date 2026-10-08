import { isAuthenticated } from '../lib/session.js';

const berlinDate = (offsetDays) =>
  new Date(Date.now() + offsetDays * 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Not logged in' });

  let data;
  try {
    const upstream = await fetch(`${process.env.API_BASE_URL}/functions/getCourierOrders?all&limit=100`, {
      headers: {
        'x-api-key': process.env.API_KEY,
        'x-courier-token': process.env.COURIER_TOKEN,
      },
    });
    if (!upstream.ok) throw new Error(`Upstream ${upstream.status}`);
    data = await upstream.json();
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: 'Could not load orders' });
  }

  const today = berlinDate(0);
  const tomorrow = berlinDate(1);
  const orders = (data.orders || [])
    .filter((o) => o.fulfillment_date === today || o.fulfillment_date === tomorrow)
    .sort((a, b) =>
      a.fulfillment_date.localeCompare(b.fulfillment_date) || (a.meal_time || '').localeCompare(b.meal_time || ''));

  res.status(200).json({ courier: data.courier, today, tomorrow, orders });
}
