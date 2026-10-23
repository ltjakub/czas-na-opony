import { esc, fmtTemp, dayLabel, stamp, MODES, defaultMode, inSeason } from './util.js';
import { CITIES } from './cities.js';
import { activeAffiliates } from './config.js';
import { evaluate, THRESHOLD } from './verdict.js';

export function siteOf(env) {
  return {
    url: String(env.SITE_URL || 'http://localhost:8787').replace(/\/+$/, ''),
    name: env.SITE_NAME || 'Czas na opony',
    email: env.CONTACT_EMAIL || '',
    beacon: env.CF_BEACON_TOKEN || '',
  };
}

// Styl wstawiony inline: zero dodatkowych requestów, systemowe fonty (szybki LCP).
// Motyw: znaki drogowe. Werdykt jest "znakiem": niebieski (nakaz), żółty (ostrzeżenie), biały (informacja).
const CSS = `
:root{color-scheme:light dark;--paper:#f1f5f7;--surface:#fff;--ink:#10222e;--mute:#44596a;--rule:#cfdae1;--sign:#0b5394;--link:#0b5394;--warn:#f5b700;--cold:#2f6db5;--warm:#c97a10}
@media (prefers-color-scheme:dark){:root{--paper:#0d1820;--surface:#13232e;--ink:#e6eef3;--mute:#9db1be;--rule:#25394a;--sign:#1b6fbf;--link:#7db7f0;--cold:#5aa0e8;--warm:#f0b04a}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:1.0625rem/1.6 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
.wrap{max-width:44rem;margin:0 auto;padding:0 1.1rem}
a{color:var(--link)}
:focus-visible{outline:3px solid var(--warn);outline-offset:2px}
.skip{position:absolute;left:-999px;top:0}.skip:focus{left:.5rem;top:.5rem;background:var(--warn);color:#000;padding:.4rem .7rem;z-index:5}
.top{padding:.85rem 0;border-bottom:1px solid var(--rule)}
.brand{font-weight:800;letter-spacing:-.01em;color:var(--ink);text-decoration:none}
.crumbs{font-size:.9rem;color:var(--mute);margin:1rem 0 0}
.crumbs ol{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:.1rem .5rem}
.crumbs li+li::before{content:"/";margin-right:.5rem}
h1{font-size:clamp(1.6rem,5.2vw,2.35rem);line-height:1.12;letter-spacing:-.02em;font-weight:800;margin:1.1rem 0 .3rem}
h2{font-size:1.3rem;line-height:1.25;margin:2.2rem 0 .4rem;font-weight:750}
h3{font-size:1.05rem;margin:1.2rem 0 .1rem}
p{margin:.55rem 0;max-width:38rem}
.sign{margin:1.3rem 0 1rem;padding:1.1rem 1.3rem 1.2rem;border-radius:1.1rem;max-width:34rem}
.sign p{margin:.35rem 0 0}
.sign .t{margin:0;font-size:clamp(1.45rem,5.5vw,2rem);line-height:1.12;font-weight:800;letter-spacing:-.015em}
.sign--now{background:var(--sign);color:#fff;box-shadow:inset 0 0 0 .25rem var(--sign),inset 0 0 0 .4rem rgba(255,255,255,.92)}
.sign--soon{background:var(--warn);color:#1a1400;box-shadow:inset 0 0 0 .25rem var(--warn),inset 0 0 0 .4rem #1a1400}
.sign--wait{background:var(--surface);color:var(--ink);box-shadow:inset 0 0 0 .2rem var(--sign)}
.note{font-size:.95rem;color:var(--mute);border-left:.3rem solid var(--rule);padding-left:.8rem}
form.pick{display:flex;flex-wrap:wrap;gap:.6rem;margin:1rem 0}
select,button{font:inherit;padding:.65rem .8rem;border-radius:.55rem;border:2px solid var(--ink);background:var(--surface);color:var(--ink)}
button{background:var(--sign);border-color:var(--sign);color:#fff;font-weight:700;cursor:pointer}
.chart{display:block;width:100%;max-width:30rem;height:auto;margin:.6rem 0}
.chart text{fill:var(--mute);font-size:11px}
.chart .v{fill:var(--ink);font-weight:700}
.chart .grid{stroke:var(--rule);stroke-width:1}
.chart .thr{stroke:var(--ink);stroke-width:1.5;stroke-dasharray:5 4}
.chart .rng{stroke-width:9;stroke-linecap:round;opacity:.35}
.chart .c{stroke:var(--cold);fill:var(--cold)}.chart .w{stroke:var(--warm);fill:var(--warm)}
.scroll{overflow-x:auto}
.tbl{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:.95rem}
.tbl caption{text-align:left;color:var(--mute);padding-bottom:.4rem}
.tbl th,.tbl td{padding:.45rem .5rem;text-align:right;border-bottom:1px solid var(--rule)}
.tbl th:first-child,.tbl td:first-child{text-align:left;white-space:nowrap}
.cities{columns:2 11rem;list-style:none;padding:0;margin:.4rem 0}
.cities li{break-inside:avoid;padding:.12rem 0}
.shop{margin:2rem 0;padding:1rem 1.1rem;border-left:.35rem solid var(--warn);background:var(--surface);max-width:38rem}
.shop h2{margin-top:0;font-size:1.15rem}
.shop ul{margin:.4rem 0;padding-left:1.2rem}
.fine{font-size:.85rem;color:var(--mute)}
.ph{border:2px dashed var(--mute);padding:1rem;margin:2rem 0;color:var(--mute)}
footer{margin-top:3rem;padding:1.4rem 0 2.5rem;border-top:1px solid var(--rule);font-size:.9rem;color:var(--mute)}
footer p{max-width:none}
`;

