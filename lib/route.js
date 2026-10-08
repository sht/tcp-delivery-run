// Route planning for 1 delivery run. Shared by the page (re-plans after "delivered" ticks).
// Times are minutes since midnight. Distances are straight-line, scaled by DETOUR for real streets.

const SPEED_KMH = 15;
const DETOUR = 1.3;
const HANDOVER_MIN = 3;
const EARLY_MIN = 15;
const BRUTE_FORCE_MAX = 8;

export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const travelMin = (a, b) => (a && b ? (distanceKm(a, b) * DETOUR * 60) / SPEED_KMH : 0);

export function parseWindow(value) {
  const m = /^(\d{2}):(\d{2})–(\d{2}):(\d{2})$/.exec(value || '');
  return m ? { start: m[1] * 60 + +m[2], end: m[3] * 60 + +m[4] } : null;
}

export const formatTime = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}`;

function pathKm(from, stops) {
  let km = 0;
  let pos = from;
  for (const s of stops) {
    if (pos) km += distanceKm(pos, s);
    pos = s;
  }
  return km;
}

function bruteForce(from, stops) {
  let best = stops;
  let bestKm = Infinity;
  const permute = (done, rest) => {
    if (!rest.length) {
      const km = pathKm(from, done);
      if (km < bestKm) [best, bestKm] = [done, km];
      return;
    }
    rest.forEach((s, i) => permute([...done, s], [...rest.slice(0, i), ...rest.slice(i + 1)]));
  };
  permute([], stops);
  return best;
}

function nearestNeighbour(from, stops) {
  const rest = [...stops];
  const route = [];
  let pos = from || rest[0];
  while (rest.length) {
    let i = 0;
    rest.forEach((s, j) => { if (distanceKm(pos, s) < distanceKm(pos, rest[i])) i = j; });
    pos = rest.splice(i, 1)[0];
    route.push(pos);
  }
  return route;
}

// Reverse segments while that shortens the path (removes crossings).
function twoOpt(from, route) {
  let best = route;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const next = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        if (pathKm(from, next) < pathKm(from, best) - 1e-9) [best, improved] = [next, true];
      }
    }
  }
  return best;
}

export function orderStops(from, stops) {
  return stops.length <= BRUTE_FORCE_MAX ? bruteForce(from, stops) : twoOpt(from, nearestNeighbour(from, stops));
}

// Plans a run from `start` ({lat, lng}) at `startTime`.
// With useWindows, stops are grouped by delivery_window in time order and each group is optimized
// from where the previous one ended. Stops without coordinates go last, without ETA.
// Returns { departure, stops } where each stop gets `eta` (minutes) and `late` (missed its window).
export function planRun({ start, startTime, stops, useWindows }) {
  const located = stops.filter((s) => s.lat != null && s.lng != null);
  const unlocated = stops.filter((s) => s.lat == null || s.lng == null);

  const groups = new Map();
  for (const s of located) {
    const w = useWindows ? parseWindow(s.delivery_window) : null;
    const key = w ? w.start : Infinity;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }

  const ordered = [];
  let pos = start;
  for (const key of [...groups.keys()].sort((a, b) => a - b)) {
    ordered.push(...orderStops(pos, groups.get(key)));
    pos = ordered.at(-1);
  }

  const earliest = (s) => {
    const w = useWindows ? parseWindow(s.delivery_window) : null;
    return w ? w.start - EARLY_MIN : -Infinity;
  };

  // Leave late enough to not wait at the first door.
  const departure = ordered.length ? Math.max(startTime, earliest(ordered[0]) - travelMin(start, ordered[0])) : startTime;

  let time = departure;
  pos = start;
  const planned = ordered.map((s) => {
    const eta = Math.max(time + travelMin(pos, s), earliest(s));
    const w = useWindows ? parseWindow(s.delivery_window) : null;
    time = eta + HANDOVER_MIN;
    pos = s;
    return { ...s, eta, late: Boolean(w && eta > w.end) };
  });

  return { departure, stops: [...planned, ...unlocated.map((s) => ({ ...s, eta: null, late: false }))] };
}
