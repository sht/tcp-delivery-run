# Courier delivery page

[![Vercel deployment](https://img.shields.io/github/deployments/sht/tcp-delivery-run/Production?label=vercel&logo=vercel)](https://github.com/sht/tcp-delivery-run/deployments)

Password protected page that shows the courier their orders for today and tomorrow, with call, navigate, route and "delivered" ticks. Hosted on Vercel: `index.html` is the page, `api/` holds the functions that keep the API key and courier token server side.

## Setup

1. Import the repo in Vercel (no build settings needed).
2. Add the env vars from `.env.example` in Project Settings → Environment Variables.
3. Deploy and share the URL and password with the courier.

Generate a session secret with `openssl rand -hex 32`. Use a long password, for example 4 random words.

## Env vars

| Name | Purpose |
|---|---|
| `API_BASE_URL` | `https://thecurryproject.de` |
| `API_KEY` | sent as `x-api-key` |
| `COURIER_TOKEN` | sent as `x-courier-token` |
| `COURIER_PASSWORD` | password the courier types |
| `SESSION_SECRET` | signs the session cookie |
| `KITCHEN_LAT`, `KITCHEN_LNG` | kitchen location, start of every run |
| `MOCK_ORDERS` | optional, testing only: `1` serves fake orders from `fixtures/orders.json` instead of calling the API. Leave unset in production. |

## Rotating secrets

Change the value in Vercel, then redeploy (Deployments → latest → Redeploy). Vercel only picks up env changes on a new deployment.

- Changing `COURIER_PASSWORD` or `SESSION_SECRET` logs out every device immediately.
- Changing `API_KEY` or `COURIER_TOKEN` does not affect logged-in sessions.

## How access works

- `POST /api/login` checks the password and sets an `HttpOnly` session cookie valid for 7 days. Wrong passwords get a 1 second delay.
- `GET /api/orders` requires the cookie, fetches today's and tomorrow's orders (Europe/Berlin) from the API with `?date=`. Phone numbers are only passed on for today's orders.
- "Delivered" ticks are stored on the courier's phone only (see `TODO.md`).

## Route planning

`lib/route.js` plans 1 run per day, starting from the kitchen at 10:00 (runs in the browser):

- Weekdays: stops are grouped by `delivery_window` in time order, each group is ordered from where the previous one ended. Up to 15 min early is allowed, stops that miss their window are marked late.
- Weekends: no windows, all stops ordered as 1 group.
- Ordering: brute force up to 8 stops, nearest neighbour + 2-opt above. Straight-line distance × 1.3 at 15 km/h, 3 min per handover.
- After a "delivered" tick, the rest is re-planned from that stop.

## Local development

```sh
npm i -g vercel
cp .env.example .env   # fill in values
vercel dev
```
