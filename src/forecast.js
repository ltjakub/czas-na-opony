import { dayKey } from './util.js';

// Źródło: MET Norway Locationforecast 2.0 (licencja CC BY 4.0 / NLOD, bez klucza API).
// Warunki: identyfikujący User-Agent z kontaktem, atrybucja, respektowanie cache.
// https://api.met.no/doc/TermsOfService
const FRESH_MS = 60 * 60 * 1000; // prognoza odświeżana najwyżej raz na godzinę na miasto
const STALE_MS = 6 * 60 * 60 * 1000; // przy awarii MET pokazujemy dane do 6 h wstecz
const mem = new Map(); // cache w pamięci isolate'a (działa wszędzie, także na workers.dev)

function userAgent(env) {
  const name = (env.SITE_NAME || 'CzasNaOpony').replace(/[^\x20-\x7E]/g, '').trim() || 'CzasNaOpony';
  const site = env.SITE_URL || 'http://localhost';
  const mail = env.CONTACT_EMAIL || 'kontakt@example.com';
  return `${name.replace(/\s+/g, '')}/1.0 (+${site}; ${mail})`;
}

async function readCache(key) {
  if (typeof caches === 'undefined') return null;
  try {
    const hit = await caches.default.match(new Request(key));
    return hit ? await hit.json() : null;
  } catch {
    return null;
  }
}

async function writeCache(key, data) {
  if (typeof caches === 'undefined') return;
  try {
    await caches.default.put(
      new Request(key),
      new Response(JSON.stringify(data), {
        headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=21600' },
      }),
    );
  } catch {
    /* cache jest dodatkiem, nie wymogiem */
  }
}

/** Z godzinowych punktów MET robi dobowe: średnia, min, max (doby wg czasu Europe/Warsaw). */
export function aggregate(timeseries, now = new Date()) {
  const today = dayKey(now);
  const byDay = new Map();
  for (const p of timeseries) {
    const t = p?.data?.instant?.details?.air_temperature;
    if (typeof t !== 'number') continue;
    const key = dayKey(new Date(p.time));
    if (key <= today) continue; // dzisiejsza doba jest niepełna, pomijamy
    let d = byDay.get(key);
    if (!d) byDay.set(key, (d = { date: key, sum: 0, n: 0, min: t, max: t }));
    d.sum += t;
    d.n += 1;
    if (t < d.min) d.min = t;
    if (t > d.max) d.max = t;
  }
  const r1 = (x) => Math.round(x * 10) / 10;
  return [...byDay.values()]
    .filter((d) => d.n >= 3)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((d) => ({ date: d.date, mean: r1(d.sum / d.n), min: r1(d.min), max: r1(d.max), points: d.n }));
}

async function fetchMet(city, env) {
  const base = env.MET_BASE || 'https://api.met.no';
  const qs = `lat=${city.lat.toFixed(4)}&lon=${city.lon.toFixed(4)}${city.alt ? `&altitude=${city.alt}` : ''}`;
  const res = await fetch(`${base}/weatherapi/locationforecast/2.0/compact?${qs}`, {
    headers: { 'User-Agent': userAgent(env), Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`MET HTTP ${res.status}`);
  const json = await res.json();
  const days = aggregate(json?.properties?.timeseries || []);
  if (days.length < 6) throw new Error(`MET: za mało dni (${days.length})`);
  return { slug: city.slug, days, fetchedAt: Date.now(), updatedAt: json?.properties?.meta?.updated_at || null };
}

/**
 * Zwraca dobowe prognozy dla miasta. Kolejność: pamięć -> Cache API -> MET.
 * Uwaga: Cache API działa tylko na własnej domenie (nie na *.workers.dev), stąd cache w pamięci.
 */
export async function getDaily(city, env, ctx) {
  const now = Date.now();
  const key = `https://cache.internal/forecast/${city.slug}`;
  let cached = mem.get(city.slug) || null;
  if (!cached) {
    cached = await readCache(key);
    if (cached) mem.set(city.slug, cached);
  }
  if (cached && now - cached.fetchedAt < FRESH_MS) return cached;
  try {
    const fresh = await fetchMet(city, env);
    mem.set(city.slug, fresh);
    ctx.waitUntil(writeCache(key, fresh));
    return fresh;
  } catch (err) {
    if (cached && now - cached.fetchedAt < STALE_MS) return { ...cached, stale: true };
    throw err;
  }
}

export function _resetMemoryCache() {
  mem.clear();
}
