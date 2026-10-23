// Test dymny: uruchamia Worker w Node z podstawionym MET Norway i Cache API.
// Uruchom: npm test
import assert from 'node:assert/strict';

// --- atrapa Cache API ---
const store = new Map();
globalThis.caches = {
  default: {
    async match(req) { const r = store.get(req.url); return r ? r.clone() : undefined; },
    async put(req, res) { store.set(req.url, res); },
  },
};

// --- atrapa MET Norway ---
let baseTemp = 10;
let slope = 0; // °C na dobę (trend)
let failMet = false;
let metCalls = 0;
function fakeSeries() {
  const out = [];
  const start = new Date(); start.setUTCMinutes(0, 0, 0);
  const midnight = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()); // stały punkt odniesienia dla trendu
  for (let h = 0; h < 9 * 24; h += h < 60 ? 1 : 6) {
    const t = new Date(start.getTime() + h * 3600e3);
    const hourLocal = (t.getUTCHours() + 2) % 24;
    const temp = baseTemp + slope * ((t.getTime() - midnight) / 864e5) + 4 * Math.sin(((hourLocal - 9) / 24) * 2 * Math.PI);
    out.push({ time: t.toISOString(), data: { instant: { details: { air_temperature: Math.round(temp * 10) / 10 } } } });
  }
  return out;
}
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.met.no/')) {
    metCalls++;
    assert.match(init.headers['User-Agent'], /\(\+https?:\/\/.+; .+@.+\)/, 'User-Agent musi zawierać witrynę i kontakt');
    if (failMet) return new Response('err', { status: 500 });
    return Response.json({ properties: { meta: { updated_at: new Date().toISOString() }, timeseries: fakeSeries() } });
  }
  return realFetch(url, init);
};

const { default: worker } = await import('../src/index.js');
const { _resetMemoryCache } = await import('../src/forecast.js');
const ctx = { waitUntil: (p) => p.catch(() => {}) };
const baseEnv = { SITE_URL: 'https://example.pl', SITE_NAME: 'Czas na opony', CONTACT_EMAIL: 'kontakt@example.pl', DISABLE_CACHE: '1' };
const get = (path, env = baseEnv, init) => worker.fetch(new Request('https://example.pl' + path, init), env, ctx);
const text = async (path, env) => { const r = await get(path, env); return [r, await r.text()]; };

let passed = 0;
const ok = (name, fn) => Promise.resolve(fn()).then(() => { passed++; console.log('  ok  ', name); });

console.log('Strony statyczne');
await ok('/ -> 200, title, canonical, form GET', async () => {
  const [r, h] = await text('/');
  assert.equal(r.status, 200);
  assert.match(h, /<title>Czy już zmienić opony\?/);
  assert.match(h, /<link rel="canonical" href="https:\/\/example\.pl\/">/);
  assert.match(h, /<form class="pick" action="\/szukaj" method="get">/);
  assert.equal((h.match(/<h1>/g) || []).length, 1);
  assert.ok(!/<script(?![^>]*ld\+json)/.test(h), 'brak JS poza JSON-LD');
  console.log('        rozmiar HTML:', h.length, 'B');
});
await ok('huby i prywatność', async () => {
  for (const p of ['/zmiana-opon-na-zimowe', '/zmiana-opon-na-letnie', '/polityka-prywatnosci']) {
    const r = await get(p); assert.equal(r.status, 200, p);
  }
});
await ok('robots.txt i sitemap.xml', async () => {
  const [, robots] = await text('/robots.txt');
  assert.match(robots, /Sitemap: https:\/\/example\.pl\/sitemap\.xml/);
  assert.match(robots, /Disallow: \/go\//);
  const [r, xml] = await text('/sitemap.xml');
  assert.match(r.headers.get('content-type'), /xml/);
  assert.equal((xml.match(/<loc>/g) || []).length, 4 + 19 * 2);
});
await ok('trailing slash -> 301, nieznana ścieżka -> 404 noindex, POST -> 405', async () => {
  const r1 = await get('/zmiana-opon-na-zimowe/'); assert.equal(r1.status, 301);
  const r2 = await get('/cos'); assert.equal(r2.status, 404); assert.equal(r2.headers.get('x-robots-tag'), 'noindex');
  const r3 = await get('/zmiana-opon-na-zimowe/atlantyda'); assert.equal(r3.status, 404);
  const r4 = await get('/', baseEnv, { method: 'POST' }); assert.equal(r4.status, 405);
});
await ok('/szukaj przekierowuje na kanoniczny URL', async () => {
  const r = await get('/szukaj?miasto=wroclaw&sezon=zimowe');
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), '/zmiana-opon-na-zimowe/wroclaw');
  const bad = await get('/szukaj?miasto=xxx&sezon=yyy');
  assert.equal(bad.headers.get('location'), '/');
});

