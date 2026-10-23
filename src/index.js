import { CITY_BY_SLUG } from './cities.js';
import { MODES } from './util.js';
import { getDaily } from './forecast.js';
import { findAffiliate } from './config.js';
import * as R from './render.js';

const PAGE_CACHE = 'public, max-age=300, s-maxage=1800'; // strony z prognozą
const STATIC_CACHE = 'public, max-age=600, s-maxage=3600'; // strony statyczne

function securityHeaders(env) {
  const beacon = Boolean(env.CF_BEACON_TOKEN);
  return {
    'content-security-policy': [
      "default-src 'none'",
      "style-src 'unsafe-inline'",
      "img-src 'self' data:",
      `script-src ${beacon ? 'https://static.cloudflareinsights.com' : "'none'"}`,
      `connect-src ${beacon ? 'https://cloudflareinsights.com' : "'none'"}`,
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'geolocation=(), camera=(), microphone=()',
  };
}

function htmlResponse(env, body, { status = 200, cache = PAGE_CACHE, noindex = false, extra = {} } = {}) {
  const headers = {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': cache,
    ...securityHeaders(env),
    ...extra,
  };
  if (noindex) headers['x-robots-tag'] = 'noindex';
  return new Response(body, { status, headers });
}

function textResponse(body, type, cache = 'public, max-age=3600, s-maxage=86400') {
  return new Response(body, { headers: { 'content-type': type, 'cache-control': cache } });
}

function notFound(env) {
  return htmlResponse(
    env,
    R.errorPage(env, { title: 'Nie znaleziono strony', message: 'Taka strona nie istnieje. Wybierz miasto na stronie głównej.' }),
    { status: 404, cache: 'public, max-age=60', noindex: true },
  );
}

/** Cache całych stron HTML (Cache API; działa na własnej domenie, na workers.dev jest no-op). */
async function withPageCache(request, env, ctx, build) {
  const useCache = typeof caches !== 'undefined' && !env.DISABLE_CACHE;
  const url = new URL(request.url);
  const key = new Request(url.origin + url.pathname, { method: 'GET' });
  if (useCache) {
    const hit = await caches.default.match(key);
    if (hit) return hit;
  }
  const res = await build();
  if (useCache && res.status === 200) ctx.waitUntil(caches.default.put(key, res.clone()));
  return res;
}

async function cityRoute(request, env, ctx, mode, slug) {
  const city = CITY_BY_SLUG.get(slug);
  if (!city) return notFound(env);
  return withPageCache(request, env, ctx, async () => {
    try {
      const daily = await getDaily(city, env, ctx);
      const { html } = R.cityPage(env, city, mode, daily);
      return htmlResponse(env, html);
    } catch (err) {
      console.error('forecast_failed', city.slug, String(err && err.message));
      return htmlResponse(
        env,
        R.errorPage(env, { title: 'Prognoza chwilowo niedostępna', message: 'Nie udało się pobrać prognozy. Spróbuj ponownie za kilka minut.' }),
        { status: 503, cache: 'no-store', noindex: true, extra: { 'retry-after': '300' } },
      );
    }
  });
}

function goRoute(request, env, id) {
  const aff = findAffiliate(env, id);
  if (!aff) return notFound(env);
  const url = new URL(env[aff.envKey]);
  const src = (new URL(request.url).searchParams.get('src') || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 50);
  // Awin: parametr clickref pozwala zobaczyć w panelu, która strona sprzedała.
  if (src && url.hostname.endsWith('awin1.com')) url.searchParams.set('clickref', src);
  console.log('affiliate_click', JSON.stringify({ id: aff.id, src }));
  return new Response(null, {
    status: 302,
    headers: { location: url.toString(), 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store', 'referrer-policy': 'origin' },
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
    }
    const url = new URL(request.url);
    const path = url.pathname;

    // jedna wersja URL: bez końcowego ukośnika
    if (path.length > 1 && path.endsWith('/')) {
      url.pathname = path.replace(/\/+$/, '');
      return Response.redirect(url.toString(), 301);
    }

    if (path === '/') return withPageCache(request, env, ctx, async () => htmlResponse(env, R.homePage(env), { cache: STATIC_CACHE }));
    if (path === '/robots.txt') return textResponse(R.robotsTxt(env), 'text/plain; charset=utf-8');
    if (path === '/sitemap.xml') return textResponse(R.sitemapXml(env), 'application/xml; charset=utf-8');
    if (path === '/polityka-prywatnosci') {
      return withPageCache(request, env, ctx, async () => htmlResponse(env, R.privacyPage(env), { cache: STATIC_CACHE }));
    }

    if (path === '/szukaj') {
      const slug = url.searchParams.get('miasto') || '';
      const mode = url.searchParams.get('sezon') || '';
      const target = CITY_BY_SLUG.has(slug) && MODES[mode] ? `${MODES[mode].path}/${slug}` : '/';
      return new Response(null, { status: 302, headers: { location: target, 'x-robots-tag': 'noindex', 'cache-control': 'no-store' } });
    }

    if (path.startsWith('/go/')) return goRoute(request, env, path.slice(4));

    for (const mode of Object.keys(MODES)) {
      const base = MODES[mode].path;
      if (path === base) {
        return withPageCache(request, env, ctx, async () => htmlResponse(env, R.hubPage(env, mode), { cache: STATIC_CACHE }));
      }
      if (path.startsWith(base + '/')) return cityRoute(request, env, ctx, mode, path.slice(base.length + 1));
    }
    return notFound(env);
  },
};