const FAVICON =
  'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 32 32%27%3E%3Ccircle cx=%2716%27 cy=%2716%27 r=%2713%27 fill=%27%23111%27/%3E%3Ccircle cx=%2716%27 cy=%2716%27 r=%275%27 fill=%27%23f5b700%27/%3E%3C/svg%3E';

function layout(env, { title, description, path, body, jsonld = [], noindex = false }) {
  const s = siteOf(env);
  const canonical = s.url + path;
  const robots = noindex ? 'noindex,nofollow' : 'index,follow,max-snippet:-1,max-image-preview:large';
  const ld = jsonld.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('');
  const beacon = s.beacon
    ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${esc(JSON.stringify({ token: s.beacon }))}'></script>`
    : '';
  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="${robots}">
<meta name="theme-color" content="#0b5394">
<meta property="og:type" content="website"><meta property="og:locale" content="pl_PL">
<meta property="og:site_name" content="${esc(s.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="${FAVICON}">
<style>${CSS}</style>${ld}</head>
<body><a class="skip" href="#main">Przejdź do treści</a>
<header class="top"><div class="wrap"><a class="brand" href="/">${esc(s.name)}</a></div></header>
<main id="main" class="wrap">${body}</main>
<footer><div class="wrap">
<p>Prognozy pogody: MET Norway (api.met.no), licencja CC BY 4.0. Średnie dobowe liczymy samodzielnie z prognozy godzinowej i traktujemy orientacyjnie.</p>
<p>Serwis ma charakter informacyjny i nie zastępuje oceny kierowcy ani zaleceń producenta opon.</p>
<p><a href="/polityka-prywatnosci">Polityka prywatności</a></p>
</div></footer>${beacon}</body></html>`;
}

function crumbs(items) {
  const li = items
    .map((it, i) => (i === items.length - 1 ? `<li aria-current="page">${esc(it.name)}</li>` : `<li><a href="${esc(it.href)}">${esc(it.name)}</a></li>`))
    .join('');
  return `<nav class="crumbs" aria-label="Okruszki"><ol>${li}</ol></nav>`;
}

function breadcrumbLd(env, items) {
  const s = siteOf(env);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: s.url + it.href,
    })),
  };
}

function cityLinks(mode, exceptSlug = null) {
  const m = MODES[mode];
  return `<ul class="cities">${CITIES.filter((c) => c.slug !== exceptSlug)
    .map((c) => `<li><a href="${m.path}/${c.slug}">${esc(c.name)}</a></li>`)
    .join('')}</ul>`;
}

// --- Blok afiliacyjny -------------------------------------------------------
function affiliateBlock(env, mode, src) {
  const m = MODES[mode];
  const list = activeAffiliates(env);
  if (!list.length) {
    return env.SHOW_AFFILIATE_PLACEHOLDER
      ? `<div class="ph">Miejsce na linki partnerskie. Ustaw zmienne AFF_*_URL (patrz config.js), a blok pojawi się tutaj.</div>`
      : '';
  }
  const items = list
    .map((a) => `<li><a href="/go/${a.id}?src=${encodeURIComponent(src)}" rel="sponsored nofollow">${esc(a.name)}: opony ${m.gen}</a></li>`)
    .join('');
  return `<aside class="shop" aria-labelledby="shop-h"><h2 id="shop-h">Potrzebujesz nowych opon ${m.gen}?</h2>
<p>Jeśli bieżnik jest już niski albo opony są stare, ceny sprawdzisz u sprzedawców online.</p>
<ul>${items}</ul>
<p class="fine">Linki partnerskie: jeśli kupisz po kliknięciu, serwis może otrzymać prowizję. Cena dla Ciebie się nie zmienia.</p></aside>`;
}

// --- Wykres SVG (bez JS) ----------------------------------------------------
function chartSvg(days, cityName) {
  const W = 360, H = 240, L = 34, R = 8, T = 26, B = 32;
  const pw = W - L - R, ph = H - T - B;
  const temps = days.flatMap((d) => [d.min, d.max]);
  const lo = Math.min(0, Math.floor(Math.min(...temps) / 5) * 5);
  const hi = Math.max(15, Math.ceil(Math.max(...temps) / 5) * 5);
  const y = (t) => (T + ((hi - t) / (hi - lo)) * ph).toFixed(1);
  const slot = pw / days.length;
  let g = '';
  for (let v = lo; v <= hi; v += 5) {
    g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 5}" y="${(Number(y(v)) + 4).toFixed(1)}" text-anchor="end">${v}</text>`;
  }
  g += `<line class="thr" x1="${L}" x2="${W - R}" y1="${y(THRESHOLD)}" y2="${y(THRESHOLD)}"/><text class="v" x="${L - 5}" y="${(Number(y(THRESHOLD)) + 4).toFixed(1)}" text-anchor="end">${THRESHOLD}</text>`;
  days.forEach((d, i) => {
    const cx = (L + slot * (i + 0.5)).toFixed(1);
    const cls = d.mean < THRESHOLD ? 'c' : 'w';
    const lab = dayLabel(d.date);
    g += `<line class="rng ${cls}" x1="${cx}" x2="${cx}" y1="${y(d.max)}" y2="${y(d.min)}"/>`;
    g += `<circle class="${cls}" cx="${cx}" cy="${y(d.mean)}" r="5.5"/>`;
    g += `<text class="v" x="${cx}" y="${(Number(y(d.max)) - 9).toFixed(1)}" text-anchor="middle">${fmtTemp(d.mean)}</text>`;
    g += `<text x="${cx}" y="${H - 16}" text-anchor="middle">${lab.wd}</text><text x="${cx}" y="${H - 4}" text-anchor="middle">${lab.date}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="ct cd"><title id="ct">Średnia dobowa temperatura, ${esc(cityName)}</title><desc id="cd">Kropka to średnia doby, pionowa kreska to zakres od najniższej do najwyższej temperatury. Linia przerywana oznacza ${THRESHOLD} stopni.</desc>${g}</svg>`;
}

function dataTable(days, cityName) {
  const rows = days
    .map((d) => {
      const l = dayLabel(d.date);
      return `<tr><td>${l.wd} ${l.date}</td><td>${fmtTemp(d.mean)}°C</td><td>${fmtTemp(d.min)}°C</td><td>${fmtTemp(d.max)}°C</td><td>${d.mean < THRESHOLD ? 'poniżej' : 'co najmniej'} ${THRESHOLD}°C</td></tr>`;
    })
    .join('');
  return `<div class="scroll"><table class="tbl"><caption>Prognoza temperatury, ${esc(cityName)}</caption><thead><tr><th scope="col">Dzień</th><th scope="col">Średnia</th><th scope="col">Najniższa</th><th scope="col">Najwyższa</th><th scope="col">Względem progu</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function faq(mode) {
  const common = `<h3>Jak liczymy prognozę?</h3><p>Średnią dobową wyliczamy z godzinowych i kilkugodzinnych prognoz temperatury MET Norway dla współrzędnych miasta. Dalsze dni są mniej pewne, więc wynik jest wskazówką, nie gwarancją.</p>`;
  const rule = `<h3>Przy jakiej temperaturze zmieniać opony?</h3><p>Najczęściej podawana reguła to ${THRESHOLD}°C średniej dobowej. Zaleca ją m.in. Polski Związek Przemysłu Oponiarskiego. To średnia z całej doby, więc poranki i noce bywają zimniejsze, niż pokazuje południowy termometr.</p>`;
  const law = `<h3>Czy w Polsce trzeba zmieniać opony w konkretnym terminie?</h3><p>Nie, polskie przepisy nie wyznaczają terminu wymiany. Decyzja zależy od pogody i od tego, gdzie oraz jak jeździsz.</p>`;
  const extra =
    mode === 'zimowe'
      ? `<h3>Co sprawdzić poza temperaturą?</h3><p>Głębokość bieżnika (prawo dopuszcza 1,6 mm, a dla zimówek zaleca się co najmniej 4 mm) oraz wiek opon: pierwsze dwie cyfry kodu DOT to tydzień, a ostatnie dwie to rok produkcji.</p>`
      : `<h3>Czy zimówki można zostawić na lato?</h3><p>Można, ale w ciepłe dni ścierają się szybciej i gorzej trzymają, więc wymianę warto zrobić, gdy temperatury się ustabilizują.</p>`;
  return `<section aria-labelledby="faq-h"><h2 id="faq-h">Najczęstsze pytania</h2>${rule}${law}${extra}${common}</section>`;
}

function offSeasonNote(mode) {
  if (inSeason(mode)) return '';
  const m = MODES[mode];
  const when = mode === 'zimowe' ? 'od września do grudnia' : 'od lutego do maja';
  return `<p class="note">Poza sezonem: wymiana ${m.label} ma zwykle sens ${when}. Poniższa prognoza jest mimo to aktualna.</p>`;
}

// --- Strony -----------------------------------------------------------------
export function homePage(env) {
  const mode = defaultMode();
  const m = MODES[mode];
  const s = siteOf(env);
  const opts = CITIES.map((c) => `<option value="${c.slug}">${esc(c.name)}</option>`).join('');
  const title = `Czy już zmienić opony? Prognoza dla ${CITIES.length} polskich miast`;
  const description = `Sprawdź, czy już czas na zmianę opon ${m.label}. Prognoza średniej dobowej temperatury na 7 dni i reguła 7°C dla Twojego miasta.`;
  const body = `<h1>Czy już zmienić opony?</h1>
<p>Wybierz miasto, a pokażemy, czy prognoza na najbliższe 7 dni pasuje do reguły 7°C i czy warto umówić wymianę opon.</p>
<form class="pick" action="/szukaj" method="get">
<label class="fine" for="miasto" style="width:100%">Miasto i rodzaj wymiany</label>
<select id="miasto" name="miasto" required>${opts}</select>
<select id="sezon" name="sezon" aria-label="Rodzaj wymiany"><option value="zimowe"${mode === 'zimowe' ? ' selected' : ''}>Na zimowe</option><option value="letnie"${mode === 'letnie' ? ' selected' : ''}>Na letnie</option></select>
<button type="submit">Sprawdź prognozę</button></form>
<h2>Wymiana na zimowe</h2>${cityLinks('zimowe')}
<h2>Wymiana na letnie</h2>${cityLinks('letnie')}
${affiliateBlock(env, mode, 'home')}
<h2>Jak to działa</h2>
<p>Pobieramy prognozę godzinową dla miasta, liczymy średnią dobową na 7 kolejnych dni i porównujemy ją z progiem ${THRESHOLD}°C. Do tego patrzymy na przymrozki w nocy, bo to one najczęściej zaskakują kierowców.</p>
${faq(mode)}`;
  return layout(env, {
    title, description, path: '/', body,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: s.name, url: s.url + '/', inLanguage: 'pl' }],
  });
}

export function hubPage(env, mode) {
  const m = MODES[mode];
  const crumbItems = [{ name: 'Strona główna', href: '/' }, { name: `Zmiana opon ${m.label}`, href: m.path }];
  const when =
    mode === 'zimowe'
      ? 'W Polsce zimowe opony zakłada się zwykle w listopadzie, ale lepiej kierować się prognozą niż kalendarzem.'
      : 'W Polsce letnie opony zakłada się zwykle w marcu lub kwietniu, ale lepiej kierować się prognozą niż kalendarzem.';
  const body = `${crumbs(crumbItems)}<h1>Kiedy zmienić opony ${m.label}?</h1>
<p>${when} Wybierz miasto, żeby zobaczyć prognozę średniej dobowej temperatury na 7 dni.</p>
${offSeasonNote(mode)}
<h2>Wybierz miasto</h2>${cityLinks(mode)}
${affiliateBlock(env, mode, `hub-${mode}`)}
<p>Coraz więcej kierowców wybiera opony całoroczne, które nie wymagają sezonowej wymiany. Jeśli jeździsz na zimowych albo letnich, ta strona podpowiada, kiedy działać.</p>
<p><a href="${MODES[m.other].path}">Szukasz wymiany ${MODES[m.other].label}?</a></p>
${faq(mode)}`;
  return layout(env, {
    title: `Kiedy zmienić opony ${m.label}? Prognoza dla ${CITIES.length} miast`,
    description: `Kiedy zmienić opony ${m.label}? Sprawdź prognozę średniej dobowej temperatury i regułę 7°C dla ${CITIES.length} polskich miast.`,
    path: m.path, body, jsonld: [breadcrumbLd(env, crumbItems)],
  });
}

export function cityPage(env, city, mode, daily) {
  const m = MODES[mode];
  const ev = evaluate(daily.days, mode);
  const path = `${m.path}/${city.slug}`;
  const crumbItems = [
    { name: 'Strona główna', href: '/' },
    { name: `Zmiana opon ${m.label}`, href: m.path },
    { name: city.name, href: path },
  ];
  const s = siteOf(env);
  const staleNote = daily.stale ? `<p class="note">Źródło prognozy chwilowo nie odpowiada, pokazujemy ostatnie dostępne dane.</p>` : '';
  const body = `${crumbs(crumbItems)}<h1>Czy już zmienić opony ${m.label} ${esc(city.loc)}?</h1>
<div class="sign sign--${ev.status}"><p class="t">${esc(ev.headline)}</p><p>${esc(ev.lead)}</p><p>${esc(ev.next)}</p></div>
${offSeasonNote(mode)}${staleNote}
<h2>Prognoza na 7 dni, ${esc(city.name)}</h2>
${chartSvg(daily.days.slice(0, 7), city.name)}
${dataTable(daily.days.slice(0, 7), city.name)}
<p class="fine">Dane z ${esc(stamp(daily.fetchedAt))}, odświeżane najwyżej raz na godzinę. Dalsze dni są mniej pewne.</p>
${affiliateBlock(env, mode, `${mode}-${city.slug}`)}
<p><a href="${MODES[m.other].path}/${city.slug}">Zobacz też wymianę ${MODES[m.other].label} ${esc(city.loc)}</a></p>
${faq(mode)}
<h2>Inne miasta</h2>${cityLinks(mode, city.slug)}`;
  return {
    html: layout(env, {
      title: `Czy już zmienić opony ${m.label} ${city.loc}? Prognoza 7 dni`,
      description: `${ev.headline} (${city.name}). ${ev.lead}`.slice(0, 300),
      path, body,
      jsonld: [
        breadcrumbLd(env, crumbItems),
        { '@context': 'https://schema.org', '@type': 'WebPage', name: `Czy już zmienić opony ${m.label} ${city.loc}?`, url: s.url + path, inLanguage: 'pl', dateModified: new Date(daily.fetchedAt).toISOString() },
      ],
    }),
    status: ev.status,
  };
}

export function privacyPage(env) {
  const s = siteOf(env);
  const body = `${crumbs([{ name: 'Strona główna', href: '/' }, { name: 'Polityka prywatności', href: '/polityka-prywatnosci' }])}<h1>Polityka prywatności</h1>
<p>Serwis nie wymaga konta i nie zbiera danych osobowych. Nie ustawiamy własnych plików cookies.</p>
<p>Pomiar odwiedzin: jeśli włączona jest usługa Cloudflare Web Analytics, działa ona bez plików cookies i bez śledzenia użytkowników między stronami.</p>
<p>Linki partnerskie: po kliknięciu w ofertę sklepu sieć partnerska (np. Awin) lub sklep mogą zapisać własne pliki cookies po swojej stronie, żeby przypisać zakup. Wtedy obowiązują ich polityki prywatności.</p>
<p>Prognozy pochodzą z serwisu MET Norway. Twoje miasto wybierasz z listy, więc nie przetwarzamy Twojej lokalizacji.</p>
${s.email ? `<p>Kontakt: ${esc(s.email)}</p>` : ''}
<p class="fine">Tekst jest szablonem. Dostosuj go do swojej działalności i skonsultuj z prawnikiem.</p>`;
  return layout(env, {
    title: 'Polityka prywatności', description: `Polityka prywatności serwisu ${s.name}.`,
    path: '/polityka-prywatnosci', body,
  });
}

export function errorPage(env, { status, title, message }) {
  const body = `<h1>${esc(title)}</h1><p>${esc(message)}</p><p><a href="/">Wróć na stronę główną</a></p>`;
  return layout(env, { title, description: message, path: '/', body, noindex: true });
}

export function sitemapXml(env) {
  const s = siteOf(env);
  const urls = ['/', MODES.zimowe.path, MODES.letnie.path, '/polityka-prywatnosci'];
  for (const mode of ['zimowe', 'letnie']) for (const c of CITIES) urls.push(`${MODES[mode].path}/${c.slug}`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `<url><loc>${esc(s.url + u)}</loc></url>`)
    .join('\n')}\n</urlset>\n`;
}

export function robotsTxt(env) {
  const s = siteOf(env);
  return `User-agent: *\nAllow: /\nDisallow: /szukaj\nDisallow: /go/\n\nSitemap: ${s.url}/sitemap.xml\n`;
}