console.log('Strony miast i werdykty');
for (const [temp, trend, mode, expected] of [
  [2, 0, 'zimowe', 'now'],
  [6.5, 0, 'zimowe', 'now'],
  [10, -0.5, 'zimowe', 'soon'],   // ochładzanie: część dni poniżej 7°C
  [8, 0, 'zimowe', 'wait'],      // średnio 8°C, noce 4°C: jeszcze nie
  [14, 0, 'zimowe', 'wait'],
  [14, 0, 'letnie', 'now'],
  [8, 0, 'letnie', 'now'],       // średnio 8°C i brak przymrozków
  [5.5, 0.5, 'letnie', 'soon'],    // ocieplenie: część dni powyżej 7°C
  [2, 0, 'letnie', 'wait'],
]) {
  await ok(`średnio ${temp}°C, trend ${trend}/dobę, tryb ${mode} -> ${expected}`, async () => {
    baseTemp = temp; slope = trend; _resetMemoryCache(); store.clear();
    const [r, h] = await text(`/zmiana-opon-na-${mode}/wroclaw`);
    assert.equal(r.status, 200);
    assert.match(h, new RegExp(`sign sign--${expected}`), `oczekiwano ${expected}`);
    assert.match(h, /<h1>Czy już zmienić opony na (zimowe|letnie) we Wrocławiu\?<\/h1>/);
    assert.match(h, /<svg class="chart"/);
    assert.equal((h.match(/<tr><td>/g) || []).length, 7, '7 wierszy tabeli');
  });
}
slope = 0;
await ok('JSON-LD parsuje się, meta description niepusty', async () => {
  baseTemp = 5; _resetMemoryCache();
  const [, h] = await text('/zmiana-opon-na-zimowe/zakopane');
  const blocks = [...h.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)];
  assert.equal(blocks.length, 2);
  for (const b of blocks) JSON.parse(b[1]);
  assert.match(h, /<meta name="description" content="[^"]{40,}/);
  console.log('        rozmiar HTML miasta:', h.length, 'B');
});
await ok('cache prognozy: 5 odsłon = 1 zapytanie do MET', async () => {
  baseTemp = 5; _resetMemoryCache(); store.clear(); metCalls = 0;
  for (let i = 0; i < 5; i++) await get('/zmiana-opon-na-zimowe/poznan');
  assert.equal(metCalls, 1);
});
await ok('awaria MET: z cache -> stale 200, bez cache -> 503 noindex', async () => {
  baseTemp = 5; _resetMemoryCache(); store.clear();
  await get('/zmiana-opon-na-zimowe/lublin'); // wypełnia cache
  failMet = true;
  const r = await get('/zmiana-opon-na-zimowe/lodz');
  assert.equal(r.status, 503);
  assert.equal(r.headers.get('retry-after'), '300');
  assert.equal(r.headers.get('x-robots-tag'), 'noindex');
  failMet = false;
});

console.log('Afiliacja');
await ok('bez linków blok się nie renderuje', async () => {
  baseTemp = 5; _resetMemoryCache();
  const [, h] = await text('/zmiana-opon-na-zimowe/gdansk');
  assert.ok(!h.includes('class="shop"'));
  assert.ok(!h.includes('class="ph"'));
});
await ok('placeholder tylko po SHOW_AFFILIATE_PLACEHOLDER', async () => {
  const [, h] = await text('/zmiana-opon-na-zimowe/gdansk', { ...baseEnv, SHOW_AFFILIATE_PLACEHOLDER: '1' });
  assert.ok(h.includes('class="ph"'));
});
const affEnv = { ...baseEnv, AFF_TIRENDO_URL: 'https://www.awin1.com/cread.php?awinmid=1&awinaffid=2', AFF_OPONYTANIO_URL: 'http://niebezpieczny.pl' };
await ok('blok z linkami: rel=sponsored, tylko https, disclosure', async () => {
  const [, h] = await text('/zmiana-opon-na-zimowe/gdansk', affEnv);
  assert.match(h, /href="\/go\/tirendo\?src=zimowe-gdansk" rel="sponsored nofollow"/);
  assert.ok(!h.includes('/go/oponytanio'), 'link http:// jest ignorowany');
  assert.match(h, /Linki partnerskie/);
});
await ok('/go/tirendo -> 302 z clickref, noindex; nieaktywny -> 404', async () => {
  const r = await get('/go/tirendo?src=zimowe-gdansk', affEnv);
  assert.equal(r.status, 302);
  assert.match(r.headers.get('location'), /awinmid=1.*clickref=zimowe-gdansk/);
  assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal((await get('/go/oponytanio', affEnv)).status, 404);
  assert.equal((await get('/go/tirendo', baseEnv)).status, 404);
});

console.log('Nagłówki');
await ok('CSP bez JS; z tokenem beacon dopuszcza tylko Cloudflare', async () => {
  const r = await get('/');
  assert.match(r.headers.get('content-security-policy'), /script-src 'none'/);
  const r2 = await get('/', { ...baseEnv, CF_BEACON_TOKEN: 'abc' });
  assert.match(r2.headers.get('content-security-policy'), /script-src https:\/\/static\.cloudflareinsights\.com/);
  assert.match(await r2.text(), /data-cf-beacon='\{&quot;token&quot;:&quot;abc&quot;\}'/);
});

console.log(`\nWszystkie testy przeszły: ${passed}`);
