# TODO

## Base44

- Add an endpoint to set an order's status to `delivered`. Then add a `POST /api/delivered` proxy function and replace the `localStorage` ticks in `index.html` with it, so delivered status is visible centrally.

## Later

- Optimized route order (Google Directions API with `optimize:true`). Needs a Google Maps API key, stored as an env var.
- Vercel Firewall rate limit rule on `/api/login` if password guessing shows up in logs.
