import { isAuthenticated } from '../lib/session.js';

const berlinDate = (offsetDays) =>
  new Date(Date.now() + offsetDays * 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });

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

// MOCK_ORDERS=1 serves fake orders from fixtures/orders.json, for local testing only.
async function mockOrders() {
  const { default: fixture } = await import('../fixtures/orders.json', { with: { type: 'json' } });
  const forDay = (day) => fixture.orders.filter((o) => o.day === day).map(({ day: _, ...o }) => o);
  return [
    { courier: fixture.courier, orders: forDay('today') },
    { courier: fixture.courier, orders: forDay('tomorrow') },
  ];
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Not logged in' });

  const today = berlinDate(0);
  const tomorrow = berlinDate(1);

  let results;
  try {
    results = process.env.MOCK_ORDERS === '1'
      ? await mockOrders()
      : await Promise.all([fetchOrders(today), fetchOrders(tomorrow)]);
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: 'Could not load orders' });
  }

  const tag = (orders, date) => (orders || []).map((o) => ({
    ...o,
    fulfillment_date: date,
    customer_phone: date === today ? o.customer_phone : null,
  }));
  const orders = [...tag(results[0].orders, today), ...tag(results[1].orders, tomorrow)]
    .sort((a, b) =>
      a.fulfillment_date.localeCompare(b.fulfillment_date) || (a.meal_time || '').localeCompare(b.meal_time || ''));

  res.status(200).json({ courier: results[0].courier, today, tomorrow, orders });
}
